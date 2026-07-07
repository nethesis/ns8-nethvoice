/**
 * Provides database functions.
 *
 * @module dbconn
 * @submodule plugins
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins/dbconn_voicemail]
 */
var IDLOG = '[plugins/dbconn_voicemail]';

/**
 * Fired when a voice message has been deleted from the database by the _deleteVoiceMessage_ method.
 *
 * @event deleteVoiceMessage
 * @param {object} voicemail The voicemail identifier
 */
/**
 * The name of the listened voice message event.
 *
 * @property EVT_DELETED_VOICE_MESSAGE
 * @type string
 * @default "deleteVoiceMessage"
 */
var EVT_DELETED_VOICE_MESSAGE = 'deleteVoiceMessage';

/**
 * Fired when a voice message content has been read from the database by the _listenVoiceMessage_ method.
 *
 * @event listenedVoiceMessage
 * @param {object} voicemail The voicemail identifier
 */
/**
 * The name of the listened voice message event.
 *
 * @property EVT_LISTENED_VOICE_MESSAGE
 * @type string
 * @default "listenedVoiceMessage"
 */
var EVT_LISTENED_VOICE_MESSAGE = 'listenedVoiceMessage';

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
      throw new Error('wrong parameter');
    }

    compDbconnMain = comp;
    logger.log.info(IDLOG, 'main dbconn component has been set');

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
 * Gets all the voice messages of a voicemail of the specified type. It search the
 * results into the _asteriskcdrdb.voicemessages_ database. The type can be "new" or "old".
 *
 * @method getVoicemailMsg
 * @param {string} vmId The voicemail identifier
 * @param {string} type The type of the message
 * @param {integer} [offset] The offset results start from
 * @param {integer} [limit] The results limit
 * @param {function} cb The callback function
 */
