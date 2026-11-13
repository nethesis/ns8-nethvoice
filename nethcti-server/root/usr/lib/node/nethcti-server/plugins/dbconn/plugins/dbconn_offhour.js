/**
 * Provides database functions.
 *
 * @module dbconn
 * @submodule plugins
 */
var fs = require('fs');
var path = require('path');
var async = require('async');
var moment = require('moment');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins/dbconn_offhour]
 */
var IDLOG = '[plugins/dbconn_offhour]';

/**
 * The name of _asterisk.offhour_ database table.
 *
 * @property DB_TABLE_OFFHOUR
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "offhour"
 */
var DB_TABLE_OFFHOUR = 'offhour';

/**
 * The name of _nethcti3.offhour_files_ database table.
 *
 * @property DB_TABLE_OFFHOUR_FILES
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "offhour_files"
 */
var DB_TABLE_OFFHOUR_FILES = 'offhour_files';

/**
 * The logger.
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
var logger = console;

/**
 * The exported apis.
 *
 * @property apiList
 * @type object
 */
var apiList = {};

/**
 * The main architect dbconn component.
 *
 * @property compDbconnMain
 * @type object
 * @private
 */
var compDbconnMain;

/**
 * Set the main dbconn architect component.
 *
 * @method setCompDbconnMain
 * @param {object} comp The architect main dbconn component
 * @static
 */
