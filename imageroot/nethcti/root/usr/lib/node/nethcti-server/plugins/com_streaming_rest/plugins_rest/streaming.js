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
        *     {
         "door": {
              "id": "door",
              "url": "http://192.168.5.169/enu/camera352x272.jpg",
              "type": "helios",
              "user": "",
              "cmdOpen": "0*",
              "password": "",
              "frameRate": "1000",
              "extension": "609",
              "description": "door"
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
        *
        * ---
        *
        * ### <a id="openpost">**`streaming/open`**</a>
        *
        * Execute the command associated with the streaming to open the associated device, e.g. a door.
        * The request must contains the following parameters:
        *
        * * `id: the streaming identifier`
        *
        * Example JSON request parameters:
        *
        *     { "id": "door" }
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
        'post': ['open', 'subscribe', 'unsubscribe'],
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

            compStreaming.open(stream, callerid, defaultExten, function(err) {

              if (err) {
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
      }
    };

    exports.api = streaming.api;
    exports.open = streaming.open;
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
