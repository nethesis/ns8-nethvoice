/**
 * HTTP requests to the devices of the streaming sources (snapshot URLs of
 * image sources and URL gates), with optional HTTP Basic or Digest
 * authentication.
 *
 * Every connection is opened by this module, before anything is sent:
 *
 * - the host name is resolved and the connection is refused when the device
 *   address is a loopback, link-local or unspecified one (the devices live on
 *   the LAN: the PBX itself and the cloud metadata services are never a
 *   device, even if the DNS changes after the source has been saved)
 * - with "tlsSkipVerify" and a pinned "tlsFingerprint" (SHA-256 of the device
 *   certificate, read by FreePBX when the source is saved) the certificate of
 *   the device must match the fingerprint: the request (credentials included)
 *   is written only after the check
 *
 * Redirects are never followed and the response body is limited.
 *
 * @module streaming
 * @submodule device_http
 */
var dns = require('dns');
var net = require('net');
var tls = require('tls');
var http = require('http');
var https = require('https');
var crypto = require('crypto');
var request = require('request');

/**
 * The default maximum size in bytes of a response body.
 *
 * @property DEFAULT_MAX_BYTES
 * @type number
 * @default 65536
 */
var DEFAULT_MAX_BYTES = 65536;

/**
 * Error code of a device address that is not allowed (loopback, link-local,
 * unspecified).
 *
 * @property ERR_ADDRESS_NOT_ALLOWED
 * @type string
 */
var ERR_ADDRESS_NOT_ALLOWED = 'DEVICE_ADDRESS_NOT_ALLOWED';

/**
 * Error code of a device certificate that does not match the pinned one.
 *
 * @property ERR_FINGERPRINT_MISMATCH
 * @type string
 */
var ERR_FINGERPRINT_MISMATCH = 'TLS_FINGERPRINT_MISMATCH';

/**
 * Error code of a response body bigger than the limit.
 *
 * @property ERR_RESPONSE_TOO_LARGE
 * @type string
 */
var ERR_RESPONSE_TOO_LARGE = 'RESPONSE_TOO_LARGE';

/**
 * Returns a SHA-256 fingerprint as 64 lowercase hex digits (colons removed),
 * or null if it is not a valid one.
 *
 * @method normalizeFingerprint
 * @param {string} fingerprint The fingerprint, e.g. "AB:CD:..." or "abcd..."
 * @return {string} The normalized fingerprint or null.
 */
