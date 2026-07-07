/**
 * Provides database connection functions through REST API.
 *
 * @module com_dbconn_rest
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
 * @default [plugins_rest/dbconn]
 */
var IDLOG = '[plugins_rest/dbconn]';

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
 * The dbconn architect component used for dbconn functions.
 *
 * @property compDbConn
 * @type object
 * @private
 */
var compDbConn;

/**
 * The utility architect component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

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
    if (typeof log === 'object' && typeof log.log.info === 'function' &&
      typeof log.log.warn === 'function' && typeof log.log.error === 'function') {

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
 * Set dbconn architect component used by dbconn functions.
 *
 * @method setCompDbConn
 * @param {object} cp The dbconn architect component.
 */
function setCompDbConn(cp) {
  try {
    compDbConn = cp;
    logger.log.info(IDLOG, 'set dbconn architect component');
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


(function() {
  try {
    /**
     * REST plugin that provides database connection functions through the following REST API:
     *
     * # POST requests
     *
     * 1. [`dbconn/test`](#testpost)
     *
     * ---
     *
     * ### <a id="testpost">**`dbconn/test`**</a>
     *
     * Test a connection to a database.
     *
     * Example of the body of the request:
     *
     *  {
     *    "host": "localhost",
     *    "port": "1433",
     *    "type": "mssql:7_3_A",
     *    "user": "testuser",
     *    "pass": "testpass",
     *    "name": "test"
     *  }
     *
     * ---
     *
     * @class plugin_rest_dbconn
     * @static
     */
    var dbconn = {
      // the REST api
      api: {
        'root': 'dbconn',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property post
         * @type {array}
         *
         *   @param {object} connection parameters
         */
        'post': [
          'test',
        ]
      },

      /**
       * Test a database connections with the following REST API:
       *
       *     test
       *
       * @method test
       * @param {object} req The client request.
       * @param {object} res The client response.
       * @param {function} next Function to run the next handler in the chain.
       */
      test: function(req, res, next) {
        try {
          if (typeof req.params.host !== 'string' ||
            typeof req.params.port !== 'string' ||
            typeof req.params.type !== 'string' ||
            typeof req.params.user !== 'string' ||
            typeof req.params.pass !== 'string' ||
            typeof req.params.name !== 'string') {

            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }

          var username = req.headers.authorization_user;
          logger.log.info(IDLOG, 'user "' + username + '" requested db connection test');

          compDbConn.testConnection(req.params.host, req.params.port, req.params.type,
            req.params.user, req.params.pass, req.params.name,
            function(err) {
              if (err) {
                logger.log.warn(IDLOG, 'test db connection failed: ' + JSON.stringify(req.params));
                res.send(503);
              } else {
                logger.log.info(IDLOG, 'test db connection success: ' + JSON.stringify(req.params));
                res.send(200);
              }
            });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      }

    };

    exports.api = dbconn.api;
    exports.test = dbconn.test;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.setCompDbConn = setCompDbConn;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();
