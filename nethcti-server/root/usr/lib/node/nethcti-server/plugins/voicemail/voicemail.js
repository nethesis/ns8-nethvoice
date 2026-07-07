/**
 * Provides the voicemail functions.
 *
 * @module voicemail
 * @main voicemail
 */
var fs = require('fs');
var path = require('path');
var async = require('async');
var childProcess = require('child_process');
var EventEmitter = require('events').EventEmitter;

/**
 * Provides the voicemail functionalities.
 *
 * @class voicemail
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
 * @default [voicemail]
 */
var IDLOG = '[voicemail]';

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
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * Fired when a new voice message has been left in a voicemail, or a
 * voice message has been listened or deleted.
 *
 * @event updateNewVoiceMessages
 * @param {object} voicemails The list of all the new voice messages of the voicemail
 */
/**
 * The name of event for the update of the new voice messages.
 *
 * @property EVT_UPDATE_NEW_VOICE_MESSAGES
 * @type string
 * @default "updateNewVoiceMessages"
 */
var EVT_UPDATE_NEW_VOICE_MESSAGES = 'updateNewVoiceMessages';

/**
 * Fired when a new voice message has been left in a voicemail.
 *
 * @event newVoiceMessage
 * @param {object} voicemails The list of all the new voice messages of the voicemail
 */
/**
 * The name of the new voicemail event.
 *
 * @property EVT_NEW_VOICE_MESSAGE
 * @type string
 * @default "newVoiceMessage"
 */
var EVT_NEW_VOICE_MESSAGE = 'newVoiceMessage';

/**
 * The path where temporary audio recordings are stored.
 *
 * @property AUDIO_RECORDED_PATH
 * @type string
 * @private
 * @default "/var/spool/asterisk/tmp"
 */
var AUDIO_RECORDED_PATH = '/var/spool/asterisk/tmp';

/**
 * Resolves a name to an absolute path that is guaranteed to stay inside
 * AUDIO_RECORDED_PATH. Throws if the resulting path would be the directory
 * itself or escape it, so every filesystem operation is forced under the
 * recordings directory regardless of the name components.
 *
 * @method resolveRecordedPath
 * @param {string} name The filename to place inside AUDIO_RECORDED_PATH
 * @return {string} The absolute path inside AUDIO_RECORDED_PATH
 * @private
 */
function resolveRecordedPath(name) {
  var resolved = path.resolve(AUDIO_RECORDED_PATH, String(name));
  if (resolved.indexOf(AUDIO_RECORDED_PATH + path.sep) !== 0) {
    throw new Error('refusing to use a path outside the recordings directory');
  }
  return resolved;
}

/**
 * The mpg123 binary for MP3 conversion.
 *
 * @property MPG123_SCRIPT_PATH
 * @type string
 * @private
 * @default "/usr/bin/mpg123"
 */
var MPG123_SCRIPT_PATH = '/usr/bin/mpg123';

/**
 * The sox binary for WAV conversion.
 *
 * @property SOX_SCRIPT_PATH
 * @type string
 * @private
 * @default "/usr/bin/sox"
 */
var SOX_SCRIPT_PATH = '/usr/bin/sox';

/**
 * The dbconn module.
 *
 * @property dbconn
 * @type object
 * @private
 */
var dbconn;

/**
 * The asterisk proxy.
 *
 * @property astProxy
 * @type object
 * @private
 */
var astProxy;

/**
 * The architect component to be used for user functions.
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
 * Set the user architect component.
 *
 * @method setCompUser
 * @param {object} cu The architect user component
 * @static
 */