function getVoicemailMsg(vmId, type, offset, limit, cb) {
  try {
    // check parameters
    if (typeof vmId !== 'string' || (type && typeof type !== 'string') || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].findAndCountAll({
      where: [
        'mailboxuser = ?' +
        ((type !== null && type !== 'all') ? ' AND LOWER(SUBSTRING_INDEX(dir, "/", -1)) = "' + type + '"' : '') +
        ' ORDER BY origtime DESC',
        vmId
      ],
      attributes: [
        'origtime', 'duration', 'id', 'dir', 'callerid', 'mailboxuser', ['LOWER(SUBSTRING_INDEX(dir, "/", -1))', 'type']
      ],
      offset: (offset ? parseInt(offset) : 0),
      limit: (limit ? parseInt(limit) : null)
    }).then(function(results) {
      // extract results to return in the callback function
      logger.log.info(IDLOG, results.count + ' results searching voice messages of voicemail "' + vmId + '"');
      cb(null, results);
    }, function(err) { // manage the error
      logger.log.error(IDLOG, 'searching voice messages of voicemail "' + vmId + '"');
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Delete a voice message from the database table _asteriskcdrdb.voicemessages_.
 *
 * @method deleteVoiceMessage
 * @param {string}   dbid The database identifier of the voice message to delete
 * @param {function} cb   The callback function
 */
function deleteVoiceMessage(dbid, cb) {
  try {
    // check parameters
    if (typeof dbid !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].find({
      where: ['id=?', dbid]
    }).then(function(task) {
      try {
        if (task) {

          task.destroy().then(function() {
            logger.log.info(IDLOG, 'voice message with db id "' + dbid + '" has been deleted successfully');
            cb();

            // emits the event for a deleted voice message
            logger.log.info(IDLOG, 'emit event "' + EVT_DELETED_VOICE_MESSAGE + '" for voicemail ' + task.selectedValues.mailboxuser);
            compDbconnMain.emit(EVT_DELETED_VOICE_MESSAGE, task.selectedValues.mailboxuser);
          });

        } else {
          var str = 'deleting voice message with db id "' + dbid + '": entry not found';
          logger.log.warn(IDLOG, str);
          cb(str);
        }

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }

    }, function(err) { // manage the error
      logger.log.error(IDLOG, 'searching voice message with db id "' + dbid + '" to delete not found: ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Delete a custom voice message from the database table _asteriskcdrdb.voicemessages_.
 *
 * @method deleteCustomMessage
 * @param {string} vm The voicemail id
 * @param {string} type The type of the custom message
 * @param {function} cb The callback function
 */
function deleteCustomMessage(vm, type, cb) {
  try {
    if (typeof vm !== 'string' || typeof type !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var path = getCustomAudioMsgPath(vm, type);
    compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].find({
      where: ['dir=? AND mailboxuser=?', path, vm]
    }).then(function(task) {
      try {
        if (task) {
          task.destroy().then(function() {
            logger.log.info(IDLOG, 'deleted custom message "' + type + '" for vm "' + vm + '"');
            cb();
          });
        } else {
          var str = 'deleting custom message "' + type + '" for vm "' + vm + '": entry not found';
          logger.log.warn(IDLOG, str);
          cb(null, null);
        }
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    }, function(err) { // manage the error
      logger.log.error(IDLOG, 'custom message "' + type + '" for vm "' + vm + '" with db id "' + dbid + '" to delete not found: ' + err.toString());
      cb(err.toString());
    });
    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns audio file from the id mailbox.
 *
 * @method listenVoiceMessage
 * @param {string}   dbid The voicemail identifier in the database
 * @param {function} cb   The callback function
 */
function listenVoiceMessage(dbid, cb) {
  try {
    // check parameters
    if (typeof dbid !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].find({
      where: ['id=?', dbid]
    }).then(function(result) {
      if (result && result.dataValues && result.dataValues.recording) {
        logger.log.info(IDLOG, 'obtained voicemail audio file from voicemail db id "' + dbid + '"');
        cb(null, result.dataValues.recording);
        // if the voice message has never been read, it updates its status as "read".
        // If the message has never been read the "dir" field contains the "INBOX" string.
        // So if it's present it updates the field replacing the "INBOX" string with the "Old" one
        var dir = result.dataValues.dir;
        if (dir.split('/').pop() === 'INBOX') {

          result.updateAttributes({
            dir: dir.substring(0, dir.length - 5) + 'Old'
          }, ['dir']).then(function() {
            logger.log.info(IDLOG, 'read status of the voice message with db id "' + dbid + '" has been updated successfully');

            // emits the event for a listened voice message
            logger.log.info(IDLOG, 'emit event "' + EVT_LISTENED_VOICE_MESSAGE + '" for voicemail ' + result.dataValues.mailboxuser);
            compDbconnMain.emit(EVT_LISTENED_VOICE_MESSAGE, result.dataValues.mailboxuser);
          });
        }
      } else {
        var str = 'getting voicemail audio file from db voice message id "' + dbid + '"';
        logger.log.warn(IDLOG, str);
        cb(str);
      }
    }, function(err) { // manage the error
      logger.log.error(IDLOG, 'searching voicemail audio file from voicemail db id "' + dbid + '"');
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns audio file of the custom audio message of the voicemail.
 *
 * @method listenCustomMessage
 * @param {string} vm The voicemail identifier
 * @param {string} type The type of the custom message ("unavail"|"busy"|"greet")
 * @param {function} cb The callback function
 */
function listenCustomMessage(vm, type, cb) {
  try {
    if (typeof vm !== 'string' || typeof type !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var path = getCustomAudioMsgPath(vm, type);
    compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].find({
      where: ['dir=? AND mailboxuser=?', path, vm]
    }).then(function(result) {
      if (result && result.dataValues && result.dataValues.recording) {
        logger.log.info(IDLOG, 'obtained listen custom message "' + type + '" for vm "' + vm + '"');
        cb(null, result.dataValues.recording);
      } else {
        var str = 'getting listen custom message "' + type + '" for vm "' + vm + '": not found';
        logger.log.warn(IDLOG, str);
        cb(null, null);
      }
    }, function(err) { // manage the error
      logger.log.error(IDLOG, 'getting listen custom message "' + type + '" for vm "' + vm + '"');
      cb(err.toString());
    });
    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the voicemail mailbox from the identifier of the voicemail in the database.
 *
 * @method getVmMailboxFromDbId
 * @param {string}   dbid The voicemail identifier in the database
 * @param {function} cb   The callback function
 */
function getVmMailboxFromDbId(dbid, cb) {
  try {
    // check parameters
    if (typeof dbid !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].findAll({
      where: ['id=?', dbid],
      attributes: ['mailboxuser']
    }).then(function(result) {
      if (result instanceof Array && result[0]) {
        logger.log.info(IDLOG, 'obtained voicemail mailbox "' + result[0].dataValues.mailboxuser + '" from voicemail db id "' + dbid + '"');
        cb(null, result[0].dataValues.mailboxuser);

      } else {
        var str = 'getting voicemail mailbox from db voice message id "' + dbid + '"';
        logger.log.warn(IDLOG, str);
        cb(str);
      }

    }, function(err) { // manage the error

      logger.log.error(IDLOG, 'searching voicemail mailbox from voicemail db id "' + dbid + '"');
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Add an entry into the asteriskcdrdb.voicemessages with the audio message content.
 *
 * @method getCustomAudioMsgPath
 * @param {string} vm The voicemail identifier
 * @param {string} type The type of the audio message ("unavail"|"busy"|"greet")
 * @return {string} The path
 * @private
 */
function getCustomAudioMsgPath(vm, type) {
  try {
    if (typeof vm !== 'string' || typeof type !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return '/var/spool/asterisk/voicemail/default/' + vm + '/' + type;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Add an entry into the asteriskcdrdb.voicemessages with the audio message content.
 *
 * @method setCustomVmAudioMsg
 * @param {string} vm The voicemail identifier
 * @param {string} type The type of the audio message ("unavail"|"busy"|"greet")
 * @param {string} audio The audio message content in binary format
 * @param {function} cb The callback function
 */
function setCustomVmAudioMsg(vm, type, audio, cb) {
  try {
    if (typeof vm !== 'string' ||
      typeof audio !== 'object' ||
      typeof type !== 'string' ||
      (type !== 'unavail' && type !== 'busy' && type !== 'greet') ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var path = getCustomAudioMsgPath(vm, type);
    // sequelize does not support mysql "INSERT ... ON DUPLICATE KEY UPDATE" statement
    // so if the entry is already present update it, otherwise create a new one
    compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].find({
      where: ['mailboxuser=? AND dir=?', vm, path]
    }).then(function(result) {
      var objEntry = {
        msgnum: -1,
        dir: path,
        mailboxuser: vm,
        mailboxcontext: 'default',
        recording: audio,
        read: 0
      };
      // the key-value pair is not already present, so save the model into the database
      if (!result) {
        var entry = compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL].build(objEntry);
        entry.save()
          .then(function() {
            logger.log.info(IDLOG, 'saved custom audio msg "' + type + '" for vm "' + vm + '"');
            cb(null);

          }, function(err) {
            logger.log.error(IDLOG, 'saving custom audio msg "' + type + '" for vm "' + vm + '": ' + err.toString());
            cb(err.toString());
          });
        compDbconnMain.incNumExecQueries();

      } else {
        // the entry is already present, so updates it
        result.updateAttributes(objEntry).then(function() {
          logger.log.info(IDLOG, 'updated custom audio msg "' + type + '" for vm "' + vm + '"');
          cb();
        });
        compDbconnMain.incNumExecQueries();
      }

    }, function(err1) { // manage the error
      logger.log.error(IDLOG, 'search setting "' + keyName + '" for user "' + username + '" failed: ' + err1.toString());
      cb(err1.toString());
    });
    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

apiList.getVoicemailMsg = getVoicemailMsg;
apiList.deleteVoiceMessage = deleteVoiceMessage;
apiList.listenVoiceMessage = listenVoiceMessage;
apiList.deleteCustomMessage = deleteCustomMessage;
apiList.listenCustomMessage = listenCustomMessage;
apiList.setCustomVmAudioMsg = setCustomVmAudioMsg;
apiList.getVmMailboxFromDbId = getVmMailboxFromDbId;
apiList.EVT_DELETED_VOICE_MESSAGE = EVT_DELETED_VOICE_MESSAGE;
apiList.EVT_LISTENED_VOICE_MESSAGE = EVT_LISTENED_VOICE_MESSAGE;

// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;
