/**
 * Forwards to Tancredi the provisioning requests of the CTI users.
 *
 * The CTI phone keys page reads the data of the user's own phone and of its
 * model, and saves the line keys and the expansion module keys of the phone.
 * Only those requests are forwarded, with the Tancredi administrator
 * credentials and with the URL rebuilt from the checked parts:
 *
 * - GET   /tancredi/api/v1/models/<model>
 * - GET   /tancredi/api/v1/phones/<MAC>[?inherit=1]  (phone of the user)
 * - PATCH /tancredi/api/v1/phones/<MAC>              (phone of the user)
 *   with body {"variables": {...}} of line keys and expansion keys only
 *
 * The answers keep only the data the page uses (see filterResponse).
 *
 * @module http_proxy
 * @submodule tancredi_proxy
 */
var stream = require('stream');
var httpProxy = require('http-proxy');

/**
 * MAC address as the CTI sends it, e.g. "0C-38-3E-12-34-56".
 *
 * @property MAC_PATTERN
 * @type string
 * @private
 */
var MAC_PATTERN = '[0-9A-F]{2}(?:-[0-9A-F]{2}){5}';
var PHONE_PATH = new RegExp('^/tancredi/api/v1/phones/(' + MAC_PATTERN + ')$');

/**
 * Tancredi model name, e.g. "fanvil-X5U" or "yealink-T4".
 *
 * @property MODEL_PATH
 * @type RegExp
 * @private
 */
var MODEL_PATH = /^\/tancredi\/api\/v1\/models\/([A-Za-z0-9_-][A-Za-z0-9_.-]{0,63})$/;

/**
 * Phone variables the CTI phone keys page changes.
 *
 * @property KEY_VARIABLE
 * @type RegExp
 * @private
 */
var KEY_VARIABLE = /^(?:linekey|expkey)_(?:type|value|label)_[1-9][0-9]{0,3}$/;

/**
 * Model capabilities, e.g. cap_linekey_count or cap_door_phone.
 *
 * @property CAPABILITY_VARIABLE
 * @type RegExp
 * @private
 */
var CAPABILITY_VARIABLE = /^cap_[a-z0-9_]+$/;

var MAX_REQUEST_BODY = 64 * 1024;
var MAX_RESPONSE_BODY = 2 * 1024 * 1024;
var MAX_VALUE_LENGTH = 255;
var CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Request headers passed to Tancredi: the host routes the request, the
 * others are informative. The credentials of the CTI user are not passed.
 *
 * @property FORWARDED_HEADERS
 * @type array
 * @private
 */
var FORWARDED_HEADERS = [
  'host',
  'user-agent',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip'
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks a request against the allowed ones.
 *
 * @method parseRequest
 * @param {string} method The HTTP method
 * @param {string} rawUrl The request URL (path and query)
 * @return {object} The request type ("phone" or "model"), the MAC address or
 *   the model name and the URL to forward. Null when the request is not
 *   allowed.
 */
function parseRequest(method, rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.charAt(0) !== '/' || rawUrl.charAt(1) === '/') {
    return null;
  }
  var url;
  try {
    url = new URL(rawUrl, 'http://localhost');
  } catch (err) {
    return null;
  }
  if (url.origin !== 'http://localhost') {
    return null;
  }
  var match = MODEL_PATH.exec(url.pathname);
  if (match) {
    if (method === 'GET' && url.search === '') {
      return { type: 'model', model: match[1], url: url.pathname };
    }
    return null;
  }
  match = PHONE_PATH.exec(url.pathname);
  if (!match) {
    return null;
  }
  if (method === 'GET' && (url.search === '' || url.search === '?inherit=1')) {
    return { type: 'phone', mac: match[1], url: url.pathname + url.search };
  }
  if (method === 'PATCH' && url.search === '') {
    return { type: 'phone', mac: match[1], url: url.pathname };
  }
  return null;
}

/**
 * Checks the body of a phone PATCH: it must be {"variables": {...}} with
 * line keys and expansion keys only, and each value a string without control
 * characters (or null).
 *
 * @method checkPatchBody
 * @param {string} text The request body
 * @return {object} {body: the body to forward} or {status: 400|403, reason}
 */
