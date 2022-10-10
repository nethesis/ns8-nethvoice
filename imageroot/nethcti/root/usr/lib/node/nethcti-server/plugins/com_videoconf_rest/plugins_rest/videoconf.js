/**
 * Provides videoconf functions through REST API.
 *
 * @module com_videoconf_rest
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
 * @default [plugins_rest/videoconf]
 */
var IDLOG = '[plugins_rest/videoconf]';

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
 * The videoconf architect component used for videoconf functions.
 *
 * @property compVideoconf
 * @type object
 * @private
 */
var compVideoconf;

/**
 * The user architect component used for videoconf functions.
 *
 * @property compUser
 * @type object
 * @private
 */
var compUser;

/**
 * The mailer architect component used for videoconf functions.
 *
 * @property compMailer
 * @type object
 * @private
 */
var compMailer;

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
 * Set videoconf architect component used by videoconf functions.
 *
 * @method setCompVideoconf
 * @param {object} cp The videoconf architect component.
 */
function setCompVideoconf(cp) {
  try {
    compVideoconf = cp;
    logger.log.info(IDLOG, 'set videoconf architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set user architect component used by videoconf functions.
 *
 * @method setCompUser
 * @param {object} cp The user architect component.
 */
function setCompUser(cp) {
  try {
    compUser = cp;
    logger.log.info(IDLOG, 'set user architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set mailer architect component used by videoconf functions.
 *
 * @method setCompMailer
 * @param {object} cp The mailer architect component.
 */
function setCompMailer(cp) {
  try {
    compMailer = cp;
    logger.log.info(IDLOG, 'set mailer architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authorization architect component.
 *
 * @method setCompAuthorization
 * @param {object} comp The architect authorization component
 * @static
 */
function setCompAuthorization(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    compAuthorization = comp;
    logger.log.info(IDLOG, 'authorization component has been set');

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
    * REST plugin that provides videoconf functions through the following REST API:
    *
    *
    * # POST requests
    *
    * 1. [`videoconf/newroom`](#newroompost)
    *
    * ---
    *
    * ### <a id="newroompost">**`videoconf/newroom`**</a>
    *
    * Creates a new room in the NethCTI videoconf
    *
    * ---
    *
    * 1. [`videoconf/send_emails`](#send_emailspost)
    *
    * ---
    *
    * ### <a id="send_emailspost">**`videoconf/send_emails`**</a>
    *
    * Send email invitations about a video conference. The following parameters are needed:
    *
    * * `list`: array list of email addresses to be invited. Keys are email address and values are the language to be used for the invite ("it", "en", "es")
    * * `email`: object formatted like the following {
              "subject": {
                "it": "subject in italian language",
                "en": "subject in english language",
                "es": "subject in spanish language"
              },
              "body": {
                "it":"body in italian language"
                "en":"body in english language"
                "es":"body in spanish language"
              }
            }
    *
    * Example JSON request parameters:
    *
    *     { "list": {
              "name@domain.com": "it",
              "name2@domain.com": "en"
            },
            "email": {
              "subject": {
                "it": "subject in italian language",
                "en": "subject in english language",
                "es": "subject in spanish language"
              },
              "body": {
                "it":"body in italian language"
                "en":"body in english language"
                "es":"body in spanish language"
              }
            }
          }
    *
    * 
    * @class plugin_rest_videoconf
    * @static
    */
    var videoconf = {
      // the REST api
      api: {
        'root': 'videoconf',
        'get': [],
        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} newroom Creates a room
         *   @param {string} send_emails Send vc invitations to email addresses
         */
        'post': [
          'newroom',
          'send_emails'
        ],
        'head': [],
        'del': []
      },
      /**
       * Create a room in the videoconf platform with the following REST API:
       *
       *     newroom
       *
       * @method newroom
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      newroom: function(req, res, next) {
        try {
          const username = req.headers.authorization_user;
          if (compAuthorization.authorizeVideoconf(username) === false) {
            logger.log.warn(IDLOG, 'creating new video conf room: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
          const name = compUser.getUserInfoJSON(username).name || 'unknown';
          const result = compVideoconf.getNewRoomUrl(username, name);
          if (result === null) {
            logger.log.warn(IDLOG, 'no vc room URL configured: send null to "' + username + '"');
          } else {
            logger.log.info(IDLOG, 'new URL for vc room (' + result.url + ') craeted for user "' + username + '"');
          }
          res.send(200, result);
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Send email invitations about a video conference with the following REST API:
       *
       *     send_emails
       *
       * @method send_emails
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      send_emails: async function(req, res, next) {
        try {
          if (typeof req.params !== 'object' || !req.params.list || !req.params.email) {
            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }
          const username = req.headers.authorization_user;
          if (compAuthorization.authorizeVideoconf(username) === false) {
            logger.log.warn(IDLOG, 'sending vc email invitations: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
          const list = req.params.list;
          const email = req.params.email;
          let data = {};
          let lang, subject, body;
          for (let address in list) {
            address = address.toLowerCase();
            lang = list[address];
            subject = email.subject[lang];
            body = email.body[lang];
            data[address] = {
              subject: subject,
              body: body
            };
          }
          let result = await compMailer.sendToList(data);
          res.send(200, result);
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      }
    };
    exports.api = videoconf.api;
    exports.newroom = videoconf.newroom;
    exports.send_emails = videoconf.send_emails;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.setCompMailer = setCompMailer;
    exports.setCompVideoconf = setCompVideoconf;
    exports.setCompUser = setCompUser;
    exports.setCompAuthorization = setCompAuthorization;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();