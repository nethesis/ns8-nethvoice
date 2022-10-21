/**
 * Provides the functions to get the asterisk switchboard history
 * call of all endpoints through REST API.
 *
 * @module com_history_rest
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
 * @default [plugins_rest/histcallswitch]
 */
var IDLOG = '[plugins_rest/histcallswitch]';

/**
 * The string used to hide phone numbers in privacy mode.
 *
 * @property privacyStrReplace
 * @type {string}
 * @private
 * @default "xxx"
 */
var privacyStrReplace = 'xxx';

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
 * The utility architect component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

/**
 * The architect component to be used for authorization.
 *
 * @property compAuthorization
 * @type object
 * @private
 */
var compAuthorization;

/**
 * The history architect component used for history functions.
 *
 * @property compHistory
 * @type object
 * @private
 */
var compHistory;

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
    if (typeof log === 'object' && typeof log.log.info === 'function' && typeof log.log.warn === 'function' && typeof log.log.error === 'function') {

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
 * Set history architect component used by history functions.
 *
 * @method setCompHistory
 * @param {object} ch The history architect component.
 */
function setCompHistory(ch) {
  try {
    compHistory = ch;
    logger.log.info(IDLOG, 'set history architect component');
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
 * Set authorization architect component used by history functions.
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

(function() {
  try {
    /**
        * REST plugin that provides switchboard history functions through the following REST API:
        *
        * # GET requests
        *
        * 1. [`histcallswitch/interval/:from/:to[?type=type&limit=n&offset=n&sort=field]`](#intervalget)
        * 1. [`histcallswitch/interval/:from/:to/:filter[?type=type&limit=n&offset=n&sort=field]`](#interval_filterget)
        *
        * ---
        *
        * ### <a id="intervalget">**`histcallswitch/interval/:from/:to[?type=type&limit=n&offset=n&sort=field]`**</a>
        *
        * Returns the switchboard history call between _"from"_ date to _"to"_ date of all endpoints.
        *
        * * `from: the start date in YYYYMMDD format`
        * * `to: the end date in YYYYMMDD format`
        * * `[type]: ("in" | "out" | "internal" | "lost") the type of the calls. If it is through a trunk`
        *
        * If an error occurs an HTTP 500 response is returned. It supports pagination with limit and offset parameters and sorting.
        *
        * Example JSON response:
        *
        *     [
         {
            "time": 1491480471,
            "channel": "PJSIP/204-00000006",
            "dstchannel": "PJSIP/91223-00000007",
            "uniqueid": "1491473271.12",
            "userfield": "",
            "duration": 2,
            "billsec": 1,
            "disposition": "ANSWERED",
            "dcontext": "ext-local",
            "recordingfile": "",
            "cnum": "204",
            "cnam": "andrea marchio",
            "ccompany": "",
            "src": "204",
            "dst": "91223",
            "dst_cnam": "",
            "dst_ccompany": "",
            "clid": "\"andrea marchio\" <204>",
            "type": "out" // can be ("in" | "out" | "internal") if it is through a trunk or not
         },
         ...
     ]
        *
        * ---
        *
        * ### <a id="interval_filterget">**`histcallswitch/interval/:from/:to/:filter[?type=type&limit=n&offset=n&sort=field]`**</a>
        *
        * Returns the switchboard history call between _"from"_ date to _"to"_ date of all endpoints
        * filtering by _"filter"_.
        *
        * * `from: the start date in YYYYMMDD format`
        * * `to: the end date in YYYYMMDD format`
        * * `filter: filter results on "cnum", "clid" and "dst" fields of the database`
        * * `[type]: ("in" | "out" | "internal") the type of the calls. If it is through a trunk`
        *
        * If an error occurs an HTTP 500 response is returned. It supports pagination with limit and offset parameters and sorting.
        *
        * Example JSON response:
        *
        *     [
         {
            "time": 1491480471,
            "channel": "PJSIP/204-00000006",
            "dstchannel": "PJSIP/91223-00000007",
            "uniqueid": "1491473271.12",
            "userfield": "",
            "duration": 2,
            "billsec": 1,
            "disposition": "ANSWERED",
            "dcontext": "ext-local",
            "recordingfile": "",
            "src": "204",
            "cnum": "204",
            "cnam": "andrea marchio",
            "ccompany": "",
            "dst": "91223",
            "dst_cnam": "",
            "dst_ccompany": "",
            "clid": "\"andrea marchio\" <204>",
            "type": "out" // can be ("in" | "out" | "internal") if it is through a trunk or not
         },
         ...
     ]
        *
        * @class plugin_rest_histcallswitch
        * @static
        */
    var histcallswitch = {

      // the REST api
      api: {
        'root': 'histcallswitch',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} interval/:from/:to[?type=type&limit=n&offset=n&sort=field] To get the history call between _"from"_ date to _"to"_ date.
         *     The date must be expressed in YYYYMMDD format
         *
         *   @param {string} interval/:from/:to/:filter[?type=type&limit=n&offset=n&sort=field] To get the history call between _"from"_ date to _"to"_
         *     date filtering by filter. The date must be expressed in YYYYMMDD format
         */
        'get': [
          'interval/:from/:to',
          'interval/:from/:to/:filter'
        ],
        'post': [],
        'head': [],
        'del': []
      },

      /**
       * Search the history call of all endpoints for the specified interval and optional filter by the following REST api:
       *
       *     interval/:from/:to[?type=type&limit=n&offset=n&sort=field]
       *     interval/:from/:to/:filter[?type=type&limit=n&offset=n&sort=field]
       *
       * @method interval
       * @param {object}   req  The client request.
       * @param {object}   res  The client response.
       * @param {function} next Function to run the next handler in the chain.
       */
      interval: function(req, res, next) {
        try {
          // get the username from the authorization header added by authentication step
          var username = req.headers.authorization_user;

          // check the switchboard cdr authorization
          if (compAuthorization.authorizeAdminCdrUser(username) === false) {
            logger.log.warn(IDLOG, 'switchboard cdr authorization failed for user "' + username + '"!');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          logger.log.info(IDLOG, 'switchboard cdr authorization successfully for user "' + username + '"');

          // check the administration recording authorization. If it's enabled the user
          // can view also all data about recording audio files
          var recording = compAuthorization.authorizeAdminRecordingUser(username);
          if (recording !== true) {
            logger.log.info(IDLOG, 'user "' + username + '" does not have the "admin recording" authorization');
          } else {
            logger.log.info(IDLOG, 'user "' + username + '" has the "admin recording" authorization');
          }

          var obj = {
            to: req.params.to,
            from: req.params.from,
            recording: recording
          };

          // add optional parameters if present
          if (req.params.filter) {
            obj.filter = req.params.filter;
          }
          if (req.params.offset) {
            obj.offset = req.params.offset;
          }
          if (req.params.limit) {
            obj.limit = req.params.limit;
          }
          if (req.params.sort) {
            obj.sort = req.params.sort;
          }
          if (req.params.type) {
            obj.type = req.params.type;
          }
          if (req.params.removeLostCalls) {
            obj.removeLostCalls = req.params.removeLostCalls;
          }

          // if the user has the privacy enabled, it adds the privacy string to be used to hide the phone numbers
          if (compAuthorization.isPrivacyEnabled(username)) {
            obj.privacyStr = privacyStrReplace;
          }

          // use the history component
          compHistory.getHistorySwitchCallInterval(obj, function(err, results) {
            try {
              if (err) {
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
              } else {
                logger.log.info(IDLOG, 'send ' + results.count + ' results searching switchboard history call ' +
                  'interval between ' + obj.from + ' to ' + obj.to + ' for all endpoints ' +
                  'and filter ' + (obj.filter ? obj.filter : '""') +
                  (obj.recording ? ' with recording data' : '') +
                  ' to user "' + username + '"');
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
    exports.api = histcallswitch.api;
    exports.interval = histcallswitch.interval;
    exports.setLogger = setLogger;
    exports.setPrivacy = setPrivacy;
    exports.setCompUtil = setCompUtil;
    exports.setCompHistory = setCompHistory;
    exports.setCompAuthorization = setCompAuthorization;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();

/**
 * Sets the string to be used to hide last digits of phone numbers in privacy mode.
 *
 * @method setPrivacy
 * @param {object} str The string used to hide last digits of phone numbers.
 */
function setPrivacy(str) {
  try {
    privacyStrReplace = str;
    logger.log.info(IDLOG, 'set privacy with string ' + privacyStrReplace);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}