function checkPatchBody(text) {
  var body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    return { status: 400, reason: 'the body is not JSON' };
  }
  if (!isPlainObject(body) || Object.keys(body).length !== 1 || !isPlainObject(body.variables)) {
    return { status: 400, reason: 'the body must be {"variables": {...}}' };
  }
  var names = Object.keys(body.variables);
  if (names.length === 0) {
    return { status: 400, reason: 'no variables' };
  }
  var variables = {};
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var value = body.variables[name];
    if (!KEY_VARIABLE.test(name)) {
      return { status: 403, reason: 'variable "' + name.substring(0, 64) + '" not allowed' };
    }
    if (value !== null &&
      (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH || CONTROL_CHARACTERS.test(value))) {

      return { status: 400, reason: 'invalid value of variable "' + name + '"' };
    }
    variables[name] = value;
  }
  return { body: { variables: variables } };
}

function pickVariables(variables, isAllowed) {
  var picked = {};
  if (isPlainObject(variables)) {
    Object.keys(variables).forEach(function (name) {
      if (isAllowed(name)) {
        picked[name] = variables[name];
      }
    });
  }
  return picked;
}

function isPhoneVariableForCti(name) {
  return KEY_VARIABLE.test(name) || CAPABILITY_VARIABLE.test(name);
}

function isModelVariableForCti(name) {
  return CAPABILITY_VARIABLE.test(name);
}

/**
 * Keeps in a Tancredi phone or model the data the CTI phone keys page uses:
 * the identifiers, the line key and expansion key variables and the
 * capabilities. Passwords, tokens, provisioning URLs and the other
 * variables are left out.
 *
 * @method filterResponse
 * @param {string} type The request type: "phone" or "model"
 * @param {object} data The Tancredi response
 * @return {object} The data for the CTI, null when data is not an object
 */
function filterResponse(type, data) {
  if (!isPlainObject(data)) {
    return null;
  }
  if (type === 'phone') {
    return {
      mac: data.mac,
      short_mac: data.short_mac,
      model: data.model,
      display_name: data.display_name,
      model_url: data.model_url,
      variables: pickVariables(data.variables, isPhoneVariableForCti)
    };
  }
  if (type === 'model') {
    return {
      name: data.name,
      display_name: data.display_name,
      model_url: data.model_url,
      variables: pickVariables(data.variables, isModelVariableForCti)
    };
  }
  return null;
}

/**
 * Reads a whole stream up to a size limit.
 *
 * @method readBody
 * @param {object} source The stream
 * @param {number} limit The maximum size in bytes
 * @param {function} cb Called with (err, buffer); err.tooLarge is true
 *   when the limit is exceeded
 * @private
 */
function readBody(source, limit, cb) {
  var chunks = [];
  var size = 0;
  var done = false;
  source.on('data', function (chunk) {
    if (done) {
      return;
    }
    size += chunk.length;
    if (size > limit) {
      done = true;
      var err = new Error('body larger than ' + limit + ' bytes');
      err.tooLarge = true;
      cb(err);
      return;
    }
    chunks.push(chunk);
  });
  source.on('end', function () {
    if (!done) {
      done = true;
      cb(null, Buffer.concat(chunks));
    }
  });
  source.on('error', function (err) {
    if (!done) {
      done = true;
      cb(err);
    }
  });
}

function sendStatus(res, status) {
  if (!res.headersSent) {
    res.writeHead(status);
  }
  res.end();
}

/**
 * Creates the handler of the Tancredi requests of the CTI users.
 *
 * @method create
 * @param {object} options
 *   @param {string} options.target The Tancredi URL ('' is the local web server)
 *   @param {function} options.getSecretKey Returns the Tancredi administrator secret key
 *   @param {object} options.logger The logger (with log.info, log.warn, log.error)
 *   @param {string} options.idlog The log identifier
 * @return {function} handle(req, res, user) where user is {name, isPhoneOwner(mac)}
 */