function setCompDbconnMain(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain = comp;
    logger.log.log(IDLOG, 'main dbconn component has been set');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

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
 * Get all the offhour from _asterisk.offhour_ db table.
 *
 * @method getOffhours
 * @param {function} cb The callback function
 */
function getOffhours(cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // offhour: asterisk database table
    compDbconnMain.models[DB_TABLE_OFFHOUR].findAll({
      attributes: [
        'id', ['param', 'action_to'],
        ['displayname', 'name'],
        ['message', 'announcement_filepath'],
        ['IF(tsbegin=0, NULL, FROM_UNIXTIME(tsbegin))', 'datebegin'],
        ['IF(tsend=0, NULL, FROM_UNIXTIME(tsend))', 'dateend'],
        'action', 'param', 'enabled', 'didcidnum', 'didextension', 'tsbegin'
      ]
    }).then(function (results) {

      // extract results to return in the callback function
      var i;
      for (i = 0; i < results.length; i++) {
        results[i] = results[i].dataValues;
      }

      logger.log.info(IDLOG, results.length + ' results by searching asterisk offhour services');
      cb(null, results);

    }, function (err) { // manage the error

      logger.log.error(IDLOG, 'searching asterisk offhour services: ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Get all the inbound routes from _asterisk.incoming_ db table.
 *
 * @method getAllInboundRoutes
 * @param {function} cb The callback function
 */
function getAllInboundRoutes(cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // incoming: asterisk database table
    compDbconnMain.models['incoming'].findAll().then(function (results) {

      // extract results to return in the callback function
      var i;
      for (i = 0; i < results.length; i++) {
        results[i] = results[i].dataValues;
      }

      logger.log.info(IDLOG, results.length + ' results by searching asterisk inbound routes');
      cb(null, results);

    }, function (err) { // manage the error

      logger.log.error(IDLOG, 'searching asterisk inbound routes: ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Store metadata about the audio file for announcement.
 *
 * @method storeAudioFileAnnouncement
 * @param {object} data
 *   @param {string} data.username The user who requested the operation
 *   @param {string} data.filepath The path of the audio file for announcement
 *   @param {string} data.privacy The path of the audio file for announcement
 *   @param {string} data.description The path of the audio file for announcement
 * @param {funcion} cb The callback function
 */
function storeAudioFileAnnouncement(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof data.filepath !== 'string' ||
      typeof data.username !== 'string' || typeof cb !== 'function' ||
      typeof data.privacy !== 'string' || typeof data.description !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get the sequelize model already loaded
    var announcement = compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].build({
      username: data.username,
      description: data.description,
      privacy: data.privacy,
      creation: moment().format('YYYY-MM-DD HH:mm:ss'),
      path: data.filepath
    });

    // check if there is already an announcement with the same username and description
    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].findAll({
      where: [
        'username = ? AND description = ?',
        data.username, data.description
      ]

    }).then(function (results) {

      if (results.length === 0) {

        announcement.save()
          .then(function () {
            logger.log.info(IDLOG, 'audio file announcement "' + data.description + '" "' + data.filepath + '" saved successfully for user "' + data.username + '" with privacy "' + data.privacy + '"');
            cb();

          }, function (err) {
            logger.log.error(IDLOG, 'saving audio file announcement "' + data.description + '" "' + data.file + '" for user "' + data.username + '" with privacy "' + data.privacy + '": ' + err.toString());
            cb(err.toString());
          });

      } else if (results.length > 0) { // there is already an announcement with the same user and description
        var str = 'saving announcement by user "' + data.username + '": duplicate entry "username-description" -> "' + data.username + '-' + data.description + '"';
        logger.log.warn(IDLOG, str);
        cb(new Error('duplicate entry'));
      }

    }, function (err) { // manage the error

      logger.log.error(IDLOG, 'searching announcement ("username-description" -> "' + data.username + '-' + data.description + '") before saving it: ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all audio files with public privacy and all private of the
 * specified user.
 *
 * @method listAllPublicAndUserPrivateAnnouncement
 * @param {string}  username The user who requested the operation
 * @param {funcion} cb       The callback function
 */
function listAllPublicAndUserPrivateAnnouncement(username, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].findAll({
      where: ['privacy="public" OR (username=? AND privacy="private")', username],
      attributes: [
        ['DATE_FORMAT(creation, "%d/%m/%Y")', 'date_creation'],
        ['DATE_FORMAT(creation, "%H:%i:%S")', 'time_creation'],
        'id', 'username', 'description', 'privacy', 'path'
      ]

    }).then(function (results) {
      // extract results to return in the callback function
      var i;
      for (i = 0; i < results.length; i++) {
        results[i] = results[i].dataValues;
      }

      logger.log.info(IDLOG, results.length + ' results by searching all public and user private audio file announcements for user "' + username + '"');
      cb(null, results);

    }, function (err1) { // manage the error
      logger.log.error(IDLOG, 'searching all public and user private audio file announcements for user "' + username + '": ' + err1.toString());
      cb(err1);
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all audio files for announcements.
 *
 * @method listAllAnnouncement
 * @param {funcion} cb The callback function
 */
function listAllAnnouncement(cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].findAll({
      attributes: [
        ['DATE_FORMAT(creation, "%d/%m/%Y")', 'date_creation'],
        ['creation', 'time_creation'],
        'id', 'username', 'description', 'privacy', 'path'
      ]

    }).then(function (results) {
      // extract results to return in the callback function
      var i;
      for (i = 0; i < results.length; i++) {
        results[i] = results[i].dataValues;

        // adjust times to local timezone
        results[i].time_creation = moment(results[i].time_creation).format('HH:mm:ss');
      }

      logger.log.info(IDLOG, results.length + ' results by searching all audio file announcements');
      cb(null, results);

    }, function (err1) { // manage the error
      logger.log.error(IDLOG, 'searching all audio file announcements: ' + err1.toString());
      cb(err1);
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all audio files of the specified user.
 *
 * @method listUserAnnouncement
 * @param {string}  username The user who requested the operation
 * @param {funcion} cb       The callback function
 */
function listUserAnnouncement(username, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].findAll({
      where: ['username=?', username],
      attributes: [
        ['DATE_FORMAT(creation, "%d/%m/%Y")', 'date_creation'],
        ['DATE_FORMAT(creation, "%H:%i:%S")', 'time_creation'],
        'id', 'username', 'description', 'privacy', 'path'
      ]

    }).then(function (results) {

      // extract results to return in the callback function
      var i;
      for (i = 0; i < results.length; i++) {
        results[i] = results[i].dataValues;
      }

      logger.log.info(IDLOG, results.length + ' results by searching audio file announcements for user "' + username + '"');
      cb(null, results);

    }, function (err1) { // manage the error
      logger.log.error(IDLOG, 'searching audio file announcements for user "' + username + '": ' + err1.toString());
      cb(err1);
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the audio file announcement data.
 *
 * @method getAnnouncement
 * @param {string} id The announcement identifier
 * @param {funcion} cb The callback function
 */
function getAnnouncement(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].find({
      where: ['id=?', id],
      attributes: [
        ['DATE_FORMAT(creation, "%d/%m/%Y")', 'date_creation'],
        ['DATE_FORMAT(creation, "%H:%i:%S")', 'time_creation'],
        'id', 'username', 'description', 'privacy', 'path'
      ]

    }).then(function (result) {

      if (result && result.dataValues) {
        logger.log.info(IDLOG, 'search announcement with db id "' + id + '" has been successful');
        cb(null, result.dataValues);

      } else {
        logger.log.info(IDLOG, 'searching announcement with db id "' + id + '": not found');
        cb(null, {});
      }

    }, function (err1) { // manage the error
      logger.log.error(IDLOG, 'searching announcement with db id "' + id + '": ' + err1.toString());
      cb(err1);
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Set data about offhour service. It writes all passed parameters.
 *
 * @method setOffhour
 * @param {object} data
 *   @param {string} data.enabled ("always" | "period" | "never") corresponding values into the db are:
 *                                "never": 0, "always": 1, "period": 2
 *   @param {string} [data.startDate] The start date of the period (ISOString)
 *   @param {string} [data.endDate] The end date of the period (ISOString)
 *   @param {string} data.calledIdNum The called number of the inbound route
 *   @param {string} data.callerIdNum The caller number of the inbound route
 *   @param {string} data.username The user who requested the operation
 *   @param {string} data.action The offhour service action: ("audiomsg" | "audiomsg_voicemail" | "redirect"). Corresponding
 *                               values into the db are: "audiomsg": 0, "audiomsg_voicemail": 1, "redirect": 2
 *   @param {string} data.redirectTo The destination to use with "action" = "redirect"
 *   @param {string} data.voicemailId The voicemail destination to use with "action" = "audiomsg_voicemail"
 *   @param {string} data.announcementFilePath File path of the audio announcement
 *   @param {string} data.announcementId The identifier of the announcement
 * @param {funcion} cb The callback function
 */
function setOffhour(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      (
        data.enabled !== 'always' &&
        data.enabled !== 'period' &&
        data.enabled !== 'never'
      ) ||
      typeof data.calledIdNum !== 'string' ||
      typeof data.callerIdNum !== 'string' ||
      typeof data.username !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var id = data.calledIdNum + '/' + data.callerIdNum;

    compDbconnMain.models[DB_TABLE_OFFHOUR].find({
      where: ['didcidnum=? AND didextension=?', data.callerIdNum, data.calledIdNum]

    }).then(function (task) {
      try {
        var obj = {
          enabled: data.enabled === 'always' ? 1 : (data.enabled === 'period' ? 2 : 0),
          didcidnum: data.callerIdNum,
          didextension: data.calledIdNum,
          displayname: data.description ? data.description : ''
        };
        if (data.startDate && data.endDate) {
          obj.tsbegin = Math.floor(moment(data.startDate).valueOf() / 1000);
          obj.tsend = Math.floor(moment(data.endDate).valueOf() / 1000);
        } else if (data.enabled === 'always') {
          obj.tsbegin = 0;
          obj.tsend = 0;
        }
        if (data.action) {
          obj.action = (data.action === 'audiomsg_voicemail' ? 1 : (data.action === 'redirect' ? 2 : 0));
          obj.param = (data.action === 'audiomsg_voicemail' ? data.voicemailId : (data.action === 'audiomsg' ? data.announcementId : data.redirectTo));
        }
        if (data.action !== 'redirect') {
          obj.message = data.announcementFilePath;
        }
        var entry = compDbconnMain.models[compDbconnMain.JSON_KEYS.OFFHOUR].build(obj);

        if (task) {

          var arrFields = ['tsbegin', 'tsend', 'enabled', 'param', 'action', 'message', 'displayname', 'didcidnum', 'didextension'];

          // empty the content of the "recordingfile" field
          task.updateAttributes(entry, arrFields).then(function (result) {
            logger.log.info(IDLOG, 'update offhour of inbound route "' + id + ' has been set successfully by user "' + data.username + '"');
            cb();
          });

        } else {
          entry.save()
            .then(function (result) {
              logger.log.info(IDLOG, 'offhour "' + id + '" has been set successfully by user "' + data.username + '"');
              cb();

            }, function (err) {
              logger.log.error(IDLOG, 'setting offhour  "' + id + '" by user "' + data.username + '": ' + err.toString());
              cb(err.toString());
            });
        }
        compDbconnMain.incNumExecQueries();
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }

    }, function (err) { // manage the error
      logger.log.error(IDLOG, 'setting offhour service "' + data.id + '" by user "' + data.username + '": ' + err.toString());
      cb(err.toString());
    });
    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the path of the audio file announcement.
 *
 * @method getAnnouncementFilePath
 * @param {string} announcementId The announcement audio file identifier
 * @param {funcion} cb The callback function
 */
function getAnnouncementFilePath(announcementId, cb) {
  try {
    // check parameters
    if (typeof announcementId !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].find({
      where: ['id=?', announcementId]

    }).then(function (task) {
      try {
        if (task && task.dataValues && task.dataValues.path) {
          logger.log.info(IDLOG, 'return the filepath "' + task.dataValues.path + '" of announcement id "' + announcementId + '"');
          cb(null, task.dataValues.path);

        } else {
          var str = 'getting filepath of announcement id "' + announcementId + '": entry not found';
          logger.log.warn(IDLOG, str);
          cb(str);
        }
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }

    }, function (err) { // manage the error

      logger.log.error(IDLOG, 'getting filepath of announcement id "' + announcementId + '": ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

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
      (data.privacy && data.privacy !== 'private' && data.privacy !== 'public') ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].find({
      where: ['id=?', data.id]

    }).then(function (task) {

      if (task) {
        var attributes = {};
        if (data.description) {
          attributes.description = data.description;
        }
        if (data.privacy) {
          attributes.privacy = data.privacy;
        }

        task.updateAttributes(attributes).then(function () {
          logger.log.info(IDLOG, 'announcement id "' + data.id + '" has been modified successfully');
          cb();

        }, function (err1) {
          var str = 'updating announcement id "' + data.id + '": ' + err1.toString();
          logger.log.error(IDLOG, str);
          cb(err1);
        });

      } else {
        var str = 'modifying announcement id "' + data.id + '": entry not found';
        logger.log.warn(IDLOG, str);
        cb(str);
      }

    }, function (err1) { // manage the error
      logger.log.error(IDLOG, 'modifying announcement id "' + data.id + '": ' + err1.toString());
      cb(err1);
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Delete the specified announcement. It deletes the audio file, the relative
 * entry from "offhour_files" db table and the associated "offhour" entry table
 * if it is present.
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

    compDbconnMain.models[DB_TABLE_OFFHOUR_FILES].find({
      where: ['id=?', id]

    }).then(function (task) {

      if (task) {
        var filepath = task.dataValues.path;

        async.parallel([

          // delete entry from offhour_files db table
          function (callback) {
            try {
              task.destroy().then(function () {
                logger.log.info(IDLOG, 'announcement with id "' + id + '" - ("' + task.dataValues.username + ' - ' + task.dataValues.description + '") has been deleted successfully');
                callback();
              });
            } catch (err) {
              logger.log.error(IDLOG, err.stack);
              callback(err);
            }
          },
          // delete entry from offhour db table if it is present
          function (callback) {
            var filename = (path.basename(filepath)).replace(path.extname(filepath), '');
            deleteOffhourByFilename(filename, callback);
          },
          // delete audio file
          function (callback) {
            try {
              fs.unlink(filepath, function (err) {
                if (err) {
                  logger.log.error(IDLOG, 'deleting ' + filepath + ' of announcement id "' + id + '"');
                  callback(err);

                } else {
                  logger.log.info(IDLOG, filepath + ' of announcement id "' + id + '" has been deleted');
                  callback();
                }
              });
            } catch (err) {
              logger.log.error(IDLOG, err.stack);
              callback(err);
            }
          }

        ], function (err) {

          if (err) {
            logger.log.error(IDLOG, 'deleting announcement with id "' + id + '": ', err);
            cb(err);

          } else {
            cb();
          }
        });

      } else {
        var str = 'deleting announcement with db id "' + id + '": entry not found';
        logger.log.warn(IDLOG, str);
        cb(str);
      }

    }, function (err1) { // manage the error

      logger.log.error(IDLOG, 'deleting announcement with db id "' + id + '": ' + err1.toString());
      cb(err1.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Delete the specified offhour based on filename.
 *
 * @method deleteOffhourByFilename
 * @param {string} filename The filename of the audio announcement associated with offhour to be deleted
 * @param {function} cb The callback function
 * @private
 */
function deleteOffhourByFilename(filename, cb) {
  try {
    if (typeof filename !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[DB_TABLE_OFFHOUR].destroy({
      where: ['message LIKE ?', '%' + filename]
    }).then(function (task) {

      logger.log.info(IDLOG, '#' + task + ' offhour with associated filename "' + filename + '" has been deleted successfully');
      cb();

    }, function (err1) { // manage the error
      logger.log.error(IDLOG, 'deleting offhour with associated filename "' + filename + '": ' + err1.toString());
      cb(err1.toString());
    });
    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

apiList.getOffhours = getOffhours;
apiList.setOffhour = setOffhour;
apiList.getAnnouncement = getAnnouncement;
apiList.getAllInboundRoutes = getAllInboundRoutes;
apiList.deleteAnnouncement = deleteAnnouncement;
apiList.modifyAnnouncement = modifyAnnouncement;
apiList.listAllAnnouncement = listAllAnnouncement;
apiList.listUserAnnouncement = listUserAnnouncement;
apiList.getAnnouncementFilePath = getAnnouncementFilePath;
apiList.storeAudioFileAnnouncement = storeAudioFileAnnouncement;
apiList.listAllPublicAndUserPrivateAnnouncement = listAllPublicAndUserPrivateAnnouncement;

// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;
