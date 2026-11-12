/**
 * Provides streaming functions through REST API.
 *
 * @module com_streaming_rest
 * @submodule plugins_rest
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins_rest/streaming]
 */
var IDLOG = '[plugins_rest/streaming]';

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
 * The streaming architect component used for streaming functions.
 *
 * @property compStreaming
 * @type object
 * @private
 */
var compStreaming;

/**
 * The architect component to be used for authorization.
 *
 * @property compAuthorization
 * @type object
 * @private
 */
var compAuthorization;

/**
 * The utility architect component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

/**
 * The config manager architect component.
 *
 * @property compConfigManager
 * @type object
 * @private
 */
var compConfigManager;

/**
 * Set the logger to be used.
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
 * Set streaming architect component used by streaming functions.
 *
 * @method setCompStreaming
 * @param {object} cp The streaming architect component.
 */
function setCompStreaming(cp) {
  try {
    compStreaming = cp;
    logger.log.info(IDLOG, 'set streaming architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the utility architect component.
 *
 * @method setCompUtil
 * @param {object} comp The utility architect component.
 */
function setCompUtil(comp) {
  try {
    compUtil = comp;
    logger.log.info(IDLOG, 'set util architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set authorization architect component.
 *
 * @method setCompAuthorization
 * @param {object} ca The authorization architect component.
 */
function setCompAuthorization(ca) {
  try {
    compAuthorization = ca;
    logger.log.info(IDLOG, 'set authorization architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets config manager architect component.
 *
 * @method setCompConfigManager
 * @param {object} comp The config manager architect component.
 */
function setCompConfigManager(comp) {
  try {
    compConfigManager = comp;
    logger.log.info(IDLOG, 'set config manager architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

(function() {
  try {
    /**
        * REST plugin that provides streaming functions through the following REST API:
        *
        * # GET requests
        *
        * 1. [`streaming/sources`](#sourcesget)
        * 1. [`streaming/image/:source`](#imageget)
        *
        * ---
        *
        * ### <a id="sourcesget">**`streaming/sources`**</a>
        *
        * Returns all the streaming sources.
        *
        * Example JSON response:
        *
        * The address of the device and its credentials are never returned:
        * "url", "user" and "password" are always empty. "type" is "image"
        * (images sent by the server) or "rtsp" (video from the video gateway
        * through WHEP, see [`streaming/token`](#tokenpost)). "whep" is the
        * relative WHEP URL of "rtsp" sources, null otherwise. "gates" are the
        * gates that can be opened with [`streaming/open`](#openpost).
        * "cmdOpen" is never the DTMF code of a source with gates: it is "*"
        * (the open door button of the older clients) or empty without gates;
        * only the configurations without gates (older FreePBX) have the code.
        *
        * Example JSON response:
        *
        *     {
         "vs_door": {
              "id": "vs_door",
              "url": "",
              "user": "",
              "cmdOpen": "*",
              "password": "",
              "frameRate": "1000",
              "extension": "609",
              "description": "door",
              "type": "rtsp",
              "whep": "/streaming-gw/vs_door/whep",
              "gates": [
                { "id": "1", "name": "Door", "type": "dtmf" },
                { "id": "2", "name": "Gate", "type": "url" }
              ]
         }
     }
        *
        * ---
        *
        * ### <a id="imageget">**`streaming/image/:source`**</a>
        *
        * Returns the image of the streaming source base64 encoded. The _source_
        * parameter is the source identifier that can be obtained with
        * _streaming/sources_ rest api.
        *
        * Errors with a JSON body `{ "code": "...", "message": "..." }`: 400
        * (`not_image_source`), 502 (`source_certificate_changed`: the TLS
        * certificate of the device is not the one pinned when the source was
        * saved). Other failures of the device answer 500.
        *
        * Example JSON response:
        *
        *     {
         "image": "id": "data:image/jpeg;base64,AA879..."
     }
        *
        * <br>
        *
        * # POST requests
        *
        * 1. [`streaming/open`](#openpost)
        * 2. [`streaming/subscribe`](#subscribepost)
        * 3. [`streaming/unsubscribe`](#unsubscribepost)
        * 4. [`streaming/token`](#tokenpost)
        *
        * ---
        *
        * ### <a id="openpost">**`streaming/open`**</a>
        *
        * Opens a gate of the streaming source, e.g. a door. A "dtmf" gate sends
        * its code to the extension of the source, an "url" gate is opened by an
        * HTTP request of the server to the device. Without "gate" the first gate
        * is opened (sources without gates use their "open" code).
        * The request must contains the following parameters:
        *
        * * `id: the streaming identifier`
        * * `[gate]: the gate identifier (string)`
        *
        * Example JSON request parameters:
        *
        *     { "id": "vs_door", "gate": "2" }
        *
        * Errors are returned with a JSON body `{ "code": "...", "message": "..." }`:
        * 400 (`missing_id`, `invalid_gate`, `no_gates`, `no_extension`, `no_code`, `no_url`),
        * 403, 404 (`source_not_found`, `gate_not_found`), 409
        * (`call_not_answered`: a DTMF gate while the call of the source
        * extension is not answered yet), 502 (`gate_failed`,
        * `gate_unreachable`, `gate_certificate_changed`: the TLS certificate
        * of the device is not the one pinned when the source was saved,
        * `gate_address_not_allowed`: loopback or link-local address,
        * `dtmf_failed`), 504 (`gate_timeout`).
        *
        * ---
        *
        * ### <a id="tokenpost">**`streaming/token`**</a>
        *
        * Returns a short-lived token to watch an "rtsp" streaming source through
        * the video gateway: the client sends it as `Authorization: Bearer <token>`
        * (the only accepted way) in the WHEP POST request to the returned
        * relative URL, within "expires_in" seconds. A token opens a single
        * gateway session: get a new token for every connection, reconnections
        * included. A user can have at most 3 sessions on a source and 30 in
        * total.
        * The request must contains the following parameters:
        *
        * * `id: the streaming source identifier`
        *
        * Example JSON request parameters:
        *
        *     { "id": "vs_door" }
        *
        * Example JSON response:
        *
        *     { "token": "6f1c...", "expires_in": 60, "whep": "/streaming-gw/vs_door/whep" }
        *
        * Errors: 400 (`missing_id`, `not_rtsp_source`), 403, 404 (`source_not_found`),
        * 429 (`too_many_sessions`: the session limits of the user are reached,
        * `too_many_requests`: too many tokens in a minute).
        *
        * ---
        *
        * ### <a id="subscribepost">**`streaming/subscribe`**</a>
        *
        * Subscribe to a streaming source.
        * After subscribing the source the user will receive streaming events for
        * the subscribed streaming source.
        * The request must contains the following parameters:
        *
        * * `id: the streaming source identifier`
        *
        * Example JSON request parameters:
        *
        *     { "id": "vs_gate1" }
        *
        * ---
        *
        * ### <a id="unsubscribepost">**`streaming/unsubscribe`**</a>
        *
        * Unsubscribe from a streaming source.
        * After unsubscribing the source the user will not receive streaming events for
        * the unsubscribed streaming source.
        * The request must contains the following parameters:
        *
        * * `id: the streaming source identifier`
        *
        * Example JSON request parameters:
        *
        *     { "id": "vs_gate1" }
        *
        * ---
        *
        * @class plugin_rest_streaming
        * @static
        */
    var streaming = {

      // the REST api
      api: {
        'root': 'streaming',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} sources To gets all the streaming sources
         *   @param {string} image/:source To get the image of the streaming source
         */
        'get': [
          'sources',
          'image/:source'
        ],

        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} open To execute the command associated with the streaming source
         */
        'post': ['open', 'subscribe', 'unsubscribe', 'token'],
        'head': [],
        'del': []
      },

      /**
       * Returns all the streaming sources by the following REST API:
       *
       *     sources
       *
       * @method sources
       * @param {object} req The client request.
       * @param {object} res The client response.
       * @param {function} next Function to run the next handler in the chain.
       */
      sources: function(req, res, next) {
        try {
          // get the username from the authorization header
          var username = req.headers.authorization_user;

          compStreaming.getAllStreamingSources(username, function(err, results) {
            try {
              logger.log.info(IDLOG, 'send authorized streaming sources "' + results + '" to the user "' + username + '"');
              res.send(200, results);
            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              compUtil.net.sendHttp500(IDLOG, res, error.toString());
            }
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Return the image of the streaming source by the following REST API:
       *
       *     image/:source
       *
       * @method sources
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      image: function(req, res, next) {
        try {
          // get the username from the authorization header
          var username = req.headers.authorization_user;
          var sourceId = req.params.source;

          // check if the user is authorized to use the streaming source
          if (compAuthorization.getAllowedStreamingSources(username).filter(function(e) {
            return e.permissionId === sourceId;
          }).length > 0) {

            logger.log.info(IDLOG, 'getting image of source "' + sourceId + '": authorization ok for user "' + username + '"');

            compStreaming.getVideoSample(sourceId, function(err, videoSample) {
              try {
                if (err && err.status) {
                  res.send(err.status, { code: err.code, message: err.message });
                  return;
                }
                if (err) {
                  logger.log.error(IDLOG, 'getting video sample of "' + sourceId + '": ' + err);
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }
                logger.log.info(IDLOG, 'send image of source "' + sourceId + '" to the user "' + username + '"');
                res.send(200, { id: sourceId, image: videoSample });

              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
              }
            });
          } else {
            logger.log.warn(IDLOG, 'getting img of source "' + sourceId + '": authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Executes the command associated with the streaming source to open
       * the associated device, e.g. a door, with the following REST API:
       *
       *     open
       *
       * @method open
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      open: function(req, res, next) {
        try {
          // get the username from the authorization header
          var username = req.headers.authorization_user;

          // get the streaming source identifier
          var stream = req.params.id;
          if (typeof stream !== 'string' || stream === '') {
            res.send(400, { code: 'missing_id', message: 'missing streaming source identifier' });
            return;
          }

          // check if the user is authorized to use the streaming source
          if (compAuthorization.getAllowedStreamingSources(username).filter(function(e) {
            return e.permissionId === stream;
          }).length > 0) {

            logger.log.info(IDLOG, 'authorization for user "' + username + '" to open streaming source "' + stream + '" has been successful');

            // create the caller identifier
            var defaultExten = compConfigManager.getDefaultUserExtensionConf(username);
            if (defaultExten === undefined || defaultExten === null) {
              defaultExten = '';
            }
            var callerid = '"' + username + '" <' + defaultExten + '>';
            var gate = req.params.gate;
            if (typeof gate === 'number' && isFinite(gate)) {
              gate = String(gate);
            } else if (gate !== undefined && gate !== null && typeof gate !== 'string') {
              res.send(400, { code: 'invalid_gate', message: 'the gate identifier must be a string' });
              return;
            }

            compStreaming.openGate(stream, gate, callerid, defaultExten, username, function(err) {

              if (err && err.status) {
                logger.log.warn(IDLOG, 'opening streaming source "' + stream + '" by user "' + username + '": ' + err.message);
                res.send(err.status, { code: err.code, message: err.message });

              } else if (err) {
                var str = 'opening streaming source "' + stream + '"';
                logger.log.error(IDLOG, str);
                compUtil.net.sendHttp500(IDLOG, res, str);

              } else {
                logger.log.warn(IDLOG, 'streaming source "' + stream + '" opened successfully by user "' + username + '"');
                compUtil.net.sendHttp200(IDLOG, res);
              }
            });
          } else {
            logger.log.warn(IDLOG, 'authorization for user "' + username + '" for open streaming source "' + stream + '" has been failed !');
            compUtil.net.sendHttp403(IDLOG, res);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Subscribe to a streaming source
       * with the following REST API:
       *
       *     subscribe
       *
       * @method subscribe
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      subscribe: function(req, res, next) {
        try {
          // get the username from the authorization header
          var username = req.headers.authorization_user;

          // get the streaming source identifier
          var stream = req.params.id;

          // check if the user is authorized to use the streaming source
          if (compAuthorization.getAllowedStreamingSources(username).filter(function(e) {
            return e.permissionId === stream;
          }).length > 0) {

            logger.log.info(IDLOG, 'authorization for user "' + username + '" to subscribe to the streaming source "' + stream + '" has been successful');

            compStreaming.subscribeSource(username, stream, function(err) {
              if (err) {
                var str = 'subscribing streaming source "' + stream + '" for user "' + username + '"';
                logger.log.error(IDLOG, str);
                compUtil.net.sendHttp500(IDLOG, res, str);
                res.send(200, null);
              } else {
                logger.log.info(IDLOG, 'subscribing streaming source "' + stream + '" successful for user "' + username + '"');
                compUtil.net.sendHttp200(IDLOG, res);
              }
            });
          } else {
            logger.log.warn(IDLOG, 'authorization for user "' + username + '" to subscribe to the streaming source "' + stream + '" has been failed !');
            compUtil.net.sendHttp403(IDLOG, res);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Unsubscribe from a streaming source
       * with the following REST API:
       *
       *     unsubscribe
       *
       * @method unsubscribe
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      unsubscribe: function(req, res, next) {
        try {
          // get the username from the authorization header
          var username = req.headers.authorization_user;

          // get the streaming source identifier
          var stream = req.params.id;

          // check if the user is authorized to use the streaming source
          if (compAuthorization.getAllowedStreamingSources(username).filter(function(e) {
            return e.permissionId === stream;
          }).length > 0) {

            logger.log.info(IDLOG, 'authorization for user "' + username + '" to subscribe to the streaming source "' + stream + '" has been successful');

            compStreaming.unsubscribeSource(username, stream, function(err) {
              if (err) {
                var str = 'subscribing streaming source "' + stream + '" for user "' + username + '"';
                logger.log.error(IDLOG, str);
                compUtil.net.sendHttp500(IDLOG, res, str);
                res.send(200, null);
              } else {
                logger.log.info(IDLOG, 'subscribing streaming source "' + stream + '" successful for user "' + username + '"');
                compUtil.net.sendHttp200(IDLOG, res);
              }
            });
          } else {
            logger.log.warn(IDLOG, 'authorization for user "' + username + '" to subscribe to the streaming source "' + stream + '" has been failed !');
            compUtil.net.sendHttp403(IDLOG, res);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Returns a short-lived token to watch an RTSP streaming source through
       * the video gateway with the following REST API:
       *
       *     token
       *
       * @method token
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      token: function(req, res, next) {
        try {
          // get the username from the authorization header
          var username = req.headers.authorization_user;

          // get the streaming source identifier
          var stream = req.params.id;
          if (typeof stream !== 'string' || stream === '') {
            res.send(400, { code: 'missing_id', message: 'missing streaming source identifier' });
            return;
          }

          // check if the user is authorized to use the streaming source
          if (compAuthorization.getAllowedStreamingSources(username).filter(function(e) {
            return e.permissionId === stream;
          }).length > 0) {

            compStreaming.createStreamToken(username, stream, function(err, result) {
              try {
                if (err && err.status) {
                  logger.log.warn(IDLOG, 'stream token for user "' + username + '": ' + err.message);
                  res.send(err.status, { code: err.code, message: err.message });
                } else if (err) {
                  logger.log.error(IDLOG, 'creating stream token of source "' + stream + '" for user "' + username + '"');
                  compUtil.net.sendHttp500(IDLOG, res, 'creating stream token');
                } else {
                  logger.log.info(IDLOG, 'sent stream token of source "' + stream + '" to user "' + username + '"');
                  res.send(200, result);
                }
              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
              }
            });
          } else {
            logger.log.warn(IDLOG, 'authorization for user "' + username + '" to get a stream token of the streaming source "' + stream + '" has been failed !');
            compUtil.net.sendHttp403(IDLOG, res);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Authentication hook of the video gateway (MediaMTX "authMethod: http").
       * It is NOT part of the REST API of the plugin: it is bound by the
       * server to the loopback-only path _/mediamtx/auth_, which is not
       * forwarded by the HTTP proxy. A 200 response allows the request (a
       * reader or a call to the control API), any other status denies it.
       *
       * @method gatewayAuth
       * @param {object}   req  The request of the video gateway
       * @param {object}   res  The response
       * @param {function} next Function to run the next handler in the chain
       */
      gatewayAuth: function(req, res, next) {
        try {
          var body = (req.body && typeof req.body === 'object') ? req.body : null;
          compStreaming.authorizeGatewayRequest(body, function(decision) {
            sendGatewayDecision(res, body, decision);
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          try {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('error');
          } catch (e) {}
        }
      }
    };

    /**
     * Answers the video gateway with the decision of the authentication hook
     * and logs it. The calls to the control API by this server are logged
     * only when denied.
     *
     * @method sendGatewayDecision
     * @param {object} res The response
     * @param {object} body The request of the video gateway
     * @param {object} decision The decision of the streaming component
     * @private
     */
    function sendGatewayDecision(res, body, decision) {
      try {
        var session = body && typeof body.id === 'string' ? body.id : '';
        var ip = body && typeof body.ip === 'string' ? body.ip : '';
        var str = 'video gateway ' + (body && typeof body.action === 'string' ? body.action : '') +
          ' of "' + (body && typeof body.path === 'string' ? body.path : '') + '"' +
          ' (' + (body && typeof body.protocol === 'string' ? body.protocol : '') + ', session ' + session + ', from ' + ip + ')' +
          (decision.username ? ' by user "' + decision.username + '"' : '');
        if (decision.allow === true) {
          if (!body || body.action !== 'api') {
            logger.log.info(IDLOG, 'allowed ' + str);
          }
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        } else {
          logger.log.warn(IDLOG, 'denied ' + str + ': ' + decision.reason);
          res.writeHead(401, { 'Content-Type': 'text/plain' });
          res.end('denied: ' + decision.reason);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        try {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('error');
        } catch (e) {}
      }
    }

    exports.api = streaming.api;
    exports.open = streaming.open;
    exports.token = streaming.token;
    exports.gatewayAuth = streaming.gatewayAuth;
    exports.subscribe = streaming.subscribe;
    exports.unsubscribe = streaming.unsubscribe;
    exports.sources = streaming.sources;
    exports.image = streaming.image;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.setCompStreaming = setCompStreaming;
    exports.setCompAuthorization = setCompAuthorization;
    exports.setCompConfigManager = setCompConfigManager;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();
