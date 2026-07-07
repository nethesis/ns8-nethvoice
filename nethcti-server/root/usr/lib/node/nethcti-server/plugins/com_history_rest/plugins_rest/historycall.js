/**
 * Provides asterisk history call functions through REST API.
 *
 * @module com_history_rest
 * @submodule plugins_rest
 */
var path = require('path');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins_rest/historycall]
 */
var IDLOG = '[plugins_rest/historycall]';

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
 * The history architect component used for history functions.
 *
 * @property compHistory
 * @type object
 * @private
 */
var compHistory;

/**
 * The utility architect component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

/**
 * The user architect component.
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
 * The asterisk proxy architect component.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * Sets the asterisk proxy architect component.
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
 * Sets the user architect component.
 *
 * @method setCompUser
 * @param {object} comp The user architect component.
 */
function setCompUser(comp) {
  try {
    compUser = comp;
    logger.log.info(IDLOG, 'set user architect component');
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
        * REST plugin that provides history functions through the following REST API:
        *
        * # GET requests
        *
        * 1. [`historycall/down_callrec/:id`](#down_callrecget)
        * 1. [`historycall/listen_callrec/:id`](#listen_callrecget)
        * 1. [`historycall/interval/:type/:target/:from/:to[?direction=dir&limit=n&offset=n&sort=field]`](#intervalget)
        * 1. [`historycall/interval/:type/:target/:from/:to/:filter[?direction=dir&limit=n&offset=n&sort=field]`](#interval_filterget)
        *
        * ---
        *
        * ### <a id="down_callrecget">**`historycall/down_callrec/:id`**</a>
        *
        * The user can downlaod the record audio file of a call. The _id_ is the _uniqueid_ field obtained
        * by _historycall/interval_ api. The user with _admin recording_ authorization can download all audio
        * files, while the user with the _recording_ permission can download only the audio file of his own calls.
        *
        * ---
        *
        * ### <a id="listen_callrecget">**`historycall/listen_callrec/:id`**</a>
        *
        * The user can listen the record audio file of a call. The _id_ is the _uniqueid_ field obtained
        * by _historycall/interval_ api. The user with _admin recording_ authorization can listen all audio
        * files, while the user with the _recording_ permission can listen only the audio file of his own calls.
        *
        * ---
        *
        * ### <a id="intervalget">**`historycall/interval/:type/:target/:from/:to[?direction=dir&limit=n&offset=n&sort=field]`**</a>
        *
        * Returns the history call between _"from"_ date to _"to"_ date of the extension or of the user.
        *
        * * `type: ("extension" | "user")`
        * * `target: the extension identifier or the username`
        * * `from: the start date in YYYYMMDD format`
        * * `to: the end date in YYYYMMDD format`
        * * `[direction]: ("in" | "out" | "lost") the direction of the calls`
        *
        * The results will be the history calls of the single extension or the history calls of all the extensions of the user.
        * If an error occurs an HTTP 500 response is returned. Supports the pagination with the limit and offset parameters and sorting.
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
            "direction": "in" // can be ("in" | "out" | "") if it involves one of extension of the user
         },
         ...
     ]
        *
        * ---
        *
        * ### <a id="interval_filterget">**`historycall/interval/:type/:target/:from/:to/:filter[?direction=dir&limit=n&offset=n&sort=field]`**</a>
        *
        * Returns the history call between _"from"_ date to _"to"_ date of the extension or of the user filtering by _"filter"_.
        *
        * * `type: ("extension" | "user")`
        * * `target: the extension identifier or the username`
        * * `from: the start date in YYYYMMDD format`
        * * `to: the end date in YYYYMMDD format`
        * * `filter: filter results on "cnum", "clid" and "dst" fields of the database`
        * * `[direction]: ("in" | "out") the direction of the calls`
        *
        * The results will be the history calls of the single extension or the history calls of all the extensions of the user.
        * If an error occurs an HTTP 500 response is returned. Supports the pagination with the limit and offset parameters and sorting.
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
            "direction": "in" // can be ("in" | "out" | "") if it involves one of extension of the user
         },
         ...
     ]
        *
        * <br>
        *
        * # POST requests
        *
        * 1. [`historycall/delete_callrec`](#delete_callrecpost)
        *
        * ---
        *
        * ### <a id="delete_callrecpost">**`historycall/delete_callrec`**</a>
        *
        * Delete the specified call recording. The request must contains the following parameters:
        *
        * * `id: the identifier of the call in the database`
        *
        * Example JSON request parameters:
        *
        *     { "id": "74" }
        *
        * @class plugin_rest_historycall
        * @static
        */
    var historycall = {

      // the REST api
      api: {
        'root': 'historycall',

        /**
         * REST API to be requested using HTTP GET request.
         *
         * @property get
         * @type {array}
         *
         *   @param {string} down_callrec/:id   To download the record audio file of a call
         *
         *   @param {string} listen_callrec/:id To listen the record audio file of a call
         *
         *   @param {string} interval/:type/:target/:from/:to[?direction=dir&limit=n&offset=n&sort=field] To get the history call between _"from"_ date to _"to"_ date.
         *     The date must be expressed in YYYYMMDD format
         *
         *   @param {string} interval/:type/:target/:from/:to/:filter[?direction=dir&limit=n&offset=n&sort=field] To get the history call between _"from"_ date to _"to"_
         *     date filtering by filter. The date must be expressed in YYYYMMDD format
         */
        'get': [
          'down_callrec/:id',
          'listen_callrec/:id',
          'interval/:type/:target/:from/:to',
          'interval/:type/:target/:from/:to/:filter'
        ],

        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         *   @param {string} delete_callrec To delete a call recording
         */
        'post': ['delete_callrec'],
        'head': [],
        'del': []
      },

      /**
       * Delete the record audio file of a call with the following REST API:
       *
       *     delete_callrec
       *
       * @method delete_callrec
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      delete_callrec: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var id = req.params.id;

          // check the "admin recording" authorization. If the user has this permission he can delete
          // all the audio files. So gets the file information and delete it
          if (compAuthorization.authorizeAdminRecordingUser(username) === true) {
            logger.log.info(IDLOG, 'deleting record call audio file: "admin recording" authorization successful for user "' + username + '"');

            // get the file information using the history component. The information are the creation year,
            // month, day and the filename. This data is need to delete the file using history component
            compHistory.getCallRecordingFileData(id, function(err, result) {
              try {

                if (err) {
                  throw err;
                }

                // the user isn't involved in the recorded call, so he can't delete it
                else if (typeof result === 'boolean' && !result) {
                  var str = 'no data information about recording call with id "' + id + '" to delete by the user "' + username + '"';
                  logger.log.warn(IDLOG, str);
                  compUtil.net.sendHttp500(IDLOG, res, str);

                } else {
                  // delete recorded call
                  deleteCallRecording(id, username, result, res);
                }
              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
              }
            });
          }
          // check the "recording" authorization
          else if (compAuthorization.authorizeRecordingUser(username) !== true) {
            logger.log.warn(IDLOG, 'deleting record call audio file: "recording" authorization failed for user "' + username + '" !');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
          // the user has the "recording" authorization, so check if the recorded call relates to himself
          else {
            // get all the extension endpoints of the user
            var extens = Object.keys(compUser.getAllEndpointsExtension(username));

            // here the user only has the "recording" authorization so he can delete only the recording call in which he
            // is involved. So checks if at least one extension of the user is involved in the recorded call. As a result
            // of this test is returned a "false" value if the test is failed, an object with the file information if the
            // test is successful
            compHistory.isAtLeastExtenInCallRecording(id, extens, function(err, result) {
              try {
                if (err) {
                  throw err;
                }
                // the user isn't involved in the recorded call, so he can't delete it
                else if (typeof result === 'boolean' && !result) {

                  logger.log.warn(IDLOG, 'user "' + username + '" try to delete the recording call id "' + id +
                    '", but he is not involved in the call');
                  compUtil.net.sendHttp403(IDLOG, res);

                } else {
                  // the user is involved in the recorded call so the file is deleted
                  deleteCallRecording(id, username, result, res);
                }

              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
              }
            });
          }
        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      },

      /**
       * Listen the record audio file of a call with the following REST API:
       *
       *     listen_callrec
       *
       * @method listen_callrec
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      listen_callrec: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var id = req.params.id;

          // check the "admin recording" authorization. If the user has this permission he can listen
          // all the audio file. So gets the file information and then return the data to the client
          if (compAuthorization.authorizeAdminRecordingUser(username) === true) {
            logger.log.info(IDLOG, 'listening record call audio file: admin recording authorization successful for user "' + username + '"');

            // get the file information using the history component. The information are the creation year,
            // month, day and the filename. This data is need to listen the file using history component
            compHistory.getCallRecordingFileData(id, function(err, result) {
              try {

                if (err) {
                  throw err;
                }

                // the user isn't involved in the recorded call, so he can't listen it
                else if (typeof result === 'boolean' && !result) {
                  var str = 'no data information about recording call with id "' + id + '" to listen by the user "' + username + '"';
                  logger.log.warn(IDLOG, str);
                  compUtil.net.sendHttp500(IDLOG, res, str);

                } else {
                  // listen recorded call, so the content of the file is sent to the client
                  listenCallRecording(id, username, result, res);
                }
              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
              }
            });

          }

          // check the "recording" authorization
          else if (compAuthorization.authorizeRecordingUser(username) !== true) {
            logger.log.warn(IDLOG, 'listening record call audio file: recording authorization failed for user "' + username + '" !');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // the user has the "recording" authorization, so check if the recorded call relates to himself
          else {
            // get all the extension endpoints of the user
            var extens = Object.keys(compUser.getAllEndpointsExtension(username));

            // here the user has only the "recording" authorization so he can listen only the recording call in which he
            // is involved. So checks if at least one extension of the user is involved in the recorded call. As a result
            // of this test is returned a "false" value if the test is failed, an object with the file information if the
            // test is successful
            compHistory.isAtLeastExtenInCallRecording(id, extens, function(err, result) {
              try {

                if (err) {
                  throw err;
                }

                // the user isn't involved in the recorded call, so he can't listen it
                else if (typeof result === 'boolean' && !result) {
                  logger.log.warn(IDLOG, 'user "' + username + '" try to listen the recording call id "' + id + '", but he isn\'t involved in the call');
                  compUtil.net.sendHttp403(IDLOG, res);

                } else {
                  // the user is involved in the recorded call so the content of the file is sent to the client
                  listenCallRecording(id, username, result, res);
                }

              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
              }
            });
          }

        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      },

      /**
       * Download the record audio file of a call with the following REST API:
       *
       *     down_callrec
       *
       * @method down_callrec
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      down_callrec: function(req, res, next) {
        try {
          // extract the username added in the authentication step
          var username = req.headers.authorization_user;
          var id = req.params.id;

          // check the "admin recording" authorization. If the user has this permission he can download
          // all the audio files. So gets the file information and then return the data to the client
          if (compAuthorization.authorizeAdminRecordingUser(username) === true) {
            logger.log.info(IDLOG, 'downloading record call audio file: "admin recording" authorization successful for user "' + username + '"');

            // get the file information using the history component. The information are the creation year,
            // month, day and the filename. This data is need to download the file using the history component
            compHistory.getCallRecordingFileData(id, function(err, result) {
              try {

                if (err) {
                  throw err;
                }

                // the user isn't involved in the recorded call, so he can't download it
                else if (typeof result === 'boolean' && !result) {
                  var str = 'no data information about recording call with id "' + id + '" to download it by the user "' + username + '"';
                  logger.log.warn(IDLOG, str);
                  compUtil.net.sendHttp500(IDLOG, res, str);

                } else {
                  // download recorded call, so the content of the file is sent to the client
                  downCallRecording(id, username, result, res);
                }
              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
              }
            });

          }

          // check the "recording" authorization
          else if (compAuthorization.authorizeRecordingUser(username) !== true) {
            logger.log.warn(IDLOG, 'downloading record call audio file: "recording" authorization failed for user "' + username + '" !');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          // the user has the "recording" authorization, so check if the recorded call relates to himself
          else {
            // get all the extension endpoints of the user
            var extens = Object.keys(compUser.getAllEndpointsExtension(username));

            // here the user only has the "recording" authorization so he can download only the recording call in which he
            // is involved. So checks if at least one extension of the user is involved in the recorded call. As a result
            // of this test is returned a "false" value if the test is failed, an object with the file information if the
            // test is successful
            compHistory.isAtLeastExtenInCallRecording(id, extens, function(err, result) {
              try {

                if (err) {
                  throw err;
                }

                // the user isn't involved in the recorded call, so he can't download it
                else if (typeof result === 'boolean' && !result) {
                  logger.log.warn(IDLOG, 'user "' + username + '" try to download the recording call id "' + id + '", but he isn\'t involved in the call');
                  compUtil.net.sendHttp403(IDLOG, res);

                } else {
                  // the user is involved in the recorded call so the content of the file is sent to the client
                  downCallRecording(id, username, result, res);
                }

              } catch (err1) {
                logger.log.error(IDLOG, err1.stack);
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());
              }
            });
          }

        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      },

      /**
       * Search the history call for the specified interval, endpoint and optional filter by the following REST api:
       *
       *     interval/:type/:target/:from/:to[?direction=dir&limit=n&offset=n&sort=field]
       *     interval/:type/:target/:from/:to/:filter[?direction=dir&limit=n&offset=n&sort=field]
       *
       * @method interval
       * @param {object} req The client request
       * @param {object} res The client response
       * @param {function} next Function to run the next handler in the chain.
       */
      interval: function(req, res, next) {
        try {
          // get the username from the authorization header added by authentication step
          var username = req.headers.authorization_user;

          // check parameters
          if (req.params.type !== 'extension' && req.params.type !== 'user') {
            compUtil.net.sendHttp400(IDLOG, res);
            return;
          }

          // check the administration cdr authorization
          if (compAuthorization.authorizeAdminCdrUser(username) === true) {
            logger.log.info(IDLOG, 'getting history interval call: admin cdr authorization successful for user "' + username + '"');
          }
          // check if the endpoint in the request is an endpoint of the
          // applicant user. The user can only see the cdr of his endpoints
          else if (compAuthorization.authorizeCdrUser(username) === true &&
            req.params.type === 'extension' &&
            compAuthorization.verifyUserEndpointExten(username, req.params.target) === false) {

            logger.log.warn(IDLOG, 'authorization cdr call failed for user "' + username + '": requested extension "' +
              req.params.target + '" not owned by him');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
          // check if the request is about the user. The user can only see his cdr
          else if (compAuthorization.authorizeCdrUser(username) === true &&
            req.params.type === 'user' &&
            req.params.target !== username) {

            logger.log.warn(IDLOG, 'authorization cdr call failed for user "' + username + '": requested user "' +
              req.params.target + '" not himself');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }
          // check the cdr authorization
          else if (compAuthorization.authorizeCdrUser(username) !== true) {
            logger.log.warn(IDLOG, 'getting history interval call: cdr authorization failed for user "' + username + '" !');
            compUtil.net.sendHttp403(IDLOG, res);
            return;
          }

          logger.log.info(IDLOG, 'cdr authorization successfully for user "' + username + '" and target ' + req.params.target);

          // check the "administration recording" and "recording" authorizations. If it's enabled
          // the user can view also all the data about his recording audio files
          var recording = (compAuthorization.authorizeRecordingUser(username) || compAuthorization.authorizeAdminRecordingUser(username));
          if (compAuthorization.authorizeAdminRecordingUser(username) === true) {
            logger.log.info(IDLOG, 'user "' + username + '" has the "admin recording" authorization');

          } else if (compAuthorization.authorizeRecordingUser(username) === true) {
            logger.log.info(IDLOG, 'user "' + username + '" has the "recording" authorization');

          } else {
            logger.log.info(IDLOG, 'user "' + username + '" has neither the "admin recording" nor the "recording" authorization');
          }

          var extens;
          if (req.params.type === 'user') {
            extens = Object.keys(compUser.getAllEndpointsExtension(req.params.target));
          } else {
            extens = [req.params.target];
          }

          var obj = {
            to: req.params.to,
            from: req.params.from,
            endpoints: extens,
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
          if (req.params.direction) {
            obj.direction = req.params.direction;
          }
          if (req.params.removeLostCalls) {
            obj.removeLostCalls = req.params.removeLostCalls;
          }

          // use the history component
          compHistory.getHistoryCallInterval(obj, function(err1, results) {
            try {
              if (err1) {
                throw err1;
              } else {
                logger.log.info(IDLOG, 'send #' + results.count + ' results searching history call' +
                  ' interval between ' + obj.from + ' to ' + obj.to + ' for ' +
                  req.params.type + ' "' + req.params.target + '" [' + obj.endpoints + ']' +
                  ' and filter ' + (obj.filter ? obj.filter : '""') +
                  (obj.recording ? ' with recording data' : '') +
                  ' to user "' + username + '"');
                res.send(200, results);
              }

            } catch (err2) {
              logger.log.error(IDLOG, err2.stack);
              compUtil.net.sendHttp500(IDLOG, res, err2.toString());
            }
          });
        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          compUtil.net.sendHttp500(IDLOG, res, error.toString());
        }
      }
    };
    exports.api = historycall.api;
    exports.interval = historycall.interval;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.setCompUser = setCompUser;
    exports.down_callrec = historycall.down_callrec;
    exports.listen_callrec = historycall.listen_callrec;
    exports.delete_callrec = historycall.delete_callrec;
    exports.setCompStaticHttp = setCompStaticHttp;
    exports.setCompAstProxy = setCompAstProxy;
    exports.setCompHistory = setCompHistory;
    exports.setCompAuthorization = setCompAuthorization;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();

/**
 * Listen call recording using history component. This returns the content of
 * the audio file using base64 enconding. So the data is sent to the client.
 *
 * @method listenCallRecording
 * @param {string} id              The identifier of the call
 * @param {string} username        The name of the user
 * @param {object} data
 *   @param {string} data.year     The creation year of the file
 *   @param {string} data.month    The creation month of the file
 *   @param {string} data.day      The creation day of the file
 *   @param {string} data.filename The name of the file
 * @param {object} res             The client response
 * @private
 */
function listenCallRecording(id, username, data, res) {
  try {
    compHistory.getCallRecordingContent(data, function(err1, result) {
      try {

        if (err1) {
          throw err1;
        } else {
          logger.log.info(IDLOG, 'listen of the recording call with id "' + id + '" has been sent successfully to user "' + username + '"');
          res.send(200, result);
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

/**
 * Download call recording using the history component. It return the filename
 * to be served by the static component.
 *
 * @method downCallRecording
 * @param {string} id              The identifier of the call
 * @param {string} username        The name of the user
 * @param {object} data
 *   @param {string} data.year     The creation year of the file
 *   @param {string} data.month    The creation month of the file
 *   @param {string} data.day      The creation day of the file
 *   @param {string} data.filename The name of the file
 * @param {object} res             The client response
 * @private
 */
function downCallRecording(id, username, data, res) {
  try {
    compHistory.getCallRecordingContent(data, function(err1, result) {
      try {

        if (err1) {
          throw err1;
        } else {
          logger.log.info(IDLOG, 'download of the recording call with id "' + id + '" has been sent successfully to user "' + username + '"');
          // get base path of the call recordings and then construct the filepath using the arguments
          var filename = 'recording' + id + username + 'tmpaudio.wav';
          var basepath = compAstProxy.getBaseCallRecAudioPath();
          var filepath = path.join(basepath, data.year, data.month, data.day, data.filename);

          compStaticHttp.copyFile(filepath, filename, function(err1) {
            try {
              if (err1) {
                logger.log.warn(IDLOG, 'copying static file "' + filepath + '" -> "' + filename + '": ' + err1.toString());
                compUtil.net.sendHttp500(IDLOG, res, err1.toString());

              } else {
                logger.log.info(IDLOG, 'send recording filename to download "' + filename + '" to user "' + username + '"');
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

/**
 * Delete call recording using history component.
 *
 * @method deleteCallRecording
 * @param {string} id              The identifier of the call
 * @param {string} username        The name of the user
 * @param {object} data
 *   @param {string} data.year     The creation year of the file
 *   @param {string} data.month    The creation month of the file
 *   @param {string} data.day      The creation day of the file
 *   @param {string} data.filename The name of the file
 * @param {object} res             The client response
 * @private
 */
function deleteCallRecording(id, username, data, res) {
  try {
    compHistory.deleteCallRecording(id, data, function(err1, result) {
      try {
        if (err1) {
          throw err1;
        } else {
          logger.log.info(IDLOG, 'the recording call with id "' + id + '" has been deleted successfully by the user "' + username + '"');
          res.send(200, result);
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
