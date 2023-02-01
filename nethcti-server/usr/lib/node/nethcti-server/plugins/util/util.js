/**
 * Provides the utility functions.
 *
 * @module util
 * @main arch_util
 */
var childProcess = require('child_process');

/**
 * Provides the utility functions.
 *
 * @class util
 * @static
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [util]
 */
var IDLOG = '[util]';

/**
 * The path of the script to do the expansion of templates
 * through the use of signal-event.
 *
 * @property SIGNAL_EVENT_SCRIPT_PATH
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "/var/www/html/freepbx/rest/lib/retrieveHelper.sh"
 */
var SIGNAL_EVENT_SCRIPT_PATH = '/var/www/html/freepbx/rest/lib/retrieveHelper.sh';

/**
 * The logger. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
var logger = console;

/**
 * Sets the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least
 * three methods: _info, warn and error_ as console object.
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' &&
      typeof log.log.info === 'function' &&
      typeof log.log.warn === 'function' &&
      typeof log.log.error === 'function') {

      logger = log;
      logger.log.info(IDLOG, 'new logger has been set');

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sends an HTTP 201 created response.
 *
 * @method sendHttp201
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp        The client response object
 * @static
 */
function sendHttp201(parentIdLog, resp) {
  try {
    resp.writeHead(201);
    logger.log.info(parentIdLog, 'send HTTP 201 response to ' + getRemoteClientIp(resp));
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 200 OK response.
 *
 * @method sendHttp200
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp        The client response object
 * @static
 */
function sendHttp200(parentIdLog, resp) {
  try {
    resp.writeHead(200);
    logger.log.info(parentIdLog, 'send HTTP 200 response to ' + getRemoteClientIp(resp));
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 400 bad request response.
 *
 * @method sendHttp400
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp The client response object
 * @param {object} [params] The parameters of the request
 * @static
 */
function sendHttp400(parentIdLog, resp, params) {
  try {
    resp.writeHead(400);
    logger.log.warn(parentIdLog, 'send HTTP 400 response to ' + getRemoteClientIp(resp));
    if (params) {
      logger.log.warn(parentIdLog, JSON.stringify(params));
    }
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 404 not found response.
 *
 * @method sendHttp404
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp        The client response object
 * @static
 */
function sendHttp404(parentIdLog, resp) {
  try {
    resp.writeHead(404);
    logger.log.warn(parentIdLog, 'send HTTP 404 response to ' + getRemoteClientIp(resp));
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 401 unauthorized response.
 *
 * @method sendHttp401
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp        The client response object
 * @param {string} [err]       An error message
 * @param {string} [code]      The error code
 * @static
 */
function sendHttp401(parentIdLog, resp, err, code) {
  try {
    if (!err && !code) {
      resp.writeHead(401);
    } else {
      var data = {};
      if (err)  { data.message = err;  }
      if (code) { data.code    = code; }
      resp.writeHead(401, data);
    }
    logger.log.warn(parentIdLog, 'send HTTP 401 response to ' + getRemoteClientIp(resp) +
      ':' + getRemoteClientPort(resp) + (err ? ' with message "' + err + '"' : ''));
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 401 unauthorized response with nonce into the WWW-Authenticate http header.
 *
 * @method sendHttp401Nonce
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp        The client response object
 * @param {string} nonce       The nonce to send
 * @static
 */
function sendHttp401Nonce(parentIdLog, resp, nonce) {
  try {
    resp.writeHead(401, {
      'WWW-Authenticate': 'Digest ' + nonce
    });
    logger.log.info(IDLOG, 'send HTTP 401 response with nonce to ' + getRemoteClientIp(resp));
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 403 forbidden response.
 *
 * @method sendHttp403
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp        The client response object
 * @static
 */
function sendHttp403(parentIdLog, resp) {
  try {
    resp.writeHead(403);
    logger.log.info(parentIdLog, 'send HTTP 403 response to ' + getRemoteClientIp(resp));
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 500 internal server error response.
 *
 * @method sendHttp500
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp        The client response object
 * @param {string} [err]       The error message
 * @static
 */
function sendHttp500(parentIdLog, resp, err) {
  try {
    var text;
    typeof err !== 'string' ? text = '' : text = err;

    resp.writeHead(500, {
      error: err
    });
    logger.log.error(parentIdLog, 'send HTTP 500 response to ' + getRemoteClientIp(resp));
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
}

/**
 * Sends an HTTP 503 internal server unavailable.
 *
 * @method sendHttp503
 * @param {string} parentIdLog The identifier of the component that uses the utility
 * @param {object} resp The client response object
 * @param {string} reason The reason message
 * @static
 */
let sendHttp503 = (parentIdLog, resp, reason) => {
  try {
    resp.writeHead(503, { error: reason });
    logger.log.warn(parentIdLog, 'send HTTP 503 response to ' + getRemoteClientIp(resp) + ' - reason: ' + reason);
    resp.end();
  } catch (err) {
    logger.log.error(IDLOG, 'used by ' + parentIdLog + ': ' + err.stack);
  }
};

/**
 * Returns the remote IP address of the client from the http response object.
 *
 * @method getRemoteClientIp
 * @param  {object} resp The http response object
 * @return {string} The remote ip address of the client
 * @private
 * @static
 */
function getRemoteClientIp(resp) {
  try {
    // "x-forwarded-for" http header is present when an http proxy is used.
    // In this case the "resp.connection.remoteAddress" is the IP of the
    // http proxy, so takes the client IP from the header
    if (resp.req && resp.req.headers['x-forwarded-for']) {
      return resp.req.headers['x-forwarded-for'].split(',')[0];
    } else {
      return resp.connection.remoteAddress;
    }
  } catch (err) {
    logger.log.error(IDLOG, 'retrieving remote client IP: ' + err.stack);
    return resp.connection.remoteAddress;
  }
}

/**
 * Returns the remote port of the client from the http response object.
 *
 * @method getRemoteClientPort
 * @param  {object} resp The http response object
 * @return {string} The remote port of the client
 * @private
 * @static
 */
function getRemoteClientPort(resp) {
  try {
    return resp.connection.remotePort;
  } catch (err) {
    logger.log.error(IDLOG, 'retrieving remote client port: ' + err.stack);
  }
}

/**
 * Call a script to expand all templates and cause reload of this server.
 * This is used after the REST API call of POST user/mobile that associate
 * a user with a mobile phone number.
 *
 * @method signalEventApplyChanges
 * @param {function} [cb] The callback function
 */
function signalEventApplyChanges(cb) {
  try {
    var child = childProcess.spawn(SIGNAL_EVENT_SCRIPT_PATH);
    child.stdin.end();
    child.on('close', function(code, signal) {

      if (code !== 0) {
        logger.log.error(IDLOG, 'signaling event apply changes: code ' + code);
        if (cb) {
          cb({ errorCode: code });
        }
        return;
      }
      if (cb) {
        cb();
      }
      logger.log.warn('applied changes with signal event');
    });
  } catch (err) {
    logger.log.error(IDLOG, 'signaling event apply changes: ' + err.stack);
    if (cb) {
      cb(err);
    }
  }
}

/**
 * Extract remote address.
 *
 * @method getRemoteAddress
 * @param {object} res The response object
 * @return {string} The remote address
 */
function getRemoteAddress(obj) {
  return obj.headers['x-forwarded-for'] || obj.connection.remoteAddress || 'unknown';
}

/**
* Network utility functions.
*
* @property net
* @type {object}
* @default {
    sendHttp200:      sendHttp200,
    sendHttp201:      sendHttp201,
    sendHttp400:      sendHttp400,
    sendHttp404:      sendHttp404,
    sendHttp401:      sendHttp401,
    sendHttp403:      sendHttp403,
    sendHttp500:      sendHttp500,
    sendHttp503:      sendHttp503,
    sendHttp401Nonce: sendHttp401Nonce,
    getRemoteAddress: getRemoteAddress
}
*/
var net = {
  sendHttp200: sendHttp200,
  sendHttp201: sendHttp201,
  sendHttp400: sendHttp400,
  sendHttp404: sendHttp404,
  sendHttp401: sendHttp401,
  sendHttp403: sendHttp403,
  sendHttp500: sendHttp500,
  sendHttp503: sendHttp503,
  sendHttp401Nonce: sendHttp401Nonce,
  getRemoteAddress: getRemoteAddress
};

// public interface
exports.net = net;
exports.setLogger = setLogger;
exports.signalEventApplyChanges = signalEventApplyChanges;