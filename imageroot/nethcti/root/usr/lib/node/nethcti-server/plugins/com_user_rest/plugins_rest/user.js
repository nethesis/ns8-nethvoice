/**
 * Provides user functions through REST API.
 *
 * @module com_user_rest
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
 * @default [plugins_rest/user]
 */
var IDLOG = '[plugins_rest/user]';

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
 * The architect component to be used for authorization.
 *
 * @property compAuthorization
 * @type object
 * @private
 */
var compAuthorization;

/**
 * The configuration manager architect component.
 *
 * @property compConfigManager
 * @type object
 * @private
 */
var compConfigManager;

/**
 * The asterisk proxy architect component.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * The architect component to be used for user functions.
 *
 * @property compUser
 * @type object
 * @private
 */
var compUser;

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
 * Set user architect component used for user functions.
 *
 * @method setCompUser
 * @param {object} comp The user architect component.
 */
function setCompUser(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    compUser = comp;
    logger.log.info(IDLOG, 'set user architect component');
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
     * REST plugin that provides user functions through the following REST API:
     *
     * # GET requests
     *
     * 1. [`user/presence`](#presenceget)
     * 1. [`user/presencelist`](#presencelistget)
     * 1. [`user/presencelist_onbusy`](#presencelist_onbusyget)
     * 1. [`user/presencelist_onunavailable`](#presencelist_onunavailableget)
     * 1. [`user/presence_onbusy`](#presence_onbusyget)
     * 1. [`user/presence_onunavailable`](#presence_onunavailableget)
     * 1. [`user/me`](#meget)
     * 1. [`user/endpoints/all`](#userendpointsallget)
     * 1. [`user/paramurl`](#paramurlget)
     *
     * ---
     *
     * ### <a id="presenceget">**`user/presence`**</a>
     *
     * Returns the user presence status.
     *
     * Example JSON response:
     *
     *     { "status": "online" }
     *
     * ---
     *
     * ### <a id="presencelistget">**`user/presencelist`**</a>
     *
     * Returns the list of the possible user presence status.
     *
     * Example JSON response:
     *
     *     ["online", "dnd", "voicemail", "cellphone", "callforward"]
     *
     * ---
     *
     * ### <a id="presencelist_onbusyget">**`user/presencelist_onbusy`**</a>
     *
     * Returns the list of the possible conditional user presence on busy status.
     *
     * Example JSON response:
     *
     *     ["callforward", "voicemail", "online", "cellphone"]
     *
     * ---
     *
     * ### <a id="presencelist_onunavailableget">**`user/presencelist_onunavailable`**</a>
     *
     * Returns the list of the possible conditional user presence on unavailable status.
     *
     * Example JSON response:
     *
     *     ["callforward", "voicemail", "online", "cellphone"]
     *
     * ---
     *
     * ### <a id="presenceget">**`user/presence`**</a>
     *
     * Returns the user presence status.
     *
     * Example JSON response:
     *
     *     { "status": "online" }
     *     { "status": "voicemail" }
     *     { "status": "cellphone" }
     *     { "status": "callforward", "to": "12345" }
     *
     * ---
     *
     * ### <a id="presence_onbusyget">**`user/presence_onbusy`**</a>
     *
     * Returns the conditional user presence status on busy.
     *
     * Example JSON response:
     *
     *     { "status": "online" }
     *     { "status": "cellphone" }
     *     { "status": "voicemail" }
     *     { "status": "callforward", "to": "12345" }
     *
     * ---
     *
     * ### <a id="presence_onunavailableget">**`user/presence_onunavailable`**</a>
     *
     * Returns the conditional user presence status on unavailable.
     *
     * Example JSON response:
     *
     *     { "status": "online" }
     *     { "status": "cellphone" }
     *     { "status": "voicemail" }
     *     { "status": "callforward", "to": "12345" }
     *
     * ---
     *
     * ### <a id="meget">**`user/me`**</a>
     *
     * Returns the information about the user.
     *
     * Example JSON response:
     *
     *      {
        "presence": "online",
        "name": "user admin",
        "username": "user",
        "endpoints": {
          "email": [
            {
              "id": "user@nethesis.it"
            }
          ],
          "jabber": [
            {
              "id": "user@nethesis.it",
              "server": "https://my.server.it/http-bind"
            }
          ],
          "extension": [
            {
              "id": "91301",
              "description": "Yealink SIP-T22P 7.73.0.50",
              "type": "physical",
              "web_user": "admin",
              "web_password": "admin",
              "actions": {
                "answer": true,
                "dtmf": true,
                "hold": true
              }
            },
            {
              "id": "92301",
              "description": "janus",
              "type": "webrtc",
              "secret": "password",
              "actions": {
                "answer": true,
                "dtmf": true,
                "hold": true
              }
            },
            {
              "id": "92304",
              "description": "janus",
              "type": "mobile",
              "secret": "password",
              "actions": {
                "answer": true,
                "dtmf": true,
                "hold": true
              }
            }
          ],
          "cellphone": [
            {
              "id": "1234567890"
            }
          ],
          "voicemail": [
            {
              "id": "301"
            }
          ],
          "mainextension": [
            {
              "id": "301",
              "description": "Yealink SIP-T22P 7.73.0.50"
            }
          ]
        },
        "profile": {
          "id": "3",
          "name": "Advanced",
          "macro_permissions": {
            "settings": {
              "value": true,
              "permissions": {
                "call_waiting": {
                  "id": "1",
                  "name": "call_waiting",
                  "value": true
                },
                ...
              }
            },
            ...
          }
        },
        "default_device": {
          "id": "200",
          "type": "webrtc",
          "secret": "12345",
          "username": "200",
          "description": "Yealink"
        },
        "settings": {
          "prop1": "value1",
          "prop2": {
            "sub-key2": "sub-value2"
          },
          "prop3": [
            "sub-key3",
            {
              "sub-key3a": "sub-value3a"
            }
          ],
          "default_extension": "200",
          ...
        }
      }
     *
     * ---
     *
     * ### <a id="all_avatarsget">**`user/all_avatars`**</a>
     *
     * Returns all user settings.
     *
     * Example JSON response:
     *
     *
     {
      "giovanni": "data:image/jpeg;base64,/9j/QCF69485Hjj=//gADKv/iC/hJQ0Nf..",
      "alessandro": "data:image/jpeg;base64,/9j/QCF69485Hjj=//5AFKE/iC/hJQ0Nf.."
     }
     *
     * ---
     *
     * ### <a id="userendpointsallget">**`user/endpoints/all`**</a>
     *
     * Returns the information about all users endpoints.
     *
     * Example JSON response:
     *
     *      {
        "alessandro": {
            "name": "Alessandro Polidori",
            "presence": "online",
            "username": "alessandro",
            "endpoints": {
                "email": [],
                "extension": [
                    {
                        "id": "223",
                        "type": "physical",
                        "description": "Yealink SIP-T22P 7.73.0.50"
                    },
                    {
                        "id": "91223",
                        "type": "webrtc",
                        "secret": "9793a942680ac41f29296d1cae8bdfb6",
                        "username": "91223",
                        "description": "Janus WebRTC Gateway SIP Plugin 0.0.6"
                    }
                ],
                "cellphone": [
                    {
                        "id": "3405512345"
                    }
                ],
                "voicemail": [
                    {
                        "id": "223"
                    }
                ],
                "mainextension": [
                    {
                        "id": "223",
                        "description": "Yealink SIP-T22P 7.73.0.50"
                    }
                ]
            }
        },
        ...
      }
     *
     * ---
     *
     * ### <a id="paramurlget">**`user/paramurl`**</a>
     *
     * Returns the parameterized URL allowed for the user profile.
     *
     * Example JSON response:
     *
     *      {
        "id": 84, "profile_id": 3, "url": "https://mycrm.it/script.php?caller=$CALLER_NAME..."}
      }
     *
     *
     * <br>
     *
     * # POST requests
     *
     * 1. [`user/presence`](#presencepost)
     * 1. [`user/presence_onbusy`](#presence_onbusypost)
     * 1. [`user/presence_onunavailable`](#presence_onunavailablepost)
     * 1. [`user/settings`](#settingspost)
     * 1. [`user/default_device`](#default_devicepost)
     * 1. [`user/mobile`](#mobilepost)
     *
     * ---
     *
     * ### <a id="#presencepost">**`user/presence`**</a>
     *
     * Set the user presence status. The request must contain the following parameters:
     *
     * * `status: valid status obtained by GET user/presencelist`
     * * `[to]: valid destination number to be specified with "callforward" status`
     *
     * Example JSON request parameters:
     *
     *     { "status": "online" }
     *     { "status": "dnd" }
     *     { "status": "voicemail" }
     *     { "status": "cellphone" }
     *     { "status": "callforward", "to": "0123456789" }
     *
     * ---
     *
     * ### <a id="presence_onbusypost">**`user/presence_onbusy`**</a>
     *
     * Set the conditional user presence on busy status. The request must contain the following parameters:
     *
     * * `status: valid status obtained by GET user/presencelist_onbusy`
     * * `[to]: valid destination number to be specified with "callforward" status`
     *
     * Example JSON request parameters:
     *
     *     { "status": "online" }
     *     { "status": "voicemail" }
     *     { "status": "cellphone" }
     *     { "status": "callforward", "to": "0123456789" }
     *
     * ---
     *
     * ### <a id="presence_onunavailablepost">**`user/presence_onunavailable`**</a>
     *
     * Set the conditional user presence on unavailable status. The request must contain the following parameters:
     *
     * * `status: valid status obtained by GET user/presencelist_onunavailable`
     * * `[to]: valid destination number to be specified with "callforward" status`
     *
     * Example JSON request parameters:
     *
     *     { "status": "online" }
     *     { "status": "voicemail" }
     *     { "status": "cellphone" }
     *     { "status": "callforward", "to": "0123456789" }
     *
     * ---
     *
     * ### <a id="#settingspost">**`user/settings`**</a>
     *
     * Save the user settings. The request must contain the following parameters:
     *
     * * `data: a valid JSON object. Keys must to be strings of maximum length of 50 characters.`
     *
     * Example JSON request parameters:
     *
     *     { "key1": "value1", "key": { "sub-key1": "sub-value1" } } }
     *
     * ---
     *
     * ### <a id="#default_devicepost">**`user/default_device`**</a>
     *
     * Set the user default device to be used for call operations. The request must contain the following parameters:
     *
     * * `id: the extension identifier`
     *
     * Example JSON request parameters:
     *
     *     { "id": "214" }
     *
     * ---
     *
     * ### <a id="#mobilepost">**`user/mobile`**</a>
     *
     * Associate a mobile phone number to the user. The request must contain the following parameters:
     *
     * * `number: the mobile phone number`
     *
     * Example JSON request parameters:
     *
     *     { "number": "3401234567" }
     *
     *
     * <br>
     *
     * # DELETE requests
     *
     * 1. [`user/settings`](#settingsdelete)
     * 1. [`user/setting/:prop`](#settingdelete)
     *
     * ---
     *
     * ### <a id="#settingsdelete">**`user/settings`**</a>
     *
     * Delete all the user settings.
     *
     * ### <a id="#settingdelete">**`user/setting/:prop`**</a>
     *
     * Delete the setting property of the user. The request must contain the following parameters:
     *
     * * `prop: the setting property to be deleted. It can be a key set with "user/settings" POST api`
     *
     * Example JSON request parameters:
     *
     *     { "prop": "avatar" }
     *
     * @class plugin_rest_user
     * @static
     */
    var user = {

      // the REST api
      api: {
        'root': 'user',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} me To get the user information
         *   @param {string} paramurl To get the parameterized URL for the user profile
         *   @param {string} presence To get the user presence status
         *   @param {string} presence_onbusy To get the conditional user presence status on busy
         *   @param {string} presence_onunavailable To get the conditional user presence status on unavailable
         *   @param {string} presencelist To get the list of possible presence status
         *   @param {string} presencelist_onbusy To get the list of possible conditional presence on busy status
         *   @param {string} presencelist_onunavailable To get the list of possible conditional presence on unavailable status
         *   @param {string} all_avatars To get the all user settings
         */
        'get': [
          'me',
          'paramurl',
          'presence',
          'all_avatars',
          'presencelist',
          'endpoints/all',
          'presence_onbusy',
          'presencelist_onbusy',
          'presence_onunavailable',
          'presencelist_onunavailable'
        ],

        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} presence Set a presence status for the user
         *   @param {string} settings Save the user settings
         *   @param {string} default_device Set a default extension for the user
         *   @param {string} presence_onbusy Set a conditional presence status on busy for the user
         *   @param {string} presence_onunavailable Set a conditional presence status on unavailable for the user
         *   @param {string} mobile Associate a mobile phone number to the user
         */
        'post': [
          'presence',
          'settings',
          'default_device',
          'presence_onbusy',
          'presence_onunavailable',
          'mobile'
        ],
        'head': [],

        /**
         * REST API to be requested using HTTP DELETE request.
         *
         * @property del
         * @type {array}
         *
         *   @param {string} settings Delete all user settings
         *   @param {string} setting/:prop Delete a single user setting
         */
        'del': [
          'settings',
          'setting/:prop'
        ]
      },

      /**
       * Get the information about the user by the following REST API:
       *
       *     me
       *
       * @method me
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      me: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var result = compUser.getUserInfoJSON(username);
          result.profile = compAuthorization.getUserProfileJSON(username);
          // remove remote_sites permissions: it is not used
          delete result.profile.macro_permissions.remote_sites;
          if (typeof result === 'object') {

            var defExt = compConfigManager.getDefaultUserExtensionConf(username);
            var i, defextObj;

            // create default_device key to return with result
            for (i = 0; i < result.endpoints[compUser.ENDPOINT_TYPES.extension].length; i++) {

              var extenAgent = compAstProxy.getExtensionAgent(result.endpoints[compUser.ENDPOINT_TYPES.extension][i].id);
              var actions = {};
              if (result.endpoints[compUser.ENDPOINT_TYPES.extension][i].type === 'webrtc' ||
                result.endpoints[compUser.ENDPOINT_TYPES.extension][i].type === 'mobile') {

                actions.answer = true;
                actions.dtmf = true;
                actions.hold = true;
              } else {
                actions.answer = compConfigManager.phoneSupportHttpApi(extenAgent);
                actions.dtmf = compConfigManager.phoneSupportDtmfHttpApi(extenAgent);
                actions.hold = compConfigManager.phoneSupportHoldHttpApi(extenAgent);
              }
              result.endpoints[compUser.ENDPOINT_TYPES.extension][i].actions = actions;

              if (result.endpoints[compUser.ENDPOINT_TYPES.extension][i].id === defExt) {
                defextObj = result.endpoints[compUser.ENDPOINT_TYPES.extension][i];
              }
              if (result.endpoints[compUser.ENDPOINT_TYPES.extension][i].type === 'mobile') {
                  result.endpoints[compUser.ENDPOINT_TYPES.extension][i].proxy_port = compConfigManager.getProxyPort();
              } else {
                  result.endpoints[compUser.ENDPOINT_TYPES.extension][i].proxy_port = null;
              }
            }
            for (i = 0; i < result.endpoints[compUser.ENDPOINT_TYPES.mainextension].length; i++) {
              if (result.endpoints[compUser.ENDPOINT_TYPES.mainextension][i].id === defExt) {
                defextObj = result.endpoints[compUser.ENDPOINT_TYPES.extension][i];
                break;
              }
            }
            result.default_device = defextObj;

            // add server url for jabber endpoints
            var serverUrl = (compConfigManager.getChatConf()).url || '';
            for (i = 0; i < result.endpoints[compUser.ENDPOINT_TYPES.jabber].length; i++) {
              result.endpoints[compUser.ENDPOINT_TYPES.jabber][i].server = serverUrl;
            }

            // get user settings
            compUser.getUserSettings(username, function(err, settings) {
              if (err) {
                logger.log.error(IDLOG, 'getting user settings for user "' + username + '"');
              } else {
                result.settings = settings;
              }
              logger.log.info(IDLOG, 'send user info to user "' + username + '"');
              res.send(200, result);
            });
          } else {
            var strerr = 'sending user info to user "' + username + '": wrong format';
            logger.log.error(IDLOG, strerr);
            compUtil.net.sendHttp500(IDLOG, res, strerr);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Get the parameterized URL fot he user profile by the following REST API:
       *
       *     paramurl
       *
       * @method paramurl
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      paramurl: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var profileId = compAuthorization.getUserProfileId(username);
          compUser.getParamUrl(username, profileId, function(err, result) {
            if (err) {
              logger.log.error(IDLOG, 'getting parameterized URL for user "' + username + '": ' + err.toString());
              compUtil.net.sendHttp500(IDLOG, res, err.toString());
              return;
            }
            logger.log.info(IDLOG, 'send parameterized URL for user "' + username + '": ' + result);
            res.send(200, result);
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Get all endpoints by the following REST API:
       *
       *     endpoints
       *
       * @method endpoints
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      endpoints: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var endpoints = compUser.getAllUsersEndpointsJSON();
          var results = {};
          var i;

          for (i in endpoints) {
            results[i] = compUser.getUserInfoJSON(i);
          }
          logger.log.info(IDLOG, 'send endpoints to user "' + username + '"');
          res.send(200, results);

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Get the list of possible conditional presence on busy status by the following REST API:
       *
       *     presencelist_onbusy
       *
       * @method presencelist_onbusy
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      presencelist_onbusy: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var results = compUser.getPresenceListOnBusy(username);
          if (results instanceof Array) {
            logger.log.info(IDLOG, 'send conditional user presence on busy list to user "' + username + '"');
            res.send(200, results);
          } else {
            var strerr = 'sending conditional user presence on busy list to user "' + username + '": wrong format';
            logger.log.error(IDLOG, strerr);
            compUtil.net.sendHttp500(IDLOG, res, strerr);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Get the list of possible conditional presence on unavailable status by the following REST API:
       *
       *     presencelist_onunavailable
       *
       * @method presencelist_onunavailable
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      presencelist_onunavailable: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var results = compUser.getPresenceListOnUnavailable(username);
          if (results instanceof Array) {
            logger.log.info(IDLOG, 'send conditional user presence on unavailable list to user "' + username + '"');
            res.send(200, results);
          } else {
            var strerr = 'sending conditional user presence on unavailable list to user "' + username + '": wrong format';
            logger.log.error(IDLOG, strerr);
            compUtil.net.sendHttp500(IDLOG, res, strerr);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Get the list of possible presence status by the following REST API:
       *
       *     presencelist
       *
       * @method presencelist
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      presencelist: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var results = compUser.getPresenceList(username);
          if (!compAuthorization.authorizeDndUser(username) && results.indexOf(compUser.USER_PRESENCE_STATUS.dnd) !== -1) {
            results.splice(results.indexOf(compUser.USER_PRESENCE_STATUS.dnd), 1);
          }
          if (!compAuthorization.authorizeCfUser(username)) {
            if (results.indexOf(compUser.USER_PRESENCE_STATUS.callforward) !== -1) {
              results.splice(results.indexOf(compUser.USER_PRESENCE_STATUS.callforward), 1);
            }
            if (results.indexOf(compUser.USER_PRESENCE_STATUS.voicemail) !== -1) {
              results.splice(results.indexOf(compUser.USER_PRESENCE_STATUS.voicemail), 1);
            }
            if (results.indexOf(compUser.USER_PRESENCE_STATUS.cellphone) !== -1) {
              results.splice(results.indexOf(compUser.USER_PRESENCE_STATUS.cellphone), 1);
            }
          }
          if (results instanceof Array) {
            logger.log.info(IDLOG, 'send user presence list to user "' + username + '"');
            res.send(200, results);
          } else {
            var strerr = 'sending user presence list to user "' + username + '": wrong format';
            logger.log.error(IDLOG, strerr);
            compUtil.net.sendHttp500(IDLOG, res, strerr);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Manages GET and POST requests to get/set the status presence of
       * the user with the following REST API:
       *
       *     GET  presence
       *     POST presence
       *
       * @method presence
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      presence: function(req, res, next) {
        try {
          if (req.method.toLowerCase() === 'get') {
            presenceGet(req, res, next);
          } else if (req.method.toLowerCase() === 'post') {
            presenceSet(req, res, next);
          } else {
            logger.log.warn(IDLOG, 'unknown requested method ' + req.method);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Manages GET and POST requests to get/set the conditional status presence
       * on busy of the user with the following REST API:
       *
       *     GET presence_onbusy
       *     POST presence_onbusy
       *
       * @method presence_onbusy
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      presence_onbusy: function(req, res, next) {
        try {
          if (req.method.toLowerCase() === 'get') {
            presenceOnBusyGet(req, res, next);
          } else if (req.method.toLowerCase() === 'post') {
            presenceOnBusySet(req, res, next);
          } else {
            logger.log.warn(IDLOG, 'unknown requested method ' + req.method);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Manages GET and POST requests to get/set the conditional status presence
       * on unavailable of the user with the following REST API:
       *
       *     GET presence_onunavailable
       *     POST presence_onunavailable
       *
       * @method presence_onunavailable
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      presence_onunavailable: function(req, res, next) {
        try {
          if (req.method.toLowerCase() === 'get') {
            presenceOnUnavailableGet(req, res, next);
          } else if (req.method.toLowerCase() === 'post') {
            presenceOnUnavailableSet(req, res, next);
          } else {
            logger.log.warn(IDLOG, 'unknown requested method ' + req.method);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Associate a mobile phone number to the user with the following REST API:
       *
       *     POST mobile
       *
       * @method mobile
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      mobile: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var pnumber = req.params.number;

          compUser.setMobilePhoneNumber(username, pnumber, function(err) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'setting mobile phone number "' + pnumber + '" to user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
              } else {
                logger.log.info(IDLOG, 'set mobile phone number "' + pnumber + '" to user "' + username + '"');
                compUtil.net.sendHttp200(IDLOG, res);
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
       * Save/Delete the user settings by the following REST API:
       *
       *     POST settings
       *     DELETE settings
       *
       * @method settings
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      settings: function(req, res, next) {
        try {
          if (req.method.toLowerCase() === 'post') {
            settingsPost(req, res, next);
          } else if (req.method.toLowerCase() === 'delete') {
            settingsDelete(req, res, next);
          } else {
            logger.log.warn(IDLOG, 'unknown requested method ' + req.method);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Delete a single user setting by the following REST API:
       *
       *     DELETE setting
       *
       * @method settings
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      setting: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;
          var prop = req.params.prop;

          compUser.deleteSetting(username, prop, function(err) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'deleting setting "' + prop + '" for user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
              } else {
                logger.log.info(IDLOG, 'deleted setting "' + prop + '" for user "' + username + '"');
                compUtil.net.sendHttp200(IDLOG, res);
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
       * Set the default extension for the user by the following REST API:
       *
       *     default_device
       *
       * @method default_device
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      default_device: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;

          if (typeof req.params.id !== 'string') {
            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }

          compConfigManager.setDefaultUserExtensionConf(username, req.params.id, function(err) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'setting default extension "' + req.params.id + '" to user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
              } else {
                logger.log.info(IDLOG, 'set default extension "' + req.params.id + '" to user "' + username + '"');
                compUtil.net.sendHttp200(IDLOG, res);
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
       * Get all users settings by the following REST API:
       *
       *     all_avatars
       *
       * @method all_avatars
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      all_avatars: function(req, res, next) {
        try {
          var username = req.headers.authorization_user;

          compConfigManager.retrieveUsersSettings(function(results) {
            logger.log.info(IDLOG, 'send all settings to user "' + username + '"');
            var obj = {};
            for (var i in results) {
              obj[i] = results[i].avatar;
            }

            res.send(200, obj);
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      }
    };

    exports.me = user.me;
    exports.api = user.api;
    exports.mobile = user.mobile;
    exports.setting = user.setting;
    exports.paramurl = user.paramurl;
    exports.presence = user.presence;
    exports.settings = user.settings;
    exports.setLogger = setLogger;
    exports.endpoints = user.endpoints;
    exports.setCompUtil = setCompUtil;
    exports.setCompUser = setCompUser;
    exports.all_avatars = user.all_avatars;
    exports.presencelist = user.presencelist;
    exports.default_device = user.default_device;
    exports.presence_onbusy = user.presence_onbusy;
    exports.presencelist_onbusy = user.presencelist_onbusy;
    exports.setCompAuthorization = setCompAuthorization;
    exports.setCompConfigManager = setCompConfigManager;
    exports.setCompAstProxy = setCompAstProxy;
    exports.presence_onunavailable = user.presence_onunavailable;
    exports.presencelist_onunavailable = user.presencelist_onunavailable;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();

/**
 * Delete all the user settings.
 *
 * @method settingsDelete
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function settingsDelete(req, res, next) {
  try {
    var username = req.headers.authorization_user;

    compUser.deleteSettings(username, function(err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'deleting settings for user "' + username + '"');
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        } else {
          logger.log.info(IDLOG, 'deleted settings for user "' + username + '"');
          compUtil.net.sendHttp200(IDLOG, res);
        }
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        compUtil.net.sendHttp500(IDLOG, res, error.toString());
      }
    });
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}

/**
 * Save the user settings.
 *
 * @method settingsPost
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function settingsPost(req, res, next) {
  try {
    var username = req.headers.authorization_user;

    if (typeof req.params !== 'object' || Object.keys(req.params).length === 0) {
      compUtil.net.sendHttp400(IDLOG, res);
      return;
    }
    compUser.saveSettings(username, req.params, function(err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'saving settings for user "' + username + '"');
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        } else {
          compConfigManager.loadAllUsersSettings(function (err) {
            if (err) {
              logger.log.error(IDLOG, 're-loading all user settings from db');
              compUtil.net.sendHttp500(IDLOG, res, err.toString());
              return;
            }
            logger.log.info(IDLOG, 'saved settings for user "' + username + '"');
            compUtil.net.sendHttp200(IDLOG, res);
          });
        }
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        compUtil.net.sendHttp500(IDLOG, res, error.toString());
      }
    });
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}

/**
 * Set configuration manager architect component.
 *
 * @method setCompConfigManager
 * @param {object} comp The configuration manager architect component.
 */
function setCompConfigManager(comp) {
  try {
    compConfigManager = comp;
    logger.log.info(IDLOG, 'set configuration manager architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set asterisk proxy architect component.
 *
 * @method setCompAstProxy
 * @param {object} comp The asterisk proxy architect component.
 */
function setCompAstProxy(comp) {
  try {
    compAstProxy = comp;
    logger.log.info(IDLOG, 'set asterisk proxy architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the conditional user presence status on busy.
 *
 * @method presenceOnBusyGet
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function presenceOnBusyGet(req, res, next) {
  try {
    var username = req.headers.authorization_user;
    var status = compUser.getPresenceOnBusy(username);
    logger.log.info(IDLOG, 'send conditional presence status on busy "' + status + '" to user "' + username + '"');
    res.send(200, {
      status: status,
      to: status === compUser.USER_PRESENCE_ONBUSY_STATUS.callforward ? compUser.getPresenceOnBusyCallforwardTo(username) : undefined
    });
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}

/**
 * Get the conditional user presence status on unavailable.
 *
 * @method presenceOnUnavailableGet
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function presenceOnUnavailableGet(req, res, next) {
  try {
    var username = req.headers.authorization_user;
    var status = compUser.getPresenceOnUnavailable(username);
    logger.log.info(IDLOG, 'send conditional presence status on unavailable "' + status + '" to user "' + username + '"');
    res.send(200, {
      status: status,
      to: status === compUser.USER_PRESENCE_ONUNAVAILABLE_STATUS.callforward ? compUser.getPresenceOnUnavailableCallforwardTo(username) : undefined
    });
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}

/**
 * Set the conditional user presence status on busy.
 *
 * @method presenceOnBusySet
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function presenceOnBusySet(req, res, next) {
  try {
    var status = req.params.status;
    var username = req.headers.authorization_user;
    var destination = req.params.to;

    if (!compUser.isValidUserPresenceOnBusy(status) ||
      (status === compUser.USER_PRESENCE_ONBUSY_STATUS.callforward && typeof destination !== 'string')) {

      compUtil.net.sendHttp400(IDLOG, res);
      return;
    }

    if (!compAuthorization.authorizeCfUser(username) &&
      (
        status === compUser.USER_PRESENCE_ONBUSY_STATUS.call_forward ||
        status === compUser.USER_PRESENCE_ONBUSY_STATUS.voicemail ||
        status === compUser.USER_PRESENCE_ONBUSY_STATUS.cellphone
      )) {

      logger.log.warn(IDLOG, 'setting presence on busy cf to user "' + username + '": permission denied');
      compUtil.net.sendHttp403(IDLOG, res);
      return;
    }

    compUser.setPresenceOnBusy({
        username: username,
        status: status,
        destination: req.params.to,
      },
      function(err) {
        try {
          if (err) {
            logger.log.error(IDLOG, 'setting conditional presence on busy "' + status + '" to "' + destination + '" to user "' + username + '"');
            compUtil.net.sendHttp500(IDLOG, res, err.toString());
            return;
          }
          logger.log.info(IDLOG, 'presence conditional on busy "' + status + '" to "' + destination + '" has been set successfully to user "' + username + '" ');
          compUtil.net.sendHttp200(IDLOG, res);

        } catch (err1) {
          logger.log.error(IDLOG, err1.stack);
          compUtil.net.sendHttp500(IDLOG, res, err1.toString());
        }
      }
    );
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}

/**
 * Set the conditional user presence status on unavailable.
 *
 * @method presenceOnUnavailableSet
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function presenceOnUnavailableSet(req, res, next) {
  try {
    var status = req.params.status;
    var username = req.headers.authorization_user;
    var destination = req.params.to;

    if (!compUser.isValidUserPresenceOnUnavailable(status) ||
      (status === compUser.USER_PRESENCE_ONUNAVAILABLE_STATUS.callforward && typeof destination !== 'string')) {

      compUtil.net.sendHttp400(IDLOG, res);
      return;
    }

    if (!compAuthorization.authorizeCfUser(username) &&
      (
        status === compUser.USER_PRESENCE_ONUNAVAILABLE_STATUS.call_forward ||
        status === compUser.USER_PRESENCE_ONUNAVAILABLE_STATUS.voicemail ||
        status === compUser.USER_PRESENCE_ONUNAVAILABLE_STATUS.cellphone
      )) {

      logger.log.warn(IDLOG, 'setting presence on unavailable cf to user "' + username + '": permission denied');
      compUtil.net.sendHttp403(IDLOG, res);
      return;
    }

    compUser.setPresenceOnUnavailable({
        username: username,
        status: status,
        destination: req.params.to,
      },
      function(err) {
        try {
          if (err) {
            logger.log.error(IDLOG, 'setting conditional presence on unavailable "' + status + '" to "' + destination + '" to user "' + username + '"');
            compUtil.net.sendHttp500(IDLOG, res, err.toString());
            return;
          }
          logger.log.info(IDLOG, 'presence conditional on unavailable "' + status + '" to "' + destination + '" has been set successfully to user "' + username + '" ');
          compUtil.net.sendHttp200(IDLOG, res);

        } catch (err1) {
          logger.log.error(IDLOG, err1.stack);
          compUtil.net.sendHttp500(IDLOG, res, err1.toString());
        }
      }
    );
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}

/**
 * Get the user presence status.
 *
 * @method presenceGet
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function presenceGet(req, res, next) {
  try {
    var username = req.headers.authorization_user;
    var status = compUser.getPresence(username);

    logger.log.info(IDLOG, 'send presence status "' + status + '" to user "' + username + '"');
    res.send(200, {
      status: status,
      to: status === compUser.USER_PRESENCE_STATUS.callforward ? compUser.getPresenceCallforwardTo(username) : undefined
    });
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}

/**
 * Set the user presence status.
 *
 * @method presenceSet
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function presenceSet(req, res, next) {
  try {
    var status = req.params.status;
    var username = req.headers.authorization_user;
    if (!compUser.isValidUserPresence(status) ||
      (status === compUser.USER_PRESENCE_STATUS.callforward && !req.params.to)) {

      compUtil.net.sendHttp400(IDLOG, res);
      return;
    }

    if (status === compUser.USER_PRESENCE_STATUS.dnd &&
      !compAuthorization.authorizeDndUser(username)) {

      logger.log.warn(IDLOG, 'setting presence dnd to user "' + username + '": permission denied');
      compUtil.net.sendHttp403(IDLOG, res);
      return;

    } else if (!compAuthorization.authorizeCfUser(username) &&
      (
        status === compUser.USER_PRESENCE_STATUS.call_forward ||
        status === compUser.USER_PRESENCE_STATUS.voicemail ||
        status === compUser.USER_PRESENCE_STATUS.cellphone
      )) {

      logger.log.warn(IDLOG, 'setting presence cf to user "' + username + '": permission denied');
      compUtil.net.sendHttp403(IDLOG, res);
      return;
    }

    // the request has been received from freepbx admin wizard
    if (username === 'admin') {
      username = req.params.username;
      logger.log.warn(IDLOG, 'set presence "' + status + '" to user "' + username + '" by user "admin"');
    }

    compUser.setPresence({
        username: username,
        status: status,
        destination: req.params.to,
      },
      function(err) {
        try {
          if (err) {
            logger.log.error(IDLOG, 'setting presence "' + status + '" to user "' + username + '"');
            compUtil.net.sendHttp500(IDLOG, res, err.toString());
            return;
          }
          logger.log.info(IDLOG, 'presence "' + status + '" has been set successfully to user "' + username + '" ');
          compUtil.net.sendHttp200(IDLOG, res);

        } catch (err1) {
          logger.log.error(IDLOG, err1.stack);
          compUtil.net.sendHttp500(IDLOG, res, err1.toString());
        }
      }
    );
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}
