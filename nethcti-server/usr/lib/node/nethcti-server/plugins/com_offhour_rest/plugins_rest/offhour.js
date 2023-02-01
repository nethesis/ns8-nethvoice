/**
 * Provides offhour functions through REST API.
 *
 * @module com_offhour_rest
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
 * @default [plugins_rest/offhour]
 */
var IDLOG = '[plugins_rest/offhour]';

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
 * The offhour architect component used for offhour functions.
 *
 * @property compOffhour
 * @type object
 * @private
 */
var compOffhour;

/**
 * The http static module.
 *
 * @property compStaticHttp
 * @type object
 * @private
 */
var compStaticHttp;

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
 * @param {object} log The logger object.
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
 * Set offhour architect component used by offhour functions.
 *
 * @method setCompOffhour
 * @param {object} comp The offhour architect component.
 */
function setCompOffhour(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compOffhour = comp;
    logger.log.info(IDLOG, 'set offhour architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set static http architecht component used by history functions.
 *
 * @method setCompStatic
 * @param {object} comp The http static architect component.
 */
function setCompStaticHttp(comp) {
  try {
    compStaticHttp = comp;
    logger.log.info(IDLOG, 'set http static component');
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
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compUtil = comp;
    logger.log.info(IDLOG, 'set util architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the authorization architect component.
 *
 * @method setCompAuthorization
 * @param {object} comp The architect authorization component
 * @static
 */
function setCompAuthorization(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compAuthorization = comp;
    logger.log.log(IDLOG, 'authorization component has been set');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

(function () {
  try {
    /**
        * REST plugin that provides offhour functions through the following REST API:
        *
        * # GET requests
        *
        * 1. [`offhour/list`](#listget)
        * 1. [`offhour/list_announcement`](#list_announcementget)
        * 1. [`offhour/listen_announcement/:id`](#listen_announcementget)
        * 1. [`offhour/download_announcement/:id`](#download_announcementget)
        *
        * ---
        *
        * ### <a id="listget">**`offhour/list`**</a>
        *
        * If the user has the admin permission it returns all inbound routes.
        * If the user has the advanced permission it returns generic inbound routes and these owned by the user.
        * If the user has the basic permission it returns only inbound routes owned by the user.
        *
        * Example JSON response:
        *
        *     {
        *       "0721405516/0123456798": {
                  "calledIdNum": "0721405516",
                  "callerIdNum": "0123456798",
                  "destination": "from-did-direct,201,1",
                  "description": "alessandro polidori",
                  "offhour": {
                    "calledIdNum": "0721405516",
                    "callerIdNum": "0123456798",
                    "action": "audiomsg_voicemail",
                    "enabled": "period",
                    "period": {
                      "datebegin": "01/12/2017",
                      "dateend": "18/12/2017",
                      "timebegin": "12:52:51",
                      "timeend": "18:00:00"
                    },
                    "audiomsg": {
                      "announcement_id": "1",
                      "description": "vacanze",
                      "privacy": "public",
                      "username": "alessandro"
                    },
                    "voicemail": {
                      "voicemail_id": "200"
                    }
                  }
                },
                ...
              }
        *
        * ---
        *
        * ### <a id="list_announcementget">**`offhour/list_announcement`**</a>
        *
        * Returns the list of all public and user private audio file for announcements.
        *
        * Example JSON response:
        *
        *     [
         {
             "id": 1,
             "username": "alessandro",
             "description": "lunch",
             "privacy": "private",
             "date_creation": "10/10/2017",
             "time_creation": "15:05:51"
         }
     ]
        *
        * ---
        *
        * ### <a id="listen_announcementget">**`offhour/listen_announcement/:id`**</a>
        *
        * Listen the specified audio announcement. The _id_ is the announcement indentifier in the database
        * (_id_ field of the nethcti3.offhour_files_ database table). The user with admin permission can listen all
        * announcements, while the user with advanced and basic permissions can listen only the owned file and these
        * with public visibility.
        *
        * ---
        *
        * ### <a id="download_announcementget">**`offhour/download_announcement/:id`**</a>
        *
        * The user can download the announcement message of the user. The id must be the identifier of the announcement
        * in the database. It returns the filename that can be downloaded getting it from /webrest/static/.
        *
        *
        * # POST requests
        *
        * 1. [`offhour/enable_announcement`](#enable_announcementpost)
        * 1. [`offhour/modify_announcement`](#modify_announcementpost)
        * 1. [`offhour/delete_announcement`](#delete_announcementpost)
        * 1. [`offhour/record_announcement`](#record_announcementpost)
        * 1. [`offhour/upload_announcement`](#upload_announcementpost)
        * 1. [`offhour/set_offhour`](#set_offhourpost)
        *
        * ---
        *
        * ### <a id="enable_announcementpost">**`offhour/enable_announcement`**</a>
        *
        * Enable the specified audio file for announcement. It is to be used after "offhour/record_announcement" rest api
        * invocation. The request must contain the following parameters:
        *
        * * `privacy: ("public" | "private" ) the visibility of the announcement`
        * * `description: the announcement description`
        * * `tempFilename: the temporary file name given by the server when receives the upload or when the offhour/record_announcement has been used`
        *
        * Example JSON request parameters:
        *
        *     { "privacy": "public", "description": "holidays time", "tempFilename": "upload_456b484edba171871e44b9d64b3bad3d.wav" }
        *
        * ---
        *
        * ### <a id="modify_announcementpost">**`offhour/modify_announcement`**</a>
        *
        * Modify data about the specified audio file for announcement. The request must contain
        * at least one the following optional parameters:
        *
        * * `id: the announcement identifier`
        * * `[description]: the description of the announcement`
        * * `[privacy]: ("public" | "private") the visibility of the announcement`
        *
        * Example JSON request parameters:
        *
        *     { "id": "2", "privacy": "public" }
        *
        * ---
        *
        * ### <a id="delete_announcementpost">**`offhour/delete_announcement`**</a>
        *
        * Delete the specified audio file for announcement. The request must contain the following parameters:
        *
        * * `id: the announcement identifier`
        *
        * Example JSON request parameters:
        *
        *     { "id": "2" }
        *
        * ---
        *
        * ### <a id="record_announcementpost">**`offhour/record_announcement`**</a>
        *
        * Record new audio file for announcement. It returns a filename that must be enabled invoking
        * "offhour/enable_announcement" rest api.
        *
        * ---
        *
        * ### <a id="upload_announcementpost">**`offhour/upload_announcement`**</a>
        *
        * Upload an audio file as announcement to be used. The request must contain the following parameters:
        *
        * * `privacy: ("public" | "private" ) the visibility of the announcement`
        * * `description: the announcement description`
        * * `audio_content: the audio file content base64 encoded. Supported formats are: mp3, wav`
        *
        * Example JSON request parameters:
        *
        *     { "privacy": "public", "description": "pause", "audio_content": "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAA..." }
        *
        *
        * ---
        *
        * ### <a id="set_offhourpost">**`offhour/set_offhour`**</a>
        *
        * Set the offhour service. It provides the functions to set offhour announcement,
        * announcement + voicemail or redirect. The request must contain the following parameters:
        *
        * * `calledIdNum: called number of the incoming route`
        * * `callerIdNum: caller number of the incoming route`
        * * `enabled: ("always" | "never" | "period") disable, enable always or enable for a period
        *                                             the offhour for the inbound route. If "period" is used
        *                                             it is necessary to specify "start_date" and "end_date"
        * * `[start_date]: used with "enabled=period" ISOString format`
        * * `[end_date]: used with "enabled=period" ISOString format`
        * * `[action]: ("audiomsg" | "audiomsg_voicemail" | "redirect") the type of the offhour`
        * * `[announcement_id]: the identifier of the audo file announcement. It is required by action "audiomsg"`
        * * `[voicemail_id]: the identifier of the voicemail extension. It is required by action "audiomsg_voicemail"`
        * * `[redirect_to]: the redirection destination number. It is required by action "redirect"`
        *
        * Example JSON request parameters:
        *
        *     { "action": "audiomsg_voicemail", "announcement_id": "2", "voicemail_id": "202" }
        *
        * @class plugin_rest_offhour
        * @static
        */
    var offhour = {

      // the REST api
      api: {
        'root': 'offhour',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} list To get the list of all the inbound routes base on user permission
         *   @param {string} list_announcement To get the list of all public and user private audio file for announcements
         *   @param {string} listen_announcement/:id To listen the specified audio file of announcement
         *   @param {string} download_announcement/:id To download the specified audio file of announcement
         */
        'get': [
          'list',
          'list_announcement',
          'listen_announcement/:id',
          'download_announcement/:id'
        ],

        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} set_offhour To Set the offhour service behaviour
         *   @param {string} modify_announcement To modify some data about the audio file for announcement
         *   @param {string} delete_announcement To delete the audio file for announcement
         *   @param {string} record_announcement To record new audio file for announcement
         *   @param {string} enable_announcement To enable the uploaded audio file for announcement
         *   @param {string} upload_announcement To upload the audio file for announcement
         */
        'post': [
          'set_offhour',
          'modify_announcement',
          'delete_announcement',
          'record_announcement',
          'enable_announcement',
          'upload_announcement'
        ],

        'head': [],
        'del': []
      },

      /**
       * If the user has the admin permission it returns all inbound routes.
       * If the user has the advanced permission it returns generic inbound routes and these owned by the user.
       * If the user has the basic permission it returns only inbound routes owned by the user.
       *
       *     list
       *
       * @method list
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      list: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          // check if the user has the "ad_off_hour" authorization
          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            // the user has the permission to see all inbound routes: his, generic and of other users
            logger.log.info(IDLOG, 'getting offhour list of all inbound routes: user "' + username + '" has the "ad_off_hour" authorization');

            compOffhour.getAdminInboundRoutes(function (err, results) {
              try {
                if (err) {
                  logger.log.error(IDLOG, 'getting offhour list of all inbound routes for user "' + username + '"');
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }
                var strlog = 'send offhour list of all inbound routes to user "' + username + '"';
                logger.log.info(IDLOG, strlog);
                res.send(200, results);

              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                compUtil.net.sendHttp500(IDLOG, res, error.toString());
              }
            });

          } else if (compAuthorization.authorizeAdvancedOffhourUser(username) === true) {
            // the user has the permission to see all his inbound routes and the generic
            logger.log.info(IDLOG, 'getting advanced offhour list of inbound routes: user "' + username + '" has the "advanced_off_hour" authorization');

            compOffhour.getAdvancedInboundRoutes(username, function (err, results) {
              try {
                if (err) {
                  logger.log.error(IDLOG, 'getting advanced offhour list of inbound routes for user "' + username + '"');
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }
                var strlog = 'send advanced offhour list of inbound routes to user "' + username + '"';
                logger.log.info(IDLOG, strlog);
                res.send(200, results);

              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                compUtil.net.sendHttp500(IDLOG, res, error.toString());
              }
            });

          } else if (compAuthorization.authorizeOffhourUser(username) === true) {
            // the user has the only permission to see his inbound routes
            logger.log.info(IDLOG, 'getting user offhour list of inbound routes: user "' + username + '" has the "offhour" authorization');

            compOffhour.getUserInboundRoutes(username, function (err, results) {
              try {
                if (err) {
                  logger.log.error(IDLOG, 'getting user offhour list of inbound routes for user "' + username + '"');
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }
                var strlog = 'send user offhour list of inbound routes to user "' + username + '"';
                logger.log.info(IDLOG, strlog);
                res.send(200, results);

              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                compUtil.net.sendHttp500(IDLOG, res, error.toString());
              }
            });

          } else {
            logger.log.warn(IDLOG, 'getting offhour list of inbound routes: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * The user listen the audio file of the specified announcement with the following REST API:
       *
       *     listen_announcement
       *
       * @method listen_announcement
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      listen_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          if (typeof req.params.id !== 'string') {
            compUtil.net.sendHttp400(IDLOG, res, req.params);
            return;
          }
          var id = req.params.id;

          // check if the user has the admin_offhour authorization
          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'listening audio announcement with id "' + id + '": user "' + username + '" has the admin authorization');

            listenAnnouncement(id, username, res);

          } else if (compAuthorization.authorizeOffhourUser(username) === true ||
            compAuthorization.authorizeAdvancedOffhourUser(username) === true) {

            logger.log.info(IDLOG, 'listening audio announcement with id "' + id + '": user "' + username + '" has the basic or advanced authorization');

            // check if the user has the permission to listen the file. The user can listen all his announcements and only the public one of other users
            compAuthorization.verifyOffhourListenAnnouncement(username, id, function (err, result) {
              try {
                if (err) {
                  logger.log.error(IDLOG, 'verifying announcement "' + id + '" for user "' + username + '" to listen it');
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }

                if (result === true) {
                  var strlog = 'verified announcement "' + id + '" for user "' + username + '": he has the authorization to listen it';
                  logger.log.info(IDLOG, strlog);
                  listenAnnouncement(id, username, res);

                } else {
                  var strlog = 'verified announcement "' + id + '" for user "' + username + '" to listen it: authorization failed';
                  logger.log.warn(IDLOG, strlog);
                  compUtil.net.sendHttp403(IDLOG, res);
                  return;
                }

              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                compUtil.net.sendHttp500(IDLOG, res, error.toString());
              }
            });

          } else {
            logger.log.warn(IDLOG, 'listening audio announcement with id "' + id + '": authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * The user download the audio file of the specified announcement with the following REST API:
       *
       *     download_announcement
       *
       * @method download_announcement
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      download_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          if (typeof req.params.id !== 'string') {
            compUtil.net.sendHttp400(IDLOG, res, req.params);
            return;
          }
          var id = req.params.id;

          // check if the user has the admin_offhour authorization
          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'downloading audio announcement with id "' + id + '": user "' + username + '" has the admin authorization');

            downloadAnnouncement(id, username, res);

          } else if (compAuthorization.authorizeOffhourUser(username) === true ||
            compAuthorization.authorizeAdvancedOffhourUser(username) === true) {

            logger.log.info(IDLOG, 'downloading audio announcement with id "' + id + '": user "' + username + '" has the basic or advanced authorization');

            // check if the user has the permission to listen the file. The user can listen all his announcements and only the public one of other users
            compAuthorization.verifyOffhourListenAnnouncement(username, id, function (err, result) {
              try {
                if (err) {
                  logger.log.error(IDLOG, 'verifying announcement "' + id + '" for user "' + username + '" to downloading it');
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }

                if (result === true) {
                  var strlog = 'verified announcement "' + id + '" for user "' + username + '": he has the authorization to downloading it';
                  logger.log.info(IDLOG, strlog);
                  downloadAnnouncement(id, username, res);

                } else {
                  var strlog = 'verified announcement "' + id + '" for user "' + username + '" to downloading it: authorization failed';
                  logger.log.warn(IDLOG, strlog);
                  compUtil.net.sendHttp403(IDLOG, res);
                  return;
                }

              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                compUtil.net.sendHttp500(IDLOG, res, error.toString());
              }
            });

          } else {
            logger.log.warn(IDLOG, 'listening audio announcement with id "' + id + '": authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Gets the list of all public and user private audio file for announcements with the following REST API:
       *
       *     list_announcement
       *
       * @method list_announcement
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      list_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            // returns public files and user's private
            logger.log.info(IDLOG, 'getting list of audio file for announcements: user "' + username + '" has the "admin_offhour" authorization');

            compOffhour.listAllAnnouncement(function (err, results) {
              try {
                if (err) {
                  logger.log.error(IDLOG, 'getting list of all audio file for announcements for user "' + username + '"');
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }
                var strlog = 'send list of all audio file for announcements to user "' + username + '"';
                logger.log.info(IDLOG, strlog);
                res.send(200, results);

              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                compUtil.net.sendHttp500(IDLOG, res, error.toString());
              }
            });

          } else if (compAuthorization.authorizeOffhourUser(username) === true) {
            // returns user's files
            logger.log.info(IDLOG, 'getting list of audio file for announcements: user "' + username + '" has the "offhour" authorization');

            compOffhour.listAllPublicAndUserPrivateAnnouncement(username, function (err, results) {
              try {
                if (err) {
                  logger.log.error(IDLOG, 'getting list of user audio file for announcements for user "' + username + '"');
                  compUtil.net.sendHttp500(IDLOG, res, err.toString());
                  return;
                }
                var strlog = 'send list of user audio file for announcements to user "' + username + '"';
                logger.log.info(IDLOG, strlog);
                res.send(200, results);

              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                compUtil.net.sendHttp500(IDLOG, res, error.toString());
              }
            });

          } else {
            logger.log.warn(IDLOG, 'getting list of audio file for announcements: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Set the offhour for the inbound route. It provides the functions to set offhour announcement,
       * announcement + voicemail or redirect and set validity "always", "period" or "never" with the
       * following REST API:
       *
       *     set_offhour
       *
       * @method set_offhour
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      set_offhour: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          if (typeof req.params.calledIdNum !== 'string' ||
            typeof req.params.callerIdNum !== 'string' ||
            (
              req.params.enabled !== 'always' &&
              req.params.enabled !== 'never' &&
              req.params.enabled !== 'period'
            ) ||
            (
              req.params.enabled === 'period' &&
              (
                typeof req.params.start_date !== 'string' ||
                typeof req.params.end_date !== 'string'
              )
            ) ||
            (typeof req.params.action === 'string' &&
              (
                req.params.action !== 'audiomsg' &&
                req.params.action !== 'audiomsg_voicemail' &&
                req.params.action !== 'redirect'
              ) ||
              (
                req.params.action === 'audiomsg' &&
                (
                  typeof req.params.announcement_id !== 'string' ||
                  req.params.announcement_id === ''
                )
              ) ||
              (
                req.params.action === 'audiomsg_voicemail' &&
                (
                  typeof req.params.announcement_id !== 'string' ||
                  req.params.announcement_id === '' ||
                  typeof req.params.voicemail_id !== 'string' ||
                  req.params.voicemail_id === ''
                )
              ) ||
              (
                req.params.action === 'redirect' &&
                (
                  typeof req.params.redirect_to !== 'string' ||
                  req.params.redirect_to === ''
                )
              )
            )
          ) {

            compUtil.net.sendHttp400(IDLOG, res, req.params);
            return;
          }

          // check the authorization. The user has the permission to set offhour in these cases:
          //
          // 1. he has the admin permission
          // 2. he has the advanced permission and the involved inbound route is generic or his own
          // 3. he has the basic permission and the involved inbound route is his own
          //
          if (!compAuthorization.authorizeAdminOffhourUser(username) &&
            !compAuthorization.authorizeAdvancedOffhourUser(username) &&
            !compAuthorization.authorizeOffhourUser(username)) {

            logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" does not have any permission');
            compUtil.net.sendHttp403(IDLOG, res);
            return;

          } else if (
            //
            // BASIC
            //
            // the user has the basic permission
            !compAuthorization.authorizeAdminOffhourUser(username) &&
            !compAuthorization.authorizeAdvancedOffhourUser(username) &&
            compAuthorization.authorizeOffhourUser(username)) {

            setOffhourOfBasicUser(username, req, res);

          } else if (
            //
            // ADVANCED
            //
            // the user has the advanced permission
            !compAuthorization.authorizeAdminOffhourUser(username) &&
            compAuthorization.authorizeAdvancedOffhourUser(username)) {

            setOffhourOfAdvancedUser(username, req, res);

          } else if (compAuthorization.authorizeAdminOffhourUser(username)) {
            //
            // ADMIN
            //
            // the user has the admin permission
            logger.log.info(IDLOG, 'setting offhour: user "' + username + '" has admin permission');
            setOffhour(req.params, username, res);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Modify some data about the audio file for announcement with the following REST API:
       *
       *     modify_announcement
       *
       * @method modify_announcement
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      modify_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var announcementId = req.params.id;
          var privacy = req.params.privacy;
          var description = req.params.description;

          if (typeof announcementId !== 'string' ||
            (privacy && privacy !== 'private' && privacy !== 'public') ||
            privacy === undefined && description === undefined || // at least one must be present
            (description && typeof description !== 'string')) {

            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }

          var data = {
            id: announcementId,
            privacy: privacy,
            description: description
          };

          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'modifying announcement "' + announcementId + '": user "' + username + '" has the "admin_offhour" authorization');

          } else if (compAuthorization.authorizeOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'modifying announcement "' + announcementId + '": user "' + username + '" has the "offhour" authorization');

          } else {
            logger.log.warn(IDLOG, 'modifying announcement "' + announcementId + '": authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // verify that the announcement if owned by the user. Only the owner can modify the announcement
          compAuthorization.verifyOffhourUserAnnouncement(username, announcementId, function (err, result) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'verifying announcement "' + announcementId + '" for user "' + username + '" to modify it');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }

              if (result === true) {
                var strlog = 'verified announcement "' + announcementId + '" for user "' + username + '": he has the authorization to modify it';
                logger.log.info(IDLOG, strlog);

                compOffhour.modifyAnnouncement(data, function (err) {
                  try {
                    if (err) {
                      logger.log.error(IDLOG, 'modifying announcement "' + announcementId + '" by user "' + username + '"');
                      compUtil.net.sendHttp500(IDLOG, res, err.toString());
                      return;
                    }
                    var strlog = 'modified announcement "' + announcementId + '" by user "' + username + '"';
                    logger.log.info(IDLOG, strlog);
                    compUtil.net.sendHttp200(IDLOG, res);

                  } catch (error) {
                    logger.log.error(IDLOG, error.stack);
                    compUtil.net.sendHttp500(IDLOG, res, error.toString());
                  }
                });

              } else {
                var strlog = 'verified announcement "' + announcementId + '" for user "' + username + '" to modify it: authorization failed';
                logger.log.warn(IDLOG, strlog);
                compUtil.net.sendHttp403(IDLOG, res);
                return;
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
       * Delete the audio file for announcement with the following REST API:
       *
       *     delete_announcement
       *
       * @method delete_announcement
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      delete_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var announcementId = req.params.id;

          if (typeof announcementId !== 'string') {
            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }

          // check if the user has the offhour authorization
          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'deleting audio announcement with id "' + announcementId + '": user "' + username + '" has the "admin_offhour" authorization');

          } else if (compAuthorization.authorizeOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'deleting audio announcement with id "' + announcementId + '": user "' + username + '" has the "offhour" authorization');

          } else {
            logger.log.warn(IDLOG, 'deleting audio announcement with id "' + announcementId + '": authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // verify that the announcement if owned by the user. Only the owner can delete the announcement
          compAuthorization.verifyOffhourUserAnnouncement(username, announcementId, function (err, result) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'verifying announcement "' + announcementId + '" for user "' + username + '" to delete it');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }

              if (result === true) {
                var strlog = 'verified announcement "' + announcementId + '" for user "' + username + '": he has the authorization to delete it';
                logger.log.info(IDLOG, strlog);

                compOffhour.deleteAnnouncement(announcementId, function (err) {
                  try {
                    if (err) {
                      logger.log.error(IDLOG, 'deleting announcement "' + announcementId + '" by user "' + username + '"');
                      compUtil.net.sendHttp500(IDLOG, res, err.toString());
                      return;
                    }
                    var strlog = 'deleted announcement "' + announcementId + '" by user "' + username + '"';
                    logger.log.warn(IDLOG, strlog);
                    compUtil.net.sendHttp200(IDLOG, res);

                  } catch (error) {
                    logger.log.error(IDLOG, error.stack);
                    compUtil.net.sendHttp500(IDLOG, res, error.toString());
                  }
                });

              } else {
                var strlog = 'verified announcement "' + announcementId + '" for user "' + username + '" to delete it: authorization failed';
                logger.log.warn(IDLOG, strlog);
                compUtil.net.sendHttp403(IDLOG, res);
                return;
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
       * Record new audio file for announcement with the following REST API:
       *
       *     record_announcement
       *
       * @method record_announcement
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      record_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          // check if the user has the offhour authorization
          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'recording new audio for announcement by user "' + username + '" has the "admin_offhour" authorization');

          } else if (compAuthorization.authorizeOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'recording new audio for announcement by user "' + username + '" has the "offhour" authorization');

          } else {
            logger.log.warn(IDLOG, 'recording new audio for announcement: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          compOffhour.recordAnnouncement(username, function (err, result) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'recording new audio for announcement by user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }
              var strlog = 'recording new audio for announcement started by user "' + username + '"';
              logger.log.info(IDLOG, strlog);
              res.send(200, result);

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
       * Enable the uploaded audio file for announcement with the following REST API:
       *
       *     enable_announcement
       *
       * @method enable_announcement
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      enable_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var privacy = req.params.privacy;
          var tempFilename = req.params.tempFilename;
          var description = req.params.description;

          if (typeof tempFilename !== 'string' ||
            typeof description !== 'string' ||
            description === '' ||
            (privacy !== 'public' && privacy !== 'private')) {

            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }

          // check if the user has the offhour authorization
          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'enabling recorded audio file for announcement: user "' + username + '" has the "admin_offhour" authorization');

          } else if (compAuthorization.authorizeOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'enabling recorded audio file for announcement: user "' + username + '" has the "offhour" authorization');

          } else {
            logger.log.warn(IDLOG, 'enabling recorded audio file for announcement: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          compOffhour.enableAnnouncement({
            user: username,
            privacy: privacy,
            description: description,
            tempFilename: tempFilename

          }, function (err) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'enabling recorded audio file for announcement by user "' + username + '" ("' + tempFilename + '" - "' + privacy + '")');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }
              var strlog = 'enabled recorded audio file for announcement by user "' + username + '" ("' + tempFilename + '" - "' + privacy + '")';
              logger.log.info(IDLOG, strlog);
              compUtil.net.sendHttp200(IDLOG, res);

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
       * Upload the audio file for announcement with the following REST API:
       *
       *     upload_announcement
       *
       * @method upload_announcement
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      upload_announcement: function (req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var privacy = req.params.privacy;
          var description = req.params.description;
          var audio_content = req.params.audio_content;

          if (typeof description !== 'string' || description === '' ||
            (privacy !== 'public' && privacy !== 'private') ||
            typeof audio_content !== 'string') {

            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }

          // check if the user has the offhour authorization
          if (compAuthorization.authorizeAdminOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'uploading audio file for announcement: user "' + username + '" has the "admin_offhour" authorization');

          } else if (compAuthorization.authorizeOffhourUser(username) === true) {
            logger.log.info(IDLOG, 'uploading audio file for announcement: user "' + username + '" has the "offhour" authorization');

          } else {
            logger.log.warn(IDLOG, 'uploading audio file for announcement: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          compOffhour.uploadAnnouncement({
            user: username,
            privacy: privacy,
            description: description,
            audio_content: audio_content

          }, function (err) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'uploading audio file for announcement by user "' + username + '" ("' + privacy + '")');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }
              var strlog = 'uploaded audio file for announcement by user "' + username + '" ("' + privacy + '")';
              logger.log.info(IDLOG, strlog);
              compUtil.net.sendHttp200(IDLOG, res);

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
    }
    exports.api = offhour.api;
    exports.list = offhour.list;
    exports.set_offhour = offhour.set_offhour;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.setCompOffhour = setCompOffhour;
    exports.setCompStaticHttp = setCompStaticHttp;
    exports.list_announcement = offhour.list_announcement;
    exports.listen_announcement = offhour.listen_announcement;
    exports.modify_announcement = offhour.modify_announcement;
    exports.delete_announcement = offhour.delete_announcement;
    exports.record_announcement = offhour.record_announcement;
    exports.enable_announcement = offhour.enable_announcement,
    exports.upload_announcement = offhour.upload_announcement,
    exports.download_announcement = offhour.download_announcement;
    exports.setCompAuthorization = setCompAuthorization;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();

/**
 * Listen announcement using offhour component. This returns the content of
 * the audio file using base64 enconding. So the data is sent to the client.
 *
 * @method listenAnnouncement
 * @param {string} id The identifier of the announcement
 * @param {string} username The name of the user
 * @param {object} res The client response
 * @private
 */
function listenAnnouncement(id, username, res) {
  try {
    compOffhour.getAnnouncementFileContent(id, function (err, result) {
      try {
        if (err) {
          var str = 'getting file content of audio announcement with id "' + id + '" to listen by the user "' + username + '"';
          logger.log.warn(IDLOG, str);
          compUtil.net.sendHttp500(IDLOG, res, err);

        } else {
          logger.log.info(IDLOG, 'got file content of audio announcement with id "' + id + '" for user "' + username + '"');
          res.send(200, result);
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

/**
 * Listen announcement using offhour component. This returns the content of
 * the audio file using base64 enconding. So the data is sent to the client.
 *
 * @method setOffhour
 * @param {object} params The parameters passed by the client
 * @param {string} username The name of the user
 * @param {object} res The response
 * @param {function} cb The callback function
 * @private
 */
function setOffhour(params, username, res) {
  try {
    var data = {
      enabled: params.enabled,
      startDate: params.start_date,
      endDate: params.end_date,
      username: username,
      calledIdNum: params.calledIdNum,
      callerIdNum: params.callerIdNum,
      action: params.action,
      redirectTo: params.redirect_to,
      voicemailId: params.voicemail_id,
      announcementId: params.announcement_id
    };

    compOffhour.setOffhour(data, function (err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'setting offhour of inbound route "' + params.calledIdNum + '/' + params.callerIdNum + '" by user "' + data.username + '"');
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
          return;
        }
        var strlog = 'set offhour of inbound route "' + params.calledIdNum + '/' + params.callerIdNum + '" by user "' + data.username + '"';
        logger.log.info(IDLOG, strlog);
        compUtil.net.sendHttp200(IDLOG, res);

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

/**
 * Set the offhour for the inbound route. The user has the basic permission.
 * It checks all the required permissions.
 *
 * @method setOffhourOfBasicUser
 * @param {string} username The name of the user
 * @param {object} req The request
 * @param {object} res The response
 * @param {function} cb The callback function
 * @private
 */
function setOffhourOfBasicUser(username, req, res) {
  try {
    logger.log.info(IDLOG, 'setting offhour: user "' + username + '" has basic permission');

    if (req.params.action === 'audiomsg' && typeof req.params.announcement_id === 'string') {

      // verify that audio message is owned by the user or has the public visibility
      compOffhour.verifyAudioMessagePermission(username, req.params.announcement_id, function (err, value) {
        try {
          if (err) {
            throw err;
          }
          if (!value) {
            logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" has basic permission, ' +
              'but he does not have any permission on specified audio message id "' + req.params.announcement_id + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // verify that the inbound route is owned by the user
          compOffhour.verifyBasicInboundRouteOfUser(username, req.params.calledIdNum, req.params.callerIdNum, function (err, value) {
            try {
              if (err) {
                throw err;
              }
              if (!value) {
                logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" has basic permission,' +
                  'but specified inbound route is not owned by the user');
                compUtil.net.sendHttp403(IDLOG, res);
                return;
              }
              setOffhour(req.params, username, res);

            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              compUtil.net.sendHttp500(IDLOG, res, error.toString());
            }
          });

        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      });
    }
    // verify that audio message is owned by the user or has the public visibility and the voicemail is owned by the user
    else if (req.params.action === 'audiomsg_voicemail') {
      // verify that audio message is owned by the user or has the public visibility
      compOffhour.verifyAudioMessagePermission(username, req.params.announcement_id, function (err, value) {
        try {
          if (err) {
            throw err;
          }
          if (!value) {
            logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" has basic permission, ' +
              'but he does not have any permission on specified audio message id "' + req.params.announcement_id + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // verify that voicemail is owned by the user
          if (!compAuthorization.verifyUserEndpointVoicemail(username, req.params.voicemail_id)) {
            logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" has basic permission, ' +
              'but he does not have any permission on specified voiemail id "' + req.params.voicemail_id + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // verify that the inbound route is owned by the user
          compOffhour.verifyBasicInboundRouteOfUser(username, req.params.calledIdNum, req.params.callerIdNum, function (err, value) {
            try {
              if (err) {
                throw err;
              }
              if (!value) {
                logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" has basic permission,' +
                  'but specified inbound route is not owned by the user');
                compUtil.net.sendHttp403(IDLOG, res);
                return;
              }
              setOffhour(req.params, username, res);

            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              compUtil.net.sendHttp500(IDLOG, res, error.toString());
            }
          });

        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      });
    }
    // redirect
    else {
      // verify that the inbound route is owned by the user
      compOffhour.verifyBasicInboundRouteOfUser(username, req.params.calledIdNum, req.params.callerIdNum, function (err, value) {
        try {
          if (err) {
            throw err;
          }
          if (!value) {
            logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" has basic permission,' +
              'but specified inbound route is not owned by the user');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
          setOffhour(req.params, username, res);

        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      });
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    compUtil.net.sendHttp500(IDLOG, res, err.toString());
  }
}

/**
 * Set the offhour for the inbound route. The user has the advanced permission.
 * It checks all the required permissions.
 *
 * @method setOffhourOfAdvancedUser
 * @param {string} username The name of the user
 * @param {object} req The request
 * @param {object} res The response
 * @param {function} cb The callback function
 * @private
 */
function setOffhourOfAdvancedUser(username, req, res) {
  try {
    logger.log.info(IDLOG, 'setting offhour: user "' + username + '" has advanced permission');

    if (req.params.action === 'audiomsg' || req.params.action === 'audiomsg_voicemail') {

      // verify that audio message is owned by the user or has the public visibility
      compOffhour.verifyAudioMessagePermission(username, req.params.announcement_id, function (err, value) {
        try {
          if (err) {
            throw err;
          }
          if (!value) {
            logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" has advanced permission, ' +
              'but he does not have any permission on specified audio message id "' + req.params.announcement_id + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // verify that the inbound route is owned by the user or is generic
          compOffhour.verifyAdvancedInboundRouteOfUser(username, req.params.calledIdNum, req.params.callerIdNum, function (err, value) {
            try {
              if (err) {
                logger.log.error(IDLOG, err.stack);
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }
              if (!value) {
                logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" have advanced permission,' +
                  'but specified inbound route is not owned by the user or it is not a generic one');
                compUtil.net.sendHttp403(IDLOG, res);
                return;
              }
              setOffhour(req.params, username, res);

            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              compUtil.net.sendHttp500(IDLOG, res, error.toString());
            }
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      });
    }
    // redirect
    else {
      // verify that the inbound route is owned by the user or is generic
      compOffhour.verifyAdvancedInboundRouteOfUser(username, req.params.calledIdNum, req.params.callerIdNum, function (err, value) {
        try {
          if (err) {
            logger.log.error(IDLOG, err.stack);
            compUtil.net.sendHttp500(IDLOG, res, err.toString());
            return;
          }
          if (!value) {
            logger.log.warn(IDLOG, 'setting offhour: user "' + username + '" have advanced permission,' +
              'but specified inbound route is not owned by the user or it is not a generic one');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
          setOffhour(req.params, username, res);

        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      });
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    compUtil.net.sendHttp500(IDLOG, res, err.toString());
  }
}

/**
 * Download audio announcement. It return the filename to be served by the static component.
 *
 * @method downloadAnnouncement
 * @param {string} id The identifier of the call
 * @param {string} username The name of the user
 * @param {object} res The client response
 * @private
 */
function downloadAnnouncement(id, username, res) {
  try {
    compOffhour.getAnnouncementFilePath(id, function(err1, filepath) {
      try {
        if (err1) {
          throw err1;
        } else {
          logger.log.info(IDLOG, 'download of the recording call with id "' + id + '" has been sent successfully to user "' + username + '"');
          // get base path of the call recordings and then construct the filepath using the arguments
          var filename = 'announcement' + id + 'tmpaudio.wav';

          compStaticHttp.copyFile(filepath, filename, function(err1) {
            try {
              if (err1) {
                logger.log.warn(IDLOG, 'copying static file "' + filepath + '" -> "' + filename + '": ' + err1.toString());
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());

              } else {
                logger.log.info(IDLOG, 'send audio announcement filename to download "' + filename + '" to user "' + username + '"');
                res.send(200, filename);
              }
            } catch (err3) {
              logger.log.error(IDLOG, err3.stack);
              compUtil.net.sendHttp500(IDLOG, res, err3.toString());
            }
          });
        }
      } catch (err2) {
        logger.log.error(IDLOG, err2.stack);
        compUtil.net.sendHttp500(IDLOG, res, err2.toString());
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    compUtil.net.sendHttp500(IDLOG, res, err.toString());
  }
}
