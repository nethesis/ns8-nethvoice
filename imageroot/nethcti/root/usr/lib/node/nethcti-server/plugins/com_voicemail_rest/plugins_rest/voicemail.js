/**
 * Provides voicemail functions through REST API.
 *
 * @module com_voicemail_rest
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
 * @default [plugins_rest/voicemail]
 */
var IDLOG = '[plugins_rest/voicemail]';

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
 * The voicemail architect component used for voicemail functions.
 *
 * @property compVoicemail
 * @type object
 * @private
 */
var compVoicemail;

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
 * The architect component to be used for user.
 *
 * @property compUser
 * @type object
 * @private
 */
var compUser;

/**
 * The http static module.
 *
 * @property compStaticHttp
 * @type object
 * @private
 */
var compStaticHttp;

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
 * Set voicemail architect component used by voicemail functions.
 *
 * @method setCompVoicemail
 * @param {object} cp The voicemail architect component.
 */
function setCompVoicemail(cp) {
  try {
    compVoicemail = cp;
    logger.log.info(IDLOG, 'set voicemail architect component');
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
 * Set the user architect component.
 *
 * @method setCompUser
 * @param {object} comp The architect user component
 * @static
 */
function setCompUser(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    compUser = comp;
    logger.log.info(IDLOG, 'user component has been set');

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
      throw new Error('wrong parameter');
    }

    compAuthorization = comp;
    logger.log.info(IDLOG, 'authorization component has been set');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

(function() {
  try {
    /**
    * REST plugin that provides voicemail functions through the following REST API:
    *
    * # GET requests
    *
    * 1. [`voicemail/list/:type[?offset=n&limit=n]`](#listget)
    * 1. [`voicemail/listen/:id`](#listenget)
    * 1. [`voicemail/download/:id`](#downloadget)
    * 1. [`voicemail/listen_custom_msg/:type`](#listen_custom_msgget)
    * 1. [`voicemail/download_custom_msg/:type`](#download_custom_msgget)
    *
    * ---
    *
    * ### <a id="listget">**`voicemail/list/:type[?offset=n&limit=n]`**</a>
    *
    * Returns the list of all voicemail messages of the user.
    * If type is specified returns only messages of the specified type.
    * It supports pagination through offset and limit.
    *
    * Example JSON response:
    *
    *     {
      "count": 39,
      "rows": [
        {
          "origtime": "1490350880",
          "duration": "14",
          "id": 961,
          "dir": "/var/spool/asterisk/voicemail/default/230/Old",
          "callerid": "\"UNIONTEL SRL\" <0521292626>",
          "mailboxuser": "302",
          "type": "old"
        },
        ...
      ]
     }
    *
    * ---
    *
    * ### <a id="listenget">**`voicemail/listen/:id`**</a>
    *
    * The user can listen the voice message of the user. The _id_ must be the identifier of the
    * voice message in the database.
    *
    * ---
    *
    * ### <a id="downloadget">**`voicemail/download/:id`**</a>
    *
    * The user can download the voice message of the user. The _id_ must be the identifier of the
    * voice message in the database. It returns the filename that can be downloaded getting it from
    * <SERVER>/webrest/static/<FILENAME>.
    *
    * ---
    *
    * ### <a id="listen_custom_msgget">**`voicemail/listen_custom_msg/:type`**</a>
    *
    * The user can listen the custom voice message for the specified type. Returns a string with
    * audio file content in base64 format or a 404 response status. The request must contains the following parameters:
    *
    * * `type: ("unavail"|"busy"|"greet") the type of the custom message`
    *
    * Example JSON response:
    *
    *     "UklgRa..."
    *
    * ---
    *
    * ### <a id="download_custom_msgget">**`voicemail/download_custom_msg/:type`**</a>
    *
    * The user can download the custom voice message for the specified type. It returns the filename
    * that can be downloaded getting it from <SERVER>/webrest/static/<FILENAME>. The request must
    * contains the following parameters:
    *
    * * `type: ("unavail"|"busy"|"greet") the type of the custom message`
    *
    * Example JSON response:
    *
    *     { "filename": "custom_msg_vm_201alessandro_busy.wav" }
    *     { "filename": "custom_msg_vm_201alessandro_unavail.wav" }
    *     { "filename": "custom_msg_vm_201alessandro_greet.wav" }
    *
    * ---
    * <br>
    *
    * # POST requests
    *
    * 1. [`voicemail/delete`](#deletepost)
    * 1. [`voicemail/custom_msg`](#custom_msgpost)
    *
    * ---
    *
    * ### <a id="deletepost">**`voicemail/delete`**</a>
    *
    * Delete the specified voicemail message. The request must contains the following parameters:
    *
    * * `id: the voice message identifier of the database`
    *
    * Example JSON request parameters:
    *
    *     { "id": "74" }
    *
    * ---
    *
    * ### <a id="custom_msgpost">**`voicemail/custom_msg`**</a>
    *
    * Upload customized audio message to be listen when the user leave a message.
    * The request must contains the following parameters:
    *
    * * `type: ("unavail"|"busy"|"greet") when the customized audio message has to be listen. "unavail" is to customize
    *                                     message when the user is unavailable or when the voicemail unconditional call forward
    *                                     has been set, "busy" is when he is busy in a conversation
    *                                     and "greet" type is to customize only the name of the person of the voicemail and
    *                                     then the default message will be listen`
    * * `audio: the audio message in base64 format. The original audio file must be wav, 8000Hz and 16 bit format mono`
    *
    * Example JSON request parameters:
    *
    *     { "audio": "data:audio/wav;base64,1234..." }
    *
    *
    * <br>
    *
    * # DELETE requests
    *
    * 1. [`voicemail/custom_msg`](#custom_msgdel)
    *
    * ---
    *
    * ### <a id="custom_msgdel">**`voicemail/custom_msg/:type`**</a>
    *
    * Delete the specified custom voicemail message. The request must contains the following parameters:
    *
    * * `type: ("unavail"|"busy"|"greet") the type of the custom message`
    *
    * Example JSON request parameters:
    *
    *     { "type": "unavail" }
    *
    *
    * @class plugin_rest_voicemail
    * @static
    */
    var voicemail = {

      // the REST api
      api: {
        'root': 'voicemail',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} list/:type[?offset=n&limit=n] To get the list of all voicemail messages of the user
         *   @param {string} listen/:id To listen the voicemail message of the user
         *   @param {string} download/:id To download the voicemail message of the user
         *   @param {string} new_counters To get the number of new voice messages of all voicemails
         *   @param {string} listen_custom_msg/:type To listen the custom message for the voicemail
         *   @param {string} download_custom_msg/:type To download the custom message for the voicemail
         */
        'get': [
          'list/:type',
          'listen/:id',
          'download/:id',
          'new_counters',
          'listen_custom_msg/:type',
          'download_custom_msg/:type'
        ],

        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} delete To delete a voicemail messages of the user
         *   @param {string} custom_msg To customize the audio message for the voicemail
         */
        'post': [
          'delete',
          'custom_msg'
        ],
        'head': [],

        /**
         * REST API to be requested using HTTP DEL request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} custom_msg To delete a custom voicemail messages of the user
         */
        'del': [
          'custom_msg/:type'
        ]
      },

      /**
       * Gets the list of all voicemail messages of the user with the following REST API:
       *
       *     list
       *
       * @method list
       * @param {object} req The client request.
       * @param {object} res The client response.
       * @param {function} next Function to run the next handler in the chain.
       */
      list: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var type = req.params.type;
          var offset = req.params.offset;
          var limit = req.params.limit;

          compVoicemail.getVoiceMessagesByUser(username, type, offset, limit, function(err, results) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'getting all voice messages of user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }

              logger.log.info(IDLOG, 'send the number of voice messages of all voicemailes to user ' + username);
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
       * Gets the number of new voice messages of all voicemails with the following REST API:
       *
       *     new_counters
       *
       * @method new_counters
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      new_counters: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          // check if the user has the "extension" authorization
          if (compAuthorization.authorizePresencePanelUser(username) !== true) {
            logger.log.warn(IDLOG, 'requesting new voice message counter of all voicemails: authorization failed for user "' + username + '"');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          compVoicemail.getAllNewVoiceMessageCount(function(err1, results) {
            try {
              if (err1) {
                logger.log.error(IDLOG, 'getting the number of new voice messages of all voicemailes for user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
                return;
              }

              logger.log.info(IDLOG, 'send the number of new voice messages of all voicemailes to user "' + username + '"');
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
       * Listen the voicemail message of the user with the following REST API:
       *
       *     listen
       *
       * @method listen
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      listen: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          // get the voicemail identifier (mailbox) from the voicemail database identifier.
          // This is for the authorization check
          compVoicemail.getVmIdFromDbId(req.params.id, function(err1, vmid) {
            try {
              if (err1) {
                logger.log.error(IDLOG, 'listening voice message: getting voicemail id (mailbox) from db voice message id "' + req.params.id + '"');
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
                return;
              }

              // check the authorization to listen the voice message checking if the voicemail endpoint is owned by the user
              if (compUser.hasVoicemailEndpoint(username, vmid) !== true) {
                logger.log.warn(IDLOG, 'user "' + username + '" tried to listen voice message with db id "' + req.params.id + '" of the voicemail "' + vmid + '" not owned by him');
                compUtil.net.sendHttp403(IDLOG, res);
                return;
              }

              // listen the voice message
              compVoicemail.listenVoiceMessage(req.params.id, function(err2, result) {
                try {
                  if (err2) {
                    logger.log.error(IDLOG, 'listening voice message with id "' + req.params.id + '" of the voicemail "' + vmid + '" by the user "' + username + '"');
                    compUtil.net.sendHttp500(IDLOG, res, err2.toString());
                    return;
                  }

                  logger.log.info(IDLOG, 'listen voice message with id "' + req.params.id + '" of the voicemail "' + vmid + '" successfully by the user "' + username + '"');
                  res.send(200, result);

                } catch (err3) {
                  logger.log.error(IDLOG, err3.stack);
                  compUtil.net.sendHttp500(IDLOG, res, err3.toString());
                }
              });

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
       * Listen the custom message of the voicemail of the user with the following REST API:
       *
       *     listen_custom_msg
       *
       * @method listen
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      listen_custom_msg: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          if (typeof req.params !== 'object' ||
            typeof req.params.type !== 'string' ||
            (req.params.type !== 'unavail' && req.params.type !== 'busy' && req.params.type !== 'greet')) {

            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }
          var vm = compUser.getEndpointVoicemail(username);
          if (typeof vm !== 'object' || typeof vm.getId !== 'function') {
            var str = 'customizing voicemail message: no voicemail for user "' + username + '": "' + JSON.stringify(vm) + '"';
            logger.log.warn(IDLOG, str);
            compUtil.net.sendHttp500(IDLOG, res, str);
            return;
          }
          vm = vm.getId();
          compVoicemail.listenCustomMessage(vm, req.params.type, function(err, result) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'listening customized vm "' + req.params.type + '" message for user "' + username + '" for vm "' + vm + '"');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }
              if (err === null && result === null) {
                logger.log.warn(IDLOG, 'listen custom message "' + req.params.type + '" for user "' + username + '" for vm "' + vm + '": not found');
                compUtil.net.sendHttp404(IDLOG, res);
              } else {
                logger.log.info(IDLOG, 'sent listen custom message "' + req.params.type + '" for user "' + username + '" for vm "' + vm + '"');
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
      },

      /**
       * Download the voice message of the user with the following REST API:
       *
       *     download
       *
       * @method download
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      download: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          // get the voicemail identifier (mailbox) from the voicemail database identifier.
          // This is for the authorization check
          compVoicemail.getVmIdFromDbId(req.params.id, function(err1, vmid) {
            try {
              if (err1) {
                logger.log.error(IDLOG, 'downloading voice message: getting voicemail id (mailbox) from db with voice message id "' + req.params.id + '" by user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
                return;
              }

              // check the authorization to download the voice message checking if the voicemail endpoint is owned by the user
              if (compUser.hasVoicemailEndpoint(username, vmid) !== true) {
                logger.log.warn(IDLOG, 'user "' + username + '" has tried to download voice message with db id "' + req.params.id + '" of the voicemail "' + vmid + '" not owned by him');
                compUtil.net.sendHttp403(IDLOG, res);
                return;
              }

              // download the voice message
              compVoicemail.listenVoiceMessage(req.params.id, function(err2, result) {
                try {
                  if (err2) {
                    logger.log.error(IDLOG, 'downloading voice message with id "' + req.params.id + '" of the voicemail "' + vmid + '" by the user "' + username + '"');
                    compUtil.net.sendHttp500(IDLOG, res, err2.toString());
                    return;
                  }

                  logger.log.info(IDLOG, 'download voice message with id "' + req.params.id + '" of the voicemail "' + vmid + '" successfully by the user "' + username + '"');
                  var filename = 'voicemail' + req.params.id + username + 'tmpaudio.wav';
                  compStaticHttp.saveFile(filename, result);
                  res.send(200, filename);

                } catch (err3) {
                  logger.log.error(IDLOG, err3.stack);
                  compUtil.net.sendHttp500(IDLOG, res, err3.toString());
                }
              });

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
       * Download the custom voice message for the specified type of the user with the following REST API:
       *
       *     download_custom_msg
       *
       * @method download_custom_msg
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      download_custom_msg: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          if (typeof req.params !== 'object' ||
            typeof req.params.type !== 'string' ||
            (req.params.type !== 'unavail' && req.params.type !== 'busy' && req.params.type !== 'greet')) {

            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }
          var vm = compUser.getEndpointVoicemail(username);
          if (typeof vm !== 'object' || typeof vm.getId !== 'function') {
            var str = 'customizing voicemail message: no voicemail for user "' + username + '": "' + JSON.stringify(vm) + '"';
            logger.log.warn(IDLOG, str);
            compUtil.net.sendHttp500(IDLOG, res, str);
            return;
          }
          vm = vm.getId();
          compVoicemail.listenCustomMessage(vm, req.params.type, function(err, result) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'downloading custom message "' + req.params.type + '" of vm "' + vm + '" by the user "' + username + '"');
                compUtil.net.sendHttp500(IDLOG, res, err.toString());
                return;
              }
              logger.log.info(IDLOG, 'download custom message "' + req.params.type + '" of vm "' + vm + '" successfully by the user "' + username + '"');
              var filename = 'custom_msg_vm_' + vm + '' + username + '_' + req.params.type + '.wav';
              compStaticHttp.saveFile(filename, result);
              res.send(200, filename);

            } catch (err3) {
              logger.log.error(IDLOG, err3.stack);
              compUtil.net.sendHttp500(IDLOG, res, err3.toString());
            }
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      },

      /**
       * Delte the specified voicemail message of the user with the following REST API:
       *
       *     delete
       *
       * @method delete
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      delete: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;

          // get the voicemail identifier (mailbox) from the voicemail database identifier.
          // This is for authorization check
          compVoicemail.getVmIdFromDbId(req.params.id, function(err1, vmid) {
            try {
              if (err1) {
                logger.log.error(IDLOG, 'deleting voice message: getting voicemail id (mailbox) from db voice message id "' + req.params.id + '"');
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
                return;
              }

              // check the authorization to delete the voice message checking if the voicemail endpoint is owned by the user
              if (compUser.hasVoicemailEndpoint(username, vmid) !== true) {
                logger.log.warn(IDLOG, 'user "' + username + '" tried to delete voice message with db id "' + req.params.id + '" of the voicemail "' + vmid + '" not owned by him');
                compUtil.net.sendHttp403(IDLOG, res);
                return;
              }

              // delete the voice message
              compVoicemail.deleteVoiceMessage(req.params.id, function(err2, results) {
                try {

                  if (err2) {
                    logger.log.error(IDLOG, 'deleting voice message with id "' + req.params.id + '" of the voicemail "' + vmid + '" by the user "' + username + '"');
                    compUtil.net.sendHttp500(IDLOG, res, err2.toString());
                    return;
                  }

                  logger.log.info(IDLOG, 'voice message with id "' + req.params.id + '" of the voicemail "' + vmid + '" has been deleted successfully by the user "' + username + '"');
                  res.send(200);

                } catch (err3) {
                  logger.log.error(IDLOG, err3.stack);
                  compUtil.net.sendHttp500(IDLOG, res, err3.toString());
                }
              });

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
       * Customize/delete the audio message for the voicemail of the user with the following REST API:
       *
       *     POST custom_msg
       *     DELETE custom_msg/:type
       *
       * @method delete
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain
       */
      custom_msg: function(req, res, next) {
        try {
          if (req.method.toLowerCase() === 'delete') {
            customMsgDelete(req, res, next);
          } else if (req.method.toLowerCase() === 'post') {
            customMsgPost(req, res, next);
          } else {
            logger.log.warn(IDLOG, 'unknown requested method ' + req.method);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      }
    };
    exports.api = voicemail.api;
    exports.list = voicemail.list;
    exports.listen = voicemail.listen;
    exports.delete = voicemail.delete;
    exports.download = voicemail.download;
    exports.setLogger = setLogger;
    exports.custom_msg = voicemail.custom_msg;
    exports.setCompUser = setCompUser;
    exports.setCompUtil = setCompUtil;
    exports.new_counters = voicemail.new_counters;
    exports.setCompVoicemail = setCompVoicemail;
    exports.setCompStaticHttp = setCompStaticHttp;
    exports.listen_custom_msg = voicemail.listen_custom_msg;
    exports.setCompAuthorization = setCompAuthorization;
    exports.download_custom_msg = voicemail.download_custom_msg;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();

/**
 * Upload customized audio message to be listen when the user leave a message.
 *
 * @method customMsgPost
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function customMsgPost(req, res, next) {
  try {
    var username = req.headers.authorization_user;
    if (typeof req.params !== 'object' ||
      typeof req.params.type !== 'string' ||
      (req.params.type !== 'unavail' && req.params.type !== 'busy' && req.params.type !== 'greet') ||
      typeof req.params.audio !== 'string') {

      compUtil.net.sendHttp400(IDLOG, res);
      return;
    }
    var vm = compUser.getEndpointVoicemail(username);
    if (typeof vm !== 'object' || typeof vm.getId !== 'function') {
      var str = 'customizing voicemail message: no voicemail for user "' + username + '": "' + JSON.stringify(vm) + '"';
      logger.log.warn(IDLOG, str);
      compUtil.net.sendHttp500(IDLOG, res, str);
      return;
    }
    vm = vm.getId();
    compVoicemail.setCustomVmAudioMsg(vm, req.params.type, req.params.audio, function(err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'setting customized vm "' + req.params.type + '" message for user "' + username + '" for vm "' + vm + '"');
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
          return;
        }
        logger.log.info(IDLOG, 'customized vm "' + req.params.type + '" message for user "' + username + '" for vm "' + vm + '" has been set successfully');
        res.send(200);
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
 * Delete customized audio message of voicemail.
 *
 * @method customMsgDelete
 * @param {object} req The request object
 * @param {object} res The response object
 * @param {object} next
 */
function customMsgDelete(req, res, next) {
  try {
    // extract the username added in the authentication step
    var username = req.headers.authorization_user;
    if (typeof req.params !== 'object' ||
      typeof req.params.type !== 'string' ||
      (req.params.type !== 'unavail' && req.params.type !== 'busy' && req.params.type !== 'greet')) {

      compUtil.net.sendHttp400(IDLOG, res);
      return;
    }
    var vm = compUser.getEndpointVoicemail(username);
    if (typeof vm !== 'object' || typeof vm.getId !== 'function') {
      var str = 'deleting voicemail message: no voicemail for user "' + username + '": "' + JSON.stringify(vm) + '"';
      logger.log.warn(IDLOG, str);
      compUtil.net.sendHttp500(IDLOG, res, str);
      return;
    }
    vm = vm.getId();
    compVoicemail.deleteCustomMessage(vm, req.params.type, function(err, result) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'deleting custom message "' + req.params.type + '" of vm "' + vm + '" by the user "' + username + '"');
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
          return;
        }
        if (err === null && result === null) {
          logger.log.warn(IDLOG, 'deleting custom message "' + req.params.type + '" of vm "' + vm + '" by user "' + username + '": entry not found');
          compUtil.net.sendHttp404(IDLOG, res);
        } else {
          logger.log.info(IDLOG, 'deleted custom message "' + req.params.type + '" of vm "' + vm + '" successfully by the user "' + username + '"');
          res.send(200);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        compUtil.net.sendHttp500(IDLOG, res, err.toString());
      }
    });
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    compUtil.net.sendHttp500(IDLOG, res, error.toString());
  }
}
