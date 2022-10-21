/**
 * Provides customer card functions through REST API.
 *
 * @module com_customer_card_rest
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
 * @default [plugins_rest/custcard]
 */
var IDLOG = '[plugins_rest/custcard]';

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
 * The customer card architect component used for customer card functions.
 *
 * @property compCustomerCard
 * @type object
 * @private
 */
var compCustomerCard;

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
 * Set customer card architect component used by customer card functions.
 *
 * @method setCompCustomerCard
 * @param {object} cc The customer card architect component.
 */
function setCompCustomerCard(cc) {
  try {
    compCustomerCard = cc;
    logger.log.info(IDLOG, 'set customer card architect component');
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
        * REST plugin that provides customer card functions through the following REST API:
        *
        * # GET requests
        *
        * 1. [`custcard/getbynum/:number/:format`](#getbynum_formatget)
        * 1. [`custcard/list`](#listget)
        *
        * ---
        *
        * ### <a id="getbynum_formatget">**`custcard/getbynum/:number/:format`**</a>
        *
        * The client receive all customer cards by number for which he has the permission. The _data_ key
        * contains the customer card in the specified format: if the format is html the data will be
        * base64 encoded. The parameters are:
        *
        * * `number: the number to use to search the customer cards data`
        * * `format: ("json" | "html") the format of the received "data" key`
        *
        * Example JSON response:
        *
        *     {
         "cc_identity": {
              "descr": "Customer Identity",
              "data": "PCEtLSBjb2xvcjogcmVk...",
              "number": "0721405516"
         }
     }
        *
        * ---
        *
        * ### <a id="listget">**`list`**</a>
        *
        * Return the list of the customer cards with their descriptions.
        *
        * Example JSON response:
        *
        *     {
         "cc_identity": {
              "descr": "Customer Identity",
         },
         ...
     }
        *
        * <br>
        *
        * # POST requests
        *
        * 1. [`custcard/preview`](#previewpost)
        *
        * ---
        *
        * ### <a id="previewpost">**`custcard/preview`**</a>
        *
        * Returns the customer card as base64 encoded html data.
        *
        * * `dbconn_id: the identifier of the database source`
        * * `template: the name of the template file.`
        * * `query: the query to be executed to get the data to be rendered with template. Must be base64 encoded`
        *
        * Example JSON request parameters:
        *
        *     { "dbconn_id": "1", "template": "template_name", "query": base64("select * from db") }
        *
        * Example JSON response:
        *
        *     {
         "html": "PCEtLSBjb..."
     }
        *
        *
        * @class plugin_rest_custcard
        * @static
        */
    var custcard = {

      // the REST api
      api: {
        'root': 'custcard',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} list Return the list of the customer cards.
         *   @param {string} getbynum/:number/:format To get a customer card as base64 encoded html format.
         */
        'get': [
          'list',
          'getbynum/:number/:format'
        ],

        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} preview To get the customer card by specified number and data.
         */
        'post': ['preview'],
        'head': [],
        'del': []
      },

      /**
       * Searches the customer cards by number with the following REST API:
       *
       *     getbynum/:number/:format
       *
       * @method getbynum
       * @param {object}   req  The client request.
       * @param {object}   res  The client response.
       * @param {function} next Function to run the next handler in the chain.
       */
      getbynum: function(req, res, next) {
        try {
          // authorization_user header field was added in the authentication step
          var username = req.headers.authorization_user;
          var format = req.params.format;
          var num = req.params.number;

          if (format !== 'json' && format !== 'html') {
            logger.log.warn(IDLOG, 'incorrect required format "' + format + '" to get customer card');
            compUtil.net.sendHttp400(IDLOG, res);
          }

          logger.log.info(IDLOG, 'get all customer cards of the user "' + username +
            '" for number "' + num + '" in "' + format + '" format');

          compCustomerCard.getAllCustomerCards(username, num, req.params.format, function(err, results) {
            try {
              if (err) {
                compUtil.net.sendHttp500(IDLOG, res, err.toString());

              } else {
                var ccreturned = '';
                var key;
                for (key in results) {
                  ccreturned += key + ',';
                }
                ccreturned = ccreturned.substring(0, ccreturned.length - 1);

                logger.log.info(IDLOG, 'send ' + Object.keys(results).length + ' customer cards "' + ccreturned +
                  '" in "' + format + '" for user "' + username + '" searching the number ' + num +
                  ' to ' + res.connection.remoteAddress);
                res.send(200, results);
              }

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
       * Return the list of the customer cards with the following REST API:
       *
       *     list
       *
       * @method list
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      list: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          logger.log.info(IDLOG, 'get customer cards list for user "' + username + '"');

          compCustomerCard.getCustomerCardsList(username, function(err, results) {
            try {
              if (err) {
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
              } else {
                logger.log.info(IDLOG, 'send cust card list ' + Object.keys(results).length + ' to user "' +
                  username + '" to ' + res.connection.remoteAddress);
                res.send(200, results);
              }
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
       * Returns the customer card as base64 encoded html data.
       *
       *     preview
       *
       * @method preview
       * @param {object}   req  The client request.
       * @param {object}   res  The client response.
       * @param {function} next Function to run the next handler in the chain.
       */
      preview: function(req, res, next) {
        try {
          if (typeof req.params.dbconn_id !== 'string' ||
            typeof req.params.query !== 'string' ||
            typeof req.params.template !== 'string') {

            compUtil.net.sendHttp400(IDLOG, res);
          }

          // authorization_user header field was added in the authentication step
          var username = req.headers.authorization_user;
          var query = Buffer.from(req.params.query, 'base64').toString('ascii').trim();
          var dbconnId = req.params.dbconn_id;
          var templateName = req.params.template;

          logger.log.info(IDLOG, 'get customer card preview for user "' + username + '"');
          compCustomerCard.getCustomerCardPreview(query, dbconnId, templateName, function(err, results) {
            try {
              if (err) {
                compUtil.net.sendHttp500(IDLOG, res, err.toString());

              } else {
                logger.log.info(IDLOG, 'send customer card preview to user "' + username + '" to ' + res.connection.remoteAddress);
                res.send(200, results);
              }
            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              compUtil.net.sendHttp500(IDLOG, res, error.toString());
            }
          });

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      }
    };
    exports.api = custcard.api;
    exports.list = custcard.list;
    exports.preview = custcard.preview;
    exports.getbynum = custcard.getbynum;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.setCompCustomerCard = setCompCustomerCard;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();
