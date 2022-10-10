/**
 * Core for asterisk 13.
 *
 * @module astproxy
 * @submodule proxy_logic_13
 */

/**
 * This is the asterisk proxy logic linked to version asterisk 13.
 *
 * @class proxy_logic_13
 * @static
 */
var fs = require('fs');
var os = require('os');
var path = require('path');
var async = require('async');
var Queue = require('../queue').Queue;
var Trunk = require('../trunk').Trunk;
var moment = require('moment');
var process = require('process');
var Channel = require('../channel').Channel;
var TrunkChannel = require('../trunkChannel').TrunkChannel;
var Parking = require('../parking').Parking;
var Extension = require('../extension').Extension;
var QueueMember = require('../queueMember').QueueMember;
var EventEmitter = require('events').EventEmitter;
var ParkedCaller = require('../parkedCaller').ParkedCaller;
var Conversation = require('../conversation').Conversation;
var utilChannel13 = require('./util_channel_13');
var MeetmeConfUser = require('../meetmeConfUser').MeetmeConfUser;
var MeetmeConference = require('../meetmeConference').MeetmeConference;
var RECORDING_STATUS = require('../conversation').RECORDING_STATUS;
var TrunkConversation = require('../trunkConversation').TrunkConversation;
var EXTEN_STATUS_ENUM = require('../extension').EXTEN_STATUS_ENUM;
var QueueWaitingCaller = require('../queueWaitingCaller').QueueWaitingCaller;
var QUEUE_MEMBER_TYPES_ENUM = require('../queueMember').QUEUE_MEMBER_TYPES_ENUM;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [proxy_logic_13]
 */
var IDLOG = '[proxy_logic_13]';

/**
 * Fired when the component is ready.
 *
 * @event ready
 */
/**
 * The name of the ready event.
 *
 * @property EVT_READY
 * @type string
 * @default "ready"
 */
var EVT_READY = 'ready';

/**
 * Fired when the component has been reloaded.
 *
 * @event reloaded
 */
/**
 * The name of the reloaded event.
 *
 * @property EVT_RELOADED
 * @type string
 * @default "reloaded"
 */
var EVT_RELOADED = 'reloaded';

/**
 * Fired to process when asterisk was restarted.
 *
 * @event reloadApp
 */
/**
 * The name of the restarted event.
 *
 * @property EVT_RESTARTED
 * @type string
 * @default "reloadApp"
 */
 var EVT_RELOADAPP = 'reloadApp';

/**
 * Fired when something changed in an extension.
 *
 * @event extenChanged
 * @param {object} msg The extension object
 */
/**
 * The name of the extension changed event.
 *
 * @property EVT_EXTEN_CHANGED
 * @type string
 * @default "extenChanged"
 */
var EVT_EXTEN_CHANGED = 'extenChanged';

/**
 * Fired when dnd status of an extension has been changed.
 *
 * @event extenDndChanged
 * @param {object} msg The event data
 */
/**
 * The name of the extension dnd changed event.
 *
 * @property EVT_EXTEN_DND_CHANGED
 * @type string
 * @default "extenDndChanged"
 */
var EVT_EXTEN_DND_CHANGED = 'extenDndChanged';

/**
 * Fired when call forward busy status of an extension has been changed.
 *
 * @event extenCfbChanged
 * @param {object} msg The event data
 */
/**
 * The name of the extension cfb changed event.
 *
 * @property EVT_EXTEN_CFB_CHANGED
 * @type string
 * @default "extenCfbChanged"
 */
var EVT_EXTEN_CFB_CHANGED = 'extenCfbChanged';

/**
 * Fired when call forward on unavailable to voicemail status of an extension has been changed.
 *
 * @event extenCfuVmChanged
 * @param {object} msg The event data
 */
/**
 * The name of the extension cfuVm changed event.
 *
 * @property EVT_EXTEN_CFUVM_CHANGED
 * @type string
 * @default "extenCfuVmChanged"
 */
var EVT_EXTEN_CFUVM_CHANGED = 'extenCfuVmChanged';

/**
 * Fired when call forward busy to voicemail status of an extension has been changed.
 *
 * @event extenCfbVmChanged
 * @param {object} msg The event data
 */
/**
 * The name of the extension cfbVm changed event.
 *
 * @property EVT_EXTEN_CFBVM_CHANGED
 * @type string
 * @default "extenCfbVmChanged"
 */
var EVT_EXTEN_CFBVM_CHANGED = 'extenCfbVmChanged';

/**
 * Fired when call forward on unavailable status of an extension has been changed.
 *
 * @event extenCfuChanged
 * @param {object} msg The event data
 */
/**
 * The name of the extension cfu changed event.
 *
 * @property EVT_EXTEN_CFU_CHANGED
 * @type string
 * @default "extenCfuChanged"
 */
var EVT_EXTEN_CFU_CHANGED = 'extenCfuChanged';

/**
 * Fired when call forward status of an extension has been changed.
 *
 * @event extenCfChanged
 * @param {object} msg The event data
 */
/**
 * The name of the extension cf changed event.
 *
 * @property EVT_EXTEN_CF_CHANGED
 * @type string
 * @default "extenCfChanged"
 */
var EVT_EXTEN_CF_CHANGED = 'extenCfChanged';

/**
 * Fired when call forward to voicemail status of an extension has been changed.
 *
 * @event extenCfVmChanged
 * @param {object} msg The event data
 */
/**
 * The name of the extension cf to voicemail changed event.
 *
 * @property EVT_EXTEN_CFVM_CHANGED
 * @type string
 * @default "extenCfVmChanged"
 */
var EVT_EXTEN_CFVM_CHANGED = 'extenCfVmChanged';

/**
 * Fired when an hangup happened on extension.
 *
 * @event hangup
 * @param {object} msg The extension hangup data object
 */
/**
 * The name of the extension hangup event.
 *
 * @property EVT_EXTEN_HANGUP
 * @type string
 * @default "extenHangup"
 */
var EVT_EXTEN_HANGUP = 'extenHangup';

/**
 * Fired when something changed in an queue member.
 *
 * @event queueMemberChanged
 * @param {object} msg The queue member object
 */
/**
 * The name of the queue member changed event.
 *
 * @property EVT_QUEUE_MEMBER_CHANGED
 * @type string
 * @default "queueMemberChanged"
 */
var EVT_QUEUE_MEMBER_CHANGED = 'queueMemberChanged';

/**
 * Fired when something changed in a trunk.
 *
 * @event trunkChanged
 * @param {object} msg The trunk object
 */
/**
 * The name of the trunk changed event.
 *
 * @property EVT_TRUNK_CHANGED
 * @type string
 * @default "trunkChanged"
 */
var EVT_TRUNK_CHANGED = 'trunkChanged';

/**
 * Fired when an extension ringing.
 *
 * @event extenDialing
 * @param {object} data The caller identity
 */
/**
 * The name of the extension dialing event.
 *
 * @property EVT_EXTEN_DIALING
 * @type string
 * @default "extenDialing"
 */
var EVT_EXTEN_DIALING = 'extenDialing';

/**
 * Fired when a new call is incoming from a trunk.
 *
 * @event callInByTrunk
 * @param {object} data The caller number
 */
/**
 * The name of the call in by trunk event.
 *
 * @property EVT_CALLIN_BY_TRUNK
 * @type string
 * @default "callInByTrunk"
 */
let EVT_CALLIN_BY_TRUNK = 'callInByTrunk';

/**
 * Fired when an extension is connected in a conversation.
 *
 * @event extenConnected
 * @param {object} data The caller identity
 */
/**
 * The name of the extension connected event.
 *
 * @property EVT_EXTEN_CONNECTED
 * @type string
 * @default "extenConnected"
 */
var EVT_EXTEN_CONNECTED = 'extenConnected';

/**
 * Fired when something changed in a parking.
 *
 * @event parkingChanged
 * @param {object} msg The parking object
 */
/**
 * The name of the parking changed event.
 *
 * @property EVT_PARKING_CHANGED
 * @type string
 * @default "parkingChanged"
 */
var EVT_PARKING_CHANGED = 'parkingChanged';

/**
 * Fired when something changed in a queue.
 *
 * @event queueChanged
 * @param {object} msg The queue object
 */
/**
 * The name of the queue changed event.
 *
 * @property EVT_QUEUE_CHANGED
 * @type string
 * @default "queueChanged"
 */
var EVT_QUEUE_CHANGED = 'queueChanged';

/**
 * Fired when something changed in a meetme conference.
 *
 * @event meetmeConfChanged
 * @param {object} msg The conference object
 */
/**
 * The name of the meetme conference changed event.
 *
 * @property EVT_MEETME_CONF_CHANGED
 * @type string
 * @default "meetmeConfChanged"
 */
var EVT_MEETME_CONF_CHANGED = 'meetmeConfChanged';

/**
 * Fired when something a meetme conference has been ended.
 *
 * @event meetmeConfEnd
 * @param {string} id The conference identifier
 */
/**
 * The name of the meetme conference end event.
 *
 * @property EVT_MEETME_CONF_END
 * @type string
 * @default "meetmeConfEnd"
 */
var EVT_MEETME_CONF_END = 'meetmeConfEnd';

/**
 * Fired when new voicemail message has been left.
 *
 * @event newVoiceMessage
 * @param {object} msg The data about the voicemail, with the number of new and old messages
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
 * Fired when new call detail records (cdr) has been logged into the call history.
 *
 * @event newCdr
 * @param {object} msg The call detail records.
 */
/**
 * The name of the new call detail records (cdr) event.
 *
 * @property EVT_NEW_CDR
 * @type string
 * @default "newCdr"
 */
var EVT_NEW_CDR = 'newCdr';

/**
 * Something has appen in the voice messages of the voicemail, for example the listen
 * of a new voice message from the phone.
 *
 * @event updateVoiceMessages
 * @param {object} msg The data about the voicemail
 */
/**
 * The name of the update voice messages event.
 *
 * @property EVT_UPDATE_VOICE_MESSAGES
 * @type string
 * @default "updateVoiceMessages"
 */
var EVT_UPDATE_VOICE_MESSAGES = 'updateVoiceMessages';

/**
 * The default base path for the recording call audio file.
 *
 * @property BASE_CALL_REC_AUDIO_PATH
 * @type object
 * @private
 * @default "/var/spool/asterisk/monitor"
 */
var BASE_CALL_REC_AUDIO_PATH = '/var/spool/asterisk/monitor';

/**
 * The interval time to update the details of all the queues.
 *
 * @property INTERVAL_UPDATE_QUEUE_DETAILS
 * @type number
 * @private
 * @final
 * @default 60000
 */
var INTERVAL_UPDATE_QUEUE_DETAILS = 60000;

/**
 * The default asterisk directory path of the alarms.
 *
 * @property AST_ALARMS_DIRPATH
 * @type string
 * @private
 * @final
 * @default "/var/spool/asterisk/outgoing/"
 */
var AST_ALARMS_DIRPATH = '/var/spool/asterisk/outgoing/';

/**
 * True if the component has been started. Used to emit EVT_RELOADED
 * instead of EVT_READY
 *
 * @property ready
 * @type boolean
 * @private
 * @default false
 */
var ready = false;

/**
 * True during component reloading.
 *
 * @property reloading
 * @type boolean
 * @private
 * @default false
 */
var reloading = false;

/**
 * True during component shutdown.
 *
 * @property shutdown
 * @type boolean
 * @private
 * @default false
 */
 var shutdown = false;

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
 * The phonebook component.
 *
 * @property compPhonebook
 * @type object
 * @private
 */
var compPhonebook;

/**
 * The identifier of the interval used to update queues details.
 *
 * @property intervalUpdateQueuesDetails
 * @type number
 * @private
 */
var intervalUpdateQueuesDetails;

/**
 * The caller note component.
 *
 * @property compCallerNote
 * @type object
 * @private
 */
var compCallerNote;

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * The asterisk proxy.
 *
 * @property astProxy
 * @type object
 * @private
 */
var astProxy;

/**
 * The prefix number to be used in outgoing call. It is not used in
 * internal calls between extensions.
 *
 * @property prefix
 * @type string
 * @private
 * @default ""
 */
var prefix = '';

/**
 * The types of the automatic click2call.
 *
 * @property C2C_TYPES
 * @type object
 * @default {
  "AUTOMATIC": "",
  "MANUAL": "",
  "CLOUD": ""
}
 * @private
 */
const C2C_TYPES = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
  CLOUD: 'cloud'
};

/**
 * The configured type of automatic click2call. It can be
 * one of the C2C_TYPES.
 *
 * @property c2cMode
 * @type string
 * @default C2C_TYPES.AUTOMATIC
 * @private
 */
let c2cMode = C2C_TYPES.AUTOMATIC;

/**
 * If the trunks events has to be managed.
 *
 * @property trunksEventsEnabled
 * @type boolean
 * @default true
 * @private
 */
var trunksEventsEnabled = true;

/**
 * The period of time to consider a call as null.
 *
 * @property nullCallPeriod
 * @type number
 * @default 5
 * @private
 */
var nullCallPeriod = 5;

/**
 * The remote sites phone prefixes.
 *
 * @property remoteSitesPrefixes
 * @type object
 * @private
 */
var remoteSitesPrefixes;

/**
 * Contains the information about the caller. The key is the caller
 * number and the value is the information object. The data are about
 * the created caller notes and the phonebook contacts from the centralized
 * and nethcti address book that match on the caller number. The information
 * are retrieved when a _UserEvent_ is received and are used when _Dialing_
 * events occurs. This is because when a call is directed to a queue, only
 * one _UserEvent_ is emitted and many _Dialing_ events for each members of
 * the queue. So it executes only one query per call. Due to asynchronous nature
 * of the query, it may happen that when _Dialing_ event occurs the query is
 * not completed. In this case the information of the caller are those returned
 * by the asterisk event. In this manner we give more importance to the speed
 * rather than to information completeness.
 *
 * @property callerIdentityData
 * @type object
 * @private
 * @default {}
 */
var callerIdentityData = {};

/**
 * All extensions. The key is the extension number and the value
 * is the _Extension_ object.
 *
 * @property extensions
 * @type object
 * @private
 */
var extensions = {};

/**
 * Temporarly used for reloading operations. It will become extensions
 * only on setAllExtensionsUsername method.
 *
 * @property tempExtensions
 * @type object
 * @private
 */
let tempExtensions = {};

/**
 * All mettme conferences. The key is the extension owner number and the value
 * is the _MeetmeConference_ object.
 *
 * @property conferences
 * @type object
 * @private
 */
var conferences = {};

/**
 * Extensions data read from JSON configuration file.
 *
 * @property staticDataExtens
 * @type object
 * @private
 */
var staticDataExtens = {};

/**
 * Mac addresses data read from JSON configuration file. Keys are
 * mac addresses and the values are the extension identifiers.
 *
 * @property macDataByMac
 * @type object
 * @private
 */
let macDataByMac = {};

/**
 * Mac addresses data read from JSON configuration file. Keys are
 * extension identifiers and the values are the mac addresses.
 *
 * @property macDataByExt
 * @type object
 * @private
 */
let macDataByExt = {};

/**
 * Trunks data read from JSON configuration file.
 *
 * @property staticDataTrunks
 * @type object
 * @private
 */
var staticDataTrunks = {};

/**
 * Queues data read from JSON configuration file.
 *
 * @property staticDataQueues
 * @type object
 * @private
 */
var staticDataQueues = {};

/**
 * QM alarms notifications status read from JSON configuration file.
 *
 * @property QMAlarmsNotificationsStatus
 * @type boolean
 * @private
 */
var QMAlarmsNotificationsStatus;

/**
 * Feature codes of asterisk, e.g. the pickup code.
 *
 * @property featureCodes
 * @type object
 * @private
 */
var featureCodes = {};

/**
 * Context used for blind transfer.
 *
 * @property blindTransferContext
 * @type string
 * @private
 */
var blindTransferContext;

/**
 * All trunks. The key is the trunk number and the value
 * is the _Trunk_ object.
 *
 * @property trunks
 * @type object
 * @private
 */
var trunks = {};

/**
 * All queues. The key is the queue number and the value
 * is the _Queue_ object.
 *
 * @property queues
 * @type object
 * @private
 */
var queues = {};

/**
 * All parkings. The key is the parkings number and the value
 * is the _Parking_ object.
 *
 * @property parkings
 * @type object
 * @private
 */
var parkings = {};

/**
 * It is used to store the parked channels to be used in conjunction
 * with "listChannels" command plugin to get the number and name
 * of the parked channels. The key is the parking number and the value
 * is an object with the parked channel information.
 *
 * @property parkedChannels
 * @type object
 * @private
 */
var parkedChannels = {};

/**
 * Store the recording information about conversations. The key
 * is the conversation identifier and the value is the status.
 * The presence of the key means that the conversation is recording,
 * otherwise not. It's necessary because asterisk has not the recording
 * information. So, when conversation list is refreshed, it is used to
 * set recording status to a conversation.
 *
 * @property recordingConv
 * @type {object}
 * @private
 */
var recordingConv = {};

/**
 * These are the key names used into the asterisk structure
 * file created by the perl script.
 *
 * @property INI_STRUCT
 * @type {object}
 * @readOnly
 * @private
 */
var INI_STRUCT = {
  TYPE: {
    PARK: 'parking',
    EXTEN: 'extension',
    QUEUE: 'queue',
    TRUNK: 'trunk',
    GROUP: 'group'
  },
  TECH: {
    SIP: 'sip',
    IAX: 'iax'
  }
};

/**
 * Sets the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least
 * three methods: _info, warn and error_ as console object.
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' &&
      typeof log.info === 'function' &&
      typeof log.warn === 'function' &&
      typeof log.error === 'function') {

      logger = log;
      logger.info(IDLOG, 'new logger has been set');

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Sets the prefix number to be used in all outgoing calls.
 * It does not to be used with internal calls between extensions.
 *
 * @method setPrefix
 * @param {string} prefix The prefix number.
 * @static
 */