function normalizeFingerprint(fingerprint) {
  if (typeof fingerprint !== 'string') {
    return null;
  }
  var f = fingerprint.trim().replace(/:/g, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(f) ? f : null;
}

/**
 * Returns true if the IP address can never be a device: loopback
 * (127.0.0.0/8, ::1), link-local (169.254.0.0/16, fe80::/10), unspecified
 * (0.0.0.0/8, ::), also as IPv4-mapped IPv6 addresses. Private LAN ranges are
 * allowed.
 *
 * @method isBlockedAddress
 * @param {string} address The IP address
 * @return {boolean} True if the address is not allowed.
 */
function isBlockedAddress(address) {
  if (typeof address !== 'string') {
    return true;
  }
  var a = address.toLowerCase();
  var zone = a.indexOf('%');
  if (zone >= 0) {
    a = a.substring(0, zone);
  }
  var mapped = /^(?:0{0,4}:){0,4}:?(?:0{0,4}:)?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) {
    a = mapped[1];
  }
  var family = net.isIP(a);
  if (family === 4) {
    var o = a.split('.').map(function(x) { return parseInt(x, 10); });
    return o[0] === 127 || o[0] === 0 || (o[0] === 169 && o[1] === 254);
  }
  if (family === 6) {
    // expand to 8 groups to compare the prefixes
    var halves = a.split('::');
    var head = halves[0] ? halves[0].split(':') : [];
    var tail = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
    if (tail.length && tail[tail.length - 1].indexOf('.') >= 0) {
      // embedded IPv4 in the last 32 bits
      var v4 = tail.pop().split('.').map(function(x) { return parseInt(x, 10); });
      tail.push(((v4[0] << 8) | v4[1]).toString(16), ((v4[2] << 8) | v4[3]).toString(16));
    }
    var groups = head.concat(new Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), tail)
      .map(function(g) { return parseInt(g || '0', 16); });
    var allZero = groups.slice(0, 7).every(function(g) { return g === 0; });
    if (allZero && (groups[7] === 0 || groups[7] === 1)) {
      return true; // "::" and "::1"
    }
    if (groups.slice(0, 5).every(function(g) { return g === 0; }) && groups[5] === 0xffff) {
      // IPv4-mapped address in hex form, e.g. "::ffff:7f00:1"
      return isBlockedAddress([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.'));
    }
    return (groups[0] & 0xffc0) === 0xfe80;
  }
  return true;
}

/**
 * Resolves the host name of a device and returns the first allowed address.
 * The connection is refused when any of the addresses of the name is not
 * allowed, so that a name cannot alternate between a LAN and a blocked
 * address.
 *
 * @method resolveDevice
 * @param {string} host The host name or IP address
 * @param {function} cb The callback function (err, address, family)
 * @private
 */
function resolveDevice(host, cb) {
  var h = typeof host === 'string' ? host.replace(/^\[|\]$/g, '') : '';
  var notAllowed = function() {
    var e = new Error('the device address ' + h + ' is not allowed (loopback, link-local or unspecified)');
    e.code = ERR_ADDRESS_NOT_ALLOWED;
    return e;
  };
  if (h === '' || h.toLowerCase() === 'localhost' || /\.localhost\.?$/i.test(h)) {
    cb(notAllowed());
    return;
  }
  if (net.isIP(h)) {
    if (isBlockedAddress(h)) {
      cb(notAllowed());
    } else {
      cb(null, h, net.isIP(h));
    }
    return;
  }
  dns.lookup(h, { all: true }, function(err, addresses) {
    if (err) {
      cb(err);
      return;
    }
    if (!addresses || addresses.length === 0) {
      var e = new Error('no address for ' + h);
      e.code = 'ENOTFOUND';
      cb(e);
      return;
    }
    var i;
    for (i = 0; i < addresses.length; i++) {
      if (isBlockedAddress(addresses[i].address)) {
        cb(notAllowed());
        return;
      }
    }
    cb(null, addresses[0].address, addresses[0].family);
  });
}

/**
 * Returns a new agent (one per request, never pooled) whose connections are
 * opened by _resolveDevice_ and, for https, verified as described in the
 * module documentation. The socket is handed to the HTTP client only when
 * the checks passed, so nothing is written to a refused device.
 *
 * @method createDeviceAgent
 * @param {string} protocol "http:" or "https:"
 * @param {object} tlsPolicy { skipVerify: boolean, fingerprint: normalized fingerprint or null }
 * @return {object} The agent.
 * @private
 */
function createDeviceAgent(protocol, tlsPolicy) {
  var isHttps = protocol === 'https:';
  var agent = isHttps ? new https.Agent({ keepAlive: false, maxCachedSessions: 0 }) : new http.Agent({ keepAlive: false });
  agent.createConnection = function(options, oncreate) {
    var host = options.hostname || options.host;
    resolveDevice(host, function(err, address) {
      if (err) {
        oncreate(err);
        return;
      }
      // the request deadline aborts the request, not a pending connection
      var connectTimer = setTimeout(function() {
        var e = new Error('connection timeout');
        e.code = 'ETIMEDOUT';
        oncreate(e);
        if (pending) {
          pending.destroy();
        }
      }, options.timeout || 10000);
      var pending;
      var ready = function(e, socket) {
        clearTimeout(connectTimer);
        oncreate(e, socket);
      };
      if (!isHttps) {
        pending = net.connect({ host: address, port: options.port });
        var onPlainError = function(e) { ready(e); };
        pending.once('error', onPlainError);
        pending.once('connect', function() {
          pending.removeListener('error', onPlainError);
          ready(null, pending);
        });
        return;
      }
      var hostName = typeof host === 'string' ? host.replace(/^\[|\]$/g, '') : '';
      var tlsOpts = {
        host: address,
        port: options.port,
        // the certificate is checked against the name of the URL
        servername: net.isIP(hostName) ? undefined : hostName,
        rejectUnauthorized: !tlsPolicy.skipVerify,
        checkServerIdentity: function(name, cert) {
          return tls.checkServerIdentity(hostName, cert);
        }
      };
      var socket = tls.connect(tlsOpts);
      pending = socket;
      var onTlsError = function(e) { ready(e); };
      socket.once('error', onTlsError);
      socket.once('secureConnect', function() {
        socket.removeListener('error', onTlsError);
        if (tlsPolicy.skipVerify && tlsPolicy.fingerprint) {
          var cert = socket.getPeerCertificate();
          var actual = cert ? normalizeFingerprint(cert.fingerprint256) : null;
          var expected = Buffer.from(tlsPolicy.fingerprint, 'hex');
          if (actual === null || !crypto.timingSafeEqual(Buffer.from(actual, 'hex'), expected)) {
            var e = new Error('the TLS certificate of the device does not match the pinned one');
            e.code = ERR_FINGERPRINT_MISMATCH;
            socket.destroy();
            ready(e);
            return;
          }
        }
        ready(null, socket);
      });
    });
  };
  return agent;
}

/**
 * Returns true if the HTTP status code is a 2xx one.
 *
 * @method isSuccess
 * @param {number} statusCode The HTTP status code
 * @return {boolean} True if the status code is 2xx.
 */
function isSuccess(statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

/**
 * Executes an HTTP request to a device.
 *
 * Without credentials a single plain request is done. With credentials the
 * request answers the challenge of the device: HTTP Basic or Digest,
 * depending on the "WWW-Authenticate" header of its 401 response, so the
 * password is never sent in clear text to a device that asked for Digest.
 * A device that replies 401 without any challenge gets a preemptive Basic
 * request. Once a device has accepted Basic, the next requests sharing the
 * same _memo_ object send it preemptively (one round trip instead of two):
 * the memo is reset as soon as the device replies 401 again.
 *
 * The whole exchange is bound by _opts.timeout_ (milliseconds): the callback
 * is called once, with an error with code "ETIMEDOUT" when the deadline
 * expires. A response body bigger than _opts.maxBytes_ (default 64 KB) aborts
 * the request with an error with code "RESPONSE_TOO_LARGE". Redirects are
 * never followed (the response is returned as is).
 *
 * @method deviceRequest
 * @param {object} opts The options of the "request" library (uri, method, timeout, encoding, ...)
 *   and of this function:
 *   - maxBytes: the maximum size of the response body
 *   - tlsSkipVerify: true to skip the TLS certificate verification of this request only
 *   - tlsFingerprint: with tlsSkipVerify, the SHA-256 fingerprint the device certificate must match
 * @param {object} auth The credentials ({ username, password }) or null
 * @param {object} memo An object kept by the caller between requests to the same device
 * @param {function} cb The callback function (err, response, body)
 */
function deviceRequest(opts, auth, memo, cb) {
  var timeout = opts.timeout || 5000;
  var maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
  var deadline = Date.now() + timeout;
  var protocol;
  try {
    protocol = new URL(opts.uri).protocol;
  } catch (e) {
    protocol = null;
  }
  var tlsPolicy = {
    skipVerify: opts.tlsSkipVerify === true,
    fingerprint: opts.tlsSkipVerify === true ? normalizeFingerprint(opts.tlsFingerprint) : null
  };
  var current = null;
  var done = false;
  var timer = setTimeout(function() {
    var err = new Error('timeout after ' + timeout + ' ms');
    err.code = 'ETIMEDOUT';
    finish(err);
    if (current) {
      try { current.abort(); } catch (e) {}
    }
  }, timeout);
  memo = memo || {};

  function finish(err, res, body) {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timer);
    cb(err, res, body);
  }

  function remaining() {
    return Math.max(1, deadline - Date.now());
  }

  function send(withAuth, sendImmediately, callback) {
    var o = {};
    var k;
    for (k in opts) {
      if (k !== 'maxBytes' && k !== 'tlsSkipVerify' && k !== 'tlsFingerprint' && k !== 'strictSSL') {
        o[k] = opts[k];
      }
    }
    o.timeout = remaining();
    o.followRedirect = false;
    o.followAllRedirects = false;
    // every connection is opened and checked by createDeviceAgent
    o.agent = createDeviceAgent(protocol, tlsPolicy);
    delete o.pool;
    delete o.forever;
    if (withAuth) {
      o.auth = {
        user: auth.username,
        pass: auth.password || '',
        sendImmediately: sendImmediately
      };
    }
    var challenge = null;
    current = request(o, function(err, res, body) {
      if (done) {
        return;
      }
      try {
        callback(err, res, body, challenge);
      } catch (err1) {
        finish(err1);
      }
    });
    // emitted when the request library answers an authentication challenge
    current.on('redirect', function() {
      if (this.response && this.response.statusCode === 401) {
        var h = this.response.headers['www-authenticate'];
        challenge = typeof h === 'string' ? h.split(' ')[0].toLowerCase() : null;
      }
    });
    // limit the body: a device answers a small page or a single image
    var received = 0;
    var self = current;
    current.on('response', function(res) {
      var length = parseInt(res.headers['content-length'], 10);
      if (!isNaN(length) && length > maxBytes) {
        tooLarge(self);
      }
    });
    current.on('data', function(chunk) {
      received += chunk.length;
      if (received > maxBytes) {
        tooLarge(self);
      }
    });
  }

  function tooLarge(req) {
    var err = new Error('the device response is bigger than ' + maxBytes + ' bytes');
    err.code = ERR_RESPONSE_TOO_LARGE;
    finish(err);
    try { req.abort(); } catch (e) {}
  }

  try {
    if (protocol !== 'http:' && protocol !== 'https:') {
      var invalid = new Error('invalid device URL');
      invalid.code = 'EINVALIDURL';
      finish(invalid);
      return;
    }
    if (!auth || typeof auth.username !== 'string' || auth.username === '') {
      send(false, false, function(err, res, body) {
        finish(err, res, body);
      });
      return;
    }

    var preemptiveBasic = function(onResult) {
      send(true, true, function(err, res, body) {
        if (!err && isSuccess(res.statusCode)) {
          memo.mode = 'basic';
        } else if (!err && res.statusCode === 401) {
          delete memo.mode;
        }
        onResult(err, res, body);
      });
    };

    var challenged = function() {
      send(true, false, function(err, res, body, challenge) {
        if (err) {
          finish(err);
          return;
        }
        if (res.statusCode === 401 && challenge === null &&
          !res.headers['www-authenticate']) {
          // 401 without any challenge: try a preemptive Basic once
          preemptiveBasic(finish);
          return;
        }
        if (isSuccess(res.statusCode) && challenge === 'basic') {
          memo.mode = 'basic';
        }
        finish(err, res, body);
      });
    };

    if (memo.mode === 'basic') {
      preemptiveBasic(function(err, res, body) {
        if (!err && res.statusCode === 401) {
          // the device changed its mind (e.g. now it wants Digest)
          challenged();
          return;
        }
        finish(err, res, body);
      });
    } else {
      challenged();
    }
  } catch (err) {
    finish(err);
  }
}

/**
 * Codes of the errors of the "tls" module of Node.js about a certificate
 * that cannot be verified (self-signed, unknown CA, expired, wrong name).
 *
 * @property TLS_CERT_ERRORS
 * @type {array}
 * @private
 */
var TLS_CERT_ERRORS = [
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
  'CERT_REJECTED',
  'CERT_SIGNATURE_FAILURE',
  'ERR_TLS_CERT_ALTNAME_INVALID'
];

/**
 * Returns true if the error is a failed verification of the TLS certificate
 * of the device.
 *
 * @method isTlsCertError
 * @param {object} err The error of a request
 * @return {boolean} True for a TLS certificate error.
 */
function isTlsCertError(err) {
  return !!err && typeof err === 'object' && TLS_CERT_ERRORS.indexOf(err.code) >= 0;
}

/**
 * Returns a short description of the error of a device request, for the
 * logs: the error code (never the URL, that can carry credentials) and, for
 * a TLS certificate error, a hint about the "Skip TLS certificate
 * verification" option of the source.
 *
 * @method describeError
 * @param {object} err The error of a request
 * @return {string} The description.
 */
function describeError(err) {
  if (err && err.code === ERR_FINGERPRINT_MISMATCH) {
    return 'TLS certificate of the device changed (' + err.code +
      '): it does not match the one pinned when the source was saved, save the source again to trust the new certificate';
  }
  if (err && err.code === ERR_ADDRESS_NOT_ALLOWED) {
    return 'device address not allowed (' + err.code + '): loopback and link-local addresses are refused';
  }
  if (err && err.code === ERR_RESPONSE_TOO_LARGE) {
    return 'device response too large (' + err.code + ')';
  }
  if (isTlsCertError(err)) {
    return 'TLS certificate of the device not valid (' + err.code +
      '): enable "Skip TLS certificate verification" for a device with a self-signed certificate';
  }
  if (err && typeof err === 'object') {
    return String(err.code || err.message);
  }
  return String(err);
}

exports.isSuccess = isSuccess;
exports.isBlockedAddress = isBlockedAddress;
exports.normalizeFingerprint = normalizeFingerprint;
exports.ERR_ADDRESS_NOT_ALLOWED = ERR_ADDRESS_NOT_ALLOWED;
exports.ERR_FINGERPRINT_MISMATCH = ERR_FINGERPRINT_MISMATCH;
exports.ERR_RESPONSE_TOO_LARGE = ERR_RESPONSE_TOO_LARGE;
exports.isTlsCertError = isTlsCertError;
exports.describeError = describeError;
exports.deviceRequest = deviceRequest;
