/**
 * Provides the offhour functions.
 *
 * @module offhour
 * @main arch_offhour
 */
var fs = require('fs');
var path = require('path');
var async = require('async');
var childProcess = require('child_process');

/**
 * Provides the offhour functionalities.
 *
 * @class offhour
 * @static
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [offhour]
 */
var IDLOG = '[offhour]';

/**
 * The destination path of asterisk audio files.
 *
 * @property AUDIO_ASTERISK_PATH
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "/var/lib/asterisk/sounds"
 */
var AUDIO_ASTERISK_PATH = '/var/lib/asterisk/sounds';

/**
 * The destination directory name of audio file for announcements.
 *
 * @property AUDIO_DIRNAME
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "nethcti"
 */
var AUDIO_DIRNAME = 'nethcti';

/**
 * The path of the mpg123 script.
 *
 * @property MPG123_SCRIPT_PATH
 * @type string
 * @private
 */
var MPG123_SCRIPT_PATH = '/usr/bin/mpg123';

/**
 * The path of the sox script.
 *
 * @property SOX_SCRIPT_PATH
 * @type string
 * @private
 */
var SOX_SCRIPT_PATH = '/usr/bin/sox';

/**
 * The destination path of audio file for announcements. It is made
 * joining AUDIO_ASTERISK_PATH and AUDIO_DIRNAME;
 *
 * @property audioAnnouncementPath
 * @type string
 * @private
 */
var audioAnnouncementPath = path.join(AUDIO_ASTERISK_PATH, AUDIO_DIRNAME);

/**
 * The destination path of recorded audio file for announcements.
 *
 * @property AUDIO_RECORDED_PATH
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "/var/spool/asterisk/tmp"
 */
var AUDIO_RECORDED_PATH = '/var/spool/asterisk/tmp';

/**
 * The extension of the audio file for announcements.
 *
 * @property FILEEXT_AUDIO_ANNOUNCEMENT
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "wav"
 */
var FILEEXT_AUDIO_ANNOUNCEMENT = '.wav';

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
 * The dbconn module.
 *
 * @property compDbconn
 * @type object
 * @private
 */
var compDbconn;

/**
 * The config manager module.
 *
 * @property compConfigManager
 * @type object
 * @private
 */
var compConfigManager;

/**
 * The asterisk proxy module.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * The user module.
 *
 * @property compUser
 * @type object
 * @private
 */
var compUser;

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
 * Set the module to be used for database functionalities.
 *
 * @method setCompDbconn
 * @param {object} comp The dbconn module.
 */
function setCompDbconn(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong dbconn object');
    }
    compDbconn = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the module to be used for config manager functionalities.
 *
 * @method setCompConfigManager
 * @param {object} comp The config manager module.
 */
function setCompConfigManager(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong v object');
    }
    compConfigManager = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the module to be used for asterisk proxy functionalities.
 *
 * @method setCompAstProxy
 * @param {object} comp The asterisk proxy module.
 */
function setCompAstProxy(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong asterisk proxy object');
    }
    compAstProxy = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the module to be used for user functionalities.
 *
 * @method setCompUser
 * @param {object} comp The user module.
 */
function setCompUser(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong user object');
    }
    compUser = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns direct did of the user and all other generic inbound routes
 * or returns only the direct dids of the user or return all inbound routes
 * based on the "param" values.
 *
 * @method getAllInboundRoutes
 * @param {string} [username] The user who requested the operation
 * @param {string} param ("all" | "advanced" | "basic")
 * @param {function} cb The callback function
 */