function setCompUser(cu) {
  try {
    // check parameter
    if (typeof cu !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    compUser = cu;
    logger.log.info(IDLOG, 'user component has been set');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the asterisk proxy to be used by the module.
 *
 * @method setAstProxy
 * @param ap
 * @type object The asterisk proxy.
 */
function setAstProxy(ap) {
  try {
    if (typeof ap !== 'object') {
      throw new Error('wrong asterisk proxy object');
    }
    astProxy = ap;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Gets the list of all voice messages of the user, new and old. If the user
 * doesn't have the voicemail, it calls the callback with false value as
 * a result.
 *
 * @method getVoiceMessagesByUser
 * @param {string}   username The username
 * @param {string}   type     The type of the message
 * @param {integer}  [offset] The offset results start from
 * @param {integer}  [limit]  The results limit
 * @param {function} cb       The callback function
 */
function getVoiceMessagesByUser(username, type, offset, limit, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var vm = compUser.getVoicemailList(username);
    if (vm.length == 1) {
      var voicemail = vm[0];
      logger.log.info(IDLOG, 'get all voice messages of user "' + username + '" by means dbconn module');
      dbconn.getVoicemailMsg(voicemail, type, offset, limit, function(err, results) {
        if (err) {
          logger.log.error(IDLOG, err);
        } else {
          cb(null, results);
        }
      });
    } else {
      cb(null, []);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Gets the number of new voice messages of all users.
 *
 * @method getNewVoiceMessageCountAllUsers
 * @param {function} cb The callback function
 */
function getAllNewVoiceMessageCount(cb) {
  try {
    // check parameter
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get the number of new voice messages of all voicemails using the listVoicemail plugin
    // command of the asterisk proxy component. Then clean the results to return only the necessary information
    logger.log.info(IDLOG, 'get the number of new voice messages of all voicemails using astProxy module');
    astProxy.doCmd({
      command: 'listVoicemail'
    }, function(err, res) {
      try {
        if (err) {
          throw err;
        }

        var vm;
        var obj = {};
        for (vm in res) {
          obj[vm] = {
            newMessageCount: res[vm].newMessageCount
          };
        }
        cb(null, obj);

      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
        cb(err1);
      }
    });
  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    cb(error.toString());
  }
}

/**
 * Set the module to be used for database functionalities.
 *
 * @method setDbconn
 * @param {object} dbConnMod The dbconn module.
 */
function setDbconn(dbconnMod) {
  try {
    // check parameter
    if (typeof dbconnMod !== 'object') {
      throw new Error('wrong dbconn object');
    }
    dbconn = dbconnMod;
    logger.log.info(IDLOG, 'set dbconn module');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Adds the listener to the asterisk proxy component.
 *
 * @method start
 */
function start() {
  try {
    // set the listener for the aterisk proxy component
    setAstProxyListeners();

    // set the listener for the database component
    setDbconnListeners();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the asterisk proxy component.
 *
 * @method setAstProxyListeners
 * @private
 */
function setAstProxyListeners() {
  try {
    // check astProxy object
    if (!astProxy || typeof astProxy.on !== 'function') {
      throw new Error('wrong astProxy object');
    }

    // new voice message has been left in a voicemail
    astProxy.on(astProxy.EVT_NEW_VOICE_MESSAGE, newVoiceMessage);
    logger.log.info(IDLOG, 'new listener has been set for "' + astProxy.EVT_NEW_VOICE_MESSAGE + '" event from the asterisk proxy component');

    // something changed in voice messages of a voicemail
    astProxy.on(astProxy.EVT_UPDATE_VOICE_MESSAGES, updateVoiceMessages);
    logger.log.info(IDLOG, 'new listener has been set for "' + astProxy.EVT_UPDATE_VOICE_MESSAGES + '" event from the asterisk proxy component');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the database component.
 *
 * @method setDbconnListeners
 * @private
 */
function setDbconnListeners() {
  try {
    // check dbconn object
    if (!dbconn || typeof dbconn.on !== 'function') {
      throw new Error('wrong dbconn object');
    }

    // a voicemail message has been listened
    dbconn.on(dbconn.EVT_LISTENED_VOICE_MESSAGE, listenedVoiceMessage);
    logger.log.info(IDLOG, 'new listener has been set for "' + dbconn.EVT_LISTENED_VOICE_MESSAGE + '" event from the dbconn component');

    // a voicemail message has been deleted
    dbconn.on(dbconn.EVT_DELETED_VOICE_MESSAGE, deletedVoiceMessage);
    logger.log.info(IDLOG, 'new listener has been set for "' + dbconn.EVT_DELETED_VOICE_MESSAGE + '" event from the dbconn component');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * New voicemail message has been left in a voicemail. It gets all the new voice messages
 * of the voicemail and emits the _EVT\_NEW\_VOICEMAIL_ event with all the new voice messages.
 *
 * @method newVoiceMessage
 * @param {object} ev The event data
 * @private
 */
function newVoiceMessage(ev) {
  try {
    // check parameter
    if (typeof ev !== 'object' && typeof ev.voicemail !== 'string' && typeof ev.context !== 'string' && typeof ev.countOld !== 'string' && typeof ev.countNew !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get all the new voice messages of the voicemail to send the events through the callback
    // emits the event for a new voice message with all the new messages of the voicemail. This event
    // is emitted only when a new voice message has been left in a voicemail
    logger.log.info(IDLOG, 'emit event "' + EVT_NEW_VOICE_MESSAGE + '" for voicemail ' + ev.voicemail);
    emitter.emit(EVT_NEW_VOICE_MESSAGE, ev);

    // emits the event with the update list of new voice messages of a voicemail. This event is emitted
    // each time a new voice message has been left, when the user listen a message or delete it
    logger.log.info(IDLOG, 'emit event "' + EVT_UPDATE_NEW_VOICE_MESSAGES + '" for voicemail ' + ev.voicemail);
    emitter.emit(EVT_UPDATE_NEW_VOICE_MESSAGES, ev);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Something has changed in voice messages of a voicemail. It gets all the new voice messages
 * of the voicemail and emits the _EVT\_UPDATE\_NEW\_VOICEMAIL_ event with all the new voice messages.
 *
 * @method updateVoiceMessages
 * @param {object} ev The event data
 * @private
 */
function updateVoiceMessages(ev) {
  try {
    // check parameter
    if (typeof ev !== 'object' && typeof ev.voicemail !== 'string' && typeof ev.context !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get all the new voice messages of the voicemail to send the events through the callback
    dbconn.getVoicemailNewMsg(ev.voicemail, updateVoiceMessagesCb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Delete custom message for the specified voicemail.
 *
 * @method deleteCustomMessage
 * @param {string} vm The voicemail id
 * @param {string} type The type of the custom message
 * @param {function} cb The callback function
 * @private
 */
function deleteCustomMessage(vm, type, cb) {
  try {
    if (typeof vm !== 'string' || typeof type !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    dbconn.deleteCustomMessage(vm, type, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Delete the specified voice message.
 *
 * @method deleteVoiceMessage
 * @param {string}   id The voice message identifier in the database
 * @param {function} cb The callback function
 * @private
 */
function deleteVoiceMessage(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    dbconn.deleteVoiceMessage(id, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}


/**
 * Listen the specified voice message.
 *
 * @method listenVoiceMessage
 * @param {string}   id The voice message identifier in the database
 * @param {function} cb The callback function
 * @private
 */
function listenVoiceMessage(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    dbconn.listenVoiceMessage(id, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Listen the specified custom message for voicemail.
 *
 * @method listenCustomMessage
 * @param {string} vm The voicemail identifier
 * @param {string} type The type of the custom message ("unavail"|"busy"|"greet")
 * @param {function} cb The callback function
 * @private
 */
function listenCustomMessage(vm, type, cb) {
  try {
    if (typeof vm !== 'string' ||
      typeof type !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    dbconn.listenCustomMessage(vm, type, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}


/**
 * Returns the voicemail identifier from the voice message identifier of the database.
 *
 * @method getVmIdFromDbId
 * @param {string}   dbid The voice message identifier in the database
 * @param {function} cb   The callback function
 * @private
 */
function getVmIdFromDbId(dbid, cb) {
  try {
    // check parameters
    if (typeof dbid !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    dbconn.getVmMailboxFromDbId(dbid, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * It's the callback function called when get new voicemail messages from
 * the database component, after a voicemail message has been listened by a user.
 *
 * @method listenedVoiceMessageCb
 * @param {object} err       The error
 * @param {string} voicemail The voicemail identifier
 * @param {object} results   The results
 * @private
 */
function listenedVoiceMessageCb(err, voicemail, results) {
  try {
    updateVoiceMessagesCb(err, voicemail, results);

  } catch (error) {
    logger.log.error(IDLOG, error.stack);
  }
}

/**
 * It's the callback function called when get new voicemail messages from
 * the database component, after something has changed to a voice messages of a voicemail.
 *
 * @method updateVoiceMessagesCb
 * @param {object} err       The error
 * @param {string} voicemail The voicemail identifier
 * @param {object} results   The results
 * @private
 */
function updateVoiceMessagesCb(err, voicemail, results) {
  try {
    if (err) {
      var str = 'getting new voicemail messages: ';
      if (typeof err === 'string') {
        str += err;
      } else {
        str += err.stack;
      }

      logger.log.error(IDLOG, str);
      return;
    }

    // check the parameters
    if (typeof voicemail !== 'string' || results instanceof Array === false) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // emits the event with the update list of new voice messages of a voicemail. This event is emitted
    // each time a new voice message has been left, when the user listen a message or delete it
    logger.log.info(IDLOG, 'emit event "' + EVT_UPDATE_NEW_VOICE_MESSAGES + '" for voicemail ' + voicemail);
    emitter.emit(EVT_UPDATE_NEW_VOICE_MESSAGES, voicemail, results);

  } catch (error) {
    logger.log.error(IDLOG, error.stack);
  }
}

/**
 * It's the callback function called when a user has listened a voicemail message.
 *
 * @method listenedVoiceMessage
 * @param {string} voicemail The voicemail identifier
 * @private
 */
function listenedVoiceMessage(voicemail) {
  try {
    // check the parameter
    if (typeof voicemail !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get all the new voice messages of the voicemail to send the events through the callback
    dbconn.getVoicemailNewMsg(voicemail, listenedVoiceMessageCb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * It's the callback function called when get new voicemail messages from
 * the database component, after a voicemail message has been deleted by a user.
 *
 * @method deletedVoiceMessageCb
 * @param {object} err       The error
 * @param {string} voicemail The voicemail identifier
 * @param {object} results   The results
 * @private
 */
function deletedVoiceMessageCb(err, voicemail, results) {
  try {
    updateVoiceMessagesCb(err, voicemail, results);

  } catch (error) {
    logger.log.error(IDLOG, error.stack);
  }
}

/**
 * It's the callback function called when a user has deleted a voicemail message.
 *
 * @method deletedVoiceMessage
 * @param {string} voicemail The voicemail identifier
 * @private
 */
function deletedVoiceMessage(voicemail) {
  try {
    // check the parameter
    if (typeof voicemail !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get all the new voice messages of the voicemail to send the events through the callback
    dbconn.getVoicemailNewMsg(voicemail, deletedVoiceMessageCb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Subscribe a callback function to a custom event fired by this object.
 * It's the same of nodejs _events.EventEmitter.on_ method.
 *
 * @method on
 * @param  {string}   type The name of the event
 * @param  {function} cb   The callback to execute in response to the event
 * @return {object}   A subscription handle capable of detaching that subscription.
 */
function on(type, cb) {
  try {
    return emitter.on(type, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns true if buffer looks like MP3.
 *
 * @method isMp3Buffer
 * @param {object} buffer The buffer to check
 * @return {boolean} True if MP3 header detected
 * @private
 */
function isMp3Buffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) {
    return false;
  }
  if (buffer.slice(0, 3).toString('ascii') === 'ID3') {
    return true;
  }
  // MP3 frame sync 0xFFEx
  if (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    return true;
  }
  return false;
}

/**
 * Convert a buffer to hex string.
 *
 * @method bufferToHex
 * @param {object} buffer The buffer
 * @param {number} length The bytes to convert
 * @return {string} Hex string
 * @private
 */
function bufferToHex(buffer, length) {
  if (!Buffer.isBuffer(buffer)) {
    return '';
  }
  return buffer.slice(0, length).toString('hex');
}

/**
 * Normalize an audio input string (base64 or data URL) to raw bytes.
 *
 * @method normalizeAudioInput
 * @param {string} audio The audio content in base64 or data URL format
 * @return {object} { buffer, detectedType, dataUrlPrefix }
 * @private
 */
function normalizeAudioInput(audio) {
  if (typeof audio !== 'string') {
    throw new Error('uploaded audio is not a string');
  }
  var dataUrlPrefix = null;
  var base64Content = audio.trim();
  if (base64Content.indexOf('data:') === 0) {
    var commaIdx = base64Content.indexOf(',');
    if (commaIdx === -1) {
      throw new Error('uploaded audio data URL is missing comma separator');
    }
    dataUrlPrefix = base64Content.substring(0, commaIdx);
    base64Content = base64Content.substring(commaIdx + 1);
  }
  base64Content = base64Content.replace(/\s+/g, '');
  var buffer = Buffer.from(base64Content, 'base64');
  var header = buffer.slice(0, 4).toString('ascii');
  var detectedType = 'unknown';
  if (header === 'RIFF') {
    detectedType = 'wav';
  } else if (isMp3Buffer(buffer)) {
    detectedType = 'mp3';
  }
  return {
    buffer: buffer,
    detectedType: detectedType,
    dataUrlPrefix: dataUrlPrefix
  };
}

/**
 * Convert WAV to Asterisk format (8k mono) using sox.
 *
 * @method convertWavToAsteriskFormat
 * @param {string} inputPath The source wav path
 * @param {string} outputPath The destination wav path
 * @param {function} cb The callback
 * @private
 */
function convertWavToAsteriskFormat(inputPath, outputPath, cb) {
  try {
    var child = childProcess.spawn(SOX_SCRIPT_PATH, [inputPath, '-r', '8000', '-c', '1', outputPath, 'rate', '-ql']);
    child.stdin.end();
    child.on('error', function(err) {
      cb('sox spawn failed: ' + err);
    });
    child.on('close', function(code) {
      if (code !== 0) {
        cb('sox conversion failed with code ' + code);
        return;
      }
      cb(null, outputPath);
    });
  } catch (err) {
    cb(err);
  }
}

/**
 * Convert MP3 to Asterisk WAV (8k mono).
 *
 * @method convertMp3ToAsteriskWav
 * @param {string} inputPath The source mp3 path
 * @param {string} outputPath The destination wav path
 * @param {function} cb The callback
 * @private
 */
function convertMp3ToAsteriskWav(inputPath, outputPath, cb) {
  try {
    var tmpWavPath = outputPath.replace(/\.wav$/i, '') + '_mp3tmp.wav';
    var child = childProcess.spawn(MPG123_SCRIPT_PATH, ['-w', tmpWavPath, inputPath]);
    child.stdin.end();
    child.on('error', function(err) {
      cb('mpg123 spawn failed: ' + err);
    });
    child.on('close', function(code) {
      if (code !== 0) {
        cb('mpg123 conversion failed with code ' + code);
        return;
      }
      convertWavToAsteriskFormat(tmpWavPath, outputPath, function(err) {
        fs.unlink(tmpWavPath, function() {
          cb(err, outputPath);
        });
      });
    });
  } catch (err) {
    cb(err);
  }
}

/**
 * Set the custom audio message for the voicemail.
 *
 * @method setCustomVmAudioMsg
 * @param {string} vm The voicemail identifier
 * @param {string} type The type of the audio message ("unavail"|"busy"|"greet")
 * @param {string} audio The audio message content in base64 format
 * @param {function} cb The callback function
 * @private
 */
function setCustomVmAudioMsg(vm, type, audio, cb) {
  try {
    if (typeof vm !== 'string' ||
      typeof audio !== 'string' ||
      typeof type !== 'string' ||
      (type !== 'unavail' && type !== 'busy' && type !== 'greet') ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var normalized = normalizeAudioInput(audio);
    if (normalized.detectedType !== 'wav' && normalized.detectedType !== 'mp3') {
      throw new Error('uploaded audio is not a valid RIFF WAV file (missing RIFF header)');
    }
    var tmpFilename = 'vm_' + vm + '_' + type + '_' + Date.now() + '_' + process.pid + '.wav';
    var tmpPath = resolveRecordedPath(tmpFilename);
    var tmpOutPath = resolveRecordedPath('vm_' + vm + '_' + type + '_' + Date.now() + '_' + process.pid + '_out.wav');
    async.waterfall([
      function(callback) {
        var tmpExt = (normalized.detectedType === 'mp3' ? '.mp3' : '.wav');
        tmpPath = tmpPath.replace(/\.wav$/, tmpExt);
        fs.writeFile(tmpPath, normalized.buffer, { mode: 0o600 }, function(err) {
          if (err) {
            callback('writing temp audio "' + tmpPath + '" failed: ' + err);
            return;
          }
          callback(null);
        });
      },
      function(callback) {
        var converter = (normalized.detectedType === 'mp3') ? convertMp3ToAsteriskWav : convertWavToAsteriskFormat;
        converter(tmpPath, tmpOutPath, function(err) {
          if (err) {
            callback(err);
            return;
          }
          callback(null);
        });
      },
      function(callback) {
        fs.readFile(tmpOutPath, function(err, convertedData) {
          if (err) {
            callback('reading converted wav "' + tmpOutPath + '" failed: ' + err);
            return;
          }
          dbconn.setCustomVmAudioMsg(vm, type, convertedData, function(err2) {
            if (err2) {
              callback(err2);
              return;
            }
            callback(null);
          });
        });
      },
      function(callback) {
        fs.unlink(tmpPath, function() {
          fs.unlink(tmpOutPath, function() {
            callback(null);
          });
        });
      }
    ], function(err) {
      if (err) {
        logger.log.error(IDLOG, 'setting custom voicemail audio failed for vm "' + vm + '" type "' + type + '": ' + err);
      }
      cb(err);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Set a custom voicemail audio message from a temporary file.
 * The function copies the file from the temporary location to the voicemail directory
 * and saves it to the database.
 *
 * @method setCustomVmAudioMsgFromFile
 * @param {string} vm The voicemail identifier
 * @param {string} type The type of the audio message ("unavail"|"busy"|"greet")
 * @param {string} tempFilename The temporary filename in /var/spool/asterisk/tmp
 * @param {function} cb The callback function
 */
function setCustomVmAudioMsgFromFile(vm, type, tempFilename, cb) {
  try {
    if (typeof vm !== 'string' ||
      typeof tempFilename !== 'string' ||
      typeof type !== 'string' ||
      (type !== 'unavail' && type !== 'busy' && type !== 'greet') ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // tempFilename must be a bare filename inside AUDIO_RECORDED_PATH: reject any
    // name with path components and the "", ".", ".." special names so that
    // readFile/stat/unlink always operate inside the recordings directory.
    var safeTempFilename = path.basename(tempFilename);
    if (safeTempFilename !== tempFilename ||
      safeTempFilename === '' || safeTempFilename === '.' || safeTempFilename === '..') {

      throw new Error('invalid tempFilename');
    }

    var sourcePath = resolveRecordedPath(safeTempFilename);
    var convertedTmpPath = null;
    var ext = path.extname(safeTempFilename);
    var extLower = ext.toLowerCase();

    // sequentially executes operations:
    // 1. read the audio file content for database storage
    // 2. save to database
    // 3. delete the temp file
    async.waterfall([

      function(callback) {
        // read the file content for database storage
        fs.readFile(sourcePath, function(err, data) {
          if (err) {
            var str = 'reading temp audio file "' + sourcePath + '" for vm "' + vm + '" failed: ' + err;
            logger.log.error(IDLOG, str);
            callback(str);
          } else {
            callback(null, data);
          }
        });
      },

      function(fileData, callback) {
        if (extLower !== '' && extLower !== '.wav' && extLower !== '.mp3') {
          callback('uploaded audio from file must be WAV or MP3; got "' + extLower + '"');
          return;
        }
        if (extLower !== '.mp3') {
          var header = fileData.slice(0, 4).toString('ascii');
          if (header !== 'RIFF') {
            callback('uploaded audio from file is not a valid RIFF WAV file (missing RIFF header)');
            return;
          }
        }
        var tmpOutPath = resolveRecordedPath('vm_' + vm + '_' + type + '_' + Date.now() + '_' + process.pid + '_out.wav');
        convertedTmpPath = tmpOutPath;
        fs.stat(sourcePath, function(err) {
          if (err) {
            callback('reading temp audio file "' + sourcePath + '" failed: ' + err);
            return;
          }
          var converter = (extLower === '.mp3') ? convertMp3ToAsteriskWav : convertWavToAsteriskFormat;
          converter(sourcePath, tmpOutPath, function(err1) {
            if (err1) {
              callback(err1);
              return;
            }
            fs.readFile(tmpOutPath, function(err2, convertedData) {
              if (err2) {
                callback('reading converted wav "' + tmpOutPath + '" failed: ' + err2);
                return;
              }
              dbconn.setCustomVmAudioMsg(vm, type, convertedData, function(err3) {
                if (err3) {
                  logger.log.error(IDLOG, 'saving custom vm "' + type + '" message to database for vm "' + vm + '"');
                  callback(err3);
                } else {
                  logger.log.info(IDLOG, 'saved custom vm "' + type + '" message to database for vm "' + vm + '"');
                  callback(null);
                }
              });
            });
          });
        });
      },

      function(callback) {
        // delete the temp file
        fs.unlink(sourcePath, function(err) {
          if (err) {
            var str = 'removing temp audio file "' + sourcePath + '" for vm "' + vm + '" failed: ' + err;
            logger.log.warn(IDLOG, str);
            // don't fail the whole operation if temp file deletion fails
          } else {
            logger.log.info(IDLOG, 'removed temp audio file "' + sourcePath + '" for vm "' + vm + '"');
          }
          if (convertedTmpPath) {
            fs.unlink(convertedTmpPath, function() {
              callback(null);
            });
            return;
          }
          callback(null);
        });
      }

    ], function(err) {
      if (err) {
        logger.log.error(IDLOG, err);
      }
      cb(err);
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

// public interface
exports.on = on;
exports.start = start;
exports.setLogger = setLogger;
exports.setDbconn = setDbconn;
exports.setAstProxy = setAstProxy;
exports.setCompUser = setCompUser;
exports.getVmIdFromDbId = getVmIdFromDbId;
exports.deleteVoiceMessage = deleteVoiceMessage;
exports.listenVoiceMessage = listenVoiceMessage;
exports.deleteCustomMessage = deleteCustomMessage;
exports.listenCustomMessage = listenCustomMessage;
exports.setCustomVmAudioMsg = setCustomVmAudioMsg;
exports.setCustomVmAudioMsgFromFile = setCustomVmAudioMsgFromFile;
exports.EVT_NEW_VOICE_MESSAGE = EVT_NEW_VOICE_MESSAGE;
exports.getVoiceMessagesByUser = getVoiceMessagesByUser;
exports.getAllNewVoiceMessageCount = getAllNewVoiceMessageCount;
exports.EVT_UPDATE_NEW_VOICE_MESSAGES = EVT_UPDATE_NEW_VOICE_MESSAGES;
