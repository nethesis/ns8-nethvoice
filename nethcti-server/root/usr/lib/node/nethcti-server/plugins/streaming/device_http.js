/**
 * HTTP requests to the devices of the streaming sources (snapshot URLs of
 * image sources and URL gates), with optional HTTP Basic or Digest
 * authentication.
 *
 * @module streaming
 * @submodule device_http
 */
var request = require('request');

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
 * expires.
 *
 * @method deviceRequest
 * @param {object} opts The options of the "request" library (uri, method, timeout,
 *   strictSSL: false to skip the TLS certificate verification of this request only, ...)
 * @param {object} auth The credentials ({ username, password }) or null
 * @param {object} memo An object kept by the caller between requests to the same device
 * @param {function} cb The callback function (err, response, body)
 */
function deviceRequest(opts, auth, memo, cb) {
  var timeout = opts.timeout || 5000;
  var deadline = Date.now() + timeout;
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
      o[k] = opts[k];
    }
    o.timeout = remaining();
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
  }

  try {
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
exports.isTlsCertError = isTlsCertError;
exports.describeError = describeError;
exports.deviceRequest = deviceRequest;