function getAllInboundRoutes(username, param, cb) {
  try {
    // check parameters
    if ((username && typeof username !== 'string') ||
      typeof param !== 'string' ||
      (param !== 'all' && param !== 'advanced' && param !== 'basic') ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    async.parallel([
      function (callback) {
        // get all inbound routes
        compDbconn.getAllInboundRoutes(function (err, results) {
          try {
            if (err) {
              logger.log.error(IDLOG, err);
              callback(err);
            } else {
              callback(null, results);
            }

          } catch (err) {
            logger.log.error(IDLOG, err.stack);
            callback(err);
          }
        });
      },
      function (callback) {
        // get all offhour services
        compDbconn.getOffhours(function (err, results) {
          try {
            if (err) {
              logger.log.error(IDLOG, err);
              callback(err);
            } else {
              callback(null, results);
            }

          } catch (err) {
            logger.log.error(IDLOG, err.stack);
            callback(err);
          }
        });
      },
      function (callback) {
        // get all offhour services
        compDbconn.listAllAnnouncement(function (err, results) {
          try {
            if (err) {
              logger.log.error(IDLOG, err);
              callback(err);
            } else {
              callback(null, results);
            }

          } catch (err) {
            logger.log.error(IDLOG, err.stack);
            callback(err);
          }
        });
      }

    ], function (err, results) {
      // filter the results
      if (err) {
        logger.log.error(IDLOG, err);
      }

      var i, inRouteId, userExtens;
      var objResult = {};
      var arrInRoutes = results[0];
      var arrOffhour = results[1];
      var arrAnnouncements = {};
      results[2].forEach(function (el) {
        arrAnnouncements[el.path.split('/').pop()] = el;
      });

      if (param === 'all') {

        for (i = 0; i < arrInRoutes.length; i++) {
          inRouteId = arrInRoutes[i].extension + '/' + arrInRoutes[i].cidnum;
          objResult[inRouteId] = {
            calledIdNum: arrInRoutes[i].extension,
            callerIdNum: arrInRoutes[i].cidnum,
            destination: arrInRoutes[i].destination,
            description: arrInRoutes[i].description
          };
        }

      } else if (param === 'advanced') {

        userExtens = compUser.getAllEndpointsExtension(username);
        for (i = 0; i < arrInRoutes.length; i++) {
          if (arrInRoutes[i].destination.indexOf('from-did-direct,') !== -1 &&
            !userExtens[(arrInRoutes[i].destination.split(',')[1])]) {

            continue;
          }
          inRouteId = arrInRoutes[i].extension + '/' + arrInRoutes[i].cidnum;
          objResult[inRouteId] = {
            calledIdNum: arrInRoutes[i].extension,
            callerIdNum: arrInRoutes[i].cidnum,
            destination: arrInRoutes[i].destination,
            description: arrInRoutes[i].description
          };
        }

      } else { // basic

        userExtens = compUser.getAllEndpointsExtension(username);
        for (i = 0; i < arrInRoutes.length; i++) {
          if (arrInRoutes[i].destination.indexOf('from-did-direct,') !== -1) {
            if (!userExtens[(arrInRoutes[i].destination.split(',')[1])]) {
              continue;
            }
            inRouteId = arrInRoutes[i].extension + '/' + arrInRoutes[i].cidnum;
            objResult[inRouteId] = {
              calledIdNum: arrInRoutes[i].extension,
              callerIdNum: arrInRoutes[i].cidnum,
              destination: arrInRoutes[i].destination,
              description: arrInRoutes[i].description
            };
          }
        }
      }

      // add offhour data
      var filename;
      for (var k in objResult) {

        for (i = 0; i < arrOffhour.length; i++) {

          if (objResult[k].calledIdNum === arrOffhour[i].didextension &&
            objResult[k].callerIdNum === arrOffhour[i].didcidnum) {

            objResult[k].offhour = {};
            objResult[k].offhour.calledIdNum = arrOffhour[i].didextension;
            objResult[k].offhour.callerIdNum = arrOffhour[i].didcidnum;
            objResult[k].offhour.action = arrOffhour[i].action === 0 ? 'audiomsg' :
              (arrOffhour[i].action === 1 ? 'audiomsg_voicemail' : 'redirect');
            objResult[k].offhour.enabled = arrOffhour[i].enabled === 2 ? 'period' :
              (arrOffhour[i].enabled === 1 ? 'always' : 'never');

            if(arrOffhour[i].datebegin !== null) {
              objResult[k].offhour.period = {
                datebegin: arrOffhour[i].datebegin,
                dateend: arrOffhour[i].dateend,
                timebegin: arrOffhour[i].timebegin,
                timeend: arrOffhour[i].timeend
              };
            }

            if (objResult[k].offhour.action === 'redirect') {
              objResult[k].offhour.redirect = {
                redirect_to: arrOffhour[i].param
              };

            } else if (objResult[k].offhour.action === 'audiomsg' ||
              objResult[k].offhour.action === 'audiomsg_voicemail') {

              var filename = arrOffhour[i].announcement_filepath.split('/').pop() + FILEEXT_AUDIO_ANNOUNCEMENT;

              objResult[k].offhour.audiomsg = {
                announcement_id: arrAnnouncements[filename] ? arrAnnouncements[filename].id : '',
                description: arrAnnouncements[filename] ? arrAnnouncements[filename].description : '',
                privacy: arrAnnouncements[filename] ? arrAnnouncements[filename].privacy : '',
                username: arrAnnouncements[filename] ? arrAnnouncements[filename].username : ''
              };
            }
            if (objResult[k].offhour.action === 'audiomsg_voicemail') {
              objResult[k].offhour.voicemail = { voicemail_id: arrOffhour[i].param };
            }
          }
        }
      }
      cb(err, objResult);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all the inbound routes.
 *
 * @method getAdminInboundRoutes
 * @param {function} cb The callback function
 */
function getAdminInboundRoutes(cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    getAllInboundRoutes(null, 'all', cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the inbound routes of the user and the generics.
 *
 * @method getAdvancedInboundRoutes
 * @param {string} username The user who requested the operation
 * @param {function} cb The callback function
 */
function getAdvancedInboundRoutes(username, cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    getAllInboundRoutes(username, 'advanced', cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the inbound routes of the user.
 *
 * @method getUserInboundRoutes
 * @param {string} username The user who requested the operation
 * @param {function} cb The callback function
 */
function getUserInboundRoutes(username, cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    getAllInboundRoutes(username, 'basic', cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the name of the audio file for announcement.
 *
 * @method getFilenameOfAudioFileForAnnouncement
 * @param  {string} username The name of the user
 * @param  {string} fileExt  The extension of the file
 * @return {string} The name of audio file for announcement.
 * @private
 */
function getFilenameOfAudioFileForAnnouncement(username, fileExt) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof fileExt !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var timestamp = (new Date()).getTime();
    return (username + '-cti-' + timestamp + fileExt);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Enable the recorded audio file for announcement. It moves temporary file to the correct destination.
 *
 * @method enableAnnouncement
 * @param {object} data
 *   @param {string} data.user The user who requested the operation
 *   @param {string} data.privacy The privacy for audio file for announcement
 *   @param {string} data.tempFilename The temporary file name given by the upload service
 * @param {function} cb The callback function
 */
function enableAnnouncement(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof data.description !== 'string' ||
      typeof data.user !== 'string' || typeof cb !== 'function' ||
      (data.privacy !== 'public' && data.privacy !== 'private') ||
      typeof data.tempFilename !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var filename = getFilenameOfAudioFileForAnnouncement(data.user, FILEEXT_AUDIO_ANNOUNCEMENT);
    var destPath = path.join(audioAnnouncementPath, filename);
    var sourcePath = path.join(AUDIO_RECORDED_PATH, data.tempFilename);

    // sequentially executes two operations:
    // 1. move the audio file for announcement
    // 2. add a new entry into the "nethcti3.offhour_files" database
    async.series([

      function (callback) {

        fs.rename(sourcePath, destPath, function (err) {
          try {
            if (err) {
              var str = 'moving audio file for announcement "' + sourcePath + '" -> "' + destPath + '" by user "' + data.user + '" failed: ' + err;
              logger.log.warn(IDLOG, str);
              callback(str);
            } else {
              logger.log.info(IDLOG, 'audio file for announcement has been moved ("' + sourcePath + '" -> "' + destPath + '") by user "' + data.user + '"');
              callback();
            }
          } catch (err) {
            logger.log.error(IDLOG, err.stack);
            callback(err);
          }
        });
      },

      function (callback) {

        var param = {
          username: data.user,
          filepath: destPath,
          privacy: data.privacy,
          description: data.description
        };

        // add a new entry into the "offhour_files" database
        compDbconn.storeAudioFileAnnouncement(param, function (err) {
          try {
            if (err) {
              logger.log.error(IDLOG, 'storing new audio file metadata "' + destPath + '" for announcement in databse by user "' + data.user + '"');
              callback(err);
            } else {
              callback();
            }
          } catch (err) {
            logger.log.error(IDLOG, err.stack);
            callback(err);
          }
        });
      }

    ], function (err) {

      if (err) {
        logger.log.error(IDLOG, err);

        // moving or database query has been failed. So checks if the file exists
        // and in that case remove it, because there is not a corresponding entry
        // in the database. This case could verify when the user enter an already
        // present description
        fs.exists(destPath, function (resultValue) {

          if (resultValue) { // file exists: remove it

            fs.unlink(destPath, function (err) { // remove file
              if (err) {
                logger.log.warn(IDLOG, 'removing ' + destPath + ' with no db entry associated');
              } else {
                logger.log.warn(IDLOG, 'removed ' + destPath + ' with no db entry associated');
              }
            })
          }
        });
      }
      cb(err);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Store wav audio file for announcement into "audioAnnouncementPath" directory.
 *
 * @method storeWavAnnouncement
 * @param {object} data
 *   @param {string} data.user The user who requested the operation
 *   @param {string} data.privacy The privacy for audio file for announcement
 *   @param {string} data.description The description of the announcement
 *   @param {string} data.audio_content The audio file content base64 encoded
 * @param {function} cb The callback function
 */
function storeWavAnnouncement(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.description !== 'string' ||
      typeof data.user !== 'string' || typeof cb !== 'function' ||
      (data.privacy !== 'public' && data.privacy !== 'private') ||
      typeof data.audio_content !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var filename = data.user + '-cti-' + (new Date()).getTime();
    var datauri = data.audio_content.split(',')[0];
    data.audio_content = data.audio_content.replace(datauri + ',', ''); // clean audio content
    var binaryData = new Buffer(data.audio_content, 'base64').toString('binary');
    var wavFilePath = path.join(audioAnnouncementPath, 'wav_' + filename + '.wav');

    // write temporary binary wav file
    fs.writeFile(wavFilePath, binaryData, 'binary', function (err1) {
      try {
        if (err1) {
          var str = 'writing temporary wav audio file to convert for announcement "' + wavFilePath + '" by user "' + data.user + '" failed: ' + err1;
          logger.log.error(IDLOG, str);
          cb(str);
          return;
        }
        logger.log.info(IDLOG, 'temporary wav audio file to convert for announcement has been written "' + wavFilePath + '" by user "' + data.user + '"');

        // convert to a suitable wav format for asterisk
        convertWavToAsteriskFormat(filename, wavFilePath, function (err2, finalWavFilePath) {
          try {
            // remove temporary files
            fs.unlink(wavFilePath, function (err3) {});
            logger.log.info(IDLOG, 'removed temporary file ' + wavFilePath);
            if (err2) {
              var str = 'converting "' + wavFilePath + '" to a suitable wav format for asterisk';
              logger.log.error(IDLOG, str);
              fs.unlink(wavFilePath, function (err3) {});
              cb(str);
              return;
            }
            logger.log.info(IDLOG, 'created wav audio file with correct format for asterisk ' + finalWavFilePath);
            cb(null, finalWavFilePath);

          } catch (error2) {
            logger.log.error(IDLOG, error2.stack);
            cb(error2);
          }
        });
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        callback(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Convert a wav file to an asterisk suitable format.
 *
 * @method convertWavToAsteriskFormat
 * @param {string} filename The final wav filename
 * @param {string} filepathToConvert The path of the wav file to be converted
 * @param {function} cb The callback function
 * @private
 */
function convertWavToAsteriskFormat(filename, filepathToConvert, cb) {
  try {
    if (typeof filename !== 'string' ||
      typeof filepathToConvert !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var finalWavFilePath = path.join(audioAnnouncementPath, filename + '.wav');
    var child2 = childProcess.spawn(SOX_SCRIPT_PATH, [filepathToConvert, '-r', '8000', '-c', '1', finalWavFilePath, 'rate', '-ql']);
    child2.stdin.end();
    child2.on('close', function(code, signal) {
      if (code !== 0) {
        cb({ errorCode: code });
        return;
      }
      cb(null, finalWavFilePath);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Store mp3 audio file for announcement into "audioAnnouncementPath" directory.
 *
 * @method storeMp3Announcement
 * @param {object} data
 *   @param {string} data.user The user who requested the operation
 *   @param {string} data.privacy The privacy for audio file for announcement
 *   @param {string} data.description The description of the announcement
 *   @param {string} data.audio_content The audio file content base64 encoded
 * @param {function} cb The callback function
 */
function storeMp3Announcement(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.description !== 'string' ||
      typeof data.user !== 'string' || typeof cb !== 'function' ||
      (data.privacy !== 'public' && data.privacy !== 'private') ||
      typeof data.audio_content !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var filename = data.user + '-cti-' + (new Date()).getTime();
    var datauri = data.audio_content.split(',')[0];
    data.audio_content = data.audio_content.replace(datauri + ',', ''); // clean audio content
    var binaryData = new Buffer(data.audio_content, 'base64').toString('binary');
    var mp3FilePath = path.join(audioAnnouncementPath, filename + '.mp3');

    // write temporary binary mp3 file
    fs.writeFile(mp3FilePath, binaryData, 'binary', function (err1) {
      try {
        if (err1) {
          var str = 'writing temporary mp3 audio file to convert for announcement "' + mp3FilePath + '" by user "' + data.user + '" failed: ' + err1;
          logger.log.error(IDLOG, str);
          cb(str);
          return;
        }
        logger.log.info(IDLOG, 'temporary mp3 audio file to convert for announcement has been written "' + mp3FilePath + '" by user "' + data.user + '"');

        // conversion from mp3 to wav
        var wavFromMp3FilePath = path.join(audioAnnouncementPath, 'wav_' + filename + '.wav');
        var child = childProcess.spawn(MPG123_SCRIPT_PATH, ['-w', wavFromMp3FilePath, mp3FilePath]);
        child.stdin.end();
        child.on('close', function(code, signal) {

          if (code !== 0) {
            var str = 'converting "' + mp3FilePath + '" to "' + wavFromMp3FilePath + '"';
            logger.log.erro(IDLOG, str);
            cb(str);

          } else {
            logger.log.info(IDLOG, 'converted from "' + mp3FilePath + '" -> "' + wavFromMp3FilePath + '"');
            // convert to a suitable wav format for asterisk
            convertWavToAsteriskFormat(filename, wavFromMp3FilePath, function (err2, finalWavFilePath) {
              try {
                // remove temporary files
                fs.unlink(mp3FilePath, function (err3) {});
                fs.unlink(wavFromMp3FilePath, function (err3) {});
                logger.log.info(IDLOG, 'removed temporary file ' + mp3FilePath);
                logger.log.info(IDLOG, 'removed temporary file ' + wavFromMp3FilePath);
                if (err2) {
                  var str = 'converting "' + wavFromMp3FilePath + '" to a suitable wav format for asterisk';
                  logger.log.error(IDLOG, str);
                  fs.unlink(mp3FilePath, function (err3) {});
                  fs.unlink(wavFromMp3FilePath, function (err3) {});
                  cb(str);
                  return;
                }
                logger.log.info(IDLOG, 'created wav audio file with correct format for asterisk ' + finalWavFilePath);
                cb(null, finalWavFilePath);

              } catch (error2) {
                logger.log.error(IDLOG, error2.stack);
                cb(error2);
              }
            });
          }
        });
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        callback(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Store an entry in "offhour_files" db table for a new audio announcement.
 *
 * @method storeDBAudioFileAnnouncement
 * @param {object} data
 *   @param {string} data.user The user who requested the operation
 *   @param {string} data.privacy The privacy for audio file for announcement
 *   @param {string} data.description The description of the announcement
 * @param {string} destPath The destinatino audio file path
 * @param {function} cb The callback function
 */
function storeDBAudioFileAnnouncement(data, destPath, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.description !== 'string' ||
      typeof data.user !== 'string' ||
      (data.privacy !== 'public' && data.privacy !== 'private') ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var param = {
      username: data.user,
      filepath: destPath,
      privacy: data.privacy,
      description: data.description
    };
    compDbconn.storeAudioFileAnnouncement(param, function (err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'storing new audio file metadata "' + destPath + '" for announcement in databse by user "' + data.user + '"');
          cb(err);
          return;
        }
        cb();

      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Upload audio file for announcement. Store the file into "audioAnnouncementPath" directory.
 *
 * @method uploadAnnouncement
 * @param {object} data
 *   @param {string} data.user The user who requested the operation
 *   @param {string} data.privacy The privacy for audio file for announcement
 *   @param {string} data.description The description of the announcement
 *   @param {string} data.audio_content The audio file content base64 encoded
 * @param {function} cb The callback function
 */
function uploadAnnouncement(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.description !== 'string' ||
      typeof data.user !== 'string' || typeof cb !== 'function' ||
      (data.privacy !== 'public' && data.privacy !== 'private') ||
      typeof data.audio_content !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var datauri = data.audio_content.split(',')[0];
    var mimeType = (datauri.split(';')[0]).split(':')[1];
    if (mimeType !== 'audio/mp3' &&
      mimeType !== 'audio/wav' &&
      mimeType !== 'audio/mpeg' &&
      mimeType !== 'audio/wave' &&
      mimeType !== 'audio/x-wav') {

      var str = 'wrong audio content format (mimeType: "' + mimeType + '")';
      logger.log.warn(IDLOG, str);
      cb(str);
      return;
    }

    if (mimeType === 'audio/mp3' || mimeType === 'audio/mpeg') {
      storeMp3Announcement(data, function (error, destPath) {
        if (error) {
          cb(error);
          return;
        }
        storeDBAudioFileAnnouncement(data, destPath, function (err1) {
          if (err1) {
            logger.log.error(IDLOG, 'adding db entry for audio announcement: ' + err1.message);
            fs.unlink(destPath, function (err2) {});
            logger.log.info(IDLOG, 'removed created announcement audio file "' + destPath + '"');
            cb(err1);
            return;
          }
          logger.log.info(IDLOG, 'add new db entry for audio announcement');
          cb();
        });
      });

    } else if (mimeType === 'audio/wav' ||
      mimeType === 'audio/wave' ||
      mimeType === 'audio/x-wav') {

      storeWavAnnouncement(data, function (error, destPath) {
        if (error) {
          cb(error);
          return;
        }
        storeDBAudioFileAnnouncement(data, destPath, function (err1) {
          if (err1) {
            logger.log.error(IDLOG, 'adding db entry for audio announcement: ' + err1.message);
            fs.unlink(destPath, function (err2) {});
            logger.log.info(IDLOG, 'removed created announcement audio file "' + destPath + '"');
            cb(err1);
            return;
          }
          logger.log.info(IDLOG, 'add new db entry for audio announcement');
          cb();
        });
      });

    } else {
      var str = 'uploading audio announcement: wrong mimeType "' + mimeType + '"';
      logger.log.warn(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all public and user private audio file for announcements.
 *
 * @method listAllPublicAndUserPrivateAnnouncement
 * @param {string} username The user who requested the operation
 * @param {function} cb The callback function
 */
function listAllPublicAndUserPrivateAnnouncement(username, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconn.listAllPublicAndUserPrivateAnnouncement(username, function (err, results) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting list of all public and user private audio file for announcements for user "' + username + '"');
          cb(err);
        } else {
          // removes filepath data
          var an;
          for (an = 0; an < results.length; an += 1) {
            delete results[an].path;
          }
          cb(null, results);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all audio file for announcements.
 *
 * @method listAllAnnouncement
 * @param {function} cb The callback function
 */
function listAllAnnouncement(cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconn.listAllAnnouncement(function (err, results) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting list of all audio file for announcements');
          cb(err);
        } else {
          // removes filepath data
          var an;
          for (an = 0; an < results.length; an += 1) {
            delete results[an].path;
          }
          cb(null, results);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all audio file for announcements of the specified user.
 *
 * @method listUserAnnouncement
 * @param {string}   username The user who requested the operation
 * @param {function} cb       The callback function
 */
function listUserAnnouncement(username, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconn.listUserAnnouncement(username, function (err, results) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting list of user audio file for announcements for user "' + username + '"');
          cb(err);
        } else {
          cb(null, results);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Set a offhour service. It provides all types of setting using the optional parameters.
 *
 * @method setOffhour
 * @param {object} data
 *   @param {string} data.enabled ("always" | "period" | "never")
 *   @param {string} data.username The name of the user
 *   @param {string} data.calledIdNum The called number of the inbound route
 *   @param {string} data.callerIdNum The caller number of the inbound route
 *   @param {string} [data.startDate] The start date of the period (YYYYMMDD)
 *   @param {string} [data.startTime] The start time of the period (HHmmss)
 *   @param {string} [data.endDate] The end date of the period (YYYYMMDD)
 *   @param {string} [data.endTime] The end time of the period (HHmmss)
 *   @param {string} [data.action] The offhour service action: ("audiomsg" | "audiomsg_voicemail" | "redirect")
 *   @param {string} [data.redirectTo] The destination to use with "action" = "redirect"
 *   @param {string} [data.voicemailId] The voicemail destination to use with "action" = "audiomsg_voicemail"
 *   @param {string} [data.announcementId] Offhour audio announcement identifier to use with "action" = "audiomsg"
 * @param {function} cb The callback function
 */
function setOffhour(data, cb) {
  try {
    if (
      typeof data.username !== 'string' ||
      typeof data.calledIdNum !== 'string' ||
      typeof data.callerIdNum !== 'string' ||
      (
        data.enabled !== 'always' &
        data.enabled !== 'period' &&
        data.enabled !== 'never'
      ) ||
      (data.action &&
        // action audiomsg
        (
          data.action !== 'audiomsg' &&
          data.action !== 'audiomsg_voicemail' &&
          data.action !== 'redirect'
        ) ||
        (
          data.action === 'audiomsg' &&
          (
            typeof data.announcementId !== 'string' ||
            data.announcementId === ''
          )
        ) ||
        // action audiomsg + voicemail
        (
          data.action === 'audiomsg_voicemail' &&
          (
            typeof data.announcementId !== 'string' ||
            data.announcementId === '' ||
            typeof data.voicemailId !== 'string' ||
            data.voicemailId === ''
          )
        ) ||
        // action redirect
        (
          data.action === 'redirect' &&
          (
            typeof data.redirectTo !== 'string' ||
            data.redirectTo === ''
          )
        )
      )
    ) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    getAllInboundRoutes(null, 'all', function (err, ibroutes) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting all inbound routes to set offhour for user "' + data.username + '"');
          cb(err);
          return;
        }

        var msg;
        var id = data.calledIdNum + '/' + data.callerIdNum;
        if (!ibroutes[id]) {
          msg = 'setting offhour: no inbound route present "' + id + '" - user "' + data.username + '"';
          logger.log.warn(IDLOG, msg);
          cb(msg);
          return;
        }

        data.description = ibroutes[id].description;

        // check if an audio message has been specified. In this case it is necessary to
        // retrieve the file path of the audio message from the db
        if ((data.action === 'audiomsg' || data.action === 'audiomsg_voicemail') &&
          data.announcementId) {

          // get the file path of announcement audio file
          compDbconn.getAnnouncementFilePath(data.announcementId, function (err, filepath) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'getting filepath of announcement id "' + data.announcementId +
                  '" to set offhour inbound route "' + id + '" by user "' + data.username + '"');
                cb(err);

              } else {

                var fileExt = path.extname(filepath);
                var filename = path.basename(filepath, fileExt); // filename without the extension
                var announcementDbFilePath = path.join(AUDIO_DIRNAME, filename);
                data.announcementFilePath = announcementDbFilePath;

                compDbconn.setOffhour(data, function (err) {
                  try {
                    if (err) {
                      logger.log.error(IDLOG, 'setting offhour service "' + data.id + '" for user "' + data.username + '"');
                      cb(err);
                    } else {
                      logger.log.info(IDLOG, 'offhour "' + data.id + '" has been setted successfully by user "' + data.username + '"');
                      cb(null);
                    }
                  } catch (err) {
                    logger.log.error(IDLOG, err.stack);
                    cb(err);
                  }
                });
              }
            } catch (err) {
              logger.log.error(IDLOG, err.stack);
              cb(err);
            }
          });

        } else {
          // in this case the user has chosen the redirection only
          compDbconn.setOffhour(data, function (err) {
            try {
              if (err) {
                logger.log.error(IDLOG, 'setting offhour "' + data.id + '" for user "' + data.username + '"');
                cb(err);
              } else {
                logger.log.info(IDLOG, 'offhour "' + data.id + '" has been set successfully by user "' + data.username + '"');
                cb();
              }
            } catch (err) {
              logger.log.error(IDLOG, err.stack);
              cb(err);
            }
          });
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Modify data about the specified announcement.
 *
 * @method modifyAnnouncement
 * @param {object} data
 *   @param {string} data.id The announcement identifier
 *   @param {string} [data.privacy] The announcement visibility
 *   @param {string} [data.description] The announcement description
 * @param {function} cb The callback function
 */
function modifyAnnouncement(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof data.id !== 'string' ||
      (data.description && typeof data.description !== 'string') ||
      (data.privacy && typeof data.privacy !== 'string') ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconn.modifyAnnouncement(data, function (err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'modifying announcement id "' + data.id + '"');
          cb(err);
        } else {
          cb(null);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Record new audio file for announcement.
 *
 * @method recordAnnouncement
 * @param {string} username The user who reqeusted the recording
 * @param {function} cb The callback function
 */
function recordAnnouncement(username, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var filename = getFilenameOfAudioFileForAnnouncement(username, FILEEXT_AUDIO_ANNOUNCEMENT);
    var filepath = path.join(AUDIO_RECORDED_PATH, filename);
    var exten = compConfigManager.getDefaultUserExtensionConf(username);

    var data = {
      exten: exten,
      filepath: filepath
    };

    compAstProxy.recordAudioFile(data, function (err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'recording audio file');
          cb(err);
        } else {
          cb(null, {
            tempFilename: filename
          });
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Delete the specified audio announcement.
 *
 * @method deleteAnnouncement
 * @param {string} id The announcement identifier
 * @param {function} cb The callback function
 */
function deleteAnnouncement(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconn.deleteAnnouncement(id, function (err) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'deleting announcement id "' + id + '"');
          cb(err);
        } else {
          cb(null);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Return the filepath of the announcement audio file.
 *
 * @method getAnnouncementFilePath
 * @param {string} id The announcement identifier
 * @param {function} cb The callback function
 */
function getAnnouncementFilePath(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get file path of announcement from the database
    compDbconn.getAnnouncementFilePath(id, function (err, filepath) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting file path of announcement with id "' + id + '"');
          cb(err);

        } else {
          logger.log.info(IDLOG, 'got file path "' + filepath + '" of announcement with id "' + id + '"');
          cb(null, filepath);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Reads the audio file of announcement using base64 encoding and
 * returns the content in the callback.
 *
 * @method getAnnouncementFileContent
 * @param {string}   id The announcement identifier
 * @param {function} cb The callback function
 */
function getAnnouncementFileContent(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get file path of announcement from the database
    compDbconn.getAnnouncementFilePath(id, function (err, filepath) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting file path of announcement with id "' + id + '"');
          cb(err);

        } else {
          logger.log.info(IDLOG, 'got file path "' + filepath + '" of announcement with id "' + id + '"');

          // check the file existence
          fs.exists(filepath, function (resultValue) {

            if (resultValue) { // the file exists

              // read the audio file using base64 enconding
              logger.log.info(IDLOG, 'read file ' + filepath + ' of audio announcement with id "' + id + '"');
              fs.readFile(filepath, 'base64', function (err, result) {
                cb(err, result);
              });

            } else { // file does not exist
              logger.log.warn(IDLOG, 'audio file ' + filepath + ' of announcement with id "' + id + '" does not exist');
              cb('audio file of announcement with id "' + id + '" does not exist');
            }
          });
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        cb(err);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Verify if the inbound route involves an extension of the user.
 *
 * @method verifyBasicInboundRouteOfUser
 * @param {string} username The username
 * @param {string} calledIdNum The called number of the inbound route
 * @param {string} callerIdNum The caller number of the inbound route
 * @param {function} The callback function
 */
function verifyBasicInboundRouteOfUser(username, calledIdNum, callerIdNum, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' ||
      typeof calledIdNum !== 'string' ||
      typeof callerIdNum !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    getAllInboundRoutes(username, 'basic', function (err, results) {
      try {

        if (err) {
          cb(err);
          return;
        }
        var userExtens = compUser.getAllEndpointsExtension(username);
        var id = calledIdNum + '/' + callerIdNum;
        if (results[id] &&
          typeof results[id].destination === 'string' &&
          results[id].destination.indexOf('from-did-direct,') !== -1 &&
          userExtens[(results[id].destination.split(',')[1])]) {

          cb(null, true);

        } else {
          cb(null, false);
        }

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Verify if the inbound route involves an extension of the user or it is generic.
 *
 * @method verifyAdvancedInboundRouteOfUser
 * @param {string} username The username
 * @param {string} calledIdNum The called number of the inbound route
 * @param {string} callerIdNum The caller number of the inbound route
 * @param {function} The callback function
 */
function verifyAdvancedInboundRouteOfUser(username, calledIdNum, callerIdNum, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' ||
      typeof calledIdNum !== 'string' ||
      typeof callerIdNum !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    getAllInboundRoutes(username, 'advanced', function (err, results) {
      try {

        if (err) {
          cb(err);
          return;
        }
        var userExtens = compUser.getAllEndpointsExtension(username);
        var id = calledIdNum + '/' + callerIdNum;
        if (results[id] &&
          typeof results[id].destination === 'string' &&
          (
            (
              results[id].destination.indexOf('from-did-direct,') !== -1 &&
              userExtens[(results[id].destination.split(',')[1])]
            ) ||
            results[id].destination.indexOf('from-did-direct') === -1
          )
        ) {

          cb(null, true);

        } else {
          cb(null, false);
        }

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Verify that the audio message is owned by the user or has the "public" visibility.
 *
 * @method verifyAudioMessagePermission
 * @param {string} username The username
 * @param {string} id The audio message id
 * @param {function} The callback function
 */
function verifyAudioMessagePermission(username, id, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' ||
      typeof id !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    listAllPublicAndUserPrivateAnnouncement(username, function (err, results) {
      if (err) {
        cb(err);
        return;
      }
      id = parseInt(id);
      for (var i = 0; i < results.length; i++) {
        if (results[i].id === id) {
          cb(null, true);
          return;
        }
      }
      cb(null, false);
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

// public interface
exports.setLogger = setLogger;
exports.setOffhour = setOffhour;
exports.setCompUser = setCompUser;
exports.setCompDbconn = setCompDbconn;
exports.setCompAstProxy = setCompAstProxy;
exports.deleteAnnouncement = deleteAnnouncement;
exports.modifyAnnouncement = modifyAnnouncement;
exports.recordAnnouncement = recordAnnouncement;
exports.enableAnnouncement = enableAnnouncement;
exports.uploadAnnouncement = uploadAnnouncement;
exports.listAllAnnouncement = listAllAnnouncement;
exports.listUserAnnouncement = listUserAnnouncement;
exports.setCompConfigManager = setCompConfigManager;
exports.getAnnouncementFilePath = getAnnouncementFilePath;
exports.getAnnouncementFileContent = getAnnouncementFileContent;
exports.getAdminInboundRoutes = getAdminInboundRoutes;
exports.getAdvancedInboundRoutes = getAdvancedInboundRoutes;
exports.getAllInboundRoutes = getAllInboundRoutes;
exports.getUserInboundRoutes = getUserInboundRoutes;
exports.listAllPublicAndUserPrivateAnnouncement = listAllPublicAndUserPrivateAnnouncement;
exports.verifyBasicInboundRouteOfUser = verifyBasicInboundRouteOfUser;
exports.verifyAdvancedInboundRouteOfUser = verifyAdvancedInboundRouteOfUser;
exports.verifyAudioMessagePermission = verifyAudioMessagePermission;