function setPrefix(code) {
  try {
    // check parameter
    if (typeof code !== 'string') {
      throw new Error('wrong prefix type');
    }

    prefix = code;

    logger.info(IDLOG, 'prefix number has been set to "' + prefix + '"');

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the c2c mode to be used.
 *
 * @method setC2CMode
 * @param {string} status The status ("enabled"|"disabled"|"cloud").
 * @static
 */
function setC2CMode(status) {
  try {
    if (typeof status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    c2cMode = status === 'cloud' ? C2C_TYPES.CLOUD : (status === 'enabled' ? C2C_TYPES.AUTOMATIC : C2C_TYPES.MANUAL);
    logger.info(IDLOG, 'auto c2c has been set to "' + status + '"');
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get the configured c2c mode.
 *
 * @method getC2CMode
 * @return {string} The click2call mode.
 * @static
 */
function getC2CMode() {
  try {
    return c2cMode;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if c2cmode is set to cloud.
 *
 * @method isC2CModeCloud
 * @return {boolean} True if the c2c mode is set to cloud.
 * @static
 */
function isC2CModeCloud() {
  try {
    return c2cMode === C2C_TYPES.CLOUD;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the period of time to consider a call as null. All calls with
 * waiting time less than this period is considered null.
 *
 * @method setNullCallPeriod
 * @param {number} period The period of time.
 * @static
 */
function setNullCallPeriod(period) {
  try {
    if (typeof period !== 'number') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    nullCallPeriod = period;
    logger.info(IDLOG, 'nullCallPeriod has been set to "' + nullCallPeriod + '"');
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get the period of time to consider a call as null. All calls with
 * waiting time less than this period is considered null.
 *
 * @method getNullCallPeriod
 * @return {number} The period of time.
 * @static
 */
function getNullCallPeriod() {
  try {
    return nullCallPeriod;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return true if the automatic click 2 call has to be used.
 *
 * @method isAutoC2CEnabled
 * @return {boolean} True if the automatic click 2 call has to be used.
 * @static
 */
function isAutoC2CEnabled() {
  try {
    return c2cMode === C2C_TYPES.AUTOMATIC;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Sets the remote sites phone prefixes used to filter the meetme conference members.
 *
 * @method setRemoteSitesPrefixes
 * @param {object} obj The remote sites prefixes data.
 * @static
 */
function setRemoteSitesPrefixes(obj) {
  try {
    // check parameter
    if (typeof obj !== 'object') {
      throw new Error('wrong remote sites object: ' + obj);
    }

    remoteSitesPrefixes = obj;
    logger.info(IDLOG, 'remote sites has been set');

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the code used to start a meetme conference.
 *
 * @method getMeetmeConfCode
 * @return {object} The code used to start a meetme conference.
 * @static
 */
function getMeetmeConfCode() {
  try {
    return featureCodes.meetme_conf;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the prefix number used in all outgoing calls.
 * It is not used with internal calls between extensions.
 *
 * @method getPrefix
 * @return {string} prefix The prefix number.
 * @static
 */
function getPrefix() {
  try {
    return prefix;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get the initial trunks list read from JSON configuration file.
 *
 * @method getStaticDataQueues
 * @return {object} The queues object read from JSON config file
 * @static
 */
function getStaticDataQueues() {
  try {
    return staticDataQueues;
  } catch (err) {
    logger.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Store the asterisk proxy to visit.
 *
 * @method visit
 * @param {object} ap The asterisk proxy module.
 */
function visit(ap) {
  try {
    // check parameter
    if (!ap || typeof ap !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    astProxy = ap;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Validates all sip trunks of the structure ini file and
 * initialize sip _Trunk_ objects.
 *
 * @method sipTrunkStructValidation
 * @param {object} err  The error received from the command
 * @param {array}  resp The response received from the command
 * @private
 */
function sipTrunkStructValidation(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'validating sip trunk structure: ' + err.toString());
      return;
    }

    // creates temporary object used to rapid check the
    // existence of a trunk into the asterisk
    var siplist = {};
    var i;
    for (i = 0; i < resp.length; i++) {
      siplist[resp[i].ext] = '';
    }

    // cycles in all elements of the structure ini file to validate
    var k;
    for (k in struct) {

      // validates all sip trunks
      if (struct[k].tech === INI_STRUCT.TECH.SIP &&
        struct[k].type === INI_STRUCT.TYPE.TRUNK) {

        // current trunk of the structure ini file isn't present
        // into the asterisk. So remove it from the structure ini file
        if (siplist[struct[k].extension] === undefined) {

          delete struct[k];
          logger.warn(IDLOG, 'inconsistency between ini structure file and asterisk for ' + k);
        }
      }
    }
    logger.info(IDLOG, 'all sip trunks have been validated');

    // initialize all sip trunks as 'Trunk' objects into the 'trunks' property
    initializeSipTrunk();

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Validates all iax trunks of the structure ini file and
 * initialize iax _Trunk_ objects.
 *
 * @method iaxTrunkStructValidation
 * @param {object} err  The error received from the command
 * @param {array}  resp The response received from the command
 * @private
 */
function iaxTrunkStructValidation(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'validating iax trunk structure: ' + err.toString());
      return;
    }

    // creates temporary object used to rapid check the
    // existence of a trunk into the asterisk
    var iaxlist = {};
    var i;
    for (i = 0; i < resp.length; i++) {
      iaxlist[resp[i].exten] = '';
    }

    // cycles in all elements of the structure ini file to validate
    var k;
    for (k in struct) {

      // validates all iax trunks
      if (struct[k].tech === INI_STRUCT.TECH.IAX &&
        struct[k].type === INI_STRUCT.TYPE.TRUNK) {

        // current trunk of the structure ini file isn't present
        // into the asterisk. So remove it from the structure ini file
        if (iaxlist[struct[k].extension] === undefined) {

          delete struct[k];
          logger.warn(IDLOG, 'inconsistency between ini structure file and asterisk for ' + k);
        }
      }
    }
    logger.info(IDLOG, 'all iax trunks have been validated');

    // initialize all iax trunks as 'Trunk' objects into the 'trunks' property
    initializeIaxTrunk(resp);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Validates all iax extensions of the structure ini file and
 * initialize iax _Extension_ objects.
 *
 * @method iaxExtenStructValidation
 * @param {object} err  The error received from the command.
 * @param {array}  resp The response received from the command.
 * @private
 */
function iaxExtenStructValidation(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'validating iax extension structure: ' + err.toString());
      return;
    }

    // creates temporary object used to rapid check the
    // existence of an extension into the asterisk
    var i;
    var iaxlist = {};
    for (i = 0; i < resp.length; i++) {
      iaxlist[resp[i].exten] = '';
    }

    // cycles in all elements of the structure ini file to validate
    var k;
    for (k in struct) {

      // validates all sip extensions
      if (struct[k].tech === INI_STRUCT.TECH.IAX &&
        struct[k].type === INI_STRUCT.TYPE.EXTEN) {

        // current extension of the structure ini file isn't present
        // into the asterisk. So remove it from the structure ini file
        if (iaxlist[struct[k].extension] === undefined) {

          delete struct[k];
          logger.warn(IDLOG, 'inconsistency between ini structure file and asterisk for ' + k);
        }
      }
    }
    logger.info(IDLOG, 'all iax extensions have been validated');

    // initialize all iax extensions as 'Extension' objects into the 'extensions' object
    initializeIaxExten(resp);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Set the initial trunks list read from JSON configuration file.
 *
 * @method setStaticDataQueues
 * @param {object} obj The queues object read from JSON config file
 * @static
 */
function setStaticDataQueues(obj) {
  try {
    staticDataQueues = obj;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set QM alarms notifications status read from JSON configuration file.
 *
 * @method setQMAlarmsNotificationsStatus
 * @param {boolean} val The EnableNotifications value read from JSON config file
 * @static
 */
function setQMAlarmsNotificationsStatus(val) {
  try {
    QMAlarmsNotificationsStatus = val;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return the value of the QM alarms notifications status.
 *
 * @method getQMAlarmsNotificationsStatus
 * @return {boolean} The EnableNotifications status
 * @static
 */
function getQMAlarmsNotificationsStatus() {
  try {
    return QMAlarmsNotificationsStatus;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the context used for blind transfer.
 *
 * @method setBlindTransferContext
 * @param {string} ctx The context for blind transfer
 * @static
 */
function setBlindTransferContext(ctx) {
  try {
    blindTransferContext = ctx;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the asterisk feature codes read from JSON configuration file.
 *
 * @method setFeatureCodes
 * @param {object} obj The feature codes object read from JSON config file
 * @static
 */
function setFeatureCodes(obj) {
  try {
    featureCodes = obj;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return the asterisk code of pickup operation.
 *
 * @method getPickupCode
 * @return {string} The asterisk code of pickup operation.
 * @static
 */
function getPickupCode() {
  try {
    return featureCodes.pickup;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the initial trunks list read from JSON configuration file.
 *
 * @method setStaticDataTrunks
 * @param {object} obj The trunks object read from JSON config file
 * @static
 */
function setStaticDataTrunks(obj) {
  try {
    staticDataTrunks = obj;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the mac addresses read from JSON configuration file.
 *
 * @method setMacDataByMac
 * @param {object} obj The mac address associations. Keys are the mac addresses
 * @static
 */
function setMacDataByMac(obj) {
  try {
    macDataByMac = obj;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the mac addresses read from JSON configuration file.
 *
 * @method setMacDataByExt
 * @param {object} obj The mac address associations. Keys are the extension identifiers
 * @static
 */
function setMacDataByExt(obj) {
  try {
    macDataByExt = obj;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get extension from mac address.
 *
 * @method getExtenFromMac
 * @param {string} mac The mac address
 * @return {string} The extension identifier.
 */
function getExtenFromMac(mac) {
  try {
    return macDataByMac[mac.toLowerCase()];
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the extension names read from JSON configuration file.
 *
 * @method setStaticDataExtens
 * @param {object} obj The extension names associations
 * @static
 */
function setStaticDataExtens(obj) {
  try {
    staticDataExtens = undefined;
    staticDataExtens = obj;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Reset the component.
 *
 * @method reset
 * @static
 */
function reset() {
  try {
    clearInterval(intervalUpdateQueuesDetails);
    intervalUpdateQueuesDetails = null;

    var k;
    for (k in trunks) {
      delete trunks[k];
    }
    trunks = {};

    for (k in queues) {
      delete queues[k];
    }
    queues = {};

    for (k in parkings) {
      delete parkings[k];
    }
    parkings = {};

    for (k in parkedChannels) {
      delete parkedChannels[k];
    }
    parkedChannels = {};
    macDataByMac = {};
    macDataByExt = {};
    staticDataTrunks = {};
    staticDataQueues = {};
    featureCodes = {};
    blindTransferContext = undefined;

    for (k in initializationStatus) {
      initializationStatus[k] = false;
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Asterisk has been fully booted.
 *
 * @method evtFullyBooted
 * @static
 */
function evtFullyBooted() {
  try {
    logger.info(IDLOG, 'asterisk fully booted');
    start();
    // reload all components if asterisk was shutted down and restarted
    if (shutdown) {
      process.emit(EVT_RELOADAPP)
      shutdown = false
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

var initializationStatus = {
  pjsipExtens: false,
  queues: false,
  parkings: false
};

/**
 * It is called when the asterisk connection is fully booted.
 *
 * @method start
 * @static
 */
function start() {
  try {
    logger.info(IDLOG, 'start');
    // initialize pjsip extensions
    astProxy.doCmd({
      command: 'listPjsipPeers'
    }, initializePjsipExten);

    if (!reloading) {
      emitter.on('pjsipExtenInitialized', () => {
        // initialize queues
        astProxy.doCmd({
          command: 'listQueues'
        }, initializeQueues);
      });
    }

    // initialize parkings
    astProxy.doCmd({
      command: 'listParkings'
    }, initializeParkings);

    // initialize sip trunks
    astProxy.doCmd({
      command: 'listSipPeers'
    }, initializeSipTrunk);

    // initialize pjsip trunks
    astProxy.doCmd({
      command: 'listPjsipPeers'
    }, initializePjsipTrunk);

    // initialize all iax trunks
    astProxy.doCmd({
      command: 'listIaxPeers'
    }, initializeIaxTrunk);

    // initializes meetme conferences
    initMeetmeConf();

    // logger.info(IDLOG, 'start asterisk structure ini file validation');
    // // validates all sip extensions
    // astProxy.doCmd({
    //   command: 'listSipPeers'
    // }, sipExtenStructValidation);
    // // validates all iax extensions
    // astProxy.doCmd({
    //   command: 'listIaxPeers'
    // }, iaxExtenStructValidation);
    // // validates all queues
    // astProxy.doCmd({
    //   command: 'listQueues'
    // }, queueStructValidation);
    // // validates all parkings
    // astProxy.doCmd({
    //   command: 'listParkings'
    // }, parkStructValidation);
    // // validates all sip trunks
    // astProxy.doCmd({
    //   command: 'listSipPeers'
    // }, sipTrunkStructValidation);
    // // validates all iax trunks
    // astProxy.doCmd({
    //   command: 'listIaxPeers'
    // }, iaxTrunkStructValidation);


    // initializes meetme conferences
    // initMeetmeConf();
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Initialize all iax extensions as _Extension_ object into the
 * _extensions_ property.
 *
 * @method initializeIaxExten
 * @param {object} resp The response of the _listIaxPeers_ command plugin.
 * @private
 */
function initializeIaxExten(resp) {
  try {
    var i, k, exten;
    for (k in struct) {

      if (struct[k].type === INI_STRUCT.TYPE.EXTEN &&
        struct[k].tech === INI_STRUCT.TECH.IAX) { // all iax extensions

        exten = new Extension(struct[k].extension, struct[k].tech);
        extensions[exten.getExten()] = exten;
        extensions[exten.getExten()].setName(struct[k].label);
      }
    }

    // set iax information
    for (i = 0; i < resp.length; i++) {

      // this check is because some iax trunks can be present in the resp,
      // so in this function trunks are not considered
      if (extensions[resp[i].exten]) {

        extensions[resp[i].exten].setIp(resp[i].ip);
        extensions[resp[i].exten].setPort(resp[i].port);
        logger.info(IDLOG, 'set iax details for ext ' + resp[i].exten);

        // request the extension status
        astProxy.doCmd({
          command: 'extenStatus',
          exten: resp[i].exten
        }, extenStatus);
      }
    }

    // request all channels
    logger.info(IDLOG, 'requests the channel list to initialize iax extensions');
    astProxy.doCmd({
      command: 'listChannels'
    }, updateConversationsForAllExten);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Sets the details for all iax extension object.
 *
 * @method listIaxPeers
 * @private
 */
function listIaxPeers(resp) {
  try {
    // check parameter
    if (!resp) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var i;
    for (i = 0; i < resp.length; i++) {

      extensions[resp[i].ext].setIp(resp[i].ip);
      extensions[resp[i].ext].setPort(resp[i].port);
      logger.info(IDLOG, 'set iax details for ext ' + resp[i].ext);

      // request the extension status
      astProxy.doCmd({
        command: 'extenStatus',
        exten: resp[i].ext
      }, extenStatus);
    }

    // request all channels
    logger.info(IDLOG, 'requests the channel list to initialize iax extensions');
    astProxy.doCmd({
      command: 'listChannels'
    }, updateConversationsForAllExten);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Initialize all parkings as _Parking_ object into the _parkings_ property.
 *
 * @method initializeParkings
 * @param {object} err The error received from the command
 * @param {object} resp The response received from the command
 * @private
 */
function initializeParkings(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'initialing parkings: ' + err);
      return;
    }
    var pid, p;
    for (pid in resp) {
      // new parking object
      p = new Parking(pid);
      p.setName(pid);
      p.setTimeout(resp[pid].timeout);
      // store it
      parkings[p.getParking()] = p;
    }
    // request all parked channels
    astProxy.doCmd({
      command: 'listParkedCalls'
    }, listParkedCalls);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Add the name of the parked to the response received from "listParkedCalls"
 * command plugin.
 *
 * @method addParkeeNames
 * @param {object} resp The reponse object received from the "listParkedCalls" command plugin
 * @private
 */
function addParkeeNames(resp) {
  try {
    var p;
    for (p in resp) {
      resp[p].parkeeName = extensions[resp[p].parkeeNum] ? extensions[resp[p].parkeeNum].getName() : '';
    }
    return resp;
  } catch (error) {
    logger.error(IDLOG, error.stack);
    return resp;
  }
}

/**
 * Store parked channels in memory and launch "listChannel" command plugin
 * to get the number and the name of each parked channels.
 *
 * @method listParkedCalls
 * @param {object} err  The error object received from the "listParkedCalls" command plugin
 * @param {object} resp The reponse object received from the "listParkedCalls" command plugin
 * @private
 */
function listParkedCalls(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'listing parked calls: ' + err.toString());
      return;
    }
    resp = addParkeeNames(resp);

    // check the parameter
    if (typeof resp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // store parked channels in global variable "parkedChannels"
    parkedChannels = resp;
    // request all channels to get the caller number information for each parked channel
    astProxy.doCmd({
      command: 'listChannels'
    }, updateParkedCallerForAllParkings);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates specified parking key of the _parkedChannels_ property with the
 * object received from _listParkedCalls_ command plugin.
 *
 * @method updateParkedChannelOfOneParking
 * @param {object} err     The error object received from _listParkedCalls_ command plugin
 * @param {object} resp    The response object received from _listParkedCalls_ command plugin
 * @param {string} parking The parking identifier
 * @private
 */
function updateParkedChannelOfOneParking(err, resp, parking) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating parked channels of one parking ' + parking + ': ' + err.toString());
      return;
    }
    // check the parameters
    if (typeof resp !== 'object' || typeof parking !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    resp = addParkeeNames(resp);

    // check if the response contains a parked channel for the specified parking
    // If it is not present, the parking is free
    if (typeof resp[parking] === 'object') {

      // update the parked channel of the parking
      parkedChannels[parking] = resp[parking];

      // request all channels to get the caller number information of
      // the parked channel of the specified parking
      logger.info(IDLOG, 'request all channels to update parked caller information for parking ' + parking);
      astProxy.doCmd({
        command: 'listChannels'
      }, function (err, resp) {
        // update the parked caller of one parking in "parkings" object list
        updateParkedCallerOfOneParking(err, resp, parking);
      });

    } else {
      // there is not a parked caller for the parking, so
      // remove the parked channel from the memory
      delete parkedChannels[parking];
      logger.info(IDLOG, 'removed parked channel from parkedChannels for parking ' + parking);
      // remove the parked caller from the parking object
      parkings[parking].removeParkedCaller();
      logger.info(IDLOG, 'removed parked caller from parking ' + parking);

      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_PARKING_CHANGED + ' for parking ' + parking);
      astProxy.emit(EVT_PARKING_CHANGED, parkings[parking]);
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Update the parked caller of the specified parking.
 *
 * @method updateParkedCallerOfOneParking
 * @param {object} err     The error received from the _listChannels_ command plugin
 * @param {object} resp    The response received from the _listChannels_ command plugin
 * @param {string} parking The parking identifier
 * @private
 */
function updateParkedCallerOfOneParking(err, resp, parking) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating parked caller of one parking ' + parking + ': ' + err.toString());
      return;
    }
    // check parameters
    if (typeof parking !== 'string' || typeof resp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check if the parking exists, otherwise there is some error
    if (parkings[parking]) {

      // get the parked channel of the specified parking
      var ch = parkedChannels[parking].channel;

      if (resp[ch]) { // the channel exists

        // add the caller number information to the response
        // received from the "listParkedCalls" command plugin
        parkedChannels[parking].callerNum = resp[ch].callerNum;
        // add the caller name information for the same reason
        parkedChannels[parking].callerName = resp[ch].callerName;

        // create and store a new parked call object
        pCall = new ParkedCaller(parkedChannels[parking]);
        parkings[parking].addParkedCaller(pCall);
        logger.info(IDLOG, 'updated parked call ' + pCall.getNumber() + ' to parking ' + parking);

        // emit the event
        logger.info(IDLOG, 'emit event ' + EVT_PARKING_CHANGED + ' for parking ' + parking);
        astProxy.emit(EVT_PARKING_CHANGED, parkings[parking]);
      }
    } else {
      logger.warn(IDLOG, 'try to update parked caller of the non existent parking ' + parking);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates all parking lots with their relative parked calls,
 * if they are present.
 *
 * @method updateParkedCallerForAllParkings
 * @param {object} err  The error object
 * @param {object} resp The object received from the "listChannels" command plugin
 * @private
 */
function updateParkedCallerForAllParkings(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating parked caller for all parkings: ' + err.toString());
      return;
    }
    // cycle in all channels received from "listChannel" command plugin.
    // If a channel is present in "parkedChannels", then it is a parked
    // channel and so add it to relative parking
    var p, ch, pCall;
    for (p in parkedChannels) {

      ch = parkedChannels[p].channel;

      if (resp[ch]) { // the channel exists
        // add the caller number information to the response
        // received from the "listParkedCalls" command plugin
        parkedChannels[p].callerNum = resp[ch].callerNum;
        // add the caller name information for the same reason
        parkedChannels[p].callerName = resp[ch].callerName;
        // create and store a new parked call object
        pCall = new ParkedCaller(parkedChannels[p]);
        parkings[p].addParkedCaller(pCall);
        logger.info(IDLOG, 'added parked call ' + pCall.getNumber() + ' to parking ' + p);
      }
    }
    if (!reloading) {
      Object.keys(parkings).forEach(function (p) {
        logger.info(IDLOG, 'emit event ' + EVT_PARKING_CHANGED + ' for parking ' + p);
        astProxy.emit(EVT_PARKING_CHANGED, parkings[p]);
      });
    }
    initializationStatus.parkings = true;
    checkInitializationStatus();
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Get the details of a queue.
 *
 * @method getQueueDetails
 * @param {string} qid The queue identifier
 * @return {function} The function to be called by _initializeQueues_.
 * @private
 */
function getQueueDetails(qid) {
  return function (callback) {
    astProxy.doCmd({
      command: 'queueDetails',
      queue: qid
    }, function (err, resp) {
      queueDetails(err, resp, callback);
      callback(null);
    });
  };
}

/**
 * Initialize all queues as _Queue_ object into the _queues_ property.
 *
 * @method initializeQueues
 * @param {object} err The error
 * @param {array} results The queues list
 * @private
 */
function initializeQueues(err, results) {
  try {
    if (err) {
      logger.error(IDLOG, err);
      return;
    }
    var arr = [];
    var k, q;
    for (k in results) {
      if (staticDataQueues[results[k].queue]) {
        q = new Queue(results[k].queue);
        q.setName(staticDataQueues[results[k].queue].name);
        // store the new queue object
        queues[q.getQueue()] = q;
        arr.push(getQueueDetails(q.getQueue()));
      }
    }
    async.series(arr,
      function (err) {
        if (err) {
          logger.error(IDLOG, err);
        }
        if (!reloading) {
          results.forEach(function (o) {
            if (staticDataQueues[o.queue]) {
              logger.info(IDLOG, 'emit event ' + EVT_QUEUE_CHANGED + ' for queue ' + o.queue);
              astProxy.emit(EVT_QUEUE_CHANGED, queues[o.queue]);
            }
          });
        }
        initializationStatus.queues = true;
        checkInitializationStatus();
      }
    );
    logger.info(IDLOG, 'start the interval period to update the details of all the queues each ' + INTERVAL_UPDATE_QUEUE_DETAILS + ' msec');
    startIntervalUpdateQueuesDetails(INTERVAL_UPDATE_QUEUE_DETAILS);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates the data about all queues each interval of time.
 *
 * @method startIntervalUpdateQueuesDetails
 * @param {number} interval The interval time to update the details of all the queues
 * @private
 */
function startIntervalUpdateQueuesDetails(interval) {
  try {
    if (typeof interval !== 'number') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    intervalUpdateQueuesDetails = setInterval(function () {
      var q;
      for (q in queues) {
        logger.info(IDLOG, 'update details of queue ' + q);
        astProxy.doCmd({
          command: 'queueDetails',
          queue: q
        }, queueDetailsUpdate);
      }
    }, interval);
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the details for the queue object.
 *
 * @method queueDetailsUpdate
 * @param {object} err  The error response object
 * @param {object} resp The queue information object
 * @private
 */
function queueDetailsUpdate(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating queue details: ' + err.toString());
      return;
    }

    // check the parameter
    if (typeof resp !== 'object' ||
      resp.queue === undefined || resp.members === undefined ||
      resp.holdtime === undefined || resp.talktime === undefined ||
      resp.completedCallsCount === undefined || resp.abandonedCallsCount === undefined ||
      resp.serviceLevelTimePeriod === undefined || resp.serviceLevelPercentage === undefined) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var q = resp.queue; // the queue number

    // check the existence of the queue
    if (!queues[q]) {
      logger.warn(IDLOG, 'try to update details of not existent queue "' + q + '"');
      return;
    }

    // update the queue data
    setQueueData(q, resp);

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_QUEUE_CHANGED + ' for queue ' + q);
    astProxy.emit(EVT_QUEUE_CHANGED, queues[q]);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the data for the queue object.
 *
 * @method setQueueData
 * @param {string} q    The queue name
 * @param {object} resp The queue information object
 * @private
 */
function setQueueData(q, resp) {
  try {
    // check the parameter
    if (typeof q !== 'string' || typeof resp !== 'object' ||
      resp.holdtime === undefined || resp.talktime === undefined ||
      resp.completedCallsCount === undefined || resp.abandonedCallsCount === undefined ||
      resp.serviceLevelTimePeriod === undefined || resp.serviceLevelPercentage === undefined) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    queues[q].setAvgHoldTime(resp.holdtime);
    queues[q].setAvgTalkTime(resp.talktime);
    queues[q].setCompletedCallsCount(resp.completedCallsCount);
    queues[q].setAbandonedCallsCount(resp.abandonedCallsCount);
    queues[q].setServiceLevelTimePeriod(resp.serviceLevelTimePeriod);
    queues[q].setServiceLevelPercentage(resp.serviceLevelPercentage);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates waiting callers of the queue object.
 *
 * @method updateQueueWaitingCallers
 * @param {object} err  The error response object
 * @param {object} resp The queue information object
 * @private
 */
function updateQueueWaitingCallers(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating queue waiting callers: ' + err.toString());
      return;
    }

    // check the parameter
    if (typeof resp !== 'object' || resp.queue === undefined) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var q = resp.queue; // the queue number

    // check the existence of the queue
    if (!queues[q]) {
      logger.warn(IDLOG, 'try to update queue waiting callers of the queue "' + q + '"');
      return;
    }

    logger.info(IDLOG, 'update all waiting callers of queue "' + q + '"');

    // remove all current waiting callers
    queues[q].removeAllWaitingCallers();

    // set all waiting callers. If the waiting callers is already present in the queue, it will be
    // overwrite. In this manner the position is updated
    var ch, wCaller;
    for (ch in resp.waitingCallers) {
      wCaller = new QueueWaitingCaller(resp.waitingCallers[ch]);
      queues[q].addWaitingCaller(wCaller);
      logger.info(IDLOG, 'updated waiting caller ' + wCaller.getName() + ' of queue ' + wCaller.getQueue());
    }

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_QUEUE_CHANGED + ' for queue ' + q);
    astProxy.emit(EVT_QUEUE_CHANGED, queues[q]);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the details for the queue object. The details include the members and
 * the waiting callers.
 *
 * @method queueDetails
 * @param {object} err  The error response object
 * @param {object} resp The queue information object
 * @private
 */
function queueDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting queue details: ' + err.toString());
      return;
    }

    // check the parameter
    if (typeof resp !== 'object' ||
      resp.queue === undefined || resp.members === undefined ||
      resp.holdtime === undefined || resp.talktime === undefined ||
      resp.completedCallsCount === undefined || resp.abandonedCallsCount === undefined ||
      resp.serviceLevelTimePeriod === undefined) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var q = resp.queue; // the queue number

    // check the existence of the queue
    if (!queues[q]) {
      logger.warn(IDLOG, 'try to set details of not existent queue "' + q + '"');
      return;
    }

    // set the queue data
    setQueueData(q, resp);

    // add all static and dynamic members that are logged in
    var m;
    for (m in resp.members) {
      addQueueMemberLoggedIn(resp.members[m], q);
    }

    // adds all static and dynamic members that are logged out. To do so it cycle
    // the dynamic members of the queue and checks if each member has already been
    // added to the queue. If it is not present, means that it is not logged in,
    // becuase asterisk did not generate the event for the member
    var i;
    var allMembersQueue = queues[q].getAllMembers();

    for (i = 0; i < staticDataQueues[q].dynmembers.length; i++) {

      // all the logged in member has already been added to the queue in the above code using
      // the asterisk events. So if it is not present means that the member is not logged in and
      // adds the member to the queue as logged off
      if (!allMembersQueue[staticDataQueues[q].dynmembers[i]]) {
        addQueueMemberLoggedOut(staticDataQueues[q].dynmembers[i], q);
      }
    }
    // set all waiting callers
    var ch, wCaller;
    for (ch in resp.waitingCallers) {
      wCaller = new QueueWaitingCaller(resp.waitingCallers[ch]);
      queues[q].addWaitingCaller(wCaller);
      logger.info(IDLOG, 'added waiting caller ' + wCaller.getName() + ' to queue ' + wCaller.getQueue());
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Add a member to a queue with logged status set to out.
 *
 * @method addQueueMemberLoggedOut
 * @param {string} memberId The queue member identifier
 * @param {string} queueId  The queue identifier
 * @private
 */
function addQueueMemberLoggedOut(memberId, queueId) {
  try {
    // check parameters
    if (typeof memberId !== 'string' || typeof queueId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the existence of the queue
    if (!queues[queueId]) {
      logger.warn(IDLOG, 'try to add logged out member "' + memberId + '" to the not existent queue "' + queueId + '"');
      return;
    }

    if (extensions[memberId]) {
      // create new queue member object
      // false value of the third parameter is used as "paused" parameter because asterisk does not
      // provides this information. When the queue member logged in the queue a new "QueueMemberAdded"
      // event is generated from the asterisk and so the member is updated with all the updated values
      var member = new QueueMember(memberId, queueId, false, false);
      member.setType(QUEUE_MEMBER_TYPES_ENUM.DYNAMIC);
      // set the member name
      if (extensions[memberId]) {
        member.setName(extensions[memberId].getName());
      }

      // add the member to the queue
      queues[queueId].addMember(member);
      logger.info(IDLOG, 'added logged off member ' + member.getMember() + ' to the queue ' + queueId);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Add a member to the queue with logged status set to "in". If the member
 * is of dynamic type, it will be added only if it has been declared as
 * dynamic member of the queue.
 *
 * @method addQueueMemberLoggedIn
 * @param {object} data
 *    @param {string}  data.member            The member identifier
 *    @param {boolean} data.paused            The paused status of the member
 *    @param {string}  data.name              The name of the member
 *    @param {string}  data.type              The type of the member (dynamic, static, realtime)
 *    @param {number}  data.callsTakenCount   The number of the taken calls
 *    @param {number}  data.lastCallTimestamp The timestamp of the last call received by the member
 * @param {string} queueId The queue identifier
 * @private
 */
function addQueueMemberLoggedIn(data, queueId) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof queueId !== 'string' ||
      typeof data.member !== 'string' || typeof data.paused !== 'boolean' ||
      typeof data.name !== 'string' || typeof data.type !== 'string' ||
      typeof data.callsTakenCount !== 'number' || typeof data.lastCallTimestamp !== 'number') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (!queues[queueId]) {
      logger.warn(IDLOG, 'try to add the queue member "' + data.member + '" to a not existent queue "' + queueId + '"');
      return;
    }

    // add member only if it has been specified as dynamic member of the queue or it is static
    if (extensions[data.member] &&
      (
        data.type === QUEUE_MEMBER_TYPES_ENUM.STATIC ||
        (
          staticDataQueues[queueId] &&
          staticDataQueues[queueId].dynmembers &&
          staticDataQueues[queueId].dynmembers.indexOf(data.member) !== -1
        )
      )
    ) {

      // create new queue member object
      var member = new QueueMember(data.member, queueId, data.paused, true);
      member.setName(extensions[data.member].getName());
      member.setType(data.type);
      member.setCallsTakenCount(data.callsTakenCount);
      member.setLastCallTimestamp(data.lastCallTimestamp);
      // add the member to the queue
      queues[queueId].addMember(member);
      logger.info(IDLOG, 'added member ' + member.getMember() + ' to the queue ' + queueId);

      logger.info(IDLOG, 'emit event ' + EVT_QUEUE_MEMBER_CHANGED + ' for member ' + data.member + ' of queue ' + queueId);
      astProxy.emit(EVT_QUEUE_MEMBER_CHANGED, queues[queueId].getMember(data.member));
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Return the list of all agents of all queues.
 *
 * @method getAllQueuesAgents
 * @return {array} The list of all agents of all queues.
 * @private
 */
function getAllQueuesAgents() {
  try {
    var q, m;
    var ret = {};
    for (q in queues) {
      var membs = queues[q].getAllMembers();
      for (m in membs) {
        ret[membs[m].getName()] = undefined;
      }
    }
    return Object.keys(ret);
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Return the number of connected calls through the specified queue.
 *
 * @method getCCCounterByQueue
 * @param {string} qid The queue identifier
 * @return {number} The the number of connected calls through the specified queue.
 */
function getCCCounterByQueue(qid) {
  try {
    if (typeof qid !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var e;
    var count = 0;
    for (e in extensions) {
      count += extensions[e].getCCCounterByQueue(qid);
    }
    return count;
  } catch (error) {
    logger.error(IDLOG, error.stack);
    return 0;
  }
}

/**
 * Return the number of waiting calls through the specified queue.
 *
 * @method getWaitingCounterByQueues
 * @param {string} qid The queue identifier
 * @return {number} The the number of waiting calls through the specified queue.
 */
function getWaitingCounterByQueue(qid) {
  try {
    if (typeof qid !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return queues[qid].getWaitingCounter();
  } catch (error) {
    logger.error(IDLOG, error.stack);
    return 0;
  }
}

/**
 * Return the JSON statistics about all queues.
 *
 * @method getJSONAllQueuesStats
 * @param {array} queuesList The list of the queues identifiers
 * @param {function} cb The callback function
 * @return {object} The JSON statistics about all queues.
 */
function getJSONAllQueuesStats(queuesList, cb) {
  try {
    if (Array.isArray(queuesList) === false || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var result = {};
    for (var i = 0; i < queuesList.length; i++) {
      result[queuesList[i]] = {
        cc_counter: getCCCounterByQueue(queuesList[i]),
        waiting_counter: getWaitingCounterByQueue(queuesList[i])
      };
      result[queuesList[i]].tot = result[queuesList[i]].cc_counter + result[queuesList[i]].waiting_counter;
    }
    cb(null, result);
  } catch (error) {
    logger.error(IDLOG, error.stack);
    cb(error);
  }
}

/**
 * Return the list of all agents of the specified queues.
 *
 * @method getAgentsOfQueues
 * @param {array} queuesList The list of the queues identifiers
 * @return {array} The list of all agents of the specified queues.
 */
function getAgentsOfQueues(queuesList, cb) {
  try {
    if (Array.isArray(queuesList) === false) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let results = [];
    for (let i = 0; i < queuesList.length; i++) {
      if (queues[queuesList[i]]) {
        results = results.concat(queues[queuesList[i]].getMembersList());
      }
    }
    return results.filter((item, pos) => results.indexOf(item) === pos);
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Returns the JSON representation of all queues.
 *
 * @method getJSONQueues
 * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
 * @return {object} The JSON representation of all queues.
 */
function getJSONQueues(privacyStr) {
  try {
    var qliteral = {};
    var q;
    for (q in queues) {
      qliteral[q] = queues[q].toJSON(privacyStr);
    }
    return qliteral;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the list of the trunks.
 *
 * @method getTrunksList
 * @return {array} The trunks list.
 */
function getTrunksList() {
  try {
    return Object.keys(trunks);

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Returns the list of the extensions.
 *
 * @method getExtensList
 * @return {array} The extensions list.
 */
function getExtensList() {
  try {
    return Object.keys(extensions);

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Returns the list of the queues.
 *
 * @method getQueuesList
 * @return {array} The queues list.
 */
function getQueuesList() {
  try {
    return Object.keys(queues);
  } catch (err) {
    logger.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Returns the queues.
 *
 * @method getQueues
 * @return {object} The queues.
 */
function getQueues() {
  try {
    return queues;
  } catch (err) {
    logger.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns the JSON representation of all trunks.
 *
 * @method getJSONTrunks
 * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
 * @return {object} The JSON representation of all trunks.
 */
function getJSONTrunks(privacyStr) {
  try {
    var tliteral = {};
    var t;
    for (t in trunks) {
      tliteral[t] = trunks[t].toJSON(privacyStr);
    }
    return tliteral;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the JSON representation of all parkings.
 *
 * @method getJSONParkings
 * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
 * @return {object} The JSON representation of all parkings.
 */
function getJSONParkings(privacyStr) {
  try {
    var p;
    var pliteral = {};
    for (p in parkings) {
      pliteral[p] = parkings[p].toJSON(privacyStr);
    }
    return pliteral;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the JSON representation of all the extensions. If some error occurs it returns an empty object.
 *
 * @method getJSONExtensions
 * @param  {string} [privacyStrOutQueue] If it is specified, it obfuscates the number of all calls that does not pass through a queue
 * @param  {string} [privacyStrInQueue]  If it is specified, it obfuscates the number of all calls that pass through a queue
 * @return {object} The JSON representation of the all extensions.
 */
function getJSONExtensions(privacyStrOutQueue, privacyStrInQueue) {
  try {
    var eliteral = {};
    var ext;
    for (ext in extensions) {
      eliteral[ext] = extensions[ext].toJSON(privacyStrOutQueue, privacyStrInQueue);
    }
    return eliteral;

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns the JSON representation of the extension. If some error
 * occurs it returns an empty object.
 *
 * @method getJSONExtension
 * @param  {string} exten                The extension identifier
 * @param  {string} [privacyStrOutQueue] If it is specified, it obfuscates the number of all calls that does not pass through a queue
 * @param  {string} [privacyStrInQueue]  If it is specified, it obfuscates the number of all calls that pass through a queue
 * @return {object} The JSON representation of the extension.
 */
function getJSONExtension(exten, privacyStrOutQueue, privacyStrInQueue) {
  try {
    // check the parameter
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    return extensions[exten].toJSON(privacyStrOutQueue, privacyStrInQueue);

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns the IP address of the extension.
 *
 * @method getExtensionIp
 * @param  {string} exten The extension identifier
 * @return {string} The IP address of the extension.
 */
function getExtensionIp(exten) {
  try {
    // check the parameter
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    return extensions[exten].getIp();

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return '';
  }
}

/**
 * Returns the extension user agent.
 *
 * @method getExtensionAgent
 * @param  {string} exten The extension identifier
 * @return {string} The extension user agent.
 */
function getExtensionAgent(exten) {
  try {
    // check the parameter
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) {
      return extensions[exten].getUserAgent();
    }
    return '';

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return '';
  }
}

/**
 * Initialize all sip extensions as _Extension_ object into the
 * _extensions_ property.
 *
 * @method initializeSipExten
 * @private
 */
function initializeSipExten() {
  try {
    var k, exten;
    for (k in struct) {

      if (struct[k].type === INI_STRUCT.TYPE.EXTEN &&
        struct[k].tech === INI_STRUCT.TECH.SIP) { // all sip extensions

        exten = new Extension(struct[k].extension, struct[k].tech);
        extensions[exten.getExten()] = exten;

        // set extension websocket transport usage
        if (struct[k].transport.indexOf('ws') > -1) {
          exten.setUseWebsocket(true);
        } else {
          exten.setUseWebsocket(false);
        }

        // request sip details for current extension
        astProxy.doCmd({
          command: 'sipDetails',
          exten: exten.getExten()
        }, extSipDetails);
        // request the extension status
        astProxy.doCmd({
          command: 'extenStatus',
          exten: exten.getExten()
        }, extenStatus);
        // get the dnd status
        astProxy.doCmd({
          command: 'dndGet',
          exten: exten.getExten()
        }, setDndStatus);
        // get the call forward status
        astProxy.doCmd({
          command: 'cfGet',
          exten: exten.getExten()
        }, setCfStatus);
        // get the call forward to voicemail status
        astProxy.doCmd({
          command: 'cfVmGet',
          exten: exten.getExten()
        }, setCfVmStatus);
      }
    }
    // request all channels
    logger.info(IDLOG, 'requests the channel list to initialize sip extensions');
    astProxy.doCmd({
      command: 'listChannels'
    }, updateConversationsForAllExten);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get do not disturb (DND) status of the extension.
 *
 * @method getDndExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getDndExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'dndGet',
      exten: exten
    }, function (err, resp) {
      setDndStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get call forward (CF) status of the extension.
 *
 * @method getCfExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getCfExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'cfGet',
      exten: exten
    }, function (err, resp) {
      setCfStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get call forward on busy (CFB) status of the extension.
 *
 * @method getCfbExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getCfbExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'cfbGet',
      exten: exten
    }, function (err, resp) {
      setCfbStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get call forward on unavailable (CFU) status of the extension.
 *
 * @method getCfuExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getCfuExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'cfuGet',
      exten: exten
    }, function (err, resp) {
      setCfuStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get call forward to voicemail (CFVM) status of the extension.
 *
 * @method getCfVmExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getCfVmExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'cfVmGet',
      exten: exten
    }, function (err, resp) {
      setCfVmStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get call forward on busy to voicemail (CFB) status of the extension.
 *
 * @method getCfbVmExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getCfbVmExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'cfbVmGet',
      exten: exten
    }, function (err, resp) {
      setCfbVmStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get call forward on unavailable to voicemail (CFU) status of the extension.
 *
 * @method getCfuVmExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getCfuVmExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'cfuVmGet',
      exten: exten
    }, function (err, resp) {
      setCfuVmStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get pjsip extension details.
 *
 * @method getPjsipDetailExten
 * @param {string} exten The extension identifier
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getPjsipDetailExten(exten) {
  return function (callback) {
    astProxy.doCmd({
      command: 'pjsipDetails',
      exten: exten
    }, function (err, resp) {
      extPjsipDetails(err, resp);
      callback(null);
    });
  };
}

/**
 * Get pjsip trunk details.
 *
 * @method getPjsipDetailTrunk
 * @param {string} trunk The trunk identifier
 * @return {function} The function to be called by _initializePjsipTrunk_.
 * @private
 */
function getPjsipDetailTrunk(trunk) {
  return function (callback) {
    astProxy.doCmd({
      command: 'pjsipDetails',
      exten: trunk
    }, function (err, resp) {
      trunkPjsipDetails(err, resp);
      callback(null);
    });
  };
}

/**
 * Get the list of channels.
 *
 * @method getListChannels
 * @return {function} The function to be called by _initializePjsipExten_.
 * @private
 */
function getListChannels() {
  return function (callback) {
    astProxy.doCmd({
      command: 'listChannels'
    }, function (err, resp) {
      updateConversationsForAllExten(err, resp);
      callback(null);
    });
  };
}

/**
 * Return true if the component is reloading.
 *
 * @method isReloading
 * @return {boolean} True if the component is reloading.
 * @private
 */
let isReloading = () => {
  try {
    return (ready === true && reloading === true);
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
};

/**
 * Initialize all pjsip extensions as _Extension_ object into the
 * _extensions_ property.
 *
 * @method initializePjsipExten
 * @param {object} err The error
 * @param {array} results The extensions list
 * @private
 */
function initializePjsipExten(err, results) {
  try {
    if (err) {
      logger.error(IDLOG, err);
      logger.warn(IDLOG, 'try again in 2 sec');
      setTimeout(() => {
        start();
      }, 2000);
      return;
    }
    let parallelOp = {}; // parallel operations for each extension
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    for (let e in results) {
      if (staticDataTrunks[results[e].ext]) { // skip if trunk
        continue;
      }
      if (staticDataExtens.names && !staticDataExtens.names[results[e].ext]) {
        continue;
      }
      let extenId = results[e].ext;
      objToUse[extenId] = new Extension(extenId, 'pjsip');
      objToUse[extenId].setMac(macDataByExt[extenId] ? macDataByExt[extenId] : '');
      parallelOp[extenId] = [];
      parallelOp[extenId].push(getDndExten(extenId));
      parallelOp[extenId].push(getCfExten(extenId));
      parallelOp[extenId].push(getCfuExten(extenId));
      parallelOp[extenId].push(getCfbExten(extenId));
      parallelOp[extenId].push(getCfVmExten(extenId));
      parallelOp[extenId].push(getCfbVmExten(extenId));
      parallelOp[extenId].push(getCfuVmExten(extenId));
      parallelOp[extenId].push(getPjsipDetailExten(extenId));
      parallelOp[extenId].push(getListChannels());
    }
    objToUse = undefined;
    let arrSeries = []; // series operation one for each extension
    for (let extenId in parallelOp) {
      arrSeries.push(callback => {
        async.parallel(parallelOp[extenId], err => {
          try {
            if (err) {
              logger.error(IDLOG, err);
            }
            callback(null);
          } catch (error) {
            logger.error(IDLOG, error.stack);
          }
        });
      })
    }
    logger.info(IDLOG, `start series/parallel op for pjsip exten init`);
    async.series(arrSeries, function (err) {
      try {
        if (err) {
          logger.error(IDLOG, err);
        }
        initializationStatus.pjsipExtens = true;
        checkInitializationStatus();
        emitter.emit('pjsipExtenInitialized');
        logger.info(IDLOG, `end series/parallel op for pjsip exten init`);
      } catch (error) {
        logger.error(IDLOG, error.stack);
      }
    });
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Check the initialization status of all parts: if all parts has
 * been initialized, it emits the relative event for the client.
 *
 * @method checkInitializationStatus
 * @private
 */
function checkInitializationStatus() {
  try {
    var k;
    for (k in initializationStatus) {
      if (initializationStatus[k] === false) {
        return;
      }
    }
    if (!ready) {
      logger.warn(IDLOG, 'emit "' + EVT_READY + '" event');
      astProxy.emit(EVT_READY);
      ready = true;
    } else {
      logger.warn(IDLOG, 'reloaded');
      logger.warn(IDLOG, 'emit "' + EVT_RELOADED + '" event');
      astProxy.emit(EVT_RELOADED);
    }
    for (k in initializationStatus) {
      initializationStatus[k] = false;
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates data about all meetme conferences.
 *
 * @method updateMeetmeConferences
 * @param {object} err  The error response object
 * @param {object} data The meetme conferences information object
 * @private
 */
function updateMeetmeConferences(err, data) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating data about all meetme conferences: ' + err.toString());
      return;
    }
    if (typeof data === 'object') {

      var extOwnerId;
      for (extOwnerId in data) {
        updateMeetmeConf(null, data[extOwnerId]);
      }
    }
    logger.info(IDLOG, 'updated all meetme conferences: #' + Object.keys(conferences).length);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates data about a single meetme conference.
 *
 * @method updateMeetmeConf
 * @param {object} err  The error response object
 * @param {object} data The meetme conference information object
 * @private
 */
function updateMeetmeConf(err, data) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating data about single meetme conference: ' + err.toString());
      return;
    }

    // data can be undefined when no conference is present. This case is
    // managed by "meetmeend" event
    if (typeof data === 'object') {

      var i;
      var newConf = new MeetmeConference(data.confId);
      for (i = 0; i < data.users.length; i++) {
        var newUserConf = new MeetmeConfUser(data.users[i].id, data.users[i].extenId, data.users[i].isOwner, data.users[i].channel);
        newUserConf.setName(extensions[data.users[i].extenId] ? extensions[data.users[i].extenId].getName() : '');
        newUserConf.setMuted(data.users[i].muted);
        newUserConf.setRemoteSitePrefix(data.users[i].prefix);
        newUserConf.setRemoteSiteName(data.users[i].site);
        newConf.addUser(newUserConf);
      }
      conferences[data.confId] = newConf;

      logger.info(IDLOG, 'updated meetme conference "' + data.confId + '": users #' + data.users.length);

      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_MEETME_CONF_CHANGED + ' for conf ' + data.confId);
      astProxy.emit(EVT_MEETME_CONF_CHANGED, conferences[data.confId]);
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Initializes all meetme conferences.
 *
 * @method initMeetmeConf
 * @private
 */
function initMeetmeConf() {
  try {
    astProxy.doCmd({
      command: 'listMeetmeConf',
      meetmeConfCode: getMeetmeConfCode(),
      remoteSitesPrefixes: remoteSitesPrefixes
    }, updateMeetmeConferences);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get trunk sip details.
 *
 * @method getTrunkSipDetails
 * @param {string} trunk The trunk identifier
 * @return {function} The function to be called by _initializeSipTrunk_.
 * @private
 */
function getTrunkSipDetails(trunk) {
  return function (callback) {
    astProxy.doCmd({
      command: 'sipDetails',
      exten: trunk
    }, function (err, resp) {
      trunkSipDetails(err, resp);
      callback(null);
    });
  };
}

/**
 * Get status of trunk sip.
 *
 * @method getSipTrunkStatus
 * @param {string} trunk The trunk identifier
 * @return {function} The function to be called by _initializeSipTrunk_.
 * @private
 */
function getSipTrunkStatus(trunk) {
  return function (callback) {
    astProxy.doCmd({
      command: 'sipTrunkStatus',
      trunk: trunk
    }, function (err, resp) {
      sipTrunkStatus(err, resp);
      callback(null);
    });
  };
}

/**
 * Get sip trunk registration.
 *
 * @method getSipTrunkRegistration
 * @param {string} trunk The trunk identifier
 * @return {function} The function to be called by _initializeSipTrunk_.
 * @private
 */
 function getSipTrunkRegistration(trunkData) {
  return function (callback) {
    astProxy.doCmd({
      command: 'sipTrunkRegistration',
      trunk: trunkData
    }, function (err, resp) {
      trunkRegistration(err, resp);
      callback(null);
    });
  };
}

/**
 * Initialize all sip trunks as _Trunk_ object into the _trunks_ property.
 *
 * @method initializeSipTrunk
 * @param {object} err The error received from the command
 * @param {array} resp The response received from the command
 * @private
 */
function initializeSipTrunk(err, results) {
  try {
    if (err) {
      logger.error(IDLOG, err);
      return;
    }

    var arr = [];
    var i;
    for (i = 0; i < results.length; i++) {
      // skip if the current sip is not a trunk
      if (!staticDataTrunks[results[i].ext]) {
        continue;
      }

      trunk = new Trunk(
        results[i].ext,
        staticDataTrunks[results[i].ext].tech,
        staticDataTrunks[results[i].ext].maxchans
      );
      trunks[trunk.getExten()] = trunk;
      trunks[trunk.getExten()].setName(staticDataTrunks[results[i].ext].name);
      trunks[trunk.getExten()].setUserContext(staticDataTrunks[results[i].ext].usercontext);
      trunks[trunk.getExten()].setIp(results[i].ip);
      trunks[trunk.getExten()].setPort(results[i].port);

      arr.push(getTrunkSipDetails(trunk.getExten()));
      arr.push(getSipTrunkStatus(trunk.getExten()));
      arr.push(getSipTrunkRegistration(staticDataTrunks[results[i].ext]));
    }
    async.parallel(arr, function (err) {
      if (err) {
        logger.error(IDLOG, err);
      }
      getListChannelsForTrunks();
    });
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get all the channels to update conversations of all trunks.
 *
 * @method getListChannelsForTrunks
 * @private
 */
function getListChannelsForTrunks() {
  try {
    if (trunksEventsEnabled) {
      astProxy.doCmd({
        command: 'listChannels'
      }, updateConversationsForAllTrunk);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get all the channels to update conversations of a single trunk.
 *
 * @method getListChannelsForSingleTrunk
 * @param {string} num The trunk identifier
 * @private
 */
function getListChannelsForSingleTrunk(num) {
  try {
    if (trunksEventsEnabled) {
      astProxy.doCmd({
        command: 'listChannels'
      }, function (err, resp) {
        updateTrunkConversations(err, resp, num);
      });
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get pjsip trunk registration.
 *
 * @method getPjsipTrunkRegistration
 * @param {string} trunk The trunk identifier
 * @return {function} The function to be called by _initializePjsipTrunk_.
 * @private
 */
 function getPjsipTrunkRegistration(trunkData) {
  return function (callback) {
    astProxy.doCmd({
      command: 'pjsipTrunkRegistration',
      trunk: trunkData
    }, function (err, resp) {
      trunkRegistration(err, resp);
      callback(null);
    });
  };
}

/**
 * Initialize all pjsip trunks as _Trunk_ object into the _trunks_ property.
 *
 * @method initializePjsipTrunk
 * @param {object} err The error received from the command
 * @param {array} resp The response received from the command
 * @private
 */
function initializePjsipTrunk(err, results) {
  try {
    if (err) {
      logger.error(IDLOG, err);
      return;
    }

    var arr = [];
    var i;
    for (i = 0; i < results.length; i++) {
      // skip if the current pjsip is not a trunk
      if (!staticDataTrunks[results[i].ext]) {
        continue;
      }

      trunk = new Trunk(
        results[i].ext,
        staticDataTrunks[results[i].ext].tech,
        staticDataTrunks[results[i].ext].maxchans
      );
      trunks[trunk.getExten()] = trunk;
      trunks[trunk.getExten()].setName(staticDataTrunks[results[i].ext].name);
      trunks[trunk.getExten()].setUserContext(staticDataTrunks[results[i].ext].usercontext);

      arr.push(getPjsipDetailTrunk(trunk.getExten()));
      arr.push(getPjsipTrunkRegistration(staticDataTrunks[results[i].ext]));
    }
    async.parallel(arr,
      function (err) {
        if (err) {
          logger.error(IDLOG, err);
        }
        getListChannelsForTrunks();
      }
    );
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Get iax trunk registration.
 *
 * @method getIaxTrunkRegistration
 * @param {string} trunk The trunk identifier
 * @return {function} The function to be called by _initializeIaxTrunk_.
 * @private
 */
 function getIaxTrunkRegistration(trunkData) {
  return function (callback) {
    astProxy.doCmd({
      command: 'iaxTrunkRegistration',
      trunk: trunkData
    }, function (err, resp) {
      trunkRegistration(err, resp);
      callback(null);
    });
  };
}

/**
 * Initialize all iax trunks as _Trunk_ object into the _trunks_ property.
 *
 * @method initializeIaxTrunk
 * @param {object} err The error received from the command
 * @param {array} resp The response received from the command
 * @private
 */
function initializeIaxTrunk(err, results) {
  try {
    if (err) {
      logger.error(IDLOG, err);
      return;
    }

    var arr = [];
    var k, trunk;

    for (i = 0; i < results.length; i++) {
      // skip if the current iax is not a trunk
      if (!staticDataTrunks[results[i].exten]) {
        continue;
      }
      trunk = new Trunk(
        results[i].exten,
        staticDataTrunks[results[i].exten].tech,
        staticDataTrunks[results[i].exten].maxchans
      );
      trunks[trunk.getExten()] = trunk;
      trunks[trunk.getExten()].setIp(results[i].ip);
      trunks[trunk.getExten()].setPort(results[i].port);
      trunks[trunk.getExten()].setStatus(results[i].status);
      trunks[trunk.getExten()].setName(staticDataTrunks[results[i].exten].name);
      trunks[trunk.getExten()].setUserContext(staticDataTrunks[results[i].exten].usercontext);

      arr.push(getIaxTrunkRegistration(staticDataTrunks[results[i].exten]));
    }
    async.parallel(arr,
      function (err) {
        if (err) {
          logger.error(IDLOG, err);
        }
        getListChannelsForTrunks();
      }
    );
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Set the call forward status of the extension.
 *
 * @method setCfStatus
 * @param {object} err  The error object of the _cfGet_ command plugin
 * @param {object} resp The response object of the _cfGet_ command plugin
 * @private
 */
function setCfStatus(err, resp) {
  try {
    if (err) {
      throw err;
    }
    if (typeof resp !== 'object' || typeof resp.exten !== 'string' || typeof resp.status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    if (objToUse[resp.exten]) {
      if (resp.status === 'on') {
        objToUse[resp.exten].setCf(resp.to);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cf enable to ' + resp.to);
      } else {
        objToUse[resp.exten].disableCf();
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cf disable');
      }
    } else {
      logger.warn(IDLOG, 'request cf for not existing extension ' + resp.exten);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Set the call forward on busy status of the extension.
 *
 * @method setCfbStatus
 * @param {object} err The error object of the _cfbGet_ command plugin
 * @param {object} resp The response object of the _cfbGet_ command plugin
 * @private
 */
function setCfbStatus(err, resp) {
  try {
    if (err) {
      throw err;
    }
    if (typeof resp !== 'object' || typeof resp.exten !== 'string' || typeof resp.status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    if (objToUse[resp.exten]) { // the extension exists
      if (resp.status === 'on') {
        objToUse[resp.exten].setCfb(resp.to);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfb enable to ' + resp.to);
      } else {
        objToUse[resp.exten].disableCfb();
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfb disable');
      }
    } else {
      logger.warn(IDLOG, 'request cfb for not existing extension ' + resp.exten);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Set the call forward on unavailable status of the extension.
 *
 * @method setCfuStatus
 * @param {object} err The error object of the _cfuGet_ command plugin
 * @param {object} resp The response object of the _cfuGet_ command plugin
 * @private
 */
function setCfuStatus(err, resp) {
  try {
    if (err) {
      throw err;
    }
    if (typeof resp !== 'object' || typeof resp.exten !== 'string' || typeof resp.status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    if (objToUse[resp.exten]) {
      if (resp.status === 'on') {
        objToUse[resp.exten].setCfu(resp.to);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfu enable to ' + resp.to);
      } else {
        objToUse[resp.exten].disableCfu();
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfu disable');
      }
    } else {
      logger.warn(IDLOG, 'request cfu for not existing extension ' + resp.exten);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the call forward to voicemail status of the extension.
 *
 * @method setCfVmStatus
 * @param {object} err  The error object of the _cfVmGet_ command plugin.
 * @param {object} resp The response object of the _cfVmGet_ command plugin.
 * @private
 */
function setCfVmStatus(err, resp) {
  try {
    if (err) {
      throw err;
    }
    if (typeof resp !== 'object' || typeof resp.exten !== 'string' || typeof resp.status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    if (objToUse[resp.exten]) { // the extension exists
      if (resp.status === 'on') {
        objToUse[resp.exten].setCfVm(resp.to);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfvm enable to ' + resp.to);
      } else {
        objToUse[resp.exten].disableCfVm();
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfvm disabled');
      }
    } else {
      logger.warn(IDLOG, 'request cfvm for not existing extension ' + resp.exten);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the call forward on busy to voicemail status of the extension.
 *
 * @method setCfbVmStatus
 * @param {object} err The error object of the _cfbVmGet_ command plugin.
 * @param {object} resp The response object of the _cfbVmGet_ command plugin.
 * @private
 */
function setCfbVmStatus(err, resp) {
  try {
    if (err) {
      throw err;
    }
    if (typeof resp !== 'object' ||
      typeof resp.exten !== 'string' || typeof resp.status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    if (objToUse[resp.exten]) { // the extension exists
      if (resp.status === 'on') {
        objToUse[resp.exten].setCfbVm(resp.to);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfbvm enable to ' + resp.to);
      } else {
        objToUse[resp.exten].disableCfbVm();
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfbvm disabled');
      }
    } else {
      logger.warn(IDLOG, 'request cfbvm for not existing extension ' + resp.exten);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the call forward on unavailable to voicemail status of the extension.
 *
 * @method setCfuVmStatus
 * @param {object} err The error object of the _cfuVmGet_ command plugin.
 * @param {object} resp The response object of the _cfuVmGet_ command plugin.
 * @private
 */
function setCfuVmStatus(err, resp) {
  try {
    if (err) {
      throw err;
    }
    if (typeof resp !== 'object' || typeof resp.exten !== 'string' || typeof resp.status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    if (objToUse[resp.exten]) { // the extension exists
      if (resp.status === 'on') {
        objToUse[resp.exten].setCfuVm(resp.to);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfuvm enable to ' + resp.to);
      } else {
        objToUse[resp.exten].disableCfuVm();
        logger.info(IDLOG, 'set extension ' + resp.exten + ' cfuvm disabled');
      }
    } else {
      logger.warn(IDLOG, 'request cfuvm for not existing extension ' + resp.exten);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Set the don't disturb status of the extension.
 *
 * @method setDndStatus
 * @param {object} err The error object of the _dndGet_ command plugin.
 * @param {object} resp The response object of the _dndGet_ command plugin.
 * @private
 */
function setDndStatus(err, resp) {
  try {
    if (err) {
      throw err;
    }
    if (typeof resp !== 'object' || typeof resp.exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    if (objToUse[resp.exten]) {
      if (resp.dnd === 'on') {
        objToUse[resp.exten].setDnd(true);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' dnd true');
      } else {
        objToUse[resp.exten].setDnd(false);
        logger.info(IDLOG, 'set extension ' + resp.exten + ' dnd false');
      }
    } else {
      logger.warn(IDLOG, 'request dnd for not existing extension ' + resp.exten);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the details for the sip extension object.
 *
 * @method extSipDetails
 * @param {object} err  The error object
 * @param {object} resp The extension information object
 * @private
 */
function extSipDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting sip extension details: ' + err.toString());
      return;
    }

    // check parameter
    if (!resp) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // extract extension object from the response
    var data = resp.exten;

    // set the extension information
    extensions[data.exten].setIp(data.ip);
    extensions[data.exten].setPort(data.port);
    extensions[data.exten].setName(data.name);
    extensions[data.exten].setContext(data.context);
    extensions[data.exten].setSipUserAgent(data.sipuseragent);
    if (isReloading() && tempExtensions[data.exten]) {
      tempExtensions[data.exten].setIp(data.ip);
      tempExtensions[data.exten].setPort(data.port);
      tempExtensions[data.exten].setName(data.name);
      tempExtensions[data.exten].setContext(data.context);
      tempExtensions[data.exten].setSipUserAgent(data.sipuseragent);
    }
    logger.info(IDLOG, 'set sip details for ext ' + data.exten);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the details for the pjsip extension object.
 *
 * @method extPjsipDetails
 * @param {object} err The error object
 * @param {object} resp The extension information object
 * @private
 */
function extPjsipDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting pjsip extension details: ' + err.toString());
      return;
    }
    if (!resp) {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }
    if (extensions[resp.exten]) {
      extensions[resp.exten].setIp(resp.ip);
      extensions[resp.exten].setPort(resp.port);
      extensions[resp.exten].setName(staticDataExtens.names[resp.exten]);
      extensions[resp.exten].setContext(resp.context);
      extensions[resp.exten].setCodecs(resp.codecs);
      extensions[resp.exten].setSipUserAgent(resp.sipuseragent);
      extensions[resp.exten].setStatus(resp.status);
    }
    if (isReloading() && tempExtensions[resp.exten]) {
      tempExtensions[resp.exten].setIp(resp.ip);
      tempExtensions[resp.exten].setPort(resp.port);
      tempExtensions[resp.exten].setName(staticDataExtens.names[resp.exten]);
      tempExtensions[resp.exten].setContext(resp.context);
      tempExtensions[resp.exten].setCodecs(resp.codecs);
      tempExtensions[resp.exten].setSipUserAgent(resp.sipuseragent);
      tempExtensions[resp.exten].setStatus(resp.status);
    }
    logger.info(IDLOG, 'set pjsip details for ext "' + resp.exten + '"');
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the details for the pjsip trunk object.
 *
 * @method trunkPjsipDetails
 * @param {object} err The error object
 * @param {object} resp The trunk information object
 * @private
 */
function trunkPjsipDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting pjsip trunk details: ' + err.toString());
      return;
    }
    if (!resp) {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }
    if (trunks[resp.exten]) {
      trunks[resp.exten].setIp(resp.ip);
      trunks[resp.exten].setPort(resp.port);
      trunks[resp.exten].setCodecs(resp.codecs);
      trunks[resp.exten].setStatus(resp.status);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the details for the sip trunk object.
 *
 * @method trunkSipDetails
 * @param {object} err  The error object
 * @param {object} resp The trunk information object
 * @private
 */
function trunkSipDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting sip trunk details: ' + err.toString());
      return;
    }

    // check parameter
    if (!resp) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // extract extension object from the response
    var data = resp.exten;

    // set the extension information
    trunks[data.exten].setSipUserAgent(data.sipuseragent);
    trunks[data.exten].setCodecs(data.codecs);
    logger.info(IDLOG, 'set sip details for trunk ' + data.exten);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Update iax extension information and emit _EVT\_EXTEN\_CHANGED_ event.
 *
 * @method updateExtIaxDetails
 * @param {object} err  The error object
 * @param {object} resp The iax extension information object
 * @private
 */
function updateExtIaxDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating iax extension details: ' + err.toString());
      return;
    }

    // set extension information
    extIaxDetails(resp);

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for iax extension ' + resp.exten);
    astProxy.emit(EVT_EXTEN_CHANGED, extensions[resp.exten]);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the details for the iax extension object.
 *
 * @method extIaxDetails
 * @param {object} resp The extension information object
 * @private
 */
function extIaxDetails(resp) {
  try {
    // check parameter
    if (typeof resp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // set the extension information
    extensions[resp.exten].setIp(resp.ip);
    extensions[resp.exten].setPort(resp.port);
    extensions[resp.exten].setIp(resp.ip);
    logger.info(IDLOG, 'set iax details for ext ' + resp.exten);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Update extension information and emit _EVT\_EXTEN\_CHANGED_ event.
 *
 * @method updateExtPjsipDetails
 * @param {object} err The error object
 * @param {object} resp The extension information object
 * @private
 */
function updateExtPjsipDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating pjsip extension details: ' + err.toString());
      return;
    }

    // set extension information
    extPjsipDetails(null, resp);

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for pjsip extension ' + resp.exten);
    astProxy.emit(EVT_EXTEN_CHANGED, extensions[resp.exten]);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Update extension information and emit _EVT\_EXTEN\_CHANGED_ event.
 *
 * @method updateExtSipDetails
 * @param {object} err  The error object
 * @param {object} resp The extension information object
 * @private
 */
function updateExtSipDetails(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating sip extension details: ' + err.toString());
      return;
    }

    // set extension information
    extSipDetails(null, resp);

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for sip extension ' + resp.exten.exten);
    astProxy.emit(EVT_EXTEN_CHANGED, extensions[resp.exten.exten]);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates the conversations for all extensions.
 *
 * @method updateConversationsForAllExten
 * @param {object} err The error object
 * @param {object} resp The channel list as received by the _listChannels_ command plugin.
 * @private
 */
function updateConversationsForAllExten(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating conversation for all extensions: ' + err.toString());
      return;
    }
    if (!resp) {
      throw new Error('wrong parameter: ' + JSON.stringify(resp));
    }
    // removes all conversations of all extensions
    var ext;
    for (ext in extensions) {
      extensions[ext].removeAllConversations();
    }
    // cycle in all received channels
    var chid;
    for (chid in resp) {
      ext = resp[chid].channelExten;
      // add new conversation to the extension. Queue channel is not considered,
      // otherwise an extension has also wrong conversation (e.g. 214 has the
      // conversation SIP/221-00000592>Local/221@from-queue-000009dc;2)
      if (chid.indexOf('Local') === -1 && chid.indexOf('@from') === -1 &&
        (extensions[ext] || tempExtensions[ext])) { // the extension exists

        addConversationToExten(ext, resp, chid);
        // emit the event
        if (!reloading) {
          logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + ext);
          astProxy.emit(EVT_EXTEN_CHANGED, extensions[ext]);
        }
      }
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Updates the conversations for all trunks.
 *
 * @method updateConversationsForAllTrunk
 * @param {object} err  The error object
 * @param {object} resp The channel list as received by the _listChannels_ command plugin.
 * @private
 */
function updateConversationsForAllTrunk(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating conversations of all trunk: ' + err.toString());
      return;
    }
    // check parameter
    if (!resp) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // removes all conversations of all trunks
    var trunk;
    for (trunk in trunks) {
      trunks[trunk].removeAllConversations();
    }

    // cycle in all received channels
    var chid;
    for (chid in resp) {

      trunk = resp[chid].channelExten;

      // add new conversation to the trunk. Queue channel is not considered,
      // otherwise a trunk has also wrong conversation (e.g. 3001 has the
      // conversation SIP/3001-00000592>Local/221@from-queue-000009dc;1)
      if (chid.indexOf('Local') === -1 &&
        chid.indexOf('@from') === -1 &&
        isTrunk(trunk)) { // the trunk exists

        addConversationToTrunk(trunk, resp, chid);
      }
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Update the conversations of the extension.
 *
 * @method updateExtenConversations
 * @param {object} err   The error object received by the _listChannels_ command plugin
 * @param {object} resp  The object received by the _listChannels_ command plugin
 * @param {string} exten The extension number
 * @private
 */
function updateExtenConversations(err, resp, exten, spyConnected) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating conversations of extension ' + exten + ': ' + err.toString());
      return;
    }

    // check parameters
    if (typeof exten !== 'string' || !resp) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check if the extension exists, otherwise there is some error
    if (extensions[exten]) {

      // reset all conversations of the extension
      extensions[exten].removeAllConversations();
      logger.info(IDLOG, 'reset all conversations of the extension ' + exten);

      // cycle in all received channels
      var ext, chid;
      for (chid in resp) {

        // current extension of the channel
        ext = resp[chid].channelExten;

        // add new conversation to the extension. Queue channel is not considered,
        // otherwise an extension has also wrong conversation (e.g. 214 has the
        // conversation SIP/221-00000592>Local/221@from-queue-000009dc;2)
        if (chid.indexOf('Local') === -1 &&
          chid.indexOf('@from') === -1 &&
          ext === exten) { // the current extension is of interest

          addConversationToExten(ext, resp, chid, spyConnected);
        }
      }
      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Check if the exten is a trunk.
 *
 * @method isTrunk
 * @param {string} trunk The trunk name
 * @return {boolean} True if the exten is a trunk.
 */
function isTrunk(trunk) {
  try {
    var t;
    for (t in trunks) {
      if (t === trunk || trunks[t].getUserContext() === trunk) {
        return true;
      }
    }
    return false;

  } catch (error) {
    logger.error(IDLOG, error.stack);
    return false;
  }
}

/**
 * Return the trunk name. This is used because in same cases
 * trunk name obtained from channels correspond to the "usercontext"
 * of the trunk itself, as in the case of incoming calls on IAX2 trunks.
 *
 * @method getTrunkName
 * @param {string} trunk The trunk name
 * @return {string} The name of the trunk.
 */
function getTrunkName(trunk) {
  try {
    var t;
    for (t in trunks) {
      if (t === trunk || trunks[t].getUserContext() === trunk) {
        return t;
      }
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Update the conversations of the extension.
 *
 * @method updateTrunkConversations
 * @param {object} err   The error object received by the _listChannels_ command plugin
 * @param {object} resp  The object received by the _listChannels_ command plugin
 * @param {string} trunk The trunk number
 * @private
 */
function updateTrunkConversations(err, resp, trunk) {
  try {
    if (err) {
      logger.error(IDLOG, 'updating conversations of trunk ' + trunk + ': ' + err.toString());
      return;
    }

    // check parameters
    if (typeof trunk !== 'string' || !resp) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check if the extension exists, otherwise there is some error
    if (isTrunk(trunk)) {

      var realTrunkName = getTrunkName(trunk);

      // reset all conversations of the trunk
      trunks[realTrunkName].removeAllConversations();
      logger.info(IDLOG, 'reset all conversations of the trunk ' + realTrunkName);

      // cycle in all received channels
      var trunkid, chid;
      for (chid in resp) {

        // current trunk of the channel
        trunkid = resp[chid].channelExten;

        // add new conversation to the trunk. Queue channel is not considered,
        // otherwise a trunk has also wrong conversation (e.g. 3001 has the
        // conversation SIP/3001-00000592>Local/221@from-queue-000009dc;2)
        if (chid.indexOf('Local') === -1 &&
          chid.indexOf('@from') === -1 &&
          trunkid === trunk) { // the current trunk is of interest

          addConversationToTrunk(trunkid, resp, chid);
        }
      }

      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_TRUNK_CHANGED + ' for trunk ' + realTrunkName);
      astProxy.emit(EVT_TRUNK_CHANGED, trunks[realTrunkName]);

    } else {
      logger.warn(IDLOG, 'try to update channel list of the non existent trunk ' + trunk);
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Add new conversation to the extension.
 *
 * @method addConversationToExten
 * @param {string} exten The extension number
 * @param {object} resp The channel list object received by the _listChannels_ command plugin
 * @param {string} chid The channel identifier
 * @private
 */
function addConversationToExten(exten, resp, chid, spyConnected) {
  try {
    // check parameters
    if (typeof exten !== 'string' || typeof resp !== 'object' || typeof chid !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var ch, ch2, chDest, chSource, chBridged;
    // add "bridgedChannel" information to the response
    for (ch in resp) {
      if (resp[ch].bridgedChannel !== '' && resp[ch].bridgedChannel !== undefined) {
        continue;
      }
      resp[ch].bridgedChannel = '';
      for (ch2 in resp) {
        if (resp[ch2].bridgedChannel !== '' && resp[ch2].bridgedChannel !== undefined) {
          continue;
        }
        if (
          (
            resp[ch2].bridgeid === resp[ch].bridgeid &&
            resp[ch2].channel !== resp[ch].channel &&
            resp[ch].bridgeid !== null
          ) ||
          (
            resp[ch].bridgeid === null && resp[ch2].bridgeid === null &&
            (resp[ch].status === 'ring' || resp[ch].status === 'ringing' || resp[ch].status === 'down') &&
            resp[ch2].channel !== resp[ch].channel &&
            (resp[ch2].status === 'ring' || resp[ch2].status === 'ringing') &&
            resp[ch].linkedid === resp[ch2].linkedid
          )) {

          resp[ch].bridgedChannel = resp[ch2].channel;
          resp[ch2].bridgedChannel = resp[ch].channel;
          resp[ch].uniqueid_linked = resp[ch2].uniqueid;
          resp[ch2].uniqueid_linked = resp[ch].uniqueid;
          continue;
        }
      }
    }
    if ((extensions[exten] || tempExtensions[exten]) && resp[chid].bridgedChannel !== undefined) {
      // creates the source and destination channels
      ch = new Channel(resp[chid]);
      if (ch.isSource()) {
        chSource = ch;
        chBridged = resp[chid].bridgedChannel;
        if (resp[chBridged]) { // the call is connected
          chDest = new Channel(resp[chBridged]);
        }
      } else {
        chDest = ch;
        chBridged = resp[chid].bridgedChannel;
        if (resp[chBridged]) { // the call is connected
          chSource = new Channel(resp[chBridged]);
        }
      }
      var queue;
      if ((resp[chid].bridgedChannel.slice(-2) === ';2' || resp[chid].bridgedChannel.slice(-2) === ';1') &&
        resp[chid].bridgedChannel.indexOf('Local/') !== -1 &&
        resp[chid].bridgedChannel.indexOf('@from-queue') !== -1) {

        var tempChid = resp[chid].bridgedChannel.substring(0, resp[chid].bridgedChannel.length - 2) + ';1';
        queue = resp[tempChid] ? resp[tempChid].queue : undefined;
      }

      // create a new conversation
      let conv = new Conversation(exten, chSource, chDest, queue, resp[chid].linkedid, resp[chid].uniqueid, spyConnected);
      let convid = conv.getId();
      conv.setThroughTrunk(isConvThroughTrunk(conv));

      // if the conversation is recording, sets its recording status
      if (recordingConv[convid] !== undefined) {
        logger.info(IDLOG, 'set recording status to conversation ' + convid);

        if (recordingConv[convid] === RECORDING_STATUS.TRUE) {
          conv.setRecording(true);
        } else if (recordingConv[convid] === RECORDING_STATUS.MUTE) {
          conv.setRecordingMute();
        }
      }
      // add the created conversation to the extension
      extensions[exten].addConversation(conv);
      if (reloading) {
        tempExtensions[exten].addConversation(conv);
      }
      logger.info(IDLOG, 'the conversation ' + convid + ' has been added to exten ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the conversation involves a trunk.
 *
 * @method isConvThroughTrunk
 * @param {Conversation} conv The conversation
 * @return {boolean} True if the conversation involves a trunk, so the call is external.
 * @private
 */
function isConvThroughTrunk(conv) {
  try {
    let chSource = conv.getSourceChannel();
    if (chSource) {
      let chSourceStr = chSource.getChannel(); // e.g. chSource = 'SIP/TWT-00000002'
      let nameSource = chSourceStr.split('-')[0];
      if (nameSource) {
        nameSource = nameSource.split('/')[1];
      }
      if (trunks[nameSource]) {
        return true;
      }
    }
    let chDest = conv.getDestinationChannel();
    if (chDest) {
      let chDestStr = chDest.getChannel();
      let nameDest = chDestStr.split('-')[0];
      if (nameDest) {
        nameDest = nameDest.split('/')[1];
      }
      if (trunks[nameDest]) {
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Check if the extension is a main extension.
 *
 * @method isMainExtension
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension is a main extension.
 * @private
 */
function isMainExtension(exten) {
  try {
    // check parameters
    if (typeof exten !== 'string') {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }
    if (staticDataExtens.mainExtens[exten]) {
      return true;
    }
    return false;

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Add new conversation to the trunk.
 *
 * @method addConversationToTrunk
 * @param {string} trunk The trunk number. It can be also the "usercontext" of the trunk
 * @param {object} resp  The channel list object received by the _listChannels_ command plugin
 * @param {string} chid  The channel identifier
 * @private
 */
function addConversationToTrunk(trunk, resp, chid) {
  try {
    // check parameters
    if (typeof trunk !== 'string' ||
      typeof resp !== 'object' ||
      typeof chid !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // add "bridgedChannel" information to the response
    var ch, ch2;
    for (ch in resp) {
      for (ch2 in resp) {
        if (resp[ch2].bridgeid === resp[ch].bridgeid &&
          resp[ch2].channel !== resp[ch].channel) {

          resp[ch].bridgedChannel = resp[ch2].channel;
          resp[ch2].bridgedChannel = resp[ch].channel;
          resp[ch].uniqueid_linked = resp[ch2].uniqueid;
          resp[ch2].uniqueid_linked = resp[ch].uniqueid;
        }
        if (resp[ch2].linkedid === resp[ch].uniqueid &&
          resp[ch2].channel !== resp[ch].channel &&
          isTrunk(resp[ch].channelExten)) {

          resp[ch].bridgedNum = resp[ch2].callerNum;
          resp[ch].bridgedName = resp[ch2].callerName;
        }
        if (isTrunk(resp[ch].channelExten)) {
          resp[ch].bridgedNum = resp[ch].bridgedNum === '<unknown>' ? '...' : resp[ch].bridgedNum;
          resp[ch].bridgedName = resp[ch].bridgedName === '<unknown>' ? '...' : resp[ch].bridgedName;
        }
      }
    }

    if (isTrunk(trunk)) {

      var chDest, chSource, chBridged;

      // creates the source and destination channels
      var ch = new TrunkChannel(resp[chid]);

      if (ch.isSource()) {

        chSource = ch;
        chBridged = resp[chid].bridgedChannel;
        if (resp[chBridged]) { // the call is connected
          chDest = new TrunkChannel(resp[chBridged]);
        }

      } else {

        chDest = ch;
        chBridged = resp[chid].bridgedChannel;
        if (resp[chBridged]) { // the call is connected
          chSource = new TrunkChannel(resp[chBridged]);
        }
      }

      // create a new conversation
      var realTrunkName = getTrunkName(trunk);
      var conv = new TrunkConversation(trunk, chSource, chDest);
      var convid = conv.getId();

      // check if the name of the internal extension involved in the conversation is empty.
      // In that case get the name and set it
      if (conv.getInternalName() === "") {

        var internalNum = conv.getInternalNum();

        if (extensions[internalNum]) {
          var name = extensions[internalNum].getName();
          conv.setInternalName(name);
        }
      }

      // if the conversation is recording, sets its recording status
      if (recordingConv[convid] !== undefined) {
        logger.info(IDLOG, 'set recording status to conversation ' + convid);

        if (recordingConv[convid] === RECORDING_STATUS.TRUE) {
          conv.setRecording(true);
        } else if (recordingConv[convid] === RECORDING_STATUS.MUTE) {
          conv.setRecordingMute();
        }
      }

      // add the created conversation to the trunk
      trunks[realTrunkName].addConversation(conv);
      logger.info(IDLOG, 'the conversation ' + convid + ' has been added to trunk ' + realTrunkName);

      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_TRUNK_CHANGED + ' for trunk ' + realTrunkName);
      astProxy.emit(EVT_TRUNK_CHANGED, trunks[realTrunkName]);

    } else {
      logger.warn(IDLOG, 'try to add new conversation to a non existent trunk ' + trunk);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Sets the extension status received.
 *
 * @method extenStatus
 * @param {object} err  The received error object
 * @param {object} resp The received response object
 * @private
 */
function extenStatus(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting extension status: ' + err.toString());
      return;
    }

    extensions[resp.exten].setStatus(resp.status);
    if (isReloading() && tempExtensions[resp.exten]) {
      tempExtensions[resp.exten].setStatus(resp.status);
    }
    logger.info(IDLOG, 'sets status ' + resp.status + ' for extension ' + resp.exten);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the sip trunk status received.
 *
 * @method sipTrunkStatus
 * @param {object} err  The received error object
 * @param {object} resp The received response object
 * @private
 */
function sipTrunkStatus(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting trunk status: ' + err.toString());
      return;
    }

    if (resp.trunk && trunks[resp.trunk] && resp.status) {
      trunks[resp.trunk].setStatus(resp.status);
      logger.info(IDLOG, 'sets status ' + resp.status + ' for trunk ' + resp.trunk);
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the trunk registration.
 *
 * @method trunkRegistration
 * @param {object} err  The received error object
 * @param {object} resp The received response object
 * @private
 */
 function trunkRegistration(err, resp) {
  try {
    if (err) {
      logger.error(IDLOG, 'setting trunk registration: ' + err.toString());
      return;
    }

    if (resp.trunk && resp.registration && trunks[resp.trunk] ) {
      trunks[resp.trunk].setRegistration(resp.registration);
      logger.info(IDLOG, 'sets registration ' + resp.registration + ' for trunk ' + resp.trunk);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Subscribe a callback function to a custom event fired by this object.
 * It's the same of nodejs _events.EventEmitter.on._
 *
 * @method on
 * @param {string} type The name of the event
 * @param {function} cb The callback to execute in response to the event
 * @return {object} A subscription handle capable of detaching that subscription.
 */
function on(type, cb) {
  try {
    return emitter.on(type, cb);
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return the extension list.
 *
 * @method getExtensions
 * @return {object} The _extensions_ object.
 */
function getExtensions() {
  try {
    return extensions;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return true is the extension status is online.
 *
 * @method isExtenOnline
 * @param {string} exten The extension id
 * @return {boolean} True is the extension status is online.
 */
function isExtenOnline(exten) {
  try {
    if (extensions[exten]) {
      return extensions[exten].isOnline();
    }
    return false;
  } catch (err) {
    logger.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Return true if the extension has a conversation.
 *
 * @method extenHasConv
 * @param {string} exten The extension id
 * @return {boolean} True if the extension has a conversation.
 */
function extenHasConv(exten) {
  try {
    if (extensions[exten]) {
      return extensions[exten].conversationCount() > 0 ? true : false;
    }
    return false;
  } catch (err) {
    logger.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Return the extension status.
 *
 * @method getExtenStatus
 * @param {string} exten The extension id
 * @return {string} The extension status.
 */
function getExtenStatus(exten) {
  try {
    if (extensions[exten]) {
      return extensions[exten].getStatus();
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns a conference of the extension.
 *
 * @method getConference
 * @return {object} The _MeetmeConference_ object.
 */
function getConference(extenId) {
  try {
    return conferences[extenId] || {};
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the extension identifier for the user of the conference.
 *
 * @method getUserExtenIdFromConf
 * @param {string} confId The conference identifier
 * @param {string} userId The user identifier
 * @return {string} The extension identifier.
 */
function getUserExtenIdFromConf(confId, userId) {
  try {
    if (typeof confId !== 'string' || typeof userId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (conferences[confId]) {
      var extenId = conferences[confId].getExtenId(userId);
      if (extenId) {
        return extenId;
      }
      logger.warn(IDLOG, 'getting extenId of userId "' + userId + '" of confId "' + confId + '": extenId "' + extenId + '" does not exist');
    } else {
      logger.warn(IDLOG, 'getting extenId of userId "' + userId + '" of confId "' + confId + '": conf does not exist');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension status and any other information except
 * the channel list. To update the channel list it request all channels
 * to analize through "listChannels" command plugin.
 *
 * @method evtExtenStatusChanged
 * @param {string} exten The extension number
 * @param {string} statusCode The numeric status code as arrived from asterisk
 * @private
 */
function evtExtenStatusChanged(exten, status) {
  try {
    if (typeof exten !== 'string' || typeof status !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      // skip if there are no changes
      if (extensions[exten].getStatus() === status) {
        return;
      }
      // update extension information. This is because when the extension becomes
      // offline/online ip, port and other information needs to be updated
      if (extensions[exten].getChanType() === 'pjsip') {

        astProxy.doCmd({
          command: 'pjsipDetails',
          exten: exten
        }, updateExtPjsipDetails);

      } else if (extensions[exten].getChanType() === 'iax') {

        // request sip details for current extension
        extensions[exten].setStatus(status);
        logger.info(IDLOG, 'set status ' + status + ' for extension ' + exten);

        astProxy.doCmd({
          command: 'iaxDetails',
          exten: exten
        }, updateExtIaxDetails);
      }
      updateConversationsOfNum(exten);

    } else if (parkings[exten]) {

      var parking = exten; // to better understand the code

      // request all parked channels
      logger.info(IDLOG, 'requests all parked channels to update the parking ' + parking);
      astProxy.doCmd({
        command: 'listParkedCalls'
      }, function (err, resp) {
        // update the parked channel of one parking in "parkedChannels"
        updateParkedChannelOfOneParking(err, resp, parking);
      });
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the peer registration.
 * To update the trunks list it request all trunks
 * to analize through "Registry" command plugin.
 *
 * @method evtRegistryChanged
 * @param {object} peer The peer data
 * @param {string} peerStatus The adapted status
 * @private
 */
 function evtRegistryChanged(peer, peerStatus) {
  try {
    if (typeof peer !== 'object' || typeof peerStatus !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    for (let trunk in staticDataTrunks) {
      if (trunks[trunk] &&
        peer.domain.includes(staticDataTrunks[trunk].host) &&
        peer.username.includes(staticDataTrunks[trunk].username)) {
        // update trunk registration
        trunks[trunk].setRegistration(peerStatus);
      }
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension status and any other information except
 * the channel list. To update the channel list it request all channels
 * to analize through "listChannels" command plugin.
 *
 * @method evtDeviceStatusChanged
 * @param {string} exten The extension number
 * @private
 */
function evtDeviceStatusChanged(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      if (extensions[exten].getChanType() === 'pjsip') {
        astProxy.doCmd({
          command: 'pjsipDetails',
          exten: exten
        }, updateExtPjsipDetails);
      } else if (extensions[exten].getChanType() === 'iax') {
        extensions[exten].setStatus(status);
        logger.info(IDLOG, 'set status ' + status + ' for extension ' + exten);
        astProxy.doCmd({
          command: 'iaxDetails',
          exten: exten
        }, updateExtIaxDetails);
      }
      updateConversationsOfNum(exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the queue member paused status and it start time.
 *
 * @method evtQueueMemberPausedChanged
 * @param {string}  queueId  The queue identifier
 * @param {string}  memberId The queue member identifier
 * @param {boolean} paused   True if the extension has been paused from the queue
 * @param {string}  reason   True reason description of the pause
 * @private
 */
function evtQueueMemberPausedChanged(queueId, memberId, paused, reason) {
  try {
    if (typeof queueId !== 'string' || typeof reason !== 'string' ||
      typeof memberId !== 'string' || typeof paused !== 'boolean') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (!queues[queueId]) {
      logger.warn(IDLOG, 'received event queue member paused changed for not existent queue "' + queueId + '"');
      return;
    }
    // get the queue member object and set its "paused" status
    var member = queues[queueId].getMember(memberId);
    if (member) {
      if ((paused === true &&
        paused === member.isInPause() &&
        reason === member.getPauseReason()) ||
        (paused === false && paused === member.isInPause())) {
        return;
      }
      member.setPaused(paused, reason);
      logger.info(IDLOG, 'paused status of queue member "' + memberId + '" of queue "' + queueId + '" has been changed to "' + paused + '"');
      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_QUEUE_MEMBER_CHANGED + ' for queue member ' + memberId + ' of queue ' + queueId);
      astProxy.emit(EVT_QUEUE_MEMBER_CHANGED, member);
    } else {
      logger.warn(IDLOG, 'received event queue member paused changed for non existent member "' + memberId + '"');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * An event about queue member status has been received from the asterisk.
 * It updates the data about the queue member.
 *
 * @method evtQueueMemberStatus
 * @param {object} data
 *   @param {string} data.type The membership type (static or dynamic)
 *   @param {string} data.name The name of the member
 *   @param {string} data.queueId The queue identifier
 *   @param {string} data.member The queue member identifier
 *   @param {boolean} data.paused True if the extension has been paused from the queue
 *   @param {number} data.lastCallTimestamp The timestamp of the last call received by the member
 *   @param {number} data.callsTakenCount The number of the taken calls
 * @private
 */
function evtQueueMemberStatus(data) {
  try {
    if (typeof data !== 'object' || typeof data.type !== 'string' ||
      typeof data.queueId !== 'string' || typeof data.lastCallTimestamp !== 'number' ||
      typeof data.member !== 'string' || typeof data.callsTakenCount !== 'number' ||
      typeof data.paused !== 'boolean' || typeof data.name !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (!queues[data.queueId] || !queues[data.queueId].getMember(data.member)) {
      return;
    }
    // skip if there are no changes
    var oldAgent = (queues[data.queueId].getMember(data.member)).toJSON();
    if (oldAgent.paused === data.paused &&
      oldAgent.callsTakenCount === data.callsTakenCount &&
      oldAgent.lastCallTimestamp === data.lastCallTimestamp) {

      return;
    }
    if (!queues[data.queueId]) {
      logger.warn(IDLOG, 'received event queue member status (' + data.member + ') for not existent queue "' + data.queueId + '"');
      return;
    }
    // the update of the data is done by two steps:
    // 1. removing the current member
    // 2. creating a new one
    // The alternative could be to update the data of the already present member, or to create a new one
    // if it is not present. But this is more error prone, especially for the future development if some
    // data is added: the developer should modify more code
    queues[data.queueId].removeMember(data.member);
    // add the new member to the queue
    addQueueMemberLoggedIn(data, data.queueId);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * An event about queue member added has been received from the asterisk.
 *
 * @method evtQueueMemberAdded
 * @param {object} data
 *   @param {string}  data.type              The membership type (static or dynamic)
 *   @param {string}  data.name              The name of the member
 *   @param {string}  data.queueId           The queue identifier
 *   @param {string}  data.member            The queue member identifier
 *   @param {boolean} data.paused            True if the extension has been paused from the queue
 *   @param {number}  data.lastCallTimestamp The timestamp of the last call received by the member
 *   @param {number}  data.callsTakenCount   The number of the taken calls
 * @private
 */
function evtQueueMemberAdded(data) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof data.type !== 'string' ||
      typeof data.queueId !== 'string' || typeof data.lastCallTimestamp !== 'number' ||
      typeof data.member !== 'string' || typeof data.callsTakenCount !== 'number' ||
      typeof data.paused !== 'boolean' || typeof data.name !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (!queues[data.queueId]) {
      logger.warn(IDLOG, 'received event queue member added for not existent queue "' + data.queueId + '"');
      return;
    }

    // add the new member to the queue
    addQueueMemberLoggedIn(data, data.queueId);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * An event about channel renaming has been received from the asterisk. It updates
 * the waiting callers of all queues.
 *
 * @method evtRename
 * @private
 */
function evtRename() {
  try {
    // request details for the current queue to update the waiting callers. This is done
    // because during a transfer ("Rename" event) the names changing
    var q;
    for (q in queues) {
      astProxy.doCmd({
        command: 'queueDetails',
        queue: q
      }, updateQueueWaitingCallers);
    }

    // request all channels to update the conversations of all extensions
    logger.info(IDLOG, 'requests the channel list to update the conversations of all extensions');
    astProxy.doCmd({
      command: 'listChannels'
    }, updateConversationsForAllExten);
    getListChannelsForTrunks();
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * An event about queue member removed has been received from the asterisk.
 * So updates the queue member status.
 *
 * @method evtQueueMemberRemoved
 * @param {object} data
 *   @param {string} data.queueId The queue identifier
 *   @param {string} data.member  The queue member identifier
 * @private
 */
function evtQueueMemberRemoved(data) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.queueId !== 'string' || typeof data.member !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (!queues[data.queueId]) {
      logger.warn(IDLOG, 'received event queue member removed for not existent queue "' + data.queueId + '"');
      return;
    }

    // update the logged in status of the member
    var member = queues[data.queueId].getMember(data.member);

    if (!member) {
      logger.warn(IDLOG, 'try to set logged in status to "false" of not existent member "' + data.member + '" of queue "' + data.queueId + '"');
      return;
    }

    member.setLoggedIn(false);
    logger.info(IDLOG, 'set the member "' + data.member + '" of queue "' + data.queueId + '" to logged off');

    member.setPaused(false);
    logger.info(IDLOG, 'set the member "' + data.member + '" of queue "' + data.queueId + '" to paused false');

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_QUEUE_MEMBER_CHANGED + ' for queue member ' + data.member + ' of queue ' + data.queueId);
    astProxy.emit(EVT_QUEUE_MEMBER_CHANGED, member);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * A new external call is received. So it retrieves the data about the caller.
 * It gets the created caller notes for the specified number and the central and
 * cti phonebook contacts. Then add the data into the _callerIdentityData_ property
 * to use it when _Dialing_ events are received. This method is called by the
 * _plugins\_event\_13/userevent.js_.
 *
 * @method evtNewExternalCall
 * @param {string} number The caller number
 */
function evtNewExternalCall(number) {
  try {
    // check parameter
    if (typeof number !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.info(IDLOG, 'new external call from number ' + number + ': get data about the caller');

    // initialize the caller data object. Due to asy
    if (callerIdentityData[number] === undefined) {
      callerIdentityData[number] = {};
    }

    // get the caller notes data
    compCallerNote.getAllValidCallerNotesByNum(number, function (err, results) {
      try {
        if (err) {
          logger.warn(IDLOG, 'retrieving caller notes data for new external call from number ' + number);

        } else {
          logger.info(IDLOG, 'add caller notes data for new external call from number ' + number);
          callerIdentityData[number].callerNotes = results;
        }
      } catch (e) {
        logger.error(IDLOG, e.stack);
      }
    });

    // get the phonebook contacts
    compPhonebook.getPbContactsByNum(number, function (err, results) {
      try {
        if (err) {
          logger.warn(IDLOG, 'retrieving phonebook contacts data for new external call from number ' + number);

        } else {
          logger.info(IDLOG, 'add phonebook contacts data for new external call from number ' + number);
          callerIdentityData[number].pbContacts = results;
        }
      } catch (e) {
        logger.error(IDLOG, e.stack);
      }
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension dnd status.
 *
 * @method evtExtenDndChanged
 * @param {string}  exten   The extension number
 * @param {boolean} enabled True if the dnd is enabled
 * @private
 */
function evtExtenDndChanged(exten, enabled) {
  try {
    if (typeof exten !== 'string' && typeof enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      if (extensions[exten].getDnd() === enabled) {
        return;
      }
      extensions[exten].setDnd(enabled);
      if (isReloading() && tempExtensions[exten]) {
        tempExtensions[exten].setDnd(enabled);
      }
      logger.info(IDLOG, 'set dnd status to ' + enabled + ' for extension ' + exten);
      // emit the events
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_DND_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_DND_CHANGED, {
        exten: exten,
        enabled: enabled
      });
    } else {
      logger.warn(IDLOG, 'try to set dnd status of non existent extension ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension unconditional call forward status.
 *
 * @method evtExtenUnconditionalCfChanged
 * @param {string} exten The extension number
 * @param {boolean} enabled True if the call forward is enabled
 * @param {string} [to] The destination number of the call forward
 * @private
 */
function evtExtenUnconditionalCfChanged(exten, enabled, to) {
  try {
    if (typeof exten !== 'string' && typeof enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      if (enabled === (extensions[exten].getCf() !== '') && extensions[exten].getCf() === to) {
        return;
      }
      if (enabled) {
        logger.info(IDLOG, 'set cf status to ' + enabled + ' for extension ' + exten + ' to ' + to);
        extensions[exten].setCf(to);
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].setCf(to);
        }
        // disable the call forward to voicemail because the call forward set the same property in the database
        evtExtenUnconditionalCfVmChanged(exten, false);
      } else {
        logger.info(IDLOG, 'set cf status to ' + enabled + ' for extension ' + exten);
        extensions[exten].disableCf();
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].disableCf();
        }
      }
      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CF_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CF_CHANGED, {
        exten: exten,
        enabled: enabled,
        to: to
      });
    } else {
      logger.warn(IDLOG, 'try to set call forward status of non existent extension ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension call forward busy status.
 *
 * @method evtExtenCfbChanged
 * @param {string} exten The extension number
 * @param {boolean} enabled True if the call forward busy is enabled
 * @param {string} [to] The destination number of the call forward busy
 * @private
 */
function evtExtenCfbChanged(exten, enabled, to) {
  try {
    if (typeof exten !== 'string' && typeof enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) { // the exten is an extension

      if (enabled) {
        logger.info(IDLOG, 'set cfb status to ' + enabled + ' for extension ' + exten + ' to ' + to);
        extensions[exten].setCfb(to);
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].setCfb(to);
        }

        // disable the call forward to voicemail because the call forward set the same property in the database
        evtExtenCfbVmChanged(exten, false);

      } else {
        logger.info(IDLOG, 'set cfb status to ' + enabled + ' for extension ' + exten);
        extensions[exten].disableCfb();
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].disableCfb();
        }
      }

      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CFB_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CFB_CHANGED, {
        exten: exten,
        enabled: enabled,
        to: to
      });
    } else {
      logger.warn(IDLOG, 'try to set call forward busy status of non existent extension ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension call forward on unavailable status.
 *
 * @method evtExtenCfuChanged
 * @param {string} exten The extension number
 * @param {boolean} enabled True if the call forward on unavailable is enabled
 * @param {string} [to] The destination number of the call forward on unavailable
 * @private
 */
function evtExtenCfuChanged(exten, enabled, to) {
  try {
    if (typeof exten !== 'string' && typeof enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) { // the exten is an extension

      if (enabled) {
        logger.info(IDLOG, 'set cfu status to ' + enabled + ' for extension ' + exten + ' to ' + to);
        extensions[exten].setCfu(to);
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].setCfu(to);
        }

        // disable the call forward to voicemail because the call forward set the same property in the database
        evtExtenCfuVmChanged(exten, false);

      } else {
        logger.info(IDLOG, 'set cfu status to ' + enabled + ' for extension ' + exten);
        extensions[exten].disableCfu();
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].disableCfu();
        }
      }

      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CFU_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CFU_CHANGED, {
        exten: exten,
        enabled: enabled,
        to: to
      });
    } else {
      logger.warn(IDLOG, 'try to set call forward on unavailable status of non existent extension ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension unconditional call forward to voicemail status.
 *
 * @method evtExtenUnconditionalCfVmChanged
 * @param {string} exten The extension number
 * @param {boolean} enabled True if the call forward to voicemail is enabled
 * @param {string} [vm] The destination voicemail number of the call forward
 * @private
 */
function evtExtenUnconditionalCfVmChanged(exten, enabled, vm) {
  try {
    if (typeof exten !== 'string' && typeof enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      if (enabled === (extensions[exten].getCfVm() !== '') && extensions[exten].getCfVm() === vm) {
        return;
      }
      if (enabled) {
        logger.info(IDLOG, 'set cfvm status to ' + enabled + ' for extension ' + exten + ' to voicemail ' + vm);
        extensions[exten].setCfVm(vm);
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].setCfVm(vm);
        }
        // disable the call forward because the call forward to voicemail set the same property in the database
        evtExtenUnconditionalCfChanged(exten, false);
      } else {
        logger.info(IDLOG, 'set cfvm status to ' + enabled + ' for extension ' + exten);
        extensions[exten].disableCfVm();
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].disableCfVm();
        }
      }
      // emit the events
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CFVM_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CFVM_CHANGED, {
        exten: exten,
        enabled: enabled,
        vm: vm
      });
    } else {
      logger.warn(IDLOG, 'try to set call forward to voicemail status of non existent extension ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension call forward busy to voicemail status.
 *
 * @method evtExtenCfbVmChanged
 * @param {string} exten The extension number
 * @param {boolean} enabled True if the call forward busy to voicemail is enabled
 * @param {string} [vm] The destination voicemail number of the call forward busy
 * @private
 */
function evtExtenCfbVmChanged(exten, enabled, vm) {
  try {
    // check parameters
    if (typeof exten !== 'string' && typeof enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) {

      if (enabled) {
        logger.info(IDLOG, 'set cfbvm status to ' + enabled + ' for extension ' + exten + ' to voicemail ' + vm);
        extensions[exten].setCfbVm(vm);
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].setCfbVm(vm);
        }

        // disable the call forward busy because the call forward to voicemail set the same property in the database
        evtExtenCfbChanged(exten, false);

      } else {
        logger.info(IDLOG, 'set cfbvm status to ' + enabled + ' for extension ' + exten);
        extensions[exten].disableCfbVm();
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].disableCfbVm();
        }
      }

      // emit the events
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CFVM_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CFBVM_CHANGED, {
        exten: exten,
        enabled: enabled,
        vm: vm
      });

    } else {
      logger.warn(IDLOG, 'try to set call forward busy to voicemail status of non existent extension ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Updates the extension call forward unavailable to voicemail status.
 *
 * @method evtExtenCfuVmChanged
 * @param {string} exten The extension number
 * @param {boolean} enabled True if the call forward unavailable to voicemail is enabled
 * @param {string} [vm] The destination voicemail number of the call forward unavailable
 * @private
 */
function evtExtenCfuVmChanged(exten, enabled, vm) {
  try {
    // check parameters
    if (typeof exten !== 'string' && typeof enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) {

      if (enabled) {
        logger.info(IDLOG, 'set cfuvm status to ' + enabled + ' for extension ' + exten + ' to voicemail ' + vm);
        extensions[exten].setCfuVm(vm);
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].setCfuVm(vm);
        }

        // disable the call forward unavailable because the call forward to voicemail set the same property in the database
        evtExtenCfuChanged(exten, false);

      } else {
        logger.info(IDLOG, 'set cfuvm status to ' + enabled + ' for extension ' + exten);
        extensions[exten].disableCfuVm();
        if (isReloading() && tempExtensions[exten]) {
          tempExtensions[exten].disableCfuVm();
        }
      }

      // emit the events
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CFUVM_CHANGED + ' for extension ' + exten);
      astProxy.emit(EVT_EXTEN_CFUVM_CHANGED, {
        exten: exten,
        enabled: enabled,
        vm: vm
      });

    } else {
      logger.warn(IDLOG, 'try to set call forward unavailable to voicemail status of non existent extension ' + exten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the identifier is an extension.
 *
 * @method isExten
 * @param {string} id The number identifier
 * @return {boolean} True if the id is an extension
 */
function isExten(id) {
  try {
    // check parameters
    if (typeof id !== 'string') {
      throw new Error('wrong parameter: ' + id);
    }

    if (extensions[id]) {
      return true;
    }
    return false;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Enable/disable the do not disturb status of the endpoint.
 * The used plugin command _dndSet_ does not generate any
 * asterisk events, so simulates it.
 *
 * @method setDnd
 * @param {string} exten The extension number
 * @param {boolean} activate True if the dnd must be enabled
 * @param {function} cb The callback function
 */
function setDnd(exten, activate, cb) {
  try {
    // check parameters
    if (typeof exten !== 'string' && typeof activate !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) { // the exten is an extension

      // this command doesn't generate any asterisk event, so if it's successful, it simulate the event
      astProxy.doCmd({
        command: 'dndSet',
        exten: exten,
        activate: activate

      }, function (err) {
        cb(err);
        if (err === null) {
          evtExtenDndChanged(exten, activate);
        }
      });
    } else {
      var str = 'try to set dnd status of non existent extension "' + exten + '"';
      logger.warn(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Check if the extension has dnd enabled.
 *
 * @method isExtenDnd
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension has dnd enabled.
 */
function isExtenDnd(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return extensions[exten].getDnd();
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the extension has call forward enabled.
 *
 * @method isExtenCf
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension has call forward enabled.
 */
function isExtenCf(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return !(extensions[exten].getCf() === '');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the extension has call forward busy enabled.
 *
 * @method isExtenCfb
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension has call forward busy enabled.
 */
function isExtenCfb(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return !(extensions[exten].getCfb() === '');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the extension has call forward on unavailable enabled.
 *
 * @method isExtenCfu
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension has call forward on unavailable enabled.
 */
function isExtenCfu(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return !(extensions[exten].getCfu() === '');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the extension has call forward on busy to voicemail enabled.
 *
 * @method isExtenCfbVm
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension has call forward on busy to voicemail enabled.
 */
function isExtenCfbVm(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return !(extensions[exten].getCfbVm() === '');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the extension has call forward on unavailable to voicemail enabled.
 *
 * @method isExtenCfuVm
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension has call forward on unavailable to voicemail enabled.
 */
function isExtenCfuVm(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return !(extensions[exten].getCfuVm() === '');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the call forward value.
 *
 * @method getExtenCfValue
 * @param {string} exten The extension identifier
 * @return {srting} The call forward value.
 */
function getExtenCfValue(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return extensions[exten].getCf();
    }
    logger.warn(IDLOG, 'returning cf value of non existent extension "' + exten + '"');
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the call forward busy value.
 *
 * @method getExtenCfbValue
 * @param {string} exten The extension identifier
 * @return {srting} The call forward busy value.
 */
function getExtenCfbValue(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return extensions[exten].getCfb();
    }
    logger.warn(IDLOG, 'returning cfb value of non existent extension "' + exten + '"');
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the call forward on unavailable value.
 *
 * @method getExtenCfuValue
 * @param {string} exten The extension identifier
 * @return {srting} The call forward on unavailable value.
 */
function getExtenCfuValue(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return extensions[exten].getCfu();
    }
    logger.warn(IDLOG, 'returning cfu value of non existent extension "' + exten + '"');
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Check if the extension has call forward to voicemail enabled.
 *
 * @method isExtenCfVm
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension has call forward to voicemail enabled.
 */
function isExtenCfVm(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[exten]) {
      return !(extensions[exten].getCfVm() === '');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Enable/disable the unconditional call forward status of the endpoint. The used plugin command _cfSet_
 * doesn't generate any asterisk events, so simulates it.
 *
 * @method setUnconditionalCf
 * @param {string}   exten    The extension number
 * @param {boolean}  activate True if the call forward must be enabled
 * @param {string}   [to]     The destination number of the call forward to be set
 * @param {function} cb       The callback function
 */
function setUnconditionalCf(exten, activate, to, cb) {
  try {
    // check parameters
    if (typeof exten !== 'string' && typeof activate !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) { // the exten is an extension

      // this command doesn't generate any asterisk event, so if it's successful, it simulate the event
      astProxy.doCmd({
        command: 'cfSet',
        exten: exten,
        activate: activate,
        val: to
      }, function (err) {

        cb(err);
        if (err === null) {
          evtExtenUnconditionalCfChanged(exten, activate, to);
        }
      });

    } else {
      var str = 'try to set unconditional call forward status of non existent extension ' + exten;
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Enable/disable the call forward busy status of the endpoint. The used plugin command _cfbSet_
 * does not generate any asterisk events, so simulates it.
 *
 * @method setCfb
 * @param {string} exten The extension number
 * @param {boolean} activate True if the call forward busy must be enabled
 * @param {string} [to] The destination number of the call forward busy to be set
 * @param {function} cb The callback function
 */
function setCfb(exten, activate, to, cb) {
  try {
    if (typeof exten !== 'string' && typeof activate !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) {

      // this command does not generate any asterisk event, so if it's successful, it simulate the event
      astProxy.doCmd({
        command: 'cfbSet',
        exten: exten,
        activate: activate,
        val: to
      }, function (err) {

        cb(err);
        if (err === null) {
          evtExtenCfbChanged(exten, activate, to);
        }
      });

    } else {
      var str = 'try to set call forward busy status of non existent extension ' + exten;
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Enable/disable the call forward busy to voicemail status of the endpoint. The used plugin command _cfbVmSet_
 * does not generate any asterisk events, so simulates it.
 *
 * @method setCfbVm
 * @param {string} exten The extension number
 * @param {boolean} activate True if the call forward busy to voicemail must be enabled
 * @param {string} [to] The destination voicemail identifier of the call forward busy to be set
 * @param {function} cb The callback function
 */
function setCfbVm(exten, activate, to, cb) {
  try {
    // check parameters
    if (typeof exten !== 'string' && typeof activate !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) {

      // this command does not generate any asterisk event, so if it's successful, it simulate the event
      astProxy.doCmd({
        command: 'cfbVmSet',
        exten: exten,
        activate: activate,
        val: to
      }, function (err, resp) {

        cb(err, resp);
        if (err === null) {
          evtExtenCfbVmChanged(exten, activate, to);
        }
      });

    } else {
      var str = 'try to set call forward busy to voicemail of non existent extension ' + exten;
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Enable/disable the call forward unavailable to voicemail status of the endpoint. The used plugin command _cfuVmSet_
 * does not generate any asterisk events, so simulates it.
 *
 * @method setCfuVm
 * @param {string} exten The extension number
 * @param {boolean} activate True if the call forward unavailable to voicemail must be enabled
 * @param {string} [to] The destination voicemail identifier of the call forward unavailable to be set
 * @param {function} cb The callback function
 */
function setCfuVm(exten, activate, to, cb) {
  try {
    // check parameters
    if (typeof exten !== 'string' && typeof activate !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) {

      // this command does not generate any asterisk event, so if it's successful, it simulate the event
      astProxy.doCmd({
        command: 'cfuVmSet',
        exten: exten,
        activate: activate,
        val: to
      }, function (err, resp) {

        cb(err, resp);
        if (err === null) {
          evtExtenCfuVmChanged(exten, activate, to);
        }
      });

    } else {
      var str = 'try to set call forward unavailable to voicemail of non existent extension ' + exten;
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Enable/disable the call forward unavailable status of the endpoint. The used plugin command _cfuSet_
 * does not generate any asterisk events, so simulates it.
 *
 * @method setCfu
 * @param {string} exten The extension number
 * @param {boolean} activate True if the call forward unavailable must be enabled
 * @param {string} [to] The destination number of the call forward unavailable to be set
 * @param {function} cb The callback function
 */
function setCfu(exten, activate, to, cb) {
  try {
    if (typeof exten !== 'string' && typeof activate !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) {

      // this command does not generate any asterisk event, so if it's successful, it simulate the event
      astProxy.doCmd({
        command: 'cfuSet',
        exten: exten,
        activate: activate,
        val: to
      }, function (err) {

        cb(err);
        if (err === null) {
          evtExtenCfuChanged(exten, activate, to);
        }
      });

    } else {
      var str = 'try to set call forward unavailable status of non existent extension ' + exten;
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Enable/disable the call forward to voicemail status of the endpoint. The used plugin command _cfVmSet_
 * doesn't generate any asterisk events, so simulates it.
 *
 * @method setUnconditionalCfVm
 * @param {string}   exten    The extension number
 * @param {boolean}  activate True if the call forward to voicemail must be enabled
 * @param {string}   [to]     The destination voicemail identifier of the call forward to be set
 * @param {function} cb       The callback function
 */
function setUnconditionalCfVm(exten, activate, to, cb) {
  try {
    // check parameters
    if (typeof exten !== 'string' && typeof activate !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[exten]) { // the exten is an extension

      // this command doesn't generate any asterisk event, so if it's successful, it simulate the event
      astProxy.doCmd({
        command: 'cfVmSet',
        exten: exten,
        activate: activate,
        val: to
      }, function (err, resp) {

        cb(err, resp);
        if (err === null) {
          evtExtenUnconditionalCfVmChanged(exten, activate, to);
        }
      });

    } else {
      var str = 'try to set call forward to voicemail of non existent extension ' + exten;
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * New voice messages has been left. So it emits the _EVT\_NEW\_VOICEMAIL_ event.
 *
 * @method evtNewVoicemailMessage
 * @param {object} data
 *  @param {string} data.context   The context of the voicemail extension
 *  @param {string} data.countNew  The number of the new voicemail messages
 *  @param {string} data.countOld  The number of the old voicemail messages
 *  @param {string} data.voicemail The voicemail identifier who received the voice message
 * @private
 */
function evtNewVoicemailMessage(data) {
  try {
    // check parameter
    if (typeof data !== 'object' &&
      typeof data.voicemail !== 'string' && typeof data.context !== 'string' &&
      typeof data.countOld !== 'string' && typeof data.countNew !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_NEW_VOICE_MESSAGE + ' in voicemail ' + data.voicemail + ' with context ' + data.context);
    astProxy.emit(EVT_NEW_VOICE_MESSAGE, data);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * New call detail records (cdr) has been logged into the call history. So it emits the _EVT\_NEW\_CDR_ event.
 *
 * @method evtNewCdr
 * @param {object} data
 *  @param {string} data.source             The calling party’s caller ID number
 *  @param {string} data.channel            The calling party’s channel
 *  @param {string} data.endtime            The end time of the call
 *  @param {string} data.duration           The number of seconds between the start and end times for the call
 *  @param {string} data.amaflags           The Automatic Message Accounting (AMA) flag associated with this call. This may be one of the following: OMIT, BILLING, DOCUMENTATION, or Unknown
 *  @param {string} data.uniqueid           The unique ID for the src channel
 *  @param {string} data.callerid           The full caller ID, including the name, of the calling party
 *  @param {string} data.starttime          The start time of the call
 *  @param {string} data.answertime         The answered time of the call
 *  @param {string} data.destination        The destination extension for the call
 *  @param {string} data.disposition        An indication of what happened to the call. This may be NO ANSWER, FAILED, BUSY, ANSWERED, or UNKNOWN
 *  @param {string} data.lastapplication    The last dialplan application that was executed
 *  @param {string} data.billableseconds    The number of seconds between the answer and end times for the call
 *  @param {string} data.destinationcontext The destination context for the call
 *  @param {string} data.destinationchannel The called party’s channel
 * @private
 */
function evtNewCdr(data) {
  try {
    if (typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.info(IDLOG, 'emit event ' + EVT_NEW_CDR + ' with uniqueid "' + data.uniqueid + '"');
    astProxy.emit(EVT_NEW_CDR, data);
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Something has appens in the voice messages of the voicemail, for example the listen
 * of a new voice message from the phone. So it emits the _EVT\_UPDATE\_VOICE\_MESSAGES_ event.
 *
 * @method evtUpdateVoicemailMessages
 * @param {object} data
 *  @param {string} data.context   The context of the voicemail extension
 *  @param {string} data.voicemail The voicemail identifier who received the voice message
 * @private
 */
function evtUpdateVoicemailMessages(data) {
  try {
    // check parameter
    if (typeof data !== 'object' &&
      typeof data.voicemail !== 'string' && typeof data.context !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_UPDATE_VOICE_MESSAGES + ' of voicemail ' + data.voicemail + ' with context ' + data.context);
    astProxy.emit(EVT_UPDATE_VOICE_MESSAGES, data);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * A queue waiting caller has left the queue. So update all queue waiting callers.
 *
 * @method evtRemoveQueueWaitingCaller
 * @param {object} data The response object received from the event plugin _leave_.
 */
function evtRemoveQueueWaitingCaller(data) {
  try {
    // check parameter
    if (typeof data !== 'object' || typeof data.queue !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.info(IDLOG, 'queue waiting caller ' + data.channel + ' has left the queue ' + data.queue);

    // request details for the current queue to update the waiting callers.
    // This is done to remove the current one and update the position of the remaining waiting callers
    astProxy.doCmd({
      command: 'queueDetails',
      queue: data.queue
    }, updateQueueWaitingCallers);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * A user extension has left the meetme conference. So update info about the conference.
 *
 * @method evtRemoveMeetmeUserConf
 * @param {object} data The response object received from the event plugin _meetmeleave_.
 */
function evtRemoveMeetmeUserConf(data) {
  try {
    // check parameter
    if (typeof data !== 'object' ||
      typeof data.userId !== 'string' ||
      typeof data.extenId !== 'string' ||
      typeof data.confId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.info(IDLOG, 'user id "' + data.userId + '" with exten id "' + data.extenId + '" has left the meetme conf ' + data.confId);
    astProxy.doCmd({
      command: 'listMeetmeConf',
      meetmeConfCode: getMeetmeConfCode(),
      confId: data.confId,
      remoteSitesPrefixes: remoteSitesPrefixes
    }, function (err, resp) {
      updateMeetmeConf(err, resp[(Object.keys(resp))[0]]);
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * A meetme conference has been ended. So update info about the conference.
 *
 * @method evtRemoveMeetmeConf
 * @param {object} data The response object received from the event plugin _meetmeend_.
 */
function evtRemoveMeetmeConf(data) {
  try {
    // check parameter
    if (typeof data !== 'object' ||
      typeof data.confId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.info(IDLOG, 'meetme conf "' + data.confId + '" has been ended');
    delete conferences[data.confId];

    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_MEETME_CONF_END + ' for conf ' + data.confId);
    astProxy.emit(EVT_MEETME_CONF_END, data.confId);

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * A user extension has joined the meetme conference. So update info about the conference.
 *
 * @method evtAddMeetmeUserConf
 * @param {object} data           The response object received from the event plugin _meetmejoin_.
 *   @param {string} data.name    The name of the user
 *   @param {string} data.userId  The user identifier in the conference
 *   @param {string} data.extenId The extension identifier in the conference
 *   @param {string} data.confId  The conference identifier
 */
function evtAddMeetmeUserConf(data) {
  try {
    // check parameter
    if (typeof data !== 'object' ||
      typeof data.name !== 'string' ||
      typeof data.userId !== 'string' ||
      typeof data.extenId !== 'string' ||
      typeof data.confId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.info(IDLOG, 'user id "' + data.userId + '" with exten id "' + data.extenId + '" has joined the meetme conf ' + data.confId);
    astProxy.doCmd({
      command: 'listMeetmeConf',
      meetmeConfCode: getMeetmeConfCode(),
      confId: data.confId,
      remoteSitesPrefixes: remoteSitesPrefixes
    }, function (err, resp) {
      updateMeetmeConf(err, resp[(Object.keys(resp))[0]]);
    });

    // request all channels
    if (extensions[data.extenId]) {
      logger.info(IDLOG, 'requests the channel list to update the extension ' + data.extenId);
      astProxy.doCmd({
        command: 'listChannels'
      }, function (err, resp) {
        // update the conversations of the extension
        updateExtenConversations(err, resp, data.extenId);
      });
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * The mute status of a meetme user conference has been changed. So update info about the conference.
 *
 * @method evtMeetmeUserConfMute
 * @param {object} data The response object received from the event plugin _meetmemute_.
 */
function evtMeetmeUserConfMute(data) {
  try {
    // check parameter
    if (typeof data !== 'object' ||
      typeof data.mute !== 'boolean' ||
      typeof data.userId !== 'string' ||
      typeof data.confId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.info(IDLOG, 'mute status of user id "' + data.userId + '" of meetme conf "' + data.confId + '" has been changed to ' + data.mute);
    astProxy.doCmd({
      command: 'listMeetmeConf',
      meetmeConfCode: getMeetmeConfCode(),
      confId: data.confId,
      remoteSitesPrefixes: remoteSitesPrefixes
    }, function (err, resp) {
      updateMeetmeConf(err, resp[(Object.keys(resp))[0]]);
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Adds a new waiting caller to a queue.
 *
 * @method evtNewQueueWaitingCaller
 * @param {object} data The response object received from the event plugin _join_.
 */
function evtNewQueueWaitingCaller(data) {
  try {
    if (typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var wCaller = new QueueWaitingCaller(data);
    var q = wCaller.getQueue();
    if (queues[q]) {
      queues[q].addWaitingCaller(wCaller);
      logger.info(IDLOG, 'added new queue waiting caller ' + wCaller.getNumber() + ' to queue ' + q);
      getListChannelsForTrunks();
      logger.info(IDLOG, 'emit event ' + EVT_QUEUE_CHANGED + ' for queue ' + q);
      astProxy.emit(EVT_QUEUE_CHANGED, queues[q]);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * If the involved spier is an extensions, it updates its conversations.
 *
 * @method evtSpyStartConversation
 * @param {object} data The data received from the __ event plugin
 */
function evtSpyStartConversation(data) {
  try {
    // check parameter
    if (typeof data !== 'object' && typeof data.spierId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    astProxy.doCmd({
      command: 'listChannels'
    }, function (err, resp) {
      // set the spy conversation as connected
      const spyConnected = true;
      // update the conversations of the spier
      if (extensions[data.spierId]) {
        updateExtenConversations(err, resp, data.spierId, spyConnected);
      }
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * If the involved numbers are extensions, it updates their conversations. If the called
 * is an extension it emits a dialing event to him with caller identity.
 *
 * @method evtConversationDialing
 * @param {object} data The data received from the _dial_ event plugin
 */
function evtConversationDialing(data) {
  try {
    // check parameter
    if (typeof data !== 'object' &&
      typeof data.chDest !== 'string' &&
      typeof data.chSource !== 'string' &&
      typeof data.callerNum !== 'string' &&
      typeof data.chDestExten !== 'string' &&
      typeof data.chSourceExten !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // if the destination is an extension, it emits the dialing event with caller
    // identity data. If the call is an external call, an _UserEvent_ has occured
    // and the identity data could be present in the _callerIdentityData_ object if
    // the query was successful before this event. If the data isn't present or the
    // call isn't an external call, the used identity data are those present in the
    // event itself

    // check if the destination is an extension
    if (extensions[data.chDestExten]) {

      var callerNum = data.callerNum;
      var dialingExten = data.chDestExten;
      var obj = callerIdentityData[callerNum] ? callerIdentityData[callerNum] : {};
      // add data about the caller and the called
      obj.numCalled = data.chDestExten;
      obj.callerNum = data.callerNum;
      obj.callerName = data.callerName;

      var callerHasConf = false;
      if (conferences[obj.callerNum]) {
        callerHasConf = true;
      }

      // emit the event
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_DIALING + ' for extension ' + dialingExten + ' with caller identity');
      astProxy.emit(EVT_EXTEN_DIALING, {
        dialingExten: dialingExten,
        callerIdentity: obj,
        channel: data.chDest,
        callerHasConf: callerHasConf,
        destUniqueId: data.destUniqueId || ''
      });
    }

    // when dialing each channel received from listChannels command
    // plugin hasn't the information about the bridgedChannel. So add
    // it in the following manner
    astProxy.doCmd({
      command: 'listChannels'
    }, function (err, resp) {
      try {
        // update the conversations of the extensions
        if (extensions[data.chSourceExten]) {
          updateExtenConversations(err, resp, data.chSourceExten);
        }
        if (extensions[data.chDestExten]) {
          updateExtenConversations(err, resp, data.chDestExten);
        }
        if (trunksEventsEnabled) {
          // update conversations of all trunks
          logger.info(IDLOG, 'update conversations of all trunks');
          updateConversationsForAllTrunk(err, resp);
        }
      } catch (err1) {
        logger.error(IDLOG, err1.stack);
      }
    });

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * A new channel has been created. If it involves a trunk en event
 * is emitted.
 *
 * @method evtNewExternalCallIn
 * @param {object} data The data received from the _newchannel_ event plugin
 */
function evtNewExternalCallIn(data) {
  try {
    if (typeof data !== 'object' && typeof data.uniqueid !== 'string' && typeof data.calledNum !== 'string' && typeof data.callerNum !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.info(IDLOG, `emit event ${EVT_CALLIN_BY_TRUNK} on trunk ${data.exten} by caller num ${data.callerNum}`);
    astProxy.emit(EVT_CALLIN_BY_TRUNK, {
      callerNum: data.callerNum,
      uniqueid: data.uniqueid
    });
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * If the involved numbers are extensions, it updates their conversations.
 *
 * @method evtConversationConnected
 * @param {string} num1 One of the two connected numbers
 * @param {string} num2 The other of the two connected numbers
 * @param {string} uniqueid The uniqueid of the call
 * @param {string} linkedid The linkedid of the call
 */
function evtConversationConnected(num1, num2, uniqueid, linkedid) {
  try {
    // check parameters
    if (typeof num1 !== 'string' || typeof num2 !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    updateConversationsOfNum(num1);
    updateConversationsOfNum(num2);
    // emit the event
    logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CONNECTED + ' between num1=' + num1 + ' and num2=' + num2);
    astProxy.emit(EVT_EXTEN_CONNECTED, {
      num1: num1,
      num2: num2,
      direction: uniqueid === linkedid ? 'out' : 'in',
      uniqueid: uniqueid,
      linkedid: linkedid,
      throughTrunk: (extensions[num1] && extensions[num2]) ? false : true
    });
    getListChannelsForTrunks();
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * If the conversation has been unhold.
 *
 * @method evtConversationUnhold
 * @param {object} data
 *  @param {string} data.whoPutsOnHoldExten The extension that puts on unhold a destination number
 *  @param {string} data.whoPutsOnHold The main extension that puts on unhold a destination number
 *  @param {string} data.putOnHold The destination that has been put on unhold
 */
function evtConversationUnhold(data) {
  try {
    if (typeof data !== 'object' || typeof data.whoPutsOnUnholdExten !== 'string' ||
      typeof data.whoPutsOnUnhold !== 'string' || typeof data.putOnUnhold !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[data.whoPutsOnUnholdExten]) {
      extensions[data.whoPutsOnUnholdExten].setStatus(EXTEN_STATUS_ENUM.BUSY);
      if (isReloading() && tempExtensions[data.whoPutsOnUnholdExten]) {
        tempExtensions[data.whoPutsOnUnholdExten].setStatus(EXTEN_STATUS_ENUM.BUSY);
      }
      logger.info(IDLOG, 'set busy (from unhold event) for extension ' + data.whoPutsOnUnholdExten);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + data.whoPutsOnUnholdExten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[data.whoPutsOnUnholdExten]);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * If the conversation has been put on hold.
 *
 * @method evtConversationHold
 * @param {object} data
 *  @param {string} data.whoPutsOnHoldExten The extension that puts on hold a destination number
 *  @param {string} data.whoPutsOnHold The main extension that puts on hold a destination number
 *  @param {string} data.putOnHold The destination that has been put on hold
 */
function evtConversationHold(data) {
  try {
    if (typeof data !== 'object' || typeof data.whoPutsOnHoldExten !== 'string' ||
      typeof data.whoPutsOnHold !== 'string' || typeof data.putOnHold !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[data.whoPutsOnHoldExten]) {
      extensions[data.whoPutsOnHoldExten].setStatus(EXTEN_STATUS_ENUM.ONHOLD);
      if (isReloading() && tempExtensions[data.whoPutsOnHoldExten]) {
        tempExtensions[data.whoPutsOnHoldExten].setStatus(EXTEN_STATUS_ENUM.ONHOLD);
      }
      logger.info(IDLOG, 'set hold status (from hold event) for extension ' + data.whoPutsOnHoldExten);
      logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + data.whoPutsOnHoldExten);
      astProxy.emit(EVT_EXTEN_CHANGED, extensions[data.whoPutsOnHoldExten]);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Update the conversations of the specified num, that can be extension, trunk or other.
 *
 * @method updateConversationsOfNum
 * @param {string} num A phone number that can be extension, trunk or other.
 * @private
 */
function updateConversationsOfNum(num) {
  try {
    if (typeof num !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extensions[num]) {
      logger.info(IDLOG, 'requests the channel list to update the extension ' + num);
      astProxy.doCmd({
        command: 'listChannels'
      }, function (err, resp) {
        updateExtenConversations(err, resp, num);
      });
    }
    if (trunks[num]) {
      getListChannelsForSingleTrunk(num);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Some information of a conversation has been changed, for example
 * during an attended transfer call. So update info.
 *
 * @method evtConversationInfoChanged
 * @param {string} num1 One of the two connected numbers
 * @param {string} num2 The other of the two connected numbers
 */
function evtConversationInfoChanged(num1, num2) {
  try {
    updateConversationsOfNum(num1);
    updateConversationsOfNum(num2);
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the name of the audio file to record the conversation of the specified extension.
 *
 * @method getRecordFilename
 * @param  {string} exten  The extension number
 * @param  {string} convid The conversation identifier
 * @param  {object} now    A date object
 * @return {string} The name of the audio file or undefined value if it is not present.
 * @private
 */
function getRecordFilename(exten, convid, now) {
  try {
    // check the extension existence
    if (!extensions[exten]) {
      return;
    }

    // get the conversation
    var conv = extensions[exten].getConversation(convid);

    if (!conv) {
      return;
    }

    var YYYYMMDD = moment(now).format('YYYYMMDD');
    var HHmmss = moment(now).format('HHmmss');
    var msec = now.getMilliseconds();

    if (conv.isIncoming()) {
      return 'exten-' + exten + '-' + conv.getCounterpartNum() + '-' + YYYYMMDD + '-' + HHmmss + '-' + msec + '.wav';
    } else {
      return 'exten-' + conv.getCounterpartNum() + '-' + exten + '-' + YYYYMMDD + '-' + HHmmss + '-' + msec + '.wav';
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns the path of the audio file to record the conversation of the specified extension.
 *
 * @method getRecordFilepath
 * @param  {string} exten  The extension number
 * @param  {string} convid The conversation identifier
 * @param  {object} now    A date object
 * @return {string} The path of the audio file or undefined value if it is not present.
 * @private
 */
function getRecordFilepath(exten, convid, now) {
  try {
    // check the extension existence
    if (!extensions[exten]) {
      return;
    }

    // get the conversation
    var conv = extensions[exten].getConversation(convid);
    if (!conv) {
      return;
    }

    var filename = getRecordFilename(exten, convid, now);
    var YYYYMMDD = moment(now).format('YYYY' + path.sep + 'MM' + path.sep + 'DD');
    return YYYYMMDD + path.sep + filename;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return the source channel of the conversation of the specified extension.
 * If the source channel isn't present, undefined will be returned. It is
 * useful for those operation in which the channel type is important. For example
 * the start and stop record call must be executed on the same channel.
 *
 * @method getExtenSourceChannelConversation
 * @param {string} exten The extension number
 * @param {string} convid The conversation identifier
 * @return {object} The source channel or undefined value if it's not present.
 * @private
 */
function getExtenSourceChannelConversation(exten, convid) {
  try {
    // check the extension existence
    if (!extensions[exten]) {
      return;
    }

    // get the conversation
    var conv = extensions[exten].getConversation(convid);

    if (!conv) {
      return;
    }

    var chSource = conv.getSourceChannel();
    var ch;

    if (chSource) {
      return chSource;
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return the identifier of the source channel of the conversation of the specified
 * extension. If the source channel isn't present, undefined will be returned. It is
 * useful for those operation in which the channel type is important. For example
 * the start and stop record call must be executed on the same channel.
 *
 * @method getExtenIdSourceChannelConversation
 * @param {string} exten The extension number
 * @param {string} convid The conversation identifier
 * @return {object} The identifier of the source channel or undefined value if it's not present.
 * @private
 */
function getExtenIdSourceChannelConversation(exten, convid) {
  try {
    // get the source channel
    var ch = getExtenSourceChannelConversation(exten, convid);
    if (ch) {
      return ch.getChannel();
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Return a channel identifier of the conversation of the specified extension. If the
 * source channel is present it will returned its id, otherwise the destination channel
 * id will be returned. It is useful for those operation in which the channel type is not
 * important (e.g. the hangup operation).
 *
 * @method getExtenIdChannelConversation
 * @param {string} exten The extension number
 * @param {string} convid The conversation identifier
 * @return {string} The channel identifier or undefined value if it's not present.
 * @private
 */
function getExtenIdChannelConversation(exten, convid) {
  try {
    // check the extension existence
    if (!extensions[exten]) {
      return undefined;
    }

    // get the conversation
    var conv = extensions[exten].getConversation(convid);

    if (!conv) {
      return;
    }

    var chDest = conv.getDestinationChannel();
    var chSource = conv.getSourceChannel();

    // get the channel of the extension "exten"
    if (chSource && chSource.isExtension(exten) === true) {
      return chSource.getChannel();
    }

    if (chDest && chDest.isExtension(exten) === true) {
      return chDest.getChannel();
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Adds a prefix to the number only if it is not already present and if
 * it is not an extension.
 *
 * @method addPrefix
 * @param  {string} num The number to call
 * @return {string} The number to call
 */
function addPrefix(num) {
  try {
    // check parameter
    if (typeof num !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // replace plus sign used in prefix with the '00' sequence
    if (num.substring(0, 1) === '+') {
      num = num.replace('+', '00');
    }

    // check if the prefix is to be added. It is added only for outgoing calls and not
    // between extensions. So checks if the destination is an extension and add the prefix
    // only in negative case and if it does not already contain it
    if (!extensions[num] && // the destination is not an extension
      num.substring(0, 2) !== '00') { // it does not contain the prefix

      num = prefix + num;
    }
    return num;

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return num;
  }
}

/**
 * Make a new call.
 *
 * @method call
 * @param {object} obj
 *  @param {string} [endpointType] The type of the endpoint (default "extension")
 *  @param {string} endpointId The endpoint identifier (e.g. the extension number)
 *  @param {string} to The destination number
 *  @param {string} [extenForContext] The extension to be used to get the "context" to make the new call (default endpointId)
 *  @param {function} cb The callback function
 */
function call(obj) {
  try {
    if (typeof obj.cb !== 'function' || typeof obj.to !== 'string' || typeof obj.endpointId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    obj.endpointType = obj.endpointType ? obj.endpointType : 'extension';
    obj.extenForContext = obj.extenForContext ? obj.extenForContext : obj.endpointId;
    let err;
    if (obj.endpointType === 'extension' && !extensions[obj.endpointId]) {
      err = 'making new call from non existent extension ' + obj.endpointId;
      logger.warn(IDLOG, err);
      obj.cb(err);
      return;
    }
    if (!extensions[obj.extenForContext]) {
      err = 'making new call: no extenForContext "' + obj.extenForContext + '" to get the "context" for the call';
      logger.warn(IDLOG, err);
      obj.cb(err);
      return;
    }

    obj.to = addPrefix(obj.to);

    logger.info(IDLOG, 'execute call from ' + obj.endpointId + ' to ' + obj.to);
    astProxy.doCmd({
      command: 'call',
      context: extensions[obj.extenForContext].getContext(),
      from: obj.endpointId,
      chanType: extensions[obj.endpointId] ? extensions[obj.endpointId].getChanType() : undefined,
      to: obj.to
    }, function (error, data) {
      obj.cb(error, data);
      callCb(error, data);
    });
  } catch (e) {
    logger.error(IDLOG, e.stack);
    obj.cb(e);
  }
}

/**
 * Return the code for in call audio function.
 *
 * @method getInCallAudioCode
 * @return {string} The code for in call audio function.
 */
function getInCallAudioCode() {
  try {
    return featureCodes['incall_audio'];
  } catch (e) {
    logger.error(IDLOG, e.stack);
  }
}

/**
 * Listen an audio file into the current conversation of the user.
 *
 * @method inCallAudio
 * @param {string} exten The extension with the conversation audio
 * @param {string} audioId The identifier of the audio file
 * @param {function} cb The callback function
 */
function inCallAudio(exten, audioId, cb) {
  try {
    if (typeof cb !== 'function' || typeof exten !== 'string' || typeof audioId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (!extensions[exten]) {
      let err = 'incall_audio from non existent extension ' + exten;
      logger.warn(IDLOG, err);
      cb(err);
      return;
    }
    logger.info(IDLOG, 'execute incall_audio for exten ' + exten + ' with audioId ' + audioId);
    astProxy.doCmd({
      command: 'inCallAudio',
      extension: getInCallAudioCode() + exten,
      audioId: audioId
    }, function (error) {
      cb(error);
    });
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Mute a call.
 *
 * @method muteConversation
 * @param {string} extension The extension identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier to be muted
 * @param {function} cb The callback function
 */
function muteConversation(extension, convid, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof convid !== 'string' ||
      typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint existence
    if (extensions[extension]) {

      // get the channel to mute
      var ch = getExtenIdChannelConversation(extension, convid);

      logger.info(IDLOG, 'execute mute of convid "' + convid + '" by exten "' + extension + '"');
      astProxy.doCmd({
        command: 'mute',
        channel: ch
      }, function (error) {
        cb(error);
        muteCb(error);
      });

    } else {
      var err = 'muting conversation "' + convid + '" by a non existent extension ' + extension;
      logger.warn(IDLOG, err);
      cb(err);
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Unmute a call.
 *
 * @method unmuteConversation
 * @param {string} extension The endpoint identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier to be unmuted
 * @param {function} cb The callback function
 */
function unmuteConversation(extension, convid, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' || typeof convid !== 'string' || typeof extension !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (extensions[extension]) {

      // get the channel to mute
      var ch = getExtenIdChannelConversation(extension, convid);

      logger.info(IDLOG, 'execute unmute of convid "' + convid + '" by exten "' + extension + '"');
      astProxy.doCmd({
        command: 'unmute',
        channel: ch
      }, function (error) {
        cb(error);
        muteCb(error);
      });

    } else {
      var err = 'unmuting conversation "' + convid + '" by a non existent extension ' + extension;
      logger.warn(IDLOG, err);
      cb(err);
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Mute a user of a meetme conference.
 *
 * @method muteUserMeetmeConf
 * @param {string} confId The meetme conference identifier
 * @param {string} userId The user indentifier into the conference
 * @param {string} extenId The extension indentifier of the user
 * @param {string} direction The direction to be muted
 * @param {function} cb The callback function
 */
function muteUserMeetmeConf(confId, userId, extenId, direction, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof confId !== 'string' ||
      typeof extenId !== 'string' ||
      typeof userId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    astProxy.doCmd({
        command: 'meetmeList',
        confId: confId,
        meetmeConfCode: getMeetmeConfCode()
      },
      function (error, resp) {
        if (error) {
          logger.error(IDLOG, error.stack);
          cb(error);
          return;
        }
        if (resp[userId] && resp[userId].channel) {
          logger.info(IDLOG, 'execute mute of user "' + userId + '" (ch: ' + resp[userId].channel + ') of meetme conf "' + confId + '" on direction "' + direction + '"');
          astProxy.doCmd({
              command: 'mute',
              channel: resp[userId].channel,
              direction: direction
            },
            function (error) {
              cb(error);
              muteUserMeetmeConfCb(error);
            });
        } else {
          var str = 'meetme channel to mute not found for userId "' + userId + '" (exten: ' + extenId + ') for confId "' + confId + '"';
          logger.error(IDLOG, str);
          cb(str);
        }
      });
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Unmute a user of a meetme conference.
 *
 * @method unmuteUserMeetmeConf
 * @param {string} confId The meetme conference identifier
 * @param {string} userId The user indentifier into the conference
 * @param {string} extenId The extension indentifier of the user
 * @param {boolean} onlyListen If the mute operation has to be made only on the listening
 * @param {function} cb The callback function
 */
function unmuteUserMeetmeConf(confId, userId, extenId, onlyListen, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof confId !== 'string' ||
      typeof extenId !== 'string' ||
      typeof userId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    astProxy.doCmd({
        command: 'meetmeList',
        confId: confId,
        meetmeConfCode: getMeetmeConfCode()
      },
      function (error, resp) {
        if (error) {
          logger.error(IDLOG, error.stack);
          cb(error);
          return;
        }
        var direction = onlyListen === true ? 'out' : 'all';
        if (resp[userId] && resp[userId].channel) {
          logger.info(IDLOG, 'execute unmute of user "' + userId + '" (ch: ' + resp[userId].channel + ') of meetme conf "' + confId + '" on direction "' + direction + '"');
          astProxy.doCmd({
              command: 'unmute',
              channel: resp[userId].channel,
              direction: direction
            },
            function (error) {
              cb(error);
              muteUserMeetmeConfCb(error);
            });
        } else {
          var str = 'meetme channel to unmute not found for userId "' + userId + '" (exten: ' + extenId + ') for confId "' + confId + '"';
          logger.error(IDLOG, str);
          cb(str);
        }
      });
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Hangup a user of a meetme conference.
 *
 * @method hangupUserMeetmeConf
 * @param {string}   confId  The meetme conference identifier
 * @param {string}   extenId The extension indentifier into the conference
 * @param {function} cb      The callback function
 */
function hangupUserMeetmeConf(confId, extenId, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof confId !== 'string' ||
      typeof extenId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.info(IDLOG, 'execute hangup of user "' + extenId + '" of meetme conf "' + confId + '"');
    var warn;

    if (!conferences[confId]) {
      warn = 'hanging up extenId "' + extenId + '" of conf id "' + confId + '": conference does not exist';
      cb(warn);
      return;
    }
    var user = conferences[confId].getUser(extenId);
    if (!user) {
      warn = 'hanging up user extenId "' + extenId + '" of conf id "' + confId + '": user does not exist';
      cb(warn);
      return;
    }
    var ch = user.getChannel();
    if (!ch) {
      warn = 'hanging up user extenId "' + extenId + '" of conf id "' + confId + '": no channel to hangup';
      cb(warn);
      return;
    }

    // execute the hangup
    logger.info(IDLOG, 'execute hangup of the channel ' + ch + ' of exten ' + extenId);
    astProxy.doCmd({
      command: 'hangup',
      channel: ch
    }, function (err) {
      cb(err);
      hangupConvCb(err);
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Sends the dtmf tone to the conversation destination.
 *
 * @method sendDtmfToConversation
 * @param {string} extension The extension identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier
 * @param {string} tone The dtmf tone to send
 * @param {function} cb The callback function
 */
function sendDtmfToConversation(extension, convid, tone, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' || typeof tone !== 'string' ||
      typeof convid !== 'string' || typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint existence
    if (extensions[extension]) {

      var conv = extensions[extension].getConversation(convid);
      var chSource = conv.getSourceChannel();
      var channel = chSource.getChannel();
      var counterpartNum = conv.getCounterpartNum();
      var chToSend = utilChannel13.extractExtensionFromChannel(channel) === counterpartNum ? channel : chSource.getBridgedChannel();

      logger.info(IDLOG, 'send dtmf tone "' + tone + '" from exten "' + extension + '" to channel "' + chToSend + '" of convid "' + convid + '"');
      astProxy.doCmd({
        command: 'playDTMF',
        channel: chToSend,
        digit: tone
      }, function (error) {
        if (error) {
          logger.warn(IDLOG, 'play dtmf tone "' + tone + '" to channel "' + chToSend + '": failed: ' + error.message);
        } else {
          logger.info(IDLOG, 'played dtmf tone "' + tone + '" to channel "' + chToSend + '" succesfully');
        }
        cb(error);
      });
    } else {
      var err = 'sending dtmf tone "' + tone + '" from a non existent extension ' + extension;
      logger.warn(IDLOG, err);
      cb(err);
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Pickup a parked caller.
 *
 * @method pickupParking
 * @param {string} parking The number of the parking
 * @param {string} destId The endpoint identifier that pickup the conversation
 * @param {string} extForCtx The extension identifier used to get the context
 * @param {function} cb The callback function
 */
function pickupParking(parking, destId, extForCtx, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof destId !== 'string' ||
      typeof parking !== 'string' ||
      typeof extForCtx !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (!extensions[extForCtx]) {
      throw new Error('no extension to get context for pickup parking (extForCtx="' + extForCtx + '")');
    }

    // check if the dest extension exists
    if (extensions[destId]) {

      // ask the info of the parked calls at runtime
      astProxy.doCmd({
        command: 'listParkedCalls'
      }, (err, list) => {

        // check action error
        if (err) throw new Error('error listing parked calls')

        // check parked calls length
        if (!(Object.keys(list).length > 0)) throw new Error('no parked calls found')

        const ctx = extensions[extForCtx].getContext();
        const ch = list[parking].channel;

        logger.info(IDLOG, 'pickup from ' + destId + ' of the channel ' + ch + ' of parking ' + parking + ' ' +
        'using context "' + ctx + '"');

        if (ch !== undefined) {

          // pickup the call using the redirectChannel action
          astProxy.doCmd({
            command: 'redirectChannel',
            context: ctx,
            chToRedirect: ch,
            to: destId
          }, function (err) {
            cb(err);
            redirectConvCb(err);
          })

        } else {
          throw new Error('channel is undefined')
        }

      });
    } else {
      var str = 'pickup parking from ' + destId + ' of parking ' + parking;
      logger.error(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Put the conversation into the waiting queue of the operator panel.
 *
 * @method opWaitConv
 * @param {string} opWaitQueue The destination waiting queue
 * @param {string} convid The conversation identifier
 * @param {string} extens The extensions in which the conversation has to be searched
 * @param {function} cb The callback function
 */
function opWaitConv(opWaitQueue, convid, extens, cb) {
  try {
    if (typeof cb !== 'function' || typeof opWaitQueue !== 'string' || typeof convid !== 'string' || !Array.isArray(extens)) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var e, conv, found;
    for (var i in extens) {
      e = extens[i];
      if (extensions[e]) {
        var convs = extensions[e].getAllConversations();
        conv = convs[convid];
        if (conv !== undefined) {
          found = true;
          var ch;
          if (conv.isIncoming()) {
            ch = conv.getSourceChannel().getChannel();
          } else {
            ch = conv.getDestinationChannel().getChannel();
          }
          astProxy.doCmd({
            command: 'redirectChannel',
            context: 'ctiopqueue',
            chToRedirect: ch,
            to: opWaitQueue
          }, function (err) {
            cb(err);
            redirectConvCb(err);
          });
          break;
        }
      }
    }
    if (found === undefined) {
      logger.warn(IDLOG, 'conv "' + convid + '" to put in waiting for the operator panel not found in extens ' + extens);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Pickup a conversation.
 *
 * @method pickupQueueWaitingCaller
 * @param {string} queue The queue identifier
 * @param {string} waitCallerId The queue waiting caller identifier
 * @param {string} destId The endpoint identifier that pickup the conversation
 * @param {string} extForCtx The extension identifier used to get the context
 * @param {function} cb The callback function
 */
function pickupQueueWaitingCaller(queue, waitCallerId, destId, extForCtx, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof queue !== 'string' ||
      typeof destId !== 'string' ||
      typeof extForCtx !== 'string' ||
      typeof waitCallerId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var str;
    if (!queues[queue]) {
      str = 'picking up qWaitCaller: queue "' + queue + '" does not exist';
      logger.warn(IDLOG, str);
      cb(str);
      return;
    }
    if (!queues[queue].waitingCallerExists(waitCallerId)) {
      str = 'picking up qWaitCaller: waitingCaller "' + waitCallerId + '" does not exist';
      logger.warn(IDLOG, str);
      cb(str);
      return;
    }
    if (!extensions[destId]) {
      str = 'picking up qWaitCaller: destId "' + destId + '" does not exist';
      logger.warn(IDLOG, str);
      cb(str);
      return;
    }
    if (!extensions[extForCtx]) {
      str = 'no extension to get context for pickup qWaitCaller (extForCtx="' + extForCtx + '")';
      logger.warn(IDLOG, str);
      cb(str);
      return;
    }
    var ch = (queues[queue].getWaitingCaller(waitCallerId)).getChannel();
    if (!ch) {
      str = 'picking up qWaitCaller: no channel to pickup (ch: ' + ch + ')';
      logger.warn(IDLOG, str);
      cb(str);
      return;
    }
    var ctx = extensions[extForCtx].getContext();
    logger.info(IDLOG, 'pickup waiting caller "' + waitCallerId + '" (ch: ' + ch + ') of queue "' + queue + '" from exten "' +
      destId + '" with context ' + ctx);
    astProxy.doCmd({
      command: 'redirectChannel',
      context: ctx,
      chToRedirect: ch,
      to: destId
    }, function (err) {
      cb(err);
      pickupQueueWaitingCallerCb(err);
    });
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Pickup a conversation.
 *
 * @method pickupConversation
 * @param {string} endpointId The endpoint identifier (e.g. the extension number)
 * @param {string} destId The endpoint identifier that pickup the conversation
 * @param {string} extForCtx The extension identifier used to get the context
 * @param {function} cb The callback function
 */
function pickupConversation(endpointId, destId, extForCtx, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof destId !== 'string' ||
      typeof extForCtx !== 'string' ||
      typeof endpointId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check the endpoint existence
    if (extensions[endpointId] && extensions[destId]) {

      if (!extensions[extForCtx]) {
        throw new Error('no extension to get context for pickup conversation (extForCtx="' + extForCtx + '")');
      }
      var ctx = extensions[extForCtx].getContext();
      // the pickup operation is made by call operation
      logger.info(IDLOG, 'pickup from "' + destId + '" of exten "' + endpointId + '"');
      astProxy.doCmd({
        command: 'call',
        context: ctx,
        chanType: extensions[endpointId].getChanType(),
        from: destId,
        to: getPickupCode() + endpointId
      }, function (err) {
        cb(err);
        pickupConvCb(err);
      });
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * It's called on asterisk shutdown. It is
 * called from the _shutdown_ event plugin.
 *
 * @method evtAstShutdown
 * @param {object} data The data received from _shutdown_ event plugin
 */
function evtAstShutdown(data) {
  try {
    if (typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.warn(IDLOG, 'asterisk shutdown' +
      (data.shutdown ? ' "' + data.shutdown + '"' : '') +
      (data.restart ? ' (restart: ' + data.restart + ')' : '')
    );
    shutdown = true
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * It's called on asterisk module reloading. It is
 * called from the _reload_ event plugin.
 *
 * @method evtAstModuleReloaded
 * @param {object} data The data received from _reload_ event plugin
 */
function evtAstModuleReloaded(data) {
  try {
    if (typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.warn(IDLOG, 'asterisk module "' + data.module + '" reloaded: ' + data.status);
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * It's called when an Hangup event is raised from the asterisk. It is
 * called from the _hangup_ event plugin.
 *
 * @method evtHangupConversation
 * @param {object} data The data received from _hangup_ event plugin
 */
function evtHangupConversation(data) {
  try {
    // check parameter
    if (typeof data !== 'object' ||
      typeof data.channel !== 'string' ||
      typeof data.channelExten !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check the presence of recording status to be removed
    var convid;
    for (convid in recordingConv) {
      if (convid.indexOf(data.channel) !== -1) {
        delete recordingConv[convid];
      }
    }

    // check the extension existence
    if (extensions[data.channelExten]) {

      // request all channel list and update channels of extension
      astProxy.doCmd({
        command: 'listChannels'
      }, function (err, resp) {

        // update the conversations of the extension
        updateExtenConversations(err, resp, data.channelExten);
      });

      // emit the event
      logger.info(IDLOG, 'emit event "' + EVT_EXTEN_HANGUP + '" for extension ' + data.channelExten);
      delete data.channel;
      astProxy.emit(EVT_EXTEN_HANGUP, data);
    }

    // check the trunk existence
    if (isTrunk(data.channelExten)) {
      getListChannelsForSingleTrunk(data.channelExten);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Starts a meetme conference. Its behaviour change based on owner
 * extension status of the conference.
 *
 * @method startMeetmeConference
 * @param {string}   convid       The conversation identifier of the owner to be added to the conference
 * @param {string}   ownerExtenId The extension owner of the conference
 * @param {string}   addExtenId   The extension identifier to be added to the conference
 * @param {function} cb           The callback function
 */
function startMeetmeConference(convid, ownerExtenId, addExtenId, cb) {
  try {
    // check parameters
    if (typeof ownerExtenId !== 'string' ||
      typeof convid !== 'string' ||
      typeof addExtenId !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var warn;

    // check the extension existence
    if (!extensions[ownerExtenId]) {
      warn = 'starting meetme conf of owner exten "' + ownerExtenId + '" failed: exten non existent';
      logger.warn(IDLOG, warn);
      cb(warn);
      return;
    }
    // check the conversation existence
    var conv = extensions[ownerExtenId].getConversation(convid);

    if (!conv) {
      warn = 'starting meetme conf of owner exten "' + ownerExtenId + '" failed: convid "' + convid + '" non existent';
      logger.warn(IDLOG, warn);
      cb(warn);
      return;
    }

    // redirect the channel of the counterpart to the conference number of the owner extension
    var confnum = getMeetmeConfCode() + ownerExtenId;
    redirectConversation(ownerExtenId, convid, confnum, ownerExtenId, function (err) {
      // newUser is true if the conversation "convid"
      // involves both "ownerExtenId" and "addExtenId"
      var newUser = conv.getCounterpartNum() === addExtenId;
      cb(err, newUser);
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Ends the entire meetme conference.
 *
 * @method endMeetmeConf
 * @param {string}   confId The conference identifier
 * @param {function} cb     The callback function
 */
function endMeetmeConf(confId, cb) {
  try {
    // check parameters
    if (typeof confId !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the conference existence
    if (!conferences[confId]) {
      var warn = 'ending entire meetme conf "' + confId + '" failed: conf does not exist';
      logger.warn(IDLOG, warn);
      cb(warn);
      return;
    }

    var extenId;
    var arrUsers = [];
    var users = conferences[confId].getAllUsers();
    for (extenId in users) {
      arrUsers.push(users[extenId]);
    }

    logger.info(IDLOG, 'starting end entire meetme conf "' + confId + '"');
    async.each(arrUsers, function (u, eachCb) {

      var ch = u.getChannel();
      var uid = u.getId();
      var eid = u.getExtenId();

      astProxy.doCmd({
        command: 'hangup',
        channel: ch
      }, function (err) {
        if (err) {
          logger.error(IDLOG, 'hanging up channel "' + ch + '" of user "' + uid + '" ' +
            'exten "' + eid + '" of conf "' + confId + '"');
          eachCb(err);
        } else {
          logger.info(IDLOG, 'channel "' + ch + '" of user "' + uid + '" ' +
            'exten "' + eid + '" of conf "' + confId + '" has been hanged up successfully');
          eachCb();
        }
      });
    }, function (err) {

      if (err) {
        logger.error(IDLOG, 'ending entire meetme conf "' + confId + '": ' + err.toString());
        cb(err);
      } else {
        logger.info(IDLOG, 'entire meetme conf "' + confId + '" has been ended successfully');
        cb(null);
      }
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Returns true if the extension is already into its meetme conference.
 *
 * @method isExtenInMeetmeConf
 * @param  {string}  ownerExtenId The extension owner of the conference
 * @return {boolean} True if the extension is already into its meetme conference.
 */
function isExtenInMeetmeConf(ownerExtenId) {
  try {
    // check parameters
    if (typeof ownerExtenId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (conferences[ownerExtenId]) {
      return conferences[ownerExtenId].hasExten(ownerExtenId);
    }
    return false;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Hangup all the conversations of the main extensions and so event all of the
 * associated secondary extensions.
 *
 * @method hangupMainExtension
 * @param {string} endpointId The main extension identifier
 * @param {function} cb The callback function
 */
function hangupMainExtension(endpointId, cb) {
  try {
    if (typeof endpointId !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var err;
    if (extensions[endpointId]) {
      logger.info(IDLOG, 'execute hangup of main exten "' + endpointId + '"');
      astProxy.doCmd({
        command: 'hangup',
        channel: '/^PJSIP/[0123456789]*' + endpointId + '-/'
      }, function (err) {
        cb(err);
        hangupConvCb(err);
      });
    } else {
      err = 'try to hangup main extension for the non existent endpoint ' + endpointId;
      logger.warn(IDLOG, err);
      cb(err);
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Hangup the conversation of the endpoint.
 *
 * @method hangupConversation
 * @param {string} endpointId The endpoint identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier
 * @param {function} cb The callback function
 */
function hangupConversation(endpointId, convid, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' || typeof cb !== 'function' ||
      typeof endpointId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var err;
    // check the endpoint existence
    if (extensions[endpointId]) {

      // get the channel to hangup
      var ch = getExtenIdChannelConversation(endpointId, convid);

      if (ch) {
        // execute the hangup
        logger.info(IDLOG, 'execute hangup of the channel ' + ch + ' of exten ' + endpointId);
        astProxy.doCmd({
          command: 'hangup',
          channel: ch
        }, function (err) {
          cb(err);
          hangupConvCb(err);
        });
      } else {
        err = 'no channel to hangup of conversation ' + convid + ' of exten ' + endpointId;
        logger.warn(IDLOG, err);
        var allConvs = extensions[endpointId].getAllConversations();
        logger.warn(IDLOG, 'conversations of ' + endpointId + ' are: ' + JSON.stringify(allConvs));
        cb(err);
      }
    } else {
      err = 'try to hangup conversation for the non existent endpoint ' + endpointId;
      logger.warn(IDLOG, err);
      cb(err);
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Hangup the asterisk channel of the endpoint.
 *
 * @method hangupChannel
 * @param {string}   endpointType The type of the endpoint (e.g. extension, queue, parking, trunk...)
 * @param {string}   endpointId   The endpoint identifier (e.g. the extension number)
 * @param {string}   ch           The channel identifier
 * @param {function} cb           The callback function
 */
function hangupChannel(endpointType, endpointId, ch, cb) {
  try {
    // check parameters
    if (typeof ch !== 'string' || typeof cb !== 'function' ||
      typeof endpointId !== 'string' || typeof endpointType !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var err;
    // check the endpoint existence
    if (endpointType === 'extension' && extensions[endpointId]) {

      logger.info(IDLOG, 'execute hangup of the channel ' + ch + ' of exten ' + endpointId);
      astProxy.doCmd({
        command: 'hangup',
        channel: ch
      }, function (err) {
        cb(err);
        hangupConvCb(err);
      });

    } else {
      err = 'try to hangup asterisk channel for the non existent endpoint ' + endpointType + ' ' + endpointId;
      logger.warn(IDLOG, err);
      cb(err);
    }

  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * This is the callback of the pickup queue waiting caller operation.
 *
 * @method pickupQueueWaitingCallerCb
 * @param {object} err The error object of the operation
 * @private
 */
function pickupQueueWaitingCallerCb(err) {
  try {
    if (err) {
      logger.error(IDLOG, 'pickup queue waiting caller failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'pickup queue waiting caller successfully');
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of the pickup operation.
 *
 * @method pickupConvCb
 * @param {object} err The error object of the operation
 * @private
 */
function pickupConvCb(err) {
  try {
    if (err) {
      logger.error(IDLOG, 'pickup call failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'pickup call successfully');
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of the _redirectChannel_ command plugin.
 *
 * @method redirectConvCb
 * @param {object} err The error object of the operation
 * @private
 */
function redirectConvCb(err) {
  try {
    if (err) {
      logger.error(IDLOG, 'redirect channel failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'redirect channel succesfully');
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of _blindTransfer_ command plugin.
 *
 * @method blindTransferConvCb
 * @param {object} err The error object of the operation
 * @private
 */
function blindTransferConvCb(err) {
  try {
    if (err) {
      logger.error(IDLOG, 'blind transfer conversation failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'blind transfer channel successfully');
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of _attendedTransfer_ command plugin.
 *
 * @method attendedTransferConvCb
 * @param {object} err The error object of the operation
 * @private
 */
function attendedTransferConvCb(err) {
  try {
    if (err) {
      logger.error(IDLOG, 'attended transfer conversation failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'attended transfer channel successfully');
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of _transferToVoicemail_ command plugin.
 *
 * @method transferConvToVoicemailCb
 * @param {object} err The error object of the operation
 * @private
 */
function transferConvToVoicemailCb(err) {
  try {
    if (err) {
      logger.error(IDLOG, 'transfer channel to voicemail failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'transfer channel to voicemail successfully');
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of the call command plugin.
 *
 * @method callCb
 * @param {object} error The error object of the operation
 * @private
 */
function callCb(error) {
  try {
    if (error) {
      logger.warn(IDLOG, 'call failed: ' + error.message);
    } else {
      logger.info(IDLOG, 'call succesfully');
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * This is the callback of the mute command plugin.
 *
 * @method muteCb
 * @param {object} error The error object of the operation
 * @private
 */
function muteCb(error) {
  try {
    if (error) {
      logger.warn(IDLOG, 'mute failed: ' + error.message);
    } else {
      logger.info(IDLOG, 'mute succesfully');
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * This is the callback of the mute user of a meetme conference command plugin.
 *
 * @method muteUserMeetmeConfCb
 * @param {object} error The error object of the operation
 * @private
 */
function muteUserMeetmeConfCb(error) {
  try {
    if (error) {
      logger.warn(IDLOG, 'mute user of meetme conf failed: ' + error.message);
    } else {
      logger.info(IDLOG, 'mute user of meetme conf succesfully');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * This is the callback of the unmute user of a meetme conference command plugin.
 *
 * @method unmuteUserMeetmeConfCb
 * @param {object} error The error object of the operation
 * @private
 */
function unmuteUserMeetmeConfCb(error) {
  try {
    if (error) {
      logger.warn(IDLOG, 'unmute user of meetme conf failed: ' + error.message);
    } else {
      logger.info(IDLOG, 'unmute user of meetme conf succesfully');
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * This is the callback of the spy command plugin with speaking.
 *
 * @method startSpySpeakConvCb
 * @param {object} err    The error object of the operation
 * @param {string} convid The conversation identifier
 * @private
 */
function startSpySpeakConvCb(err, convid) {
  try {
    if (err) {
      logger.error(IDLOG, 'start spy speak convid ' + convid + ' with speaking failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'start spy speak convid ' + convid + ' with speaking succesfully');
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of the spy command plugin with only listening.
 *
 * @method startSpyListenConvCb
 * @param {object} err    The error object of the operation
 * @param {string} convid The conversation identifier
 * @private
 */
function startSpyListenConvCb(err, convid) {
  try {
    if (err) {
      logger.error(IDLOG, 'start spy listen convid ' + convid + ' with only listening failed: ' + err.toString());
    } else {
      logger.info(IDLOG, 'start spy listen convid ' + convid + ' with only listening succesfully');
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * This is the callback of the hangup command plugin.
 *
 * @method hangupConvCb
 * @param {object} err The error object of the operation
 * @private
 */
function hangupConvCb(err) {
  try {
    if (err) {
      logger.warn(IDLOG, 'hangup channel failed' + err.toString());
    } else {
      logger.info(IDLOG, 'hangup channel succesfully');
    }

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Redirect the conversation.
 *
 * @method redirectConversation
 * @param {string} extension The extension identifier
 * @param {string} convid The conversation identifier
 * @param {string} to The destination number to redirect the conversation
 * @param {string} extForCtx The extension identifier used to get the context
 * @param {function} cb The callback function
 */
function redirectConversation(extension, convid, to, extForCtx, cb) {
  try {
    if (typeof convid !== 'string' || typeof cb !== 'function' ||
      typeof to !== 'string' || typeof extForCtx !== 'string' ||
      typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var msg;
    if (extensions[extension]) {

      if (!extensions[extForCtx]) {
        throw new Error('no extension to get context for redirect conversation (extForCtx="' + extForCtx + '")');
      }

      var ctx = extensions[extForCtx].getContext();
      var convs = extensions[extension].getAllConversations();
      var conv = convs[convid];
      var chSource = conv.getSourceChannel();
      var channel = chSource.getChannel();
      var bridgedChannel = chSource.getBridgedChannel();

      // redirect is only possible on own calls. So when the extension is the caller, the
      // channel to redirect is the destination channel. It is the source channel otherwise
      var chToRedirect = extension === utilChannel13.extractExtensionFromChannel(channel) ? bridgedChannel : channel;

      if (chToRedirect !== undefined) {
        // redirect the channel
        logger.info(IDLOG, 'redirect of the channel ' + chToRedirect + ' of exten ' + extension + ' to ' + to);
        astProxy.doCmd({
          command: 'redirectChannel',
          context: ctx,
          chToRedirect: chToRedirect,
          to: to
        }, function (err) {
          cb(err);
          redirectConvCb(err);
        });
      } else {
        msg = 'getting the channel to redirect ' + chToRedirect;
        logger.error(IDLOG, msg);
        cb(msg);
      }
    } else {
      msg = 'redirecting conversation: extension "' + extension + '" not present';
      logger.warn(IDLOG, msg);
      cb(msg);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Force hangup of the conversation.
 *
 * @method forceHangupConversation
 * @param {string}   endpointType The type of the endpoint (e.g. extension, queue, parking, trunk...)
 * @param {string}   endpointId   The endpoint identifier (e.g. the extension number)
 * @param {string}   convid       The conversation identifier
 * @param {string}   extForCtx    The extension identifier used to get the context
 * @param {function} cb           The callback function
 */
function forceHangupConversation(endpointType, endpointId, convid, extForCtx, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' ||
      typeof cb !== 'function' || typeof extForCtx !== 'string' ||
      typeof endpointId !== 'string' || typeof endpointType !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var msg;
    // check the endpoint existence
    if (endpointType === 'extension' && extensions[endpointId]) {

      if (!extensions[extForCtx]) {
        throw new Error('no extension to get context for force hangup conversation (extForCtx="' + extForCtx + '")');
      }

      var ctx = extensions[extForCtx].getContext();
      var convs = extensions[endpointId].getAllConversations();
      var conv = convs[convid];
      var chSource = conv.getSourceChannel();
      var chDest = conv.getDestinationChannel();

      // force hangup is realized with a redirection to a non existent destination.
      var chToHangup;
      if (chSource) {
        chToHangup = endpointId === chSource.getCallerNum() ? chSource.getChannel() : chSource.getBridgedChannel();
      } else {
        chToHangup = endpointId === chDest.getCallerNum() ? chDest.getChannel() : chDest.getBridgedChannel();
      }

      if (chToHangup !== undefined) {

        var to = 'xyzw';

        // redirect the channel to a non existent destination to force the hangup
        logger.info(IDLOG, 'force hangup of the channel ' + chToHangup + ' of exten ' + endpointId + ' to non existent destination ' + to);
        astProxy.doCmd({
          command: 'redirectChannel',
          context: ctx,
          chToRedirect: chToHangup,
          to: to
        }, function (err) {
          cb(err);
          if (err) {
            logger.error(IDLOG, 'force hangup channel failed: ' + err.toString());
          } else {
            logger.info(IDLOG, 'force hangup channel succesfully');
          }
        });

      } else {
        msg = 'getting the channel to force hangup ' + chToHangup;
        logger.error(IDLOG, msg);
        cb(msg);
      }

    } else {
      msg = 'force hangup conversation: unknown endpointType ' + endpointType + ' or extension ' + endpointId + ' not present';
      logger.warn(IDLOG, msg);
      cb(msg);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Redirect the waiting caller from the queue to the specified destination.
 *
 * @method redirectWaitingCaller
 * @param {string}   waitingCallerId The identifier of the waiting caller
 * @param {string}   queue           The identifier of the queue in which the caller waiting
 * @param {string}   to              The destination number to redirect the conversation
 * @param {string}   extForCtx       The extension identifier used to get the context
 * @param {function} cb              The callback function
 */
function redirectWaitingCaller(waitingCallerId, queue, to, extForCtx, cb) {
  try {
    if (typeof cb !== 'function' ||
      typeof waitingCallerId !== 'string' || typeof queue !== 'string' ||
      typeof extForCtx !== 'string' || typeof to !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (queues[queue]) {
      if (!extensions[extForCtx]) {
        throw new Error('no extension to get context for redirect waiting caller (extForCtx="' + extForCtx + '")');
      }
      var ctx = extensions[extForCtx].getContext();
      var ch = queues[queue].getAllWaitingCallers()[waitingCallerId].getChannel();

      if (ch !== undefined) {
        logger.info(IDLOG, 'redirect channel ' + ch + ' of waitingCaller ' + waitingCallerId + ' from queue ' + queue + ' to ' + to);
        astProxy.doCmd({
          command: 'redirectChannel',
          context: ctx,
          chToRedirect: ch,
          to: to
        }, function (err) {
          cb(err);
          redirectConvCb(err);
        });
      } else {
        var str = 'redirecting waiting caller ' + waitingCallerId + ' from queue ' + queue + ' to ' + to + ': no channel found';
        logger.error(IDLOG, str);
        cb(str);
      }
    } else {
      var msg = 'redirecting waiting caller ' + waitingCallerId + ' from queue ' + queue + ' to ' + to + ': non existent queue ' + queue;
      logger.warn(IDLOG, msg);
      cb(msg);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Redirect the parked call to the specified destination.
 *
 * @method redirectParking
 * @param {string}   parking   The identifier of the parking
 * @param {string}   to        The destination number to redirect the parked call
 * @param {string}   extForCtx The extension identifier used to get the context
 * @param {function} cb        The callback function
 */
function redirectParking(parking, to, extForCtx, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' || typeof extForCtx !== 'string' ||
      typeof parking !== 'string' || typeof to !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the parking existence
    if (parkings[parking]) {

      if (!extensions[extForCtx]) {
        throw new Error('no extension to get context for pickup parking (extForCtx="' + extForCtx + '")');
      }

      var ctx = extensions[extForCtx].getContext();
      var ch = parkings[parking].getParkedCaller().getChannel();

      if (ch !== undefined) {

        logger.info(IDLOG, 'redirect channel ' + ch + ' from parking ' + parking + ' to ' + to);
        astProxy.doCmd({
          command: 'redirectChannel',
          context: ctx,
          chToRedirect: ch,
          to: to
        }, function (err) {
          cb(err);
          redirectConvCb(err);
        });

      } else {
        var str = 'redirecting parked caller of parking ' + parking + ' to ' + to + ': no channel found';
        logger.error(IDLOG, str);
        cb(str);
      }

    } else {
      var msg = 'redirecting parked caller of parking ' + parking + ' to ' + to + ': non existent parking ' + parking;
      logger.warn(IDLOG, msg);
      cb(msg);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Blind transfer the conversation.
 *
 * @method blindTransferConversation
 * @param {string} extension The endpoint identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier
 * @param {string} to The destination number to redirect the conversation
 * @param {function} cb The callback function
 */
function blindTransferConversation(extension, convid, to, cb) {
  try {
    if (typeof convid !== 'string' || typeof cb !== 'function' ||
      typeof to !== 'string' || typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var msg;
    if (extensions[extension]) {
      var convs = extensions[extension].getAllConversations();
      var conv = convs[convid];
      if (!conv) {
        msg = 'blind transfer convid "' + convid + '": no conversation present in extension ' + extension;
        logger.warn(IDLOG, msg);
        cb(msg);
        return;
      }
      var chSource = conv.getSourceChannel();
      var channel = chSource.getChannel();
      var bridgedChannel = chSource.getBridgedChannel();
      // blind transfer is only possible on own calls. So when the extension is the caller, the
      // channel to transfer is the source channel, otherwise it is the destination channel
      var chToTransfer = utilChannel13.extractExtensionFromChannel(channel) === extension ? channel : bridgedChannel;

      if (chToTransfer !== undefined) {
        logger.info(IDLOG, 'blind transfer channel ' + chToTransfer + ' of exten ' + extension + ' to ' + to);
        astProxy.doCmd({
          command: 'blindTransfer',
          chToTransfer: chToTransfer,
          context: blindTransferContext,
          to: to
        }, function (err) {
          cb(err);
          blindTransferConvCb(err);
        });
      } else {
        msg = 'blind transfer: no channel to transfer ' + chToTransfer;
        logger.error(IDLOG, msg);
        cb(msg);
      }
    } else {
      msg = 'blind transfer conversation: extension ' + extension + ' not present';
      logger.warn(IDLOG, msg);
      cb(msg);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Attended transfer the conversation.
 *
 * @method attendedTransferConversation
 * @param {string} extension The endpoint identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier
 * @param {string} to The destination number to redirect the conversation
 * @param {function} cb The callback function
 */
function attendedTransferConversation(extension, convid, to, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' || typeof cb !== 'function' ||
      typeof to !== 'string' || typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var msg;
    // check the endpoint existence
    if (extensions[extension]) {

      var convs = extensions[extension].getAllConversations();
      var conv = convs[convid];

      if (!conv) {
        msg = 'attended transfer convid "' + convid + '": no conversation present in extension ' + extension;
        logger.warn(IDLOG, msg);
        cb(msg);
        return;
      }

      var chSource = conv.getSourceChannel();
      var channel = chSource.getChannel();
      var bridgedChannel = chSource.getBridgedChannel();

      // attended transfer is only possible on own calls. So when the extension is the caller, the
      // channel to transfer is the source channel, otherwise it is the destination channel
      var chToTransfer = utilChannel13.extractExtensionFromChannel(channel) === extension ? channel : bridgedChannel;

      if (chToTransfer !== undefined) {

        // attended transfer the channel
        logger.info(IDLOG, 'attended transfer of the channel ' + chToTransfer + ' of exten ' + extension + ' to ' + to);
        astProxy.doCmd({
          command: 'attendedTransfer',
          chToTransfer: chToTransfer,
          to: to
        }, function (err) {
          cb(err);
          attendedTransferConvCb(err);
        });

      } else {
        msg = 'attended transfer: no channel to transfer ' + chToTransfer;
        logger.error(IDLOG, msg);
        cb(msg);
      }
    } else {
      msg = 'attended transfer conversation: extension ' + extension + ' not present';
      logger.warn(IDLOG, msg);
      cb(msg);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Transfer the conversation to the voicemail.
 *
 * @method transferConversationToVoicemail
 * @param {string}   endpointType The type of the endpoint (e.g. extension, queue, parking, trunk...)
 * @param {string}   endpointId   The endpoint identifier (e.g. the extension number)
 * @param {string}   convid       The conversation identifier
 * @param {string}   voicemail    The destination voicemail number to transfer the conversation
 * @param {string}   extForCtx    The extension identifier used to get the context
 * @param {function} cb           The callback function
 */
function transferConversationToVoicemail(endpointType, endpointId, convid, voicemail, extForCtx, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' || typeof extForCtx !== 'string' ||
      typeof cb !== 'function' || typeof voicemail !== 'string' ||
      typeof endpointId !== 'string' || typeof endpointType !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var msg;
    // check the endpoint existence
    if (endpointType === 'extension' && extensions[endpointId]) {

      if (!extensions[extForCtx]) {
        throw new Error('no extension to get context for transfer conv to vm (extForCtx="' + extForCtx + '")');
      }

      var ctx = extensions[extForCtx].getContext();
      var convs = extensions[endpointId].getAllConversations();
      var conv = convs[convid];

      if (!conv) {
        msg = 'transfer convid "' + convid + '" to voicemail "' + voicemail + '": no conversation present in extension ' + endpointId;
        logger.warn(IDLOG, msg);
        cb(msg);
        return;
      }

      var chSource = conv.getSourceChannel();
      var callerNum = chSource.getCallerNum();
      var bridgedNum = chSource.getBridgedNum();

      // when the endpointId is the caller, the channel to transfer is the destination channel
      var chToTransfer = endpointId === chSource.getCallerNum() ? chSource.getBridgedChannel() : chSource.getChannel();

      if (chToTransfer !== undefined) {

        // transfer the channel to the voicemail
        logger.info(IDLOG, 'transfer of the channel ' + chToTransfer + ' of exten ' + endpointId + ' to voicemail ' + voicemail);
        astProxy.doCmd({
          command: 'transferToVoicemail',
          context: ctx,
          chToTransfer: chToTransfer,
          voicemail: voicemail
        }, function (err) {
          cb(err);
          transferConvToVoicemailCb(err);
        });

      } else {
        msg = 'transfer to voicemail: no channel to transfer ' + chToTransfer;
        logger.error(IDLOG, msg);
        cb(msg);
      }

    } else {
      msg = 'transfer conversation to voicemail: unknown endpointType ' + endpointType + ' or extension ' + endpointId + ' not present';
      logger.warn(IDLOG, msg);
      cb(msg);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Park the conversation.
 *
 * @method parkConversation
 * @param {string} extension The endpoint identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier
 * @param {string} applicantId The applicant identifier of the park operation (e.g. the extension number)
 * @param {function} cb The callback function
 */
function parkConversation(extension, convid, applicantId, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' || typeof cb !== 'function' ||
      typeof extension !== 'string' || typeof applicantId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint existence
    if (extensions[extension]) {

      var convs = extensions[extension].getAllConversations();
      var conv = convs[convid];

      var err;
      // check the presence of the conversation
      if (typeof conv !== 'object') {
        err = 'parking the conversation ' + convid + ': no conversation present for exten "' + extension + '"';
        logger.warn(IDLOG, err);
        cb(err);
        return;
      }

      var chSource = conv.getSourceChannel();
      var channel = chSource.getChannel();
      var bridgedChannel = chSource.getBridgedChannel();

      // check if the applicant of the request is an intermediary of the conversation.
      // This is because only caller or called can park the conversation
      if (utilChannel13.extractExtensionFromChannel(channel) !== applicantId &&
        utilChannel13.extractExtensionFromChannel(bridgedChannel) !== applicantId) {

        err = 'applicant extension "' + applicantId + '" not allowed to park a conversation not owned by him ' + convid;
        logger.warn(IDLOG, err);
        cb(err);
        return;
      }

      var chToPark;
      var chToReturn; // channel to return once elapsed the parking timeout
      if (utilChannel13.extractExtensionFromChannel(channel) === applicantId) {
        chToPark = bridgedChannel;
        chToReturn = channel;
      } else {
        chToPark = channel;
        chToReturn = bridgedChannel;
      }

      if (chToPark !== undefined && chToReturn !== undefined) {

        // park the channel
        logger.info(IDLOG, 'execute the park of the channel ' + chToPark + ' of exten ' + extension);
        astProxy.doCmd({
          command: 'parkChannel',
          chToPark: chToPark,
          chToReturn: chToReturn
        }, function (err, resp) {
          try {
            if (err) {
              logger.error(IDLOG, 'parking the channel ' + chToPark + ' by the applicant ' + applicantId);
              cb(err);
              return;
            }
            logger.info(IDLOG, 'channel ' + chToPark + ' has been parked successfully');
            cb(null);

          } catch (e) {
            logger.error(IDLOG, e.stack);
            cb(e);
          }
        });
      } else {
        err = 'getting the channel to park: "' + chToPark + '"';
        logger.error(IDLOG, err);
        cb(err);
      }
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Record an audio file.
 *
 * @method recordAudioFile
 * @param {object} data
 *   @param {string} data.exten The extension to be used for recording
 *   @param {string} data.filepath The path of the audio file to be stored
 * @param {function} cb The callback function
 */
function recordAudioFile(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof cb !== 'function' ||
      typeof data.exten !== 'string' || typeof data.filepath !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.info(IDLOG, 'execute record audio file "' + data.filepath + '" with exten "' + data.exten + '"');
    var cmd = {
      command: 'recordAudioFile',
      context: extensions[data.exten].getContext(),
      exten: data.exten,
      filepath: data.filepath,
      chanType: extensions[data.exten].getChanType()
    };
    astProxy.doCmd(cmd, function (err) {
      try {
        if (err) {
          logger.error(IDLOG, 'recording audio file "' + data.filepath + '" with exten "' + data.exten + '"');
          cb(err);
          return;
        }
        logger.info(IDLOG, 'record audio file "' + data.filepath + '" with exten "' + data.exten + '" has been started');
        cb(null);

      } catch (e) {
        logger.error(IDLOG, e.stack);
        cb(e);
      }
    });
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Alternates the logon and logout of the specified extension in all the queues
 * for which it's a dynamic member.
 *
 * @method inoutDynQueues
 * @param {string} endpointId The endpoint identifier (e.g. the extension number)
 * @param {function} cb The callback function
 */
function inoutDynQueues(endpointId, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' || typeof endpointId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint existence
    if (extensions[endpointId]) {

      logger.info(IDLOG, 'execute inout to all queues in which the ' + endpointId + ' is dynamic');
      astProxy.doCmd({
        command: 'inoutDynQueues',
        context: extensions[endpointId].getContext(),
        exten: endpointId
      }, function (err) {
        try {
          if (err) {
            logger.error(IDLOG, 'inout to all queues for which exten ' + endpointId + ' is dynamic');
            cb(err);
            return;
          }
          logger.info(IDLOG, 'inout to all queues for which exten ' + endpointId + ' is dynamic has been successful');
          cb(null);

        } catch (e) {
          logger.error(IDLOG, e.stack);
          cb(e);
        }
      });
    } else {
      var err = 'inout to all queues in which the endpoint is dynamic: extension not present';
      logger.warn(IDLOG, err);
      cb(err);
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Pause or unpause an extension from a specific queue or from all queues omitting the _queueId_ parameter.
 *
 * @method queueMemberPauseUnpause
 * @param {string} endpointId The endpoint identifier (e.g. the extension number)
 * @param {string} queueId The queue identifier
 * @param {string} reason The textual description of the reason. In the unpause case, simply it's ignored
 * @param {boolean} paused If the extension must be paused or unpaused. If it's true the extension will be paused from the queue
 * @param {function} cb The callback function
 */
function queueMemberPauseUnpause(endpointId, queueId, reason, paused, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof paused !== 'boolean' ||
      typeof endpointId !== 'string' ||
      (typeof queueId !== 'string' && queueId) ||
      typeof reason !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // used to discriminate the output log between the two operation: pause or unpause
    var logWord = (paused ? 'pause' : 'unpause');
    // used to discriminate the presence of the queueId parameter. If it's omitted the pause or unpause
    // is done in all queues
    var logQueue = (queueId ? 'queue "' + queueId + '"' : 'all queues');

    // check the endpoint existence
    if (extensions[endpointId]) {

      let obj = {
        command: 'queueMemberPauseUnpause',
        exten: endpointId,
        reason: reason,
        paused: paused
      };
      // if queueId is omitted the action is done on all queues
      if (queueId) {
        obj.queue = queueId;
      }

      logger.info(IDLOG, 'execute ' + logWord + ' ' + endpointId + ' of ' + logWord);
      astProxy.doCmd(obj, function (err1) {
        try {
          if (err1) {
            var str = logWord + ' extension ' + endpointId + ' from ' + logQueue + ' has been failed: ' + err1.toString();
            cb(str);
          } else {
            logger.info(IDLOG, logWord + ' extension ' + endpointId + ' from ' + logQueue + ' has been successful');
            cb();
          }
        } catch (err2) {
          logger.error(IDLOG, err2.stack);
          cb(err2.stack);
        }
      });
    } else {
      var err = logWord + ' queue member: extension not present';
      logger.warn(IDLOG, err);
      cb(err);
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Returns the list of queues in which the user paused status is active.
 *
 * @method getPausedQueues
 * @param {string} exten The endpoint identifier (e.g. the extension number)
 * @param {function} cb The callback function
 */
function getPausedQueues(exten, cb) {
  try {
    let results = [];
    for (let kq in queues) {
      let agent = queues[kq].getMember(exten);
      if (agent && agent.isInPause()) {
        results.push(kq);
      }
    }
    return results;
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Adds the member to the queue.
 *
 * @method queueMemberAdd
 * @param {string} endpointId The endpoint identifier (e.g. the extension number)
 * @param {string} queueId The queue identifier
 * @param {string} [paused] To pause or not the member initially
 * @param {function} cb The callback function
 */
function queueMemberAdd(endpointId, queueId, paused, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof endpointId !== 'string' ||
      typeof queueId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint existence
    if (extensions[endpointId]) {

      // sequentially executes two operations:
      // 1. add the member to the queue
      // 2. add a new entry into the "asteriskcdrdb.queue_log" database with the name of the member
      // This is used by "queue report" application. Without the second operation asterisk only add
      // an entry with extension identifier data
      async.series([

        // add the member to the queue
        function (callback) {

          var obj1 = {
            command: 'dbGet',
            family: 'QPENALTY',
            key: queueId + '/agents/' + endpointId
          };
          logger.info(IDLOG, 'get agent penalty of exten "' + endpointId + '" of queue "' + queueId + '"');
          astProxy.doCmd(obj1, function (err1, resp) {
            try {
              if (err1 || typeof resp.val === undefined) {
                var str = 'getting agent penalty of exten "' + endpointId + '" of queue "' + queueId + '" has been failed (resp.val=' + resp.val + '): ' + err1.toString();
                callback(str);
              } else {
                var obj2 = {
                  command: 'queueMemberAdd',
                  queue: queueId,
                  exten: endpointId,
                  penalty: resp.val,
                  memberName: extensions[endpointId].getName()
                };
                // add optional parameters
                if (paused) {
                  obj2.paused = paused;
                }
                logger.info(IDLOG, 'execute queue member add of ' + endpointId + ' to queue ' + queueId);
                astProxy.doCmd(obj2, function (err2) {
                  try {
                    if (err2) {
                      var str = 'queue member add of ' + endpointId + ' to queue ' + queueId + ' has been failed: ' + err2.toString();
                      callback(str);
                    } else {
                      logger.info(IDLOG, 'queue member add of ' + endpointId + ' to queue ' + queueId + ' has been successful');
                      callback();
                    }
                  } catch (err3) {
                    logger.error(IDLOG, err3.stack);
                    callback(err3.stack);
                  }
                });
              }
            } catch (err4) {
              logger.error(IDLOG, err4.stack);
              callback(err4.stack);
            }
          });
        },

        // add the entry into the "asteriskcdrdb.queue_log" database
        function (callback) {

          var name = extensions[endpointId].getName();

          var obj3 = {
            command: 'queueLog',
            queue: queueId,
            event: 'ADDMEMBER',
            interface: name,
            message: 'Local/' + endpointId + '@from-queue/n'
          };

          logger.info(IDLOG, 'add new entry in queue_log asterisk db: interface "' + name + '", queue "' + queueId + '" and event "ADDMEMBER"');
          astProxy.doCmd(obj3, function (err4) {
            try {
              if (err4) {
                var str = 'add new entry in "queue_log" asterisk db has been failed: interface "' + name + '", queue "' + queueId + '" and event "ADDMEMBER": ' + err4.toString();
                callback(str);

              } else {
                logger.info(IDLOG, 'add new entry in "queue_log" asterisk db has been successful: interface "' + name + '", queue "' + queueId + '" and event "ADDMEMBER"');
                callback();
              }

            } catch (err5) {
              logger.error(IDLOG, err5.stack);
              callback(err5.stack);
            }
          });
        }

      ], function (err6) {

        if (err6) {
          logger.error(IDLOG, err6);
        }
        cb(err6);
      });

    } else {
      var str = 'queue member add of ' + endpointId + ' to queue ' + queueId + ': extension not present';
      logger.warn(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err.stack);
  }
}

/**
 * Removes the extension from a specific queue.
 *
 * @method queueMemberRemove
 * @param {string} endpointId The endpoint identifier (e.g. the extension number)
 * @param {string} queueId The queue identifier
 * @param {function} cb The callback function
 */
function queueMemberRemove(endpointId, queueId, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof endpointId !== 'string' ||
      typeof queueId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint existence
    if (extensions[endpointId]) {

      var obj = {};

      // sequentially executes two operations:
      // 1. remove the member from the queue
      // 2. add a new entry into the "asteriskcdrdb.queue_log" database with the name of the member
      // This is used by "queue report" application. Without the second operation asterisk only add
      // an entry with extension identifier data
      async.series([

        // remove the member from the queue
        function (callback) {

          obj = {
            command: 'queueMemberRemove',
            queue: queueId,
            exten: endpointId
          };

          logger.info(IDLOG, 'execute queue member remove of ' + endpointId + ' from queue ' + queueId);
          astProxy.doCmd(obj, function (err1) {
            try {
              if (err1) {
                var str = 'queue member remove of ' + endpointId + ' from queue ' + queueId + ' has been failed: ' + err1.toString();
                callback(str);

              } else {
                logger.info(IDLOG, 'queue member remove of ' + endpointId + ' from queue ' + queueId + ' has been successful');
                callback();
              }

            } catch (err2) {
              logger.error(IDLOG, err2.stack);
              cb(err2.stack);
            }
          });
        },

        // add the entry into the "asteriskcdrdb.queue_log" database
        function (callback) {

          var name = extensions[endpointId].getName();

          obj = {
            command: 'queueLog',
            queue: queueId,
            event: 'REMOVEMEMBER',
            interface: name,
            message: 'Local/' + endpointId + '@from-queue/n'
          };

          logger.info(IDLOG, 'add new entry in queue_log asterisk db: interface "' + name + '", queue "' + queueId + '" and event "REMOVEMEMBER"');
          astProxy.doCmd(obj, function (err3) {
            try {
              if (err3) {
                var str = 'add new entry in "queue_log" asterisk db has been failed: interface "' + name + '", queue "' + queueId + '" and event "REMOVEMEMBER": ' + err3.toString();
                callback(str);

              } else {
                logger.info(IDLOG, 'add new entry in "queue_log" asterisk db has been successful: interface "' + name + '", queue "' + queueId + '" and event "REMOVEMEMBER"');
                callback();
              }

            } catch (err4) {
              logger.error(IDLOG, err4.stack);
              callback(err4.stack);
            }
          });
        }

      ], function (err5) {

        if (err5) {
          logger.error(IDLOG, err5);
        }

        cb(err5);
      });

    } else {
      var err = 'queue member remove of ' + endpointId + ' from queue ' + queueId + ': extension not present';
      logger.warn(IDLOG, err);
      cb(err);
    }

  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Returns all the queue identifiers to which the specified extension belongs.
 *
 * @method getQueueIdsOfExten
 * @param  {string} extenId The extension identifier
 * @return {object} The queue identifier list as keys of an object.
 */
function getQueueIdsOfExten(extenId) {
  try {
    // check parameters
    if (typeof extenId !== 'string') {
      throw new Error('wrong parameter extenId "' + extenId + '"');
    }

    var q, allMembers;
    var result = {};

    // check the endpoint existence
    if (extensions[extenId]) {

      for (q in queues) {

        // all member of current queue
        allMembers = queues[q].getAllMembers();

        // check if the specified extension is present in the member list of current queue.
        // If it is, it is added to the result to be returned
        if (extenId in allMembers) {
          result[q] = "";
        }
      }
    }
    return result;

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Checks if the specified extension is a dynamic member of the specified queue.
 *
 * @method isExtenDynMemberQueue
 * @param  {string}  extenId The extension identifier
 * @param  {string}  queueId The queue identifier
 * @return {boolean} True if the specified extension is a dynamic member of the specified queue.
 */
function isExtenDynMemberQueue(extenId, queueId) {
  try {
    // check parameters
    if (typeof extenId !== 'string' || typeof queueId !== 'string') {
      throw new Error('wrong parameters extenId "' + extenId + '", queueId "' + queueId + '"');
    }

    if (!queues[queueId]) {
      logger.warn(IDLOG, 'checking if the exten "' + extenId + '" is dynamic member of non existent queue "' + queueId + '"');
      return false;
    }

    // all member of the queue
    var allMembers = queues[queueId].getAllMembers();
    if (extenId in allMembers) {

      return allMembers[extenId].isDynamic();

    } else {
      logger.warn(IDLOG, 'checking if the exten "' + extenId + '" is a dynamic member of queue "' + queueId + '": it is not its member');
    }
    return false;

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Checks if the specified queue dynamic member is logged into the specified queue.
 *
 * @method isDynMemberLoggedInQueue
 * @param  {string}  extenId The extension identifier
 * @param  {string}  queueId The queue identifier
 * @return {boolean} True if the specified queue dynamic member is logged into the specified queue.
 */
function isDynMemberLoggedInQueue(extenId, queueId) {
  try {
    // check parameters
    if (typeof extenId !== 'string' || typeof queueId !== 'string') {
      throw new Error('wrong parameters extenId "' + extenId + '", queueId "' + queueId + '"');
    }

    if (!queues[queueId]) {
      logger.warn(IDLOG, 'checking if the queue dyn member "' + extenId + '" is logged into non existent queue "' + queueId + '"');
      return false;
    }

    // all member of the queue
    var m = queues[queueId].getMember(extenId);
    if (m) {
      return m.isLoggedIn();
    } else {
      logger.warn(IDLOG, 'checking if the queue dyn member "' + extenId + '" is logged into the queue "' + queueId + '": it is not its member');
    }
    return false;

  } catch (err) {
    logger.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Stop the recording of the conversation.
 *
 * @method stopRecordConversation
 * @param {string} extension The extension identifier (e.g. the extension number)
 * @param {string} convid The conversation identifier
 * @param {function} cb The callback function
 */
function stopRecordConversation(extension, convid, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' ||
      typeof cb !== 'function' ||
      typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var str;
    // check the endpoint existence
    if (extensions[extension]) {

      // get the channel to stop record
      var chid = getExtenIdSourceChannelConversation(extension, convid);

      if (recordingConv[convid] === undefined) {
        str = 'the conversation ' + convid + ' is not recording';
        logger.info(IDLOG, str);
        cb(str);

      } else if (chid) {
        // start the recording
        logger.info(IDLOG, 'execute the stop record of the channel ' + chid + ' of exten ' + extension);
        astProxy.doCmd({
          command: 'stopRecordCall',
          channel: chid
        }, function (err) {
          cb(err);
          stopRecordCallCb(err, convid);
        });

      } else {
        str = 'no channel to stop record of conversation ' + convid + ' of exten ' + extension;
        logger.warn(IDLOG, str);
        cb(str);
      }

    } else {
      str = 'try to stop record conversation for the non existent endpoint ' + extension;
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    cb(err);
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Start the spy of the conversation with speaking.
 *
 * @method startSpySpeakConversation
 * @param {string} convid The conversation identifier
 * @param {string} endpointId The endpoint identifier that has the conversation to spy
 * @param {string} destId The endpoint identifier that spy the conversation
 * @param {function} cb The callback function
 */
function startSpySpeakConversation(endpointId, convid, destId, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' || typeof cb !== 'function' ||
      typeof destId !== 'string' || typeof endpointId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint and dest
    if (extensions[endpointId] && // the extension to spy exists
      extensions[destId]) { // the extension that want to spy exists

      var convs = extensions[endpointId].getAllConversations();
      var conv = convs[convid];
      var chSource = conv.getSourceChannel();
      var chToSpy = ((chSource.getChannel()).split('/')[1]).split('-')[0] === endpointId ? chSource.getChannel() : chSource.getBridgedChannel();
      var spyChanType = extensions[destId].getChanType();
      var spierId = spyChanType + '/' + destId;

      // start to spy
      logger.info(IDLOG, 'execute the spy with only listening from ' + destId + ' of the channel ' + chToSpy + ' of exten ' + endpointId);
      astProxy.doCmd({
        command: 'spySpeak',
        spierId: spierId,
        spiedId: endpointId,
        chToSpy: chToSpy
      }, function (err) {
        cb(err);
        startSpySpeakConvCb(err, convid);
      });

    } else {
      logger.warn(IDLOG, 'spy speak conversation of ' + endpointId + ' from ' + destId);
      cb();
    }
  } catch (err) {
    cb();
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Start the spy of the conversation with only listening.
 *
 * @method startSpyListenConversation
 * @param {string} convid The conversation identifier
 * @param {string} endpointId The endpoint identifier that has the conversation to spy
 * @param {string} destId The endpoint identifier that spy the conversation
 * @param {function} cb The callback function
 */
function startSpyListenConversation(endpointId, convid, destId, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' ||
      typeof cb !== 'function' ||
      typeof destId !== 'string' ||
      typeof endpointId !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the endpoint and dest
    if (extensions[endpointId] && extensions[destId]) { // the extension to spy exists
      var convs = extensions[endpointId].getAllConversations();
      var conv = convs[convid];
      var chSource = conv.getSourceChannel();
      var callerNum = chSource.getCallerNum();
      var chToSpy = callerNum === endpointId ? chSource.getChannel() : chSource.getBridgedChannel();
      var spyChanType = extensions[destId].getChanType();
      var spierId = spyChanType + '/' + destId;

      // start to spy
      logger.info(IDLOG, 'execute the spy with only listening from ' + destId + ' of the channel ' + chToSpy + ' of exten ' + endpointId);
      astProxy.doCmd({
        command: 'spyListen',
        spierId: spierId,
        spiedId: endpointId,
        chToSpy: chToSpy
      }, function (err) {
        cb(err);
        startSpyListenConvCb(err, convid);
      });
    } else {
      var str = 'spy listen conversation of ' + endpointId + ' from ' + destId;
      logger.warn(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    cb(err);
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Mute the recording of the conversation.
 *
 * @method muteRecordConversation
 * @param {string}   extension   The extension identifier (e.g. the extension number)
 * @param {string}   convid       The conversation identifier
 * @param {function} cb           The callback function
 */
function muteRecordConversation(extension, convid, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' ||
      typeof cb !== 'function' ||
      typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var str;
    // check the endpoint existence
    if (extensions[extension]) {

      // get the channel to record
      var ch = getExtenSourceChannelConversation(extension, convid);

      // check if the conversation is already recording
      if (recordingConv[convid] === undefined) {
        logger.info(IDLOG, 'the conversation ' + convid + ' is not recording, so it can not be mute');
        cb();

      } else if (ch) {

        var chid = ch.getChannel(); // the channel identifier

        // start the recording
        logger.info(IDLOG, 'mute the recording of convid "' + convid + '" of extension "' + extension + '" with channel ' + chid);
        astProxy.doCmd({
          command: 'muteRecordCall',
          channel: chid
        }, function (err) {
          try {
            if (err) {
              logger.error(IDLOG, 'muting recording of convid "' + convid + '" of extension "' + extension + '" with channel ' + chid);
              cb(err);
              return;
            }
            logger.info(IDLOG, 'mute the recording of convid "' + convid + '" of extension "' + extension + '" with channel ' + chid + ' has been successfully');

            // set the recording status mute of all conversations with specified convid
            setRecordStatusMuteConversations(convid);
            cb();

          } catch (e) {
            logger.error(IDLOG, e.stack);
            cb(e);
          }
        });
      } else {
        str = 'no channel to mute record of conversation ' + convid + ' of exten ' + extension;
        logger.warn(IDLOG, str);
        cb(str);
      }
    } else {
      str = 'try to mute the record conversation for the non existent endpoint ' + extension;
      logger.warn(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    cb(err);
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Unmute the recording of the conversation.
 *
 * @method unmuteRecordConversation
 * @param {string}   extension   The extension identifier (e.g. the extension number)
 * @param {string}   convid       The conversation identifier
 * @param {function} cb           The callback function
 */
function unmuteRecordConversation(extension, convid, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' ||
      typeof cb !== 'function' ||
      typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var str;
    // check the endpoint existence
    if (extensions[extension]) {

      // get the channel to record
      var ch = getExtenSourceChannelConversation(extension, convid);

      // check if the conversation is already recording
      if (recordingConv[convid] === undefined) {
        logger.info(IDLOG, 'the conversation ' + convid + ' is not recording, so it can not be unmute');
        cb();

      } else if (ch) {

        var chid = ch.getChannel(); // the channel identifier

        // start the recording
        logger.info(IDLOG, 'unmute the recording of convid "' + convid + '" of extension "' + extension + '" with channel ' + chid);
        astProxy.doCmd({
          command: 'unmuteRecordCall',
          channel: chid
        }, function (err) {
          try {
            if (err) {
              logger.error(IDLOG, 'unmuting recording of convid "' + convid + '" of extension "' + extension + '" with channel ' + chid);
              cb(err);
              return;
            }
            logger.info(IDLOG, 'unmuting the recording of convid "' + convid + '" of extension "' + extension + '" with channel ' + chid + ' has been successfully');
            recordingConv[convid] = RECORDING_STATUS.TRUE;
            // set the recording status of all conversations with specified convid
            setRecordStatusConversations(convid, true);
            cb();

          } catch (e) {
            logger.error(IDLOG, e.stack);
            cb(e);
          }
        });
      } else {
        str = 'no channel to unmute record of conversation ' + convid + ' of exten ' + extension;
        logger.warn(IDLOG, str);
        cb(str);
      }
    } else {
      str = 'try to unmute the record conversation for the non existent endpoint ' + extension;
      logger.warn(IDLOG, str);
      cb(str);
    }
  } catch (err) {
    cb(err);
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Starts the recording of the conversation.
 *
 * @method startRecordConversation
 * @param {string}   extension    The extension identifier (e.g. the extension number)
 * @param {string}   convid       The conversation identifier
 * @param {function} cb           The callback function
 */
function startRecordConversation(extension, convid, cb) {
  try {
    // check parameters
    if (typeof convid !== 'string' ||
      typeof cb !== 'function' ||
      typeof extension !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var str;
    // check the endpoint existence
    if (extensions[extension]) {

      // get the channel to record
      var ch = getExtenSourceChannelConversation(extension, convid);
      // get the name of the audio file
      var now = new Date();
      var filename = getRecordFilename(extension, convid, now);
      var filepath = getRecordFilepath(extension, convid, now);

      // check if the conversation is already recording
      if (recordingConv[convid] !== undefined) {
        logger.info(IDLOG, 'the conversation ' + convid + ' is already recording');
        cb();

      } else if (ch) {

        var chid = ch.getChannel(); // the channel identifier

        logger.info(IDLOG, 'set asterisk variables to record the convid "' + convid + '" of extension "' + extension + '"');
        // set some asterisk variables to fill the "recordingfile" field of the
        // asteriskcdrdb.cdr database table and then record the conversation
        async.series([

          // set the asterisk variables
          function (callback) {

            logger.info(IDLOG, 'set "MASTER_CHANNEL(ONETOUCH_REC)" asterisk variable');
            astProxy.doCmd({
              command: 'setVariable',
              name: 'MASTER_CHANNEL(ONETOUCH_REC)',
              value: 'RECORDING',
              channel: chid
            }, function (err) {
              try {
                if (err) {
                  callback(err);
                } else {
                  callback();
                }

              } catch (e) {
                logger.error(IDLOG, e.stack);
                callback(e);
              }
            });
          },

          function (callback) {

            logger.info(IDLOG, 'set "MASTER_CHANNEL(REC_STATUS)" asterisk variable');
            astProxy.doCmd({
              command: 'setVariable',
              name: 'MASTER_CHANNEL(REC_STATUS)',
              value: 'RECORDING',
              channel: chid
            }, function (err) {
              try {
                if (err) {
                  callback(err);
                } else {
                  callback();
                }

              } catch (e) {
                logger.error(IDLOG, e.stack);
                callback(e);
              }
            });
          },

          function (callback) {

            logger.info(IDLOG, 'set "MASTER_CHANNEL(CDR(recordingfile))" asterisk variable with filename "' + filename + '"');
            astProxy.doCmd({
              command: 'setVariable',
              name: 'MASTER_CHANNEL(CDR(recordingfile))',
              value: filename,
              channel: chid
            }, function (err) {
              try {
                if (err) {
                  callback(err);
                } else {
                  callback();
                }

              } catch (e) {
                logger.error(IDLOG, e.stack);
                callback(e);
              }
            });
          },

          function (callback) {

            logger.info(IDLOG, 'set "MASTER_CHANNEL(CDR(recordingfile))" asterisk variable');
            astProxy.doCmd({
              command: 'setVariable',
              name: 'MASTER_CHANNEL(ONETOUCH_RECFILE)',
              value: filename,
              channel: chid
            }, function (err) {
              try {
                if (err) {
                  callback(err);
                } else {
                  callback();
                }

              } catch (e) {
                logger.error(IDLOG, e.stack);
                callback();
              }
            });
          }

        ], function (err) {

          if (err) {
            logger.error(IDLOG, 'setting asterisk variables to record the convid "' + convid + '" of extension "' + extension + '"');
            return;
          }

          logger.info(IDLOG, 'asterisk variables to record the convid "' + convid + '" of extension "' + extension + '" has been set');

          // start the recording
          logger.info(IDLOG, 'record the convid "' + convid + '" of extension "' + extension + '"');
          astProxy.doCmd({
            command: 'recordCall',
            channel: chid,
            filepath: filepath
          }, function (err) {
            try {
              if (err) {
                logger.error(IDLOG, 'recording the convid "' + convid + '" of extension "' + extension + '"');
                cb(err);
                return;
              }
              logger.info(IDLOG, 'record the convid "' + convid + '" of extension "' + extension + '" has been successfully started in ' + filepath);

              // set the recording status of the conversation
              startRecordCallCb(convid);
              cb();

            } catch (e) {
              logger.error(IDLOG, e.stack);
              cb(e);
            }
          });
        });

      } else {
        str = 'no channel to record of conversation ' + convid + ' of exten ' + extension;
        logger.warn(IDLOG, str);
        cb(str);
      }

    } else {
      str = 'extension ' + extension + 'doesn\'t exist';
      logger.warn(IDLOG, str);
      cb(str);
    }

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * This is the callback of the stop record call command plugin.
 * Reset the record status of the conversations.
 *
 * @method stopRecordCallCb
 * @param {object} err    The error object of the operation
 * @param {string} convid The conversation identifier
 * @private
 */
function stopRecordCallCb(err, convid) {
  try {
    if (err) {
      logger.error(IDLOG, 'stop record convid ' + convid + ' failed: ' + err.toString());

    } else {
      logger.info(IDLOG, 'stop record convid ' + convid + ' started succesfully');

      // remove the recording status of the conversation
      delete recordingConv[convid];
      // reset the recording status of all conversations with specified convid
      setRecordStatusConversations(convid, false);
    }
  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the recording status of the conversations.
 *
 * @method startRecordCallCb
 * @param {string} convid The conversation identifier
 * @private
 */
function startRecordCallCb(convid) {
  try {
    // set the recording status of the conversation to memory
    recordingConv[convid] = RECORDING_STATUS.TRUE;
    // set the recording status of all conversations with specified convid
    setRecordStatusConversations(convid, true);

  } catch (error) {
    logger.error(IDLOG, error.stack);
  }
}

/**
 * Sets the recording status of all the conversations with the specified convid.
 *
 * @method setRecordStatusConversations
 * @param {string} convid The conversation identifier
 * @param {boolean} value The value to be set
 * @private
 */
function setRecordStatusConversations(convid, value) {
  try {
    // check parameters
    if (typeof convid !== 'string' || typeof value !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // set the recording status of all the conversations with the specified convid
    var exten, convs, cid;
    for (exten in extensions) { // cycle in all extensions

      // get all the conversations of the current extension
      convs = extensions[exten].getAllConversations();
      if (convs) {

        // cycle in all conversations
        for (cid in convs) {
          // if the current conversation identifier is the
          // same of that specified, set its recording status
          if (cid === convid) {
            convs[convid].setRecording(value);
            logger.info(IDLOG, 'set recording status ' + value + ' to conversation ' + convid);

            // emit the event
            logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
            astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
          }
        }
      }
    }

    var trunk;
    for (trunk in trunks) { // cycle in all trunks

      // get all the conversations of the current trunk
      convs = trunks[trunk].getAllConversations();
      if (convs) {

        // cycle in all conversations
        for (cid in convs) {
          // if the current conversation identifier is the
          // same of that specified, set its recording status
          if (cid === convid) {
            convs[convid].setRecording(value);
            logger.info(IDLOG, 'set recording status ' + value + ' to conversation ' + convid);

            // emit the event
            logger.info(IDLOG, 'emit event ' + EVT_TRUNK_CHANGED + ' for trunk ' + trunk);
            astProxy.emit(EVT_TRUNK_CHANGED, trunks[trunk]);
          }
        }
      }
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Sets the recording status mute of all the conversations with the specified convid.
 *
 * @method setRecordStatusMuteConversations
 * @param {string} convid The conversation identifier
 * @private
 */
function setRecordStatusMuteConversations(convid) {
  try {
    // check parameter
    if (typeof convid !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // set the recording status mute of all the conversations with the specified convid
    var exten, convs, cid;
    for (exten in extensions) { // cycle in all extensions

      // get all the conversations of the current extension
      convs = extensions[exten].getAllConversations();
      if (convs) {

        // cycle in all conversations
        for (cid in convs) {
          // if the current conversation identifier is the
          // same of that specified, set its recording status to mute
          if (cid === convid) {
            recordingConv[convid] = RECORDING_STATUS.MUTE;
            convs[convid].setRecordingMute();
            logger.info(IDLOG, 'set recording status "mute" to conversation ' + convid);

            // emit the event
            logger.info(IDLOG, 'emit event ' + EVT_EXTEN_CHANGED + ' for extension ' + exten);
            astProxy.emit(EVT_EXTEN_CHANGED, extensions[exten]);
          }
        }
      }
    }

    var trunk;
    for (trunk in trunks) { // cycle in all trunks

      // get all the conversations of the current trunk
      convs = trunks[trunk].getAllConversations();
      if (convs) {

        // cycle in all conversations
        for (cid in convs) {
          // if the current conversation identifier is the
          // same of that specified, set its recording status to mute
          if (cid === convid) {
            recordingConv[convid] = RECORDING_STATUS.MUTE;
            convs[convid].setRecordingMute();
            logger.info(IDLOG, 'set recording status "mute" to conversation ' + convid);

            // emit the event
            logger.info(IDLOG, 'emit event ' + EVT_TRUNK_CHANGED + ' for trunk ' + trunk);
            astProxy.emit(EVT_TRUNK_CHANGED, trunks[trunk]);
          }
        }
      }
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Sends the DTMF tones to the specified extension. If the extension as
 * already busy in a conversation, or it's calling, then one channel already
 * exists and then use it to play DTMF. Otherwise, if the extension is free,
 * it calls the extension and then sends the DTMF digits.
 *
 * @method sendDTMFSequence
 * @param {string}   extension The extension identifier
 * @param {boolean}  sequence  The DTMF digits to send to the extension
 * @param {string}   callerid  The caller identifier
 * @param {string}   fromExten The extension identifier from which the command has to be sent
 * @param {function} cb        The callback function
 * @private
 */
function sendDTMFSequence(extension, sequence, callerid, fromExten, cb) {
  try {
    // check parameters
    if (typeof extension !== 'string' ||
      typeof sequence !== 'string' || typeof cb !== 'function' ||
      typeof callerid !== 'string' || typeof fromExten !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check if the extension exists
    if (!extensions[extension]) {
      logger.warn(IDLOG, 'sending DTMF sequence to non existing extension ' + extension);
      cb(extension + ' doesn\'t exist');
      return;
    }

    // get the channel type (sip, iax, ...) of the extension
    var chanType = extensions[extension].getChanType();

    var tyext = chanType + '/' + extension;

    // gets all the active channels. If a channel of the extension already exists then
    // play DTMF tones on that channel, otherwise it calls the extension and then sends
    // the DMTF tones
    astProxy.doCmd({
      command: 'listChannels'
    }, function (err, resp) {
      try {
        if (err) {
          cb(err);
          return;
        }

        // cycle in all the active channels to check if there is a channel of the extension
        var ch;
        var chdtmf;
        for (ch in resp) {

          // check if the channel is owned by the extension
          if (ch.substring(0, tyext.length).toLowerCase() === tyext) {
            chdtmf = ch;
            break;
          }
        }

        if (chdtmf) {
          sendDTMFSequenceToChannel(chdtmf, sequence, cb);
        } else {
          callAndSendDTMFSequence(chanType, extension, sequence, callerid, fromExten, cb);
        }

      } catch (e) {
        logger.error(IDLOG, e.stack);
        cb(e);
      }
    });

  } catch (error) {
    logger.error(IDLOG, error.stack);
    cb(error);
  }
}

/**
 * Play sequence of DTMF digits in the specified channel.
 *
 * @method sendDTMFSequenceToChannel
 * @param {string}   channel  The channel to play DTMF tones
 * @param {string}   sequence The sequence of DTMF tones
 * @param {function} cb The callback function
 * @private
 */
function sendDTMFSequenceToChannel(channel, sequence, cb) {
  try {
    // check parameters
    if (typeof channel !== 'string' ||
      typeof sequence !== 'string' || typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get the array from string
    var arrSequence = sequence.split('');

    // delay between to sequential DTMF tones
    var DTMF_DELAY = 300;

    // play DTMF tone for each digits
    async.eachSeries(arrSequence, function (digit, seriesCb) {

      setTimeout(function () {

        // play one DTMF digit into the specified channel
        astProxy.doCmd({
          command: 'playDTMF',
          channel: channel,
          digit: digit
        }, function (err) {

          if (err) {
            logger.error(IDLOG, 'playing DTMF digit "' + digit + '" to channel ' + channel);
            seriesCb(err);

          } else {
            logger.info(IDLOG, 'played DTMF digit "' + digit + '" to channel ' + channel + ' successfully');
            seriesCb();
          }
        });

      }, DTMF_DELAY);

    }, function (err) {

      if (err) {
        logger.error(IDLOG, 'playing DTMF sequence "' + sequence + '" to channel ' + channel + ': ' + err.toString());
        cb(err);
      } else {
        logger.info(IDLOG, 'played DTMF sequence "' + sequence + '" to channel ' + channel + ' successfully');
        cb(null);
      }
    });

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Call and then send sequence of DTMF digits to the specified extension.
 *
 * @method callAndSendDTMFSequence
 * @param {string}   chanType  The technology of the channel (e.g. SIP, IAX, ...)
 * @param {string}   extension The extension identifier
 * @param {string}   sequence  The sequence of DTMF tones
 * @param {string}   callerid  The caller identifier
 * @param {string}   fromExten The extension identifier from which the command has to be sent
 * @param {function} cb        The callback function
 * @private
 */
function callAndSendDTMFSequence(chanType, extension, sequence, callerid, fromExten, cb) {
  try {
    // check parameters
    if (typeof chanType !== 'string' || typeof fromExten !== 'string' ||
      typeof cb !== 'function' || typeof callerid !== 'string' ||
      typeof extension !== 'string' || typeof sequence !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // call the extension and send DTMF sequence
    var opts = {
      command: 'callAndSendDTMF',
      chanType: chanType,
      exten: extension,
      context: extensions[fromExten].getContext(),
      sequence: sequence,
      callerid: callerid
    };
    astProxy.doCmd(opts, function (err) {
      try {
        if (err) {
          logger.error(IDLOG, 'calling and sending DTMF sequence "' + sequence + '" to ' + chanType + ' ' + extension + ' with callerid ' + callerid);
          cb(err);
        } else {
          logger.info(IDLOG, 'calling and sending DTMF sequence "' + sequence + '" to ' + chanType + ' ' + extension + ' with callerid ' + callerid + ' has successful');
          cb();
        }

      } catch (error) {
        logger.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Returns the destination number to compose to make a new echo call.
 *
 * @method getEchoCallDestination
 * @return {string} The destination number to compose to make a new echo call.
 */
function getEchoCallDestination() {
  try {
    return '*43';
  } catch (e) {
    logger.error(IDLOG, e.stack);
  }
}

/**
 * Returns the extensions involved in the specified conversation.
 *
 * @method getExtensionsFromConversation
 * @param  {string} convid The conversation identifier
 * @param  {string} exten  The extension identifier which has the conversation
 * @return {array}  The extensions involved in the conversation.
 * @private
 */
function getExtensionsFromConversation(convid, exten) {
  try {
    // check parameters
    if (typeof convid !== 'string' || typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var result = [];

    // check the extension existence
    if (extensions[exten]) {

      // check if the extension has the specified conversation
      var conv = extensions[exten].getConversation(convid);
      if (typeof conv !== 'object') {
        logger.warn(IDLOG, 'getting extensions from convid ' + convid + ': no conversation in extension ' + exten);
        return result;
      }
      result.push(exten);

      // get the other number of the conversation and check if it's an extension number
      var chSource = conv.getSourceChannel();
      if (typeof chSource !== 'object') {
        logger.warn(IDLOG, 'getting extensions from convid ' + convid + ': no source channel in conversation of extension ' + exten);
        return result;
      }

      // get the other number of the conversation
      var numToCheckExten = chSource.getCallerNum() === exten ? chSource.getBridgedNum() : chSource.getCallerNum();

      // check if the other number is an extension and if it has the specified conversation
      if (extensions[numToCheckExten]) {

        // to check whether the number is an extension, check if it has the specified conversation
        if (extensions[numToCheckExten].getConversation(convid)) {
          result.push(numToCheckExten);
        }
      }

    } else {
      logger.warn(IDLOG, 'getting the extensions of the convid ' + convid + ' from extension ' + exten + ': no extension ' + exten + ' present');
    }
    return result;

  } catch (e) {
    logger.error(IDLOG, e.stack);
    return [];
  }
}

/**
 * Returns the base path of the call recording audio files.
 *
 * @method getBaseCallRecAudioPath
 * @return {string} The base path of the call recording audio files.
 */
function getBaseCallRecAudioPath() {
  try {
    return BASE_CALL_REC_AUDIO_PATH;
  } catch (e) {
    logger.error(IDLOG, e.stack);
  }
}

/**
 * setAsteriskPresence
 *
 * @method setAsteriskPresence
 * @param {string}   extension   The endpoint identifier (e.g. the extension number)
 * @param {string}   presenceState   The state of presence [ AVAILABLE | DND | AWAY,CELLPHONE | XA,VOICEMAIL ]
 * @param {function} cb              The callback function
 */
function setAsteriskPresence(extension, presenceState, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof extension !== 'string' ||
      typeof presenceState !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.info(IDLOG, 'Set Asterisk Presence state to ' + presenceState + ' for user ' + extension);
    astProxy.doCmd({
      command: 'setPresenceState',
      exten: extension,
      state: presenceState
    }, function (error) {
      cb(error);
    });
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Create an alarm for a specified date, time and extension.
 *
 * @method createAlarm
 * @param {object} params
 *  @param {string} params.extension The endpoint identifier (e.g. the extension number)
 *  @param {string} params.time The time of the alarm. Use hh:mm in 24 format
 *  @param {string} params.date The date of the alarm. Use YYYYMMDD format
 *  @param {string} [params.maxRetries] Number of retries before failing
 *  @param {string} [params.retryTime] Seconds between retries
 *  @param {string} [params.waitTime] Seconds to wait for an answer
 * @param {function} cb The callback function
 */
function createAlarm(params, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof params.extension !== 'string' ||
      typeof params.date !== 'string' ||
      typeof params.time !== 'string' ||
      (params.maxRetries && typeof params.maxRetries !== 'string' && typeof params.maxRetries !== 'number') ||
      (params.retryTime && typeof params.retryTime !== 'string' && typeof params.retryTime !== 'number') ||
      (params.waitTime && typeof params.waitTime !== 'string' && typeof params.waitTime !== 'number')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var timestamp = moment(params.date + params.time, 'YYYYMMDDhh:mm').unix();
    var filename = params.extension + '-' + timestamp + '.call';
    var filepath = path.join(AST_ALARMS_DIRPATH, filename);
    var content = [
      'Channel: Local/', params.extension, '@from-internal\n',
      'MaxRetries: ' + (params.maxRetries ? params.maxRetries : '5') + '\n',
      'RetryTime: ' + (params.retryTime ? params.retryTime : '60') + '\n',
      'WaitTime: ' + (params.waitTime ? params.waitTime : '30') + '\n',
      'CallerID: \'Sveglia\' <Sveglia>\n',
      // 'Set: CAMERA=', extension, '\n',
      // 'Set: RECEPTION=\n',
      'Set: ALARM=', timestamp, '\n',
      'Set: CALLERID(name)=SVEGLIA\n',
      'Context: sveglia\n',
      'Priority: 1\n',
      'Extension: s\n'
    ].join('');

    // create temporary file into the current directory
    var tmpfilepath = path.join(os.tmpdir(), filename);
    fs.writeFile(tmpfilepath, content, function (err) {
      if (err) {
        logger.error(IDLOG, 'creating alarm for "' + params.extension + '" on ' + params.date + ' - ' + params.time + ' (' + timestamp + ')');
        cb(err);
        return;
      }
      // set the file timestamp
      fs.utimes(tmpfilepath, timestamp, timestamp, function (err2) {
        if (err2) {
          logger.error(IDLOG, 'creating alarm for "' + params.extension + '" on ' + params.date + ' - ' + params.time + ' (' + timestamp + ')');
          cb(err);
          return;
        }
        // move the file to the correct asterisk destination
        fs.rename(tmpfilepath, filepath, function () {
          logger.info(IDLOG, 'created alarm for "' + params.extension + '" on ' + params.date + ' - ' + params.time + ' (' + timestamp + ')');
          cb();
        });
      });
    });
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Get the list of all alarms wakeup.
 *
 * @method getAlarms
 * @param {function} cb The callback function
 */
function getAlarms(cb) {
  try {
    // check parameters
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    fs.readdir(AST_ALARMS_DIRPATH, function (err, files) {
      if (err) {
        logger.error(IDLOG, 'getting the list of all alarms');
        cb(err);
        return;
      }
      cb(null, files);
    });
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Delete an alarm wakeup.
 *
 * @method deleteAlarm
 * @param {string} filename The alarm filename
 * @param {function} cb The callback function
 */
function deleteAlarm(filename, cb) {
  try {
    // check parameters
    if (typeof filename !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var filepath = path.join(AST_ALARMS_DIRPATH, filename);
    fs.unlink(filepath, function (err) {
      if (err) {
        logger.error(IDLOG, 'deleting alarm wakeup ' + filepath);
        cb(err);
        return;
      }
      logger.info(IDLOG, 'deleted alarm wakeup ' + filepath);
      cb();
    });
  } catch (e) {
    logger.error(IDLOG, e.stack);
    cb(e);
  }
}

/**
 * Disable the events trunks management.
 *
 * @method disableTrunksEvents
 */
function disableTrunksEvents() {
  try {
    trunksEventsEnabled = false;
  } catch (e) {
    logger.error(IDLOG, e.stack);
  }
}

/**
 * Set reloading property.
 *
 * @method setReloading
 * @param {boolean} value The reloading value
 */
function setReloading(value) {
  try {
    reloading = value;
  } catch (e) {
    logger.error(IDLOG, e.stack);
  }
}

/**
 * Set the association between the extension and username for all extensions.
 *
 * @method setAllExtensionsUsername
 * @param {object} assoc Keys are exten id and values are the usernames
 */
function setAllExtensionsUsername(assoc) {
  try {
    logger.info(IDLOG, 'start setting username to extensions');
    let objToUse = isReloading() ? tempExtensions : extensions; // based on boot or reload time
    for (let exten in assoc) {
      if (objToUse[exten]) {
        objToUse[exten].setUsername(assoc[exten]);
      } else {
        logger.warn(IDLOG, `setting username ${assoc[exten]} to exten ${exten}`);
      }
    }
    if (isReloading()) {
      // switch tempExtensions into extensions: this phase is executed only during reload
      for (let k in extensions) {
        delete extensions[k];
        extensions[k] = undefined;
      }
      extensions = undefined;
      extensions = tempExtensions;
      tempExtensions = undefined;
      tempExtensions = {};
      setReloading(false);
    }
    logger.info(IDLOG, 'end setting username to extensions');
  } catch (e) {
    logger.error(IDLOG, e.stack);
  }
}

/**
 * Get the associated username from extension.
 *
 * @method getUsernameByExtension
 * @param {string} exten The extension identifier
 * @return {string} The username.
 */
function getUsernameByExtension(exten) {
  try {
    if (extensions[exten]) {
      return extensions[exten].getUsername();
    }
  } catch (e) {
    logger.error(IDLOG, e.stack);
  }
}

/**
 * Books a recall to a busy extension.
 *
 * @method recallOnBusy
 * @param {string}  caller  The main extension of the caller
 * @param {string}  called  The main extension of the called
 * @param {function}  cb    The callback function
 * @returns {array} The waiting extensions
 */
 function recallOnBusy(caller, called, cb) {
  try {
    // check parameters
    if (typeof caller !== 'string' || typeof called !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // exec command to check the already waiting extensions
    astProxy.doCmd({
      command: 'robGet',
      called: called
    }, function (err, resp) {
      // check command errors
      if (err) {
        cb(err)
      }

      let extensionsWaiting = resp.extensions_waiting ? resp.extensions_waiting.split('&') : []
      // add the caller to the waiting extensions list if not already exists
      if (extensionsWaiting.indexOf(caller) === -1) extensionsWaiting.push(caller)

      // update waiting extensions list
      astProxy.doCmd({
        command: 'robSet',
        called: called,
        extensions_waiting: extensionsWaiting.join('&')
      }, function (err) {
        cb(err, {
          extensions_waiting: extensionsWaiting
        })
      })
    });
  } catch (err) {
    logger.error(IDLOG, err.stack)
    cb(err)
  }
}

// public interface
exports.on = on;
exports.call = call;
exports.start = start;
exports.visit = visit;
exports.reset = reset;
exports.setCfb = setCfb;
exports.setCfu = setCfu;
exports.setDnd = setDnd;
exports.isTrunk = isTrunk;
exports.isExten = isExten;
exports.setCfbVm = setCfbVm;
exports.setCfuVm = setCfuVm;
exports.EVT_READY = EVT_READY;
exports.setLogger = setLogger;
exports.setPrefix = setPrefix;
exports.getPrefix = getPrefix;
exports.addPrefix = addPrefix;
exports.evtRename = evtRename;
exports.evtNewCdr = evtNewCdr;
exports.isExtenCf = isExtenCf;
exports.getAlarms = getAlarms;
exports.isExtenCfb = isExtenCfb;
exports.isExtenCfu = isExtenCfu;
exports.isExtenDnd = isExtenDnd;
exports.recallOnBusy = recallOnBusy;
exports.isExtenCfVm = isExtenCfVm;
exports.EVT_NEW_CDR = EVT_NEW_CDR;
exports.createAlarm = createAlarm;
exports.deleteAlarm = deleteAlarm;
exports.setReloading = setReloading;
exports.EVT_RELOADED = EVT_RELOADED;
exports.isExtenCfbVm = isExtenCfbVm;
exports.isExtenCfuVm = isExtenCfuVm;
exports.getExtensions = getExtensions;
exports.isExtenOnline = isExtenOnline;
exports.extenHasConv = extenHasConv;
exports.getExtenStatus = getExtenStatus;
exports.getConference = getConference;
exports.hangupChannel = hangupChannel;
exports.pickupParking = pickupParking;
exports.getJSONQueues = getJSONQueues;
exports.endMeetmeConf = endMeetmeConf;
exports.opWaitConv = opWaitConv;
exports.getJSONTrunks = getJSONTrunks;
exports.getTrunksList = getTrunksList;
exports.getExtensList = getExtensList;
exports.getQueuesList = getQueuesList;
exports.getQueues = getQueues;
exports.getExtensionIp = getExtensionIp;
exports.queueMemberAdd = queueMemberAdd;
exports.inoutDynQueues = inoutDynQueues;
exports.getJSONParkings = getJSONParkings;
exports.recordAudioFile = recordAudioFile;
exports.redirectParking = redirectParking;
exports.getExtenCfValue = getExtenCfValue;
exports.setFeatureCodes = setFeatureCodes;
exports.getExtenCfbValue = getExtenCfbValue;
exports.getExtenCfuValue = getExtenCfuValue;
exports.EVT_EXTEN_HANGUP = EVT_EXTEN_HANGUP;
exports.muteConversation = muteConversation;
exports.sendDTMFSequence = sendDTMFSequence;
exports.parkConversation = parkConversation;
exports.setC2CMode = setC2CMode;
exports.setNullCallPeriod = setNullCallPeriod;
exports.isAutoC2CEnabled = isAutoC2CEnabled;
exports.getJSONExtension = getJSONExtension;
exports.getExtensionAgent = getExtensionAgent;
exports.getMeetmeConfCode = getMeetmeConfCode;
exports.getJSONExtensions = getJSONExtensions;
exports.queueMemberRemove = queueMemberRemove;
exports.EXTEN_STATUS_ENUM = EXTEN_STATUS_ENUM;
exports.EVT_EXTEN_CHANGED = EVT_EXTEN_CHANGED;
exports.disableTrunksEvents = disableTrunksEvents;
exports.setBlindTransferContext = setBlindTransferContext;
exports.EVT_EXTEN_CF_CHANGED = EVT_EXTEN_CF_CHANGED;
exports.EVT_EXTEN_CFB_CHANGED = EVT_EXTEN_CFB_CHANGED;
exports.EVT_EXTEN_CFU_CHANGED = EVT_EXTEN_CFU_CHANGED;
exports.EVT_EXTEN_CFVM_CHANGED = EVT_EXTEN_CFVM_CHANGED;
exports.EVT_EXTEN_CFBVM_CHANGED = EVT_EXTEN_CFBVM_CHANGED;
exports.EVT_EXTEN_CFUVM_CHANGED = EVT_EXTEN_CFUVM_CHANGED;
exports.EVT_EXTEN_DND_CHANGED = EVT_EXTEN_DND_CHANGED;
exports.EVT_TRUNK_CHANGED = EVT_TRUNK_CHANGED;
exports.EVT_EXTEN_DIALING = EVT_EXTEN_DIALING;
exports.EVT_CALLIN_BY_TRUNK = EVT_CALLIN_BY_TRUNK;
exports.EVT_QUEUE_CHANGED = EVT_QUEUE_CHANGED;
exports.getQueueIdsOfExten = getQueueIdsOfExten;
exports.getJSONAllQueuesStats = getJSONAllQueuesStats;
exports.setQMAlarmsNotificationsStatus = setQMAlarmsNotificationsStatus;
exports.getQMAlarmsNotificationsStatus = getQMAlarmsNotificationsStatus;
exports.unmuteConversation = unmuteConversation;
exports.setUnconditionalCf = setUnconditionalCf;
exports.hangupConversation = hangupConversation;
exports.evtNewExternalCall = evtNewExternalCall;
exports.pickupConversation = pickupConversation;
exports.evtExtenDndChanged = evtExtenDndChanged;
exports.muteUserMeetmeConf = muteUserMeetmeConf;
exports.hangupMainExtension = hangupMainExtension;
exports.evtConversationUnhold = evtConversationUnhold;
exports.evtConversationHold = evtConversationHold;
exports.EVT_EXTEN_CONNECTED = EVT_EXTEN_CONNECTED;
exports.isExtenInMeetmeConf = isExtenInMeetmeConf;
exports.evtRemoveMeetmeConf = evtRemoveMeetmeConf;
exports.evtQueueMemberAdded = evtQueueMemberAdded;
exports.EVT_MEETME_CONF_END = EVT_MEETME_CONF_END;
exports.EVT_PARKING_CHANGED = EVT_PARKING_CHANGED;
exports.setAsteriskPresence = setAsteriskPresence;
exports.setStaticDataTrunks = setStaticDataTrunks;
exports.setStaticDataQueues = setStaticDataQueues;
exports.setStaticDataExtens = setStaticDataExtens;
exports.setMacDataByMac = setMacDataByMac;
exports.setMacDataByExt = setMacDataByExt;
exports.unmuteUserMeetmeConf = unmuteUserMeetmeConf;
exports.hangupUserMeetmeConf = hangupUserMeetmeConf;
exports.evtAddMeetmeUserConf = evtAddMeetmeUserConf;
exports.evtQueueMemberStatus = evtQueueMemberStatus;
exports.setUnconditionalCfVm = setUnconditionalCfVm;
exports.redirectConversation = redirectConversation;
exports.evtMeetmeUserConfMute = evtMeetmeUserConfMute;
exports.isExtenDynMemberQueue = isExtenDynMemberQueue;
exports.EVT_NEW_VOICE_MESSAGE = EVT_NEW_VOICE_MESSAGE;
exports.evtQueueMemberRemoved = evtQueueMemberRemoved;
exports.redirectWaitingCaller = redirectWaitingCaller;
exports.evtHangupConversation = evtHangupConversation;
exports.evtAstShutdown = evtAstShutdown;
exports.evtAstModuleReloaded = evtAstModuleReloaded;
exports.startMeetmeConference = startMeetmeConference;
exports.evtExtenStatusChanged = evtExtenStatusChanged;
exports.evtRegistryChanged = evtRegistryChanged;
exports.evtDeviceStatusChanged = evtDeviceStatusChanged;
exports.setRemoteSitesPrefixes = setRemoteSitesPrefixes;
exports.sendDtmfToConversation = sendDtmfToConversation;
exports.getEchoCallDestination = getEchoCallDestination;
exports.evtNewVoicemailMessage = evtNewVoicemailMessage;
exports.stopRecordConversation = stopRecordConversation;
exports.evtConversationDialing = evtConversationDialing;
exports.evtNewExternalCallIn = evtNewExternalCallIn;
exports.muteRecordConversation = muteRecordConversation;
exports.getUserExtenIdFromConf = getUserExtenIdFromConf;
exports.evtRemoveMeetmeUserConf = evtRemoveMeetmeUserConf;
exports.forceHangupConversation = forceHangupConversation;
exports.evtSpyStartConversation = evtSpyStartConversation;
exports.startRecordConversation = startRecordConversation;
exports.getBaseCallRecAudioPath = getBaseCallRecAudioPath;
exports.queueMemberPauseUnpause = queueMemberPauseUnpause;
exports.EVT_MEETME_CONF_CHANGED = EVT_MEETME_CONF_CHANGED;
exports.EVT_QUEUE_MEMBER_CHANGED = EVT_QUEUE_MEMBER_CHANGED;
exports.pickupQueueWaitingCaller = pickupQueueWaitingCaller;
exports.evtNewQueueWaitingCaller = evtNewQueueWaitingCaller;
exports.evtConversationConnected = evtConversationConnected;
exports.unmuteRecordConversation = unmuteRecordConversation;
exports.isDynMemberLoggedInQueue = isDynMemberLoggedInQueue;
exports.EVT_UPDATE_VOICE_MESSAGES = EVT_UPDATE_VOICE_MESSAGES;
exports.startSpySpeakConversation = startSpySpeakConversation;
exports.blindTransferConversation = blindTransferConversation;
exports.evtConversationInfoChanged = evtConversationInfoChanged;
exports.startSpyListenConversation = startSpyListenConversation;
exports.evtUpdateVoicemailMessages = evtUpdateVoicemailMessages;
exports.evtQueueMemberPausedChanged = evtQueueMemberPausedChanged;
exports.evtRemoveQueueWaitingCaller = evtRemoveQueueWaitingCaller;
exports.attendedTransferConversation = attendedTransferConversation;
exports.getExtensionsFromConversation = getExtensionsFromConversation;
exports.evtExtenUnconditionalCfChanged = evtExtenUnconditionalCfChanged;
exports.transferConversationToVoicemail = transferConversationToVoicemail;
exports.evtExtenUnconditionalCfVmChanged = evtExtenUnconditionalCfVmChanged;
exports.setAllExtensionsUsername = setAllExtensionsUsername;
exports.getUsernameByExtension = getUsernameByExtension;
exports.getAgentsOfQueues = getAgentsOfQueues;
exports.evtFullyBooted = evtFullyBooted;
exports.getExtenFromMac = getExtenFromMac;
exports.inCallAudio = inCallAudio;
exports.getC2CMode = getC2CMode;
exports.isC2CModeCloud = isC2CModeCloud;
exports.getNullCallPeriod = getNullCallPeriod;
exports.getStaticDataQueues = getStaticDataQueues;
exports.getPausedQueues = getPausedQueues;