function create(options) {
  var logger = options.logger;
  var idlog = options.idlog;
  var proxy = httpProxy.createProxy();

  // the Tancredi answer is read and only the data the CTI uses is sent
  proxy.on('proxyRes', function (proxyRes, req, res) {
    var route = req.tancrediRoute;
    readBody(proxyRes, MAX_RESPONSE_BODY, function (err, data) {
      if (err) {
        logger.log.error(idlog, 'provisioning request ' + req.method + ' ' + req.url + ': ' + err.message);
        sendStatus(res, 502);
        return;
      }
      var status = proxyRes.statusCode;
      if (status < 200 || status >= 300) {
        // Tancredi errors: 4xx carry a problem description, 5xx nothing useful
        if (status >= 400 && status < 500 && data.length > 0) {
          res.writeHead(status, { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' });
          res.end(data);
        } else {
          sendStatus(res, status);
        }
        return;
      }
      var filtered = null;
      try {
        filtered = filterResponse(route.type, JSON.parse(data.toString('utf8')));
      } catch (parseErr) {
        filtered = null;
      }
      if (filtered === null) {
        logger.log.error(idlog, 'provisioning request ' + req.method + ' ' + req.url + ': unexpected answer from Tancredi');
        sendStatus(res, 502);
        return;
      }
      var json = Buffer.from(JSON.stringify(filtered));
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': json.length });
      res.end(json);
    });
  });

  function forward(req, res, route, user, body) {
    var headers = {};
    FORWARDED_HEADERS.forEach(function (name) {
      if (req.headers[name] !== undefined) {
        headers[name] = req.headers[name];
      }
    });
    headers.user = 'admin';
    headers.secretkey = options.getSecretKey();
    headers.accept = 'application/json';
    // the answer is parsed: no compressed body
    headers['accept-encoding'] = 'identity';
    var proxyOptions = { target: options.target, selfHandleResponse: true };
    if (body !== undefined) {
      var data = Buffer.from(JSON.stringify(body));
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(data.length);
      proxyOptions.buffer = new stream.PassThrough();
      proxyOptions.buffer.end(data);
    }
    req.headers = headers;
    req.url = route.url;
    req.tancrediRoute = route;
    logger.log.info(idlog, 'proxy provisioning request ' + req.method + ' ' + req.url + ' for user ' + user.name);
    proxy.web(req, res, proxyOptions, function (err) {
      logger.log.error(idlog, 'provisioning request ' + req.method + ' ' + req.url + ' failed: ' + err.message);
      sendStatus(res, 502);
    });
  }

  return function handle(req, res, user) {
    var route = parseRequest(req.method, req.url);
    if (route === null) {
      logger.log.warn(idlog, req.method + ' ' + req.url + ' not permitted (from user ' + user.name + ')');
      sendStatus(res, 403);
      return;
    }
    if (route.type === 'phone' && user.isPhoneOwner(route.mac) !== true) {
      logger.log.warn(idlog, 'authorization failed for user ' + user.name + ' calling api ' + req.method + ' ' + route.url);
      sendStatus(res, 403);
      return;
    }
    if (req.method !== 'PATCH') {
      forward(req, res, route, user);
      return;
    }
    readBody(req, MAX_REQUEST_BODY, function (err, data) {
      if (err) {
        logger.log.warn(idlog, 'provisioning request ' + req.method + ' ' + route.url + ' from user ' + user.name + ': ' + err.message);
        sendStatus(res, err.tooLarge ? 413 : 400);
        return;
      }
      var checked = checkPatchBody(data.toString('utf8'));
      if (checked.body === undefined) {
        logger.log.warn(idlog, 'provisioning request ' + req.method + ' ' + route.url + ' from user ' + user.name + ' refused: ' + checked.reason);
        sendStatus(res, checked.status);
        return;
      }
      forward(req, res, route, user, checked.body);
    });
  };
}

exports.create = create;
exports.parseRequest = parseRequest;
exports.checkPatchBody = checkPatchBody;
exports.filterResponse = filterResponse;
