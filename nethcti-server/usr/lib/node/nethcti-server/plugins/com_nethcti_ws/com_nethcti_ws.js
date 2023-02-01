/**
 * Communicates in real time mode with the clients using websocket.
 * Listen on localhost http.
 *
 * @module com_nethcti_ws
 * @main com_nethcti_ws
 */

/**
 * Core module that communicates with the clients using websocket.
 *
 * @class com_nethcti_ws
 * @static
 */
var fs = require('fs');
var io = require('socket.io');
var http = require('http');
var EventEmitter = require('events').EventEmitter;

/**
 * Emitted to a websocket client connection on extension update.
 *
 * Example:
 *
 *                         {
        "ip": "",
        "cf": "",
        "dnd": false,
        "cfVm": "",
        "port": "",
        "name": "user",
        "exten": "602",
        "status": "offline",
        "chanType": "sip",
        "sipuseragent": "",
        "conversations": { Conversation.{{#crossLink "Conversation/toJSON"}}{{/crossLink}}() }
     }
 *
 * @event extenUpdate
 * @param {object} exten The data about the extension
 *
 */
/**
 * The name of the extension update event.
 *
 * @property EVT_EXTEN_UPDATE
 * @type string
 * @default "extenUpdate"
 */
var EVT_EXTEN_UPDATE = 'extenUpdate';

/**
 * Emitted to a websocket client connection on new alarm.
 *
 * Example:
 *
 *                         {
        "alarm": "queueload",
        "queue": "401",
        "message": "Queue 401 has no waiting call",
        "status": "ok"
     }
 *
 * @event EVT_QMANAGER_ALARM
 * @param {object} alarm The alarm data
 *
 */
/**
 * The name of the alarm update event.
 *
 * @property EVT_QMANAGER_ALARM
 * @type string
 * @default "qmAlarm"
 */
var EVT_QMANAGER_ALARM = 'qmAlarm';

/**
 * Emitted to the extension involved in a connected conversation.
 *
 * Example:
 *
 *     { "extenConnected": "223" }
 *
 * @event extenConnected
 * @param {object} data The data about the event
 *
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
 * Emitted to the extension involved in a connected conversation. The difference
 * with EVT_EXTEN_CONNECTED is that this event indicates both the involved numbers.
 *
 * Example:
 *
 *     { "num1": "223", "num2": "100" }
 *
 * @event extenConvConnected
 * @param {object} data The data about the involved numbers
 *
 */
/**
 * The name of the extension conversation connected event.
 *
 * @property EVT_EXTEN_CONV_CONNECTED
 * @type string
 * @default "extenConvConnected"
 */
var EVT_EXTEN_CONV_CONNECTED = 'extenConvConnected';

/**
 * Emitted to a websocket client connection on trunk update.
 *
 * Example:
 *
 *                         {
        "ip": "",
        "port": "",
        "name": "",
        "exten": "2001",
        "status": "offline",
        "chanType": "sip",
        "maxChannels": 4,
        "sipuseragent": "",
        "conversations": { Conversation.{{#crossLink "Conversation/toJSON"}}{{/crossLink}}() }
     }
 *
 * @event trunkUpdate
 * @param {object} trunk The data about the trunk
 *
 */
/**
 * The name of the trunk update event.
 *
 * @property EVT_TRUNK_UPDATE
 * @type string
 * @default "trunkUpdate"
 */
var EVT_TRUNK_UPDATE = 'trunkUpdate';

/**
 * Fired when the componente has been reloaded.
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
 * Emitted to a websocket client connection on queue update.
 *
 * Example:
 *
 *                         {
        "name":                   "Coda401",
        "queue":                  "401",
        "members":                { QueueMember.{{#crossLink "QueueMember/toJSON"}}{{/crossLink}}() } // the keys is the extension numbers
        "avgHoldTime":            "37"
        "avgTalkTime":            "590",
        "waitingCallers":         { QueueWaitingCaller.{{#crossLink "QueueWaitingCaller/toJSON"}}{{/crossLink}}() } // the keys is the channel identifier
        "abandonedCallsCount":    "26",
        "completedCallsCount":    "11"
        "serviceLevelTimePeriod": "60"
        "serviceLevelPercentage": "100.0"
     }
 *
 * @event queueUpdate
 * @param {object} queue The data about the queue
 *
 */
/**
 * The name of the queue update event.
 *
 * @property EVT_QUEUE_UPDATE
 * @type string
 * @default "queueUpdate"
 */
var EVT_QUEUE_UPDATE = 'queueUpdate';

/**
 * Emitted to a websocket client connection on all components reloaded.
 *
 * @event serverReloaded
 */
/**
 * The name of the all component reloaded
 *
 * @property EVT_SERVER_RELOADED
 * @type string
 * @default "serverReloaded"
 */
var EVT_SERVER_RELOADED = 'serverReloaded';


/**
 * Emitted to a websocket client connection on queue member update.
 *
 * Example:
 *
 *                         {
        "type":                   "static",
        "name":                   "Name",
        "queue":                  "401",
        "member":                 "214",
        "paused":                 true,          // the paused status
        "loggedIn":               true,          // if the member is logged in or not
        "callsTakenCount":        0,             // the number of taken calls
        "lastCallTimestamp":      1365590191     // the timestamp of the last taken call
        "lastPausedInReason":     "some reason"  // the reason description of the last started pause
        "lastPausedInTimestamp":  1365591191     // the timestamp of the last started pause
        "lastPausedOutTimestamp": 1365594191     // the timestamp of the last ended pause
     }
 *
 * @event queueMemberUpdate
 * @param {object} queueMember The data about the queue member
 *
 */
/**
 * The name of the queue member update event.
 *
 * @property EVT_QUEUE_MEMBER_UPDATE
 * @type string
 * @default "queueMemberUpdate"
 */
var EVT_QUEUE_MEMBER_UPDATE = 'queueMemberUpdate';

/**
 * Emitted to a websocket client connection on parking update.
 *
 * Example:
 *
 *                         {
        "name": "71",
        "parking": "71"
        "timeout": 45
        "parkedCaller": { ParkedCaller.{{#crossLink "ParkedCaller/toJSON"}}{{/crossLink}}() }
     }
 *
 * @event parkingUpdate
 * @param {object} parking The data about the parking
 *
 */
/**
 * The name of the parking update event.
 *
 * @property EVT_PARKING_UPDATE
 * @type string
 * @default "parkingUpdate"
 */
var EVT_PARKING_UPDATE = 'parkingUpdate';

//  /**
//   * Emitted to a websocket client connection to answer an incoming call to webrtc extension.
//   *
//   * @event answerWebrtc
//   * @param {string} exten The WebRTC extension identifier
//   *
//   */
//  /**
//   * The name of the event for answer webrtc extension
//   *
//   * @property EVT_ANSWER_WEBRTC
//   * @type string
//   * @default "answerWebrtc"
//   */
var EVT_ANSWER_WEBRTC = 'answerWebrtc';

/**
 * Emitted to a websocket client connection to call a number using webrtc extension.
 *
 * Example:
 *
     "0721405516"
 *
 * @event callWebrtc
 * @param {string} to The destination number to be called using WebRTC extension
 *
 */
/**
 * The name of the event to call number using WebRTC extension
 *
 * @property EVT_CALL_WEBRTC
 * @type string
 */
var EVT_CALL_WEBRTC = 'callWebrtc';

//  /**
//   * Emitted to a websocket client connection on user endpoint presence update.
//   *
//   * @event endpointPresenceUpdate
//   * @param {object} data The data about the user endpoint presence
//   *
//   */
//  /**
//   * The name of the endpoint presence update event.
//   *
//   * @property EVT_ENDPOINT_PRESENCE_UPDATE
//   * @type string
//   * @default "endpointPresenceUpdate"
//   */
var EVT_ENDPOINT_PRESENCE_UPDATE = 'endpointPresenceUpdate';

/**
 * Emitted to a websocket client connection on a user presence update.
 * The event can contains three different keys: "presence",
 * "presence_onbusy" or "presence_onunavailable".
 *
 * The "presence" is the presence status of the user.
 *
 * The "presence_onbusy" is the presence status of the user when he is busy in a conversation.
 *
 * The "presence_onunavailable" is the presence status of the user when he does not answer
 * to an incoming call.
 *
 * Example:
 *
 *                         {
       "presence": {
         "username": "ale",
         "status": "dnd"
       }
     }

     {
       "presence_onbusy": {
         "username": "ale",
         "status": "callforward",
         "to": "190"
       }
     }

     {
       "presence_onunavailable": {
         "username": "ale",
         "status": "callforward",
         "to": "190"
       }
     }
 *
 * @event userPresenceUpdate
 * @param {object} data The data about the user presence update
 *
 */

/**
 * The name of the user presence update event.
 *
 * @property EVT_USER_PRESENCE_UPDATE
 * @type string
 * @default "userPresenceUpdate"
 */
var EVT_USER_PRESENCE_UPDATE = 'userPresenceUpdate';

/**
 * The name of the user main presence update event.
 *
 * @property EVT_USER_MAIN_PRESENCE_UPDATE
 * @type string
 * @default "userMainPresenceUpdate"
 */
 var EVT_USER_MAIN_PRESENCE_UPDATE = 'userMainPresenceUpdate';

/**
 * Emitted to a websocket client connection on a user profile avatar update.
 *
 *     { "username": "ale", "avatar": "1234abcdef..." }
 *
 * @event userProfileAvatarUpdate
 * @param {object} data The data about the user profile avatar update
 *
 */
/**
 * The name of the user profile avatar update event.
 *
 * @property EVT_USER_PROFILE_AVATAR_UPDATE
 * @type string
 * @default "userProfileAvatarUpdate"
 */
var EVT_USER_PROFILE_AVATAR_UPDATE = 'userProfileAvatarUpdate';

/**
 * Emitted to a websocket client connection on a streaming source update event.
 *
 *     { "source": "vs_gate1", "image": "1234abcdef..." }
 *
 * @event evtStreamingSourceUpdate
 * @param {object} data The data about the streaming source update event
 *
 */
/**
 * The name of the streaming source update event.
 *
 * @property EVT_STREAMING_SOURCE_UPDATE
 * @type string
 * @default "streamingSourceUpdate"
 */
var EVT_STREAMING_SOURCE_UPDATE = 'streamingSourceUpdate';

/**
 * Emitted to a websocket client connection on a meetme conference update event.
 *
 *                         {
      "id": "201",
      "users": {
        "201": {
          "id": "1",
          "name": "John",
          "owner": false,
          "muted": false,
          "extenId": "201"
        }
      }
 *
 * @event meetmeConfUpdate
 * @param {object} data The data about the meetme conference update event
 *
 */
/**
 * The name of the meetme conference update event.
 *
 * @property EVT_MEETME_CONF_UPDATE
 * @type string
 * @default "meetmeConfUpdate"
 */
var EVT_MEETME_CONF_UPDATE = 'meetmeConfUpdate';

/**
 * Emitted to a websocket client connection on a meetme conference end event.
 *
 *     { id: "201" }
 *
 * @event meetmeConfEnd
 * @param {object} data The data about the meetme conference end event
 *
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
 * Fired when a websocket client connection has been closed.
 *
 * @event wsClientDisonnection
 * @param {string} username The name of the user that has closed the connection
 */
/**
 * The name of the client websocket disconnection event.
 *
 * @property EVT_ALL_WS_CLIENT_DISCONNECTION
 * @type string
 * @default "allWsClientDisonnection"
 */
var EVT_ALL_WS_CLIENT_DISCONNECTION = 'allWsClientDisonnection';

/**
 * Fired when a client websocket has been connected.
 *
 * @event wsClientConnected
 */
/**
 * The name of the event emitted when a client websocket has been connected.
 *
 * @property EVT_WS_CLIENT_CONNECTED
 * @type string
 * @default "wsClientConnected"
 */
var EVT_WS_CLIENT_CONNECTED = 'wsClientConnected';

/**
 * Fired when a client has been logged in by a websocket connection.
 *
 * @event wsClientLoggedIn
 * @param {string} username The name of the user that has been logged in.
 */
/**
 * The name of the client logged in event.
 *
 * @property EVT_WS_CLIENT_LOGGEDIN
 * @type string
 * @default "wsClientLoggedIn"
 */
var EVT_WS_CLIENT_LOGGEDIN = 'wsClientLoggedIn';

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type {string}
 * @private
 * @final
 * @readOnly
 * @default [com_nethcti_ws]
 */
var IDLOG = '[com_nethcti_ws]';

/**
 * The user agent used to recognize cti client application. The user agent is set
 * to the socket properties when client login (loginHdlr) and checked when disconnect
 * (disconnHdlr) to set the offline presence of the client user.
 *
 * @property USER_AGENT
 * @type {string}
 * @private
 * @final
 * @readOnly
 * @default "nethcti"
 */
var USER_AGENT = 'nethcti';

/**
 * The user agent type used to recognize cti client application. The user agent type is set
 * to the socket properties when client login (loginHdlr).
 *
 * @property USER_AGENT_TYPE
 * @type {object}
 * @private
 * @final
 * @readOnly
 * @default {
 *   "MOBILE": "mobile",
 *   "DESKTOP": "desktop"
 * }
 */
var USER_AGENT_TYPE = {
  MOBILE: 'mobile',
  DESKTOP: 'desktop'
};

/**
* The websocket rooms used to update clients with asterisk events.
*
* @property WS_ROOM
* @type {object}
* @private
* @final
* @readOnly
* @default {
    AST_EVT_CLEAR:   "ast_evt_clear",
    AST_EVT_PRIVACY: "ast_evt_privacy"
}
*/
var WS_ROOM = {
  QMANAGER_EVT: 'qmanager_evt',
  QUEUES_AST_EVT_CLEAR: 'queues_ast_evt_clear',
  QUEUES_AST_EVT_PRIVACY: 'queues_ast_evt_privacy',
  TRUNKS_AST_EVT_CLEAR: 'trunks_ast_evt_clear',
  TRUNKS_AST_EVT_PRIVACY: 'trunks_ast_evt_privacy',
  PARKINGS_AST_EVT_CLEAR: 'parkings_ast_evt_clear',
  PARKINGS_AST_EVT_PRIVACY: 'parkings_ast_evt_privacy',
  EXTENSIONS_AST_EVT_CLEAR: 'extensions_ast_evt_clear',
  EXTENSIONS_AST_EVT_PRIVACY: 'extensions_ast_evt_privacy'
};

/**
 * The configuration file path of the privacy.
 *
 * @property CONFIG_PRIVACY_FILEPATH
 * @type string
 * @private
 */
var CONFIG_PRIVACY_FILEPATH;

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * The string used to hide phone numbers in privacy mode.
 *
 * @property privacyStrReplace
 * @type {string}
 * @private
 * @final
 * @readOnly
 */
var privacyStrReplace;

/**
 * The websocket unsecure server port.
 *
 * @property wsPort
 * @type string
 * @private
 */
var wsPort;

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
 * The websocket server unsecure (http).
 *
 * @property wsServer
 * @type {object}
 * @private
 */
var wsServer;

/**
 * The asterisk proxy.
 *
 * @property astProxy
 * @type object
 * @private
 */
var astProxy;

/**
 * The user component.
 *
 * @property compUser
 * @type object
 * @private
 */
var compUser;

/**
 * The authentication module.
 *
 * @property compAuthe
 * @type object
 * @private
 */
var compAuthe;

/**
 * The authorization module.
 *
 * @property compAuthorization
 * @type object
 * @private
 */
var compAuthorization;

/**
 * The voicemail architect component used for voicemail functions.
 *
 * @property compVoicemail
 * @type object
 * @private
 */
var compVoicemail;

/**
 * The post-it architect component.
 *
 * @property compPostit
 * @type object
 * @private
 */
var compPostit;

/**
 * The streaming component.
 *
 * @property compStreaming
 * @type object
 * @private
 */
var compStreaming;

/**
 * Contains all websocket identifiers of authenticated clients (http).
 * The key is the websocket identifier and the value is an object
 * containing the username and the token of the user. It's used for
 * fast authentication for each request.
 *
 * @property wsid
 * @type object
 * @private
 */
var wsid = {};

/**
 * Interval time to automatic update token expiration of all users that
 * are connected by websocket.
 *
 * @property updateTokenExpirationInterval
 * @type {number}
 * @private
 */
var updateTokenExpirationInterval;

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
    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authentication module to be used.
 *
 * @method setAuthe
 * @param {object} autheMod The authentication module.
 */
function setAuthe(autheMod) {
  try {
    if (typeof autheMod !== 'object') {
      throw new Error('wrong authentication object');
    }
    compAuthe = autheMod;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the user module to be used.
 *
 * @method setCompUser
 * @param {object} comp The user module.
 */
function setCompUser(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong user object');
    }
    compUser = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the authorization module to be used.
 *
 * @method setCompAuthorization
 * @param {object} comp The authorization module.
 */
function setCompAuthorization(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong authorization module');
    }
    compAuthorization = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets voicemail architect component used by voicemail functions.
 *
 * @method setCompVoicemail
 * @param {object} cv The voicemail architect component.
 */
function setCompVoicemail(cv) {
  try {
    compVoicemail = cv;
    logger.log.info(IDLOG, 'set voicemail architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets post-it architect component.
 *
 * @method setCompPostit
 * @param {object} comp The post-it architect component.
 */
function setCompPostit(comp) {
  try {
    compPostit = comp;
    logger.log.info(IDLOG, 'set post-it architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the streaming module to be used.
 *
 * @method setCompStreaming
 * @param {object} comp The user module.
 */
function setCompStreaming(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong user object');
    }
    compStreaming = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the asterisk proxy to be used by the module.
 *
 * @method setAstProxy
 * @param {object} comp The asterisk proxy component
 */
function setAstProxy(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong asterisk proxy object');
    }
    astProxy = comp;
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
    if (!astProxy || typeof astProxy.on !== 'function') {
      throw new Error('wrong astProxy object');
    }
    astProxy.on(astProxy.EVT_EXTEN_HANGUP, extenHangup); // an extension hangup
    astProxy.on(astProxy.EVT_EXTEN_CHANGED, extenChanged); // an extension has changed
    astProxy.on(astProxy.EVT_EXTEN_DIALING, extenDialing); // an extension ringing
    astProxy.on(astProxy.EVT_TRUNK_CHANGED, trunkChanged); // a trunk has changed
    astProxy.on(astProxy.EVT_QUEUE_CHANGED, queueChanged); // a queue has changed
    astProxy.on(astProxy.EVT_EXTEN_CONNECTED, extenConnected); // an extension has a connected conversation
    astProxy.on(astProxy.EVT_PARKING_CHANGED, parkingChanged); // a parking has changed
    astProxy.on(astProxy.EVT_MEETME_CONF_END, meetmeConfEnd); // a meetme conference has been ended
    astProxy.on(astProxy.EVT_MEETME_CONF_CHANGED, meetmeConfChanged); // a meetme conference has changed
    astProxy.on(astProxy.EVT_QUEUE_MEMBER_CHANGED, queueMemberChanged); // a queue member has changed
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the communication ipc component.
 *
 * @method setComIpcListeners
 * @private
 */
function setComIpcListeners() {
  try {
    process.on('evtAlarm', evtAlarm);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Received an alarm.
 *
 * @method evtAlarm
 * @private
 */
function evtAlarm(data) {
  try {
    if (data.status && data.alarm && data.queue) {
      logger.log.info(IDLOG, 'emit event "' + EVT_QMANAGER_ALARM + '" to ws room qmanager');
      wsServer.sockets.in(WS_ROOM.QMANAGER_EVT).emit(EVT_QMANAGER_ALARM, data);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the voicemail component.
 *
 * @method setVoicemailListeners
 * @private
 */
function setVoicemailListeners() {
  try {
    if (!compVoicemail || typeof compVoicemail.on !== 'function') {
      throw new Error('wrong voicemail object');
    }
    compVoicemail.on(compVoicemail.EVT_UPDATE_NEW_VOICE_MESSAGES, updateNewVoiceMessagesListener);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the post-it component.
 *
 * @method setPostitListeners
 * @private
 */
function setPostitListeners() {
  try {
    // check post-it component object
    if (!compPostit || typeof compPostit.on !== 'function') {
      throw new Error('wrong post-it object');
    }
    compPostit.on(compPostit.EVT_UPDATE_NEW_POSTIT, updateNewPostitListener);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the user component.
 *
 * @method setUserListeners
 * @private
 */
function setUserListeners() {
  try {
    if (!compUser || typeof compUser.on !== 'function') {
      throw new Error('wrong user object');
    }
    compUser.on(compUser.EVT_USER_PRESENCE_CHANGED, evtUserPresenceChanged);
    compUser.on(compUser.EVT_USER_MAIN_PRESENCE_CHANGED, evtUserMainPresenceChanged);
    compUser.on(compUser.EVT_USER_PROFILE_AVATAR_CHANGED, evtUserProfileAvatarChanged);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the streaming component.
 *
 * @method setStreamingListeners
 * @private
 */
function setStreamingListeners() {
  try {
    if (!compStreaming || typeof compStreaming.on !== 'function') {
      throw new Error('wrong user object');
    }

    compStreaming.on(compStreaming.EVT_STREAMING_SOURCE_CHANGED, evtStreamingSourceChanged);
    compStreaming.on(compStreaming.EVT_STREAMING_SOURCE_SUBSCRIBED, evtStreamingSourceSubscribed);
    compStreaming.on(compStreaming.EVT_STREAMING_SOURCE_UNSUBSCRIBED, evtStreamingSourceUnsubscribed);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Manages the new voicemail event emitted by the voicemail component. It sends
 * all new voice messages of the voicemail to all users who use the voicemail.
 *
 * @method updateNewVoiceMessagesListener
 * @param {string} voicemail The voicemail identifier
 * @param {array}  list      The list of all new voicemail messages
 * @private
 */
function updateNewVoiceMessagesListener(data) {
  try {
    logger.log.info(IDLOG, 'received "new voicemail" event for voicemail ' + data.voicemail);

    // get all users associated with the voicemail. Only the user with the associated voicemail
    // receives the list of all new voice messages
    var users = compUser.getUsersUsingEndpointVoicemail(data.voicemail);

    // emit the "newVoiceMessage" event for each logged in user associated with the voicemail.
    // The event contains the voicemail details
    var socketId, username;

    for (socketId in wsid) {
      username = wsid[socketId].username;
      // the user is associated with the voicemail is logged in
      if (users.indexOf(username) !== -1) {
        // emits the event with the list of all new voice messages of the voicemail
        logger.log.info(IDLOG, 'emit event "updateNewVoiceMessages" for voicemail ' + data.voicemail + ' to user "' + username + '"');
        // object to return with the event
        var obj = {};
        obj[data.voicemail] = {
          inbox: data.countNew,
          old: data.countOld
        };

        if (wsServer.sockets.sockets.has(socketId)) {
          wsServer.sockets.sockets.get(socketId).emit('updateNewVoiceMessages', obj);
        }
      }
    }

    // emit the "newVoiceMessageCounter" to all the users. The event contains only the number
    // of new voice messages of the voicemail without they details. So it is sent to all the users
    // without any authorization checking
    for (socketId in wsid) {
      username = wsid[socketId].username;
      // emits the event "newVoiceMessageCounter" with the number of new voice messages of the user
      logger.log.info(IDLOG, 'emit event "newVoiceMessageCounter" ' + data.countNew + ' to user "' + username + '"');

      if (wsServer.sockets.sockets.has(socketId)) {
        wsServer.sockets.sockets.get(socketId).emit('newVoiceMessageCounter', {
          voicemail: data.voicemail,
          counter: data.countNew
        });
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Manages the event emitted by the post-it component to update the new post-it messages.
 * It send all new post-it to the recipient user.
 *
 * @method updateNewPostitListener
 * @param {string} recipient The recipient user of the new post-it
 * @param {array}  list      All the new post-it messages of the user
 * @private
 */
function updateNewPostitListener(recipient, list) {
  try {
    // check the event data
    if (typeof recipient !== 'string' || list === undefined || list instanceof Array === false) {
      throw new Error('wrong arguments');
    }
    logger.log.info(IDLOG, 'received "updateNewPostit" event for recipient user ' + recipient);
    // emit the "updateNewPostit" event for the recipient user. The events contains all the new post-it with their details
    var socketId, username;
    for (socketId in wsid) {
      username = wsid[socketId].username;
      // the user is the recipient of the new post-it message
      if (username === recipient) {
        // emits the event with the list of all new post-it messages of the user
        logger.log.info(IDLOG, 'emit event "updateNewPostit" to the recipient user "' + recipient + '"');

        if (wsServer.sockets.sockets.has(socketId)) {
          wsServer.sockets.sockets.get(socketId).emit('updateNewPostit', list);
        }
      }
    }

    // emit the "newPostitCounter". The event only contains the number of new post-it of a user. So it is
    // sent to all users without any authorization checking
    for (socketId in wsid) {
      username = wsid[socketId].username;
      // emits the event with the number of new post-it of the recipient user
      logger.log.info(IDLOG, 'emit event "newPostitCounter" ' + list.length + ' to recipient user "' + username + '"');

      if (wsServer.sockets.sockets.has(socketId)) {
        wsServer.sockets.sockets.get(socketId).emit('newPostitCounter', {
          user: recipient,
          counter: list.length
        });
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _userPresenceChanged_ event emitted by _user_
 * component. The user presence has changed, so notifies all clients.
 *
 * @method evtUserPresenceChanged
 * @param {object} evt
 *  @param {string} evt.username The username
 *  @param {string} evt.presence The presence status of the user
 * @private
 */
function evtUserPresenceChanged(evt) {
  try {
    if (typeof evt !== 'object' ||
      (
        typeof evt.presence !== 'object' &&
        typeof evt.presence_onbusy !== 'object' &&
        typeof evt.presence_onunavailable !== 'object'
      )
    ) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event "' + compUser.EVT_USER_PRESENCE_CHANGED + '" ' + JSON.stringify(evt));
    logger.log.info(IDLOG, 'emit event "' + EVT_USER_PRESENCE_UPDATE + '" ' + JSON.stringify(evt) + ' to websockets');

    // emits the event to all users
    var sockid;
    for (sockid in wsid) {
      wsServer.sockets.sockets.get(sockid).emit(EVT_USER_PRESENCE_UPDATE, evt);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _userMainPresenceChanged_ event emitted by _user_
 * component. The user main presence has changed, so notifies all clients.
 *
 * @method evtUserPresenceChanged
 * @param {object} evt
 *  @param {string} evt.username The username
 *  @param {string} evt.presence The main presence status of the user
 * @private
 */
 function evtUserMainPresenceChanged(evt) {

  try {
    if (typeof evt !== 'object' ) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event "' + compUser.EVT_USER_MAIN_PRESENCE_CHANGED + '" ' + JSON.stringify(evt));
    logger.log.info(IDLOG, 'emit event "' + EVT_USER_MAIN_PRESENCE_UPDATE + '" ' + JSON.stringify(evt) + ' to websockets');

    // emits the event to all users
    var sockid;
    for (sockid in wsid) {
      wsServer.sockets.sockets.get(sockid).emit(EVT_USER_MAIN_PRESENCE_UPDATE, evt);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _evtUserProfileAvatarChanged_ event emitted by _user_
 * component. The user avatar picture has been changed, so notifies all clients.
 *
 * @method evtUserProfileAvatarChanged
 * @param {object} evt
 *  @param {string} evt.username The username
 *  @param {string} evt.avatar The avatar picture in base64 format
 * @private
 */
function evtUserProfileAvatarChanged(evt) {
  try {
    if (typeof evt !== 'object' || typeof evt.username !== 'string') {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event "' + compUser.EVT_USER_PROFILE_AVATAR_CHANGED + '" for user ' + evt.username);
    logger.log.info(IDLOG, 'emit event "' + EVT_USER_PROFILE_AVATAR_UPDATE + '" for user ' + evt.username + ' to websockets');

    // emits the event to all users
    var sockid;
    for (sockid in wsid) {
      wsServer.sockets.sockets.get(sockid).emit(EVT_USER_PROFILE_AVATAR_UPDATE, evt);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _evtStreamingSourceChanged_ event emitted by _streaming_
 * component. The streaming source image has been changed, so notifies all clients.
 *
 * @method evtStreamingSourceChanged
 * @param {object} evt
 *  @param {string} evt.source The streaming source
 *  @param {string} evt.image The streaming image in base64 format
 * @private
 */
function evtStreamingSourceChanged(evt) {
  try {
    logger.log.info(IDLOG, 'received event "' + compStreaming.EVT_STREAMING_SOURCE_CHANGED + '" for source ' + evt.streaming.source);
    logger.log.info(IDLOG, 'emit event "' + EVT_STREAMING_SOURCE_UPDATE + '" for source ' + evt.streaming.source + ' to websockets');

    var room_name = 'STREAMING_' + evt.streaming.source.toUpperCase();

    // emits the event to all clients
    var sockid;
    for (sockid in wsid) {
      wsServer.sockets.in(WS_ROOM[room_name]).emit(EVT_STREAMING_SOURCE_UPDATE, evt);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _evtStreamingSourceSubscribed_ event emitted by _streaming_
 * component.
 * The streaming source has been subscribed, so handle streaming sources rooms.
 *
 * @method evtStreamingSourceSubscribed
 * @param {object} evt
 * @param {string} evt.username The username to subscribe with
 * @param {string} evt.streamId The streaming source identifier
 * @private
 */
function evtStreamingSourceSubscribed(evt) {
  try {
    logger.log.info(IDLOG, 'received event "' + compUser.EVT_STREAMING_SOURCE_SUBSCRIBED + '" for user ' + evt.streaming.username + ' source ' + evt.streaming.streamId);

    var streamId = evt.streaming.streamId;
    var room_name = 'STREAMING_' + streamId.toUpperCase();
    WS_ROOM[room_name] = room_name.toLowerCase();

    var socketId, username;
    for (socketId in wsid) {
      username = wsid[socketId].username;

      if (username === evt.streaming.username) {
        wsServer.sockets.sockets.get(socketId).join(WS_ROOM[room_name]);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _evtStreamingSourceUnsubscribed_ event emitted by _streaming_
 * component.
 * The streaming source has been unsubscribed, so handle streaming sources rooms.
 *
 * @method evtStreamingSourceUnsubscribed
 * @param {object} evt
 * @param {string} evt.username The username to subscribe with
 * @param {string} evt.streamId The streaming source identifier
 * @private
 */
function evtStreamingSourceUnsubscribed(evt) {
  try {
    logger.log.info(IDLOG, 'received event "' + compUser.EVT_STREAMING_SOURCE_UNSUBSCRIBED + '" for user ' + evt.streaming.username + ' source ' + evt.streaming.streamId);

    var streamId = evt.streaming.streamId;
    var room_name = 'STREAMING_' + streamId.toUpperCase();

    var socketId, username;
    for (socketId in wsid) {
      username = wsid[socketId].username;

      if (username === evt.streaming.username) {
        wsServer.sockets.sockets.get(socketId).leave(WS_ROOM[room_name]);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * It sends an event to all the local websocket clients. It accepts also a
 * function to be verified before performing the send and an optional function
 * to manipulate data before sending.
 *
 * @method sendEventToAllClients
 * @param {string}   evname   The event name
 * @param {object}   data     The event data object
 * @param {function} fn       The function to be passed to perform the sending. It will be
 *                            called passing the "username" associated with websocket
 * @param {function} [fnData] The function to be passed to perform the data manipulation. It
 *                            will be called passing the "username" associated with websocket
 *                            and the data event
 */
function sendEventToAllClients(evname, data, fn, fnData) {
  try {
    if (typeof evname !== 'string' || typeof data !== 'object' ||
      typeof fn !== 'function' || (fnData && typeof fnData !== 'function')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'emit event "' + evname + '" to all local clients with permission enabled');

    // cycle in each websocket to send the event
    var sockid, username, copyData;
    for (sockid in wsid) {
      username = wsid[sockid].username;
      copyData = JSON.parse(JSON.stringify(data));

      // check the authorization
      if (fn(username) === true) {
        // manipulate data based on username
        if (fnData) {
          copyData.data = fnData(username, copyData.data);
        }
        if (wsServer.sockets.sockets.has(sockid)) {
          wsServer.sockets.sockets.get(sockid).emit(evname, copyData);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * It sends an event to all the local websocket clients.
 *
 * @method sendAll
 * @param {string} evname The event name
 * @param {object} data The event data object
 */
function sendAll(evname, data) {
  try {
    if (typeof evname !== 'string' || typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'emit event "' + evname + '" to all local clients with permission enabled');
    for (let sockid in wsid) {
      if (wsServer.sockets.sockets.has(sockid)) {
        wsServer.sockets.sockets.get(sockid).emit(evname, data);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenChanged_ event emitted by _astproxy_
 * component. Something has changed in the extension, so notifies
 * all interested clients.
 *
 * @method extenChanged
 * @param {object} exten The extension object
 * @private
 */
function extenChanged(exten) {
  try {
    logger.log.info(IDLOG, 'received event "' + astProxy.EVT_EXTEN_CHANGED + '" for extension ' + exten.getExten());
    logger.log.info(IDLOG, 'emit event "' + EVT_EXTEN_UPDATE + '" for extension ' + exten.getExten() + ' to websockets');

    // cycle in each websocket to send the event about an extension update. If the websocket user
    // is associated with the extension or the user has the privacy permission disabled, then it
    // sends the update with clear number, otherwise the number is obfuscated to respect the privacy authorization
    var sockid, username, extJson;

    // retrieve extension value from exten
    const extension = exten.getExten()
    for (sockid in wsid) {
      username = wsid[sockid].username;

      // get username when the user is logged in with extension
      if (astProxy.isExten(username)) {
        const usernameByExt = astProxy.getUsernameByExtension(username)
        if (usernameByExt) username = usernameByExt
      }

      // checks if the user has the privacy enabled
      //
      // Scenario 1: the user has the "privacy" and "admin queues" permissions enabled
      // the privacy is bypassed for all the calls that pass through a queue and for the calls
      // that concern the user to send to
      //
      // Other cases: all the calls are obfuscated except those concerning the user to send to
      if (compAuthorization.isPrivacyEnabled(username) === true &&
        compAuthorization.authorizeAdminQueuesUser(username) === false &&
        compAuthorization.verifyUserEndpointExten(username, extension) === false &&
        wsServer.sockets.sockets.has(sockid)) {

        extJson = exten.toJSON(privacyStrReplace, privacyStrReplace);

      } else if (compAuthorization.isPrivacyEnabled(username) === true &&
        compAuthorization.authorizeAdminQueuesUser(username) === true &&
        compAuthorization.verifyUserEndpointExten(username, extension) === false &&
        wsServer.sockets.sockets.has(sockid)) {

        extJson = exten.toJSON(privacyStrReplace);

      } else if (wsServer.sockets.sockets.has(sockid)) {
        extJson = exten.toJSON();
      }
      if (wsServer.sockets.sockets.has(sockid)) {
        wsServer.sockets.sockets.get(sockid).emit(EVT_EXTEN_UPDATE, extJson);
      }
    }
    if (extension) {
      // retrieve the mainPresence and emit the associated event
      compUser.updateUserMainPresence(extension)
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenHangup_ event emitted by _astproxy_ component.
 *
 * @method extenHangup
 * @param {object} data The extension hangup data object
 * @private
 */
function extenHangup(data) {
  try {
    logger.log.info(IDLOG, 'received event "' + astProxy.EVT_EXTEN_HANGUP + '" for extension ' + data.channelExten);

    // get the user associated with the hangupped extension
    var user = compUser.getUserUsingEndpointExtension(data.channelExten);
    // emit the "extenHangup" event for each logged in user associated with the hangupped extension
    var socketId, username;

    for (socketId in wsid) {

      username = wsid[socketId].username;
      // the user is associated with the hangupped extension and it is logged in
      if (user === username) {
        // emits the event with the hangup data
        logger.log.info(IDLOG, 'emit event "' + astProxy.EVT_EXTEN_HANGUP + '" for extension ' + data.channelExten + ' to user "' + username + '"');

        if (wsServer.sockets.sockets.has(socketId)) {
          wsServer.sockets.sockets.get(socketId).emit(astProxy.EVT_EXTEN_HANGUP, data);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _queueMemberChanged_ event emitted by _astproxy_
 * component. Something has changed in the queue member, so notifies
 * all interested clients.
 *
 * @method queueMemberChanged
 * @param {object} member The queue member object
 * @private
 */
function queueMemberChanged(member) {
  try {
    logger.log.info(IDLOG, 'received event queueMemberChanged for member ' + member.getMember() + ' of queue ' + member.getQueue());
    logger.log.info(IDLOG, 'emit event ' + EVT_QUEUE_MEMBER_UPDATE + ' for member ' + member.getMember() + ' of queue ' + member.getQueue() + ' to websockets');
    // emits the event with clear numbers to all users with privacy disabled
    wsServer.sockets.in(WS_ROOM.QUEUES_AST_EVT_CLEAR).emit(EVT_QUEUE_MEMBER_UPDATE, member.toJSON());
    // emits the event with hide numbers to all users with privacy enabled
    wsServer.sockets.in(WS_ROOM.QUEUES_AST_EVT_PRIVACY).emit(EVT_QUEUE_MEMBER_UPDATE, member.toJSON(privacyStrReplace));
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _astProxy.EVT\_MEETME\_CONF\_CHANGED_ event emitted by _astproxy_
 * component. Something has changed in the meetme conference, so notifies
 * all clients associated with the conference extension.
 *
 * @method meetmeConfChanged
 * @param {object} conf The conference object
 * @private
 */
function meetmeConfChanged(conf) {
  try {
    logger.log.info(IDLOG, 'received event "' + astProxy.EVT_MEETME_CONF_CHANGED + '" for conf id ' + conf.getId());
    logger.log.info(IDLOG, 'emit event "' + EVT_MEETME_CONF_UPDATE + '" for conf id ' + conf.getId() + ' to websockets');
    sendEvtToUserWithExtenId(EVT_MEETME_CONF_UPDATE, conf.toJSON(), conf.getId());
    var extens = Object.keys(conf.getAllUsers());
    for (var i = 0; i < extens.length; i++) {
      sendEvtToUserWithExtenId(EVT_MEETME_CONF_UPDATE, conf.toJSON(), extens[i]);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _astProxy.EVT\_MEETME\_CONF\_END_ event emitted by _astproxy_
 * component. A meetme conference has been ended, so notifies
 * all clients associated with the conference extension.
 *
 * @method meetmeConfEnd
 * @param {string} confId The conference identifier
 * @private
 */
function meetmeConfEnd(confId) {
  try {
    logger.log.info(IDLOG, 'received event "' + astProxy.EVT_MEETME_CONF_END + '" for conf id ' + confId);
    logger.log.info(IDLOG, 'emit event "' + EVT_MEETME_CONF_END + '" for conf id ' + confId + ' to websockets');
    sendEvtToUserWithExtenId(EVT_MEETME_CONF_END, { id: confId }, confId);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sends the event only to users with associated extension.
 *
 * @method sendEvtToUserWithExtenId
 * @param {string} evtName The name of the event
 * @param {object} evtObj  The event data object
 * @param {string} extenId The extension identifier
 * @private
 */
function sendEvtToUserWithExtenId(evtName, evtObj, extenId) {
  try {
    for (let socket of wsServer.sockets.sockets.values()) {
      if (socket.nethcti && compAuthorization.verifyUserEndpointExten(socket.nethcti.username, extenId) === true) {
        socket.emit(evtName, evtObj);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _trunkChanged_ event emitted by _astproxy_
 * component. Something has changed in the trunk, so notifies
 * all interested clients.
 *
 * @method trunkChanged
 * @param {object} trunk The trunk object
 * @private
 */
function trunkChanged(trunk) {
  try {
    logger.log.info(IDLOG, 'received event trunkChanged for trunk ' + trunk.getExten());
    logger.log.info(IDLOG, 'emit event ' + EVT_TRUNK_UPDATE + ' for trunk ' + trunk.getExten() + ' to websockets');
    // emits the event with clear numbers to all users with privacy disabled
    wsServer.sockets.in(WS_ROOM.EXTENSIONS_AST_EVT_CLEAR).emit(EVT_TRUNK_UPDATE, trunk.toJSON());
    // emits the event with hide numbers to all users with privacy enabled
    wsServer.sockets.in(WS_ROOM.EXTENSIONS_AST_EVT_PRIVACY).emit(EVT_TRUNK_UPDATE, trunk.toJSON(privacyStrReplace));
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns identity data of the caller filtered by user authorizations. Returned caller
 * notes are those all of the user and the publics of the others if he has only the "postit"
 * authorization and all the caller notes if he has the "admin postit" authorization. Phonebook
 * contacts returned is the one created by the user in the cti phonebook, or one from the
 * centralized phonebook or a public contact created by other users in the cti address book.
 *
 * @method getFilteredCallerIndentity
 * @param  {string} username       The username
 * @param  {object} callerIdentity The identity of the caller to be filtered
 * @return {object} The filtered caller identity.
 * @private
 */
function getFilteredCallerIndentity(username, callerIdentity) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof callerIdentity !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var i;
    // filter the caller notes, if there are
    var filteredCallerNotes = [];

    if (callerIdentity.callerNotes) {
      // the user can view all the caller notes of all users, both private and public
      if (compAuthorization.authorizeAdminPostitUser(username) === true) {
        for (i = 0; i < callerIdentity.callerNotes.length; i++) {
          filteredCallerNotes.push(callerIdentity.callerNotes[i]);
        }
      }
      // the user can view only his caller notes and the public of other users
      else if (compAuthorization.authorizePostitUser(username) === true) {
        for (i = 0; i < callerIdentity.callerNotes.length; i++) {
          if (callerIdentity.callerNotes[i].creator === username || callerIdentity.callerNotes[i].public === 1) {
            filteredCallerNotes.push(callerIdentity.callerNotes[i]);
          }
        }
      }
    }

    // filter the phonebook contact if it's present
    // chose the phonebook contacts: is first returned the contact of the user from the cti phonebook,
    // than that from the central phonebook and the last is the public contact from the cti phonebook.
    // If more than one contact is present, the first is returned
    var pbContact;
    if (callerIdentity.pbContacts) {
      // check if the user has the phonebook permission
      if (compAuthorization.authorizePhonebookUser(username) === true) {

        for (i = 0; i < callerIdentity.pbContacts.nethcti.length; i++) {
          // the user has a contact in the cti phonebook
          if (callerIdentity.pbContacts.nethcti[i].owner_id === username) {
            pbContact = callerIdentity.pbContacts.nethcti[i];
            break;
          }
        }

        // check if the contact wasn't found as private contact of the user in the cti phonebook
        if (pbContact === undefined && callerIdentity.pbContacts.centralized.length > 0) {
          // the contact was found in the centralized phonebook
          pbContact = callerIdentity.pbContacts.centralized[0];
        }

        // check if the contact was not found as private contact of the user in the cti phonebook and
        // was not found in the centralized phonebook
        if (pbContact === undefined) {
          for (i = 0; i < callerIdentity.pbContacts.nethcti.length; i++) {
            // there is a public contact in the cti phonebook
            if (callerIdentity.pbContacts.nethcti[i].type === 'public') {
              pbContact = callerIdentity.pbContacts.nethcti[i];
              break;
            }
          }
        }
      }
    }
    // object to return
    var filteredIdentityCaller = {
      numCalled: callerIdentity.numCalled,
      callerNum: callerIdentity.callerNum,
      callerName: callerIdentity.callerName
    };

    if (pbContact) {
      filteredIdentityCaller.pbContact = pbContact;
    }
    if (filteredCallerNotes.length > 0) {
      filteredIdentityCaller.callerNotes = filteredCallerNotes;
    }
    return filteredIdentityCaller;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sends an event to the client to answer the incoming call of webrtc extension.
 *
 * @method sendAnswerWebrtcToClient
 * @param {string} username The name of the client user
 * @param {string} extenId  The extension identifier
 */
function sendAnswerWebrtcToClient(username, extenId) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof extenId !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // emit the EVT_ANSWER_WEBRTC event for each logged in user associated with the ringing extension
    var socketId;
    for (socketId in wsid) {

      if (wsid[socketId].username === username) {
        logger.log.info(IDLOG, 'emit event "' + EVT_ANSWER_WEBRTC + '" for webrtc extension ' + extenId + ' to user "' + username + '"');

        if (wsServer.sockets.sockets.has(socketId)) {
          wsServer.sockets.sockets.get(socketId).emit(EVT_ANSWER_WEBRTC, extenId);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sends an event to the client to call the number using webrtc extension.
 *
 * @method sendCallWebrtcToClient
 * @param {string} username The name of the client user
 * @param {string} to       The destination number to be called using client webrtc phone
 */
function sendCallWebrtcToClient(username, to) {
  try {
    if (typeof username !== 'string' || typeof to !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // emit the EVT_CALL_WEBRTC event for each logged in user
    var socketId;
    for (socketId in wsid) {

      if (wsid[socketId].username === username) {
        logger.log.info(IDLOG, 'emit event "' + EVT_CALL_WEBRTC + '" to number ' + to + ' to user "' + username + '"');

        if (wsServer.sockets.sockets.has(socketId)) {
          wsServer.sockets.sockets.get(socketId).emit(EVT_CALL_WEBRTC, to);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send an event to all the clients to inform them about all components reloaded.
 *
 * @method sendAllCompReloaded
 */
function sendAllCompReloaded() {
  try {
    var socketId;
    logger.log.info(IDLOG, 'emit event "' + EVT_SERVER_RELOADED + '" to all clients');
    for (socketId in wsid) {
      if (wsServer.sockets.sockets.has(socketId)) {
        wsServer.sockets.sockets.get(socketId).emit(EVT_SERVER_RELOADED);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenDialing_ event emitted by _astproxy_ component.
 * The extension ringing, so notify all users associated with it, with the
 * identity data of the caller.
 *
 * @method extenDialing
 * @param {object} data
 *   @param {string} data.dialingExten   The identifier of the ringing extension
 *   @param {object} data.callerIdentity The identity data of the caller
 *   @param {boolean} data.callerHasConf True if the caller has an active conference
 * @private
 */
function extenDialing(data) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.dialingExten !== 'string' ||
      typeof data.callerHasConf !== 'boolean' ||
      typeof data.callerIdentity !== 'object') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event extenDialing for extension ' + data.dialingExten + ' with the caller identity');

    // get the user associated with the ringing extension
    var user = compUser.getUserUsingEndpointExtension(data.dialingExten);

    // emit the "extenRinging" event for each logged in user associated with the ringing extension
    var socketId, username, filteredCallerIdentity;
    for (socketId in wsid) {

      username = wsid[socketId].username;

      // the user is associated with the ringing extension and is logged in
      if (user === username) {

        filteredCallerIdentity = getFilteredCallerIndentity(username, data.callerIdentity);
        filteredCallerIdentity.callerHasConf = data.callerHasConf;

        // emits the event with the caller identity data
        logger.log.info(IDLOG, 'emit event extenRinging for extension ' + data.dialingExten + ' to user "' + username + '" with the caller identity');

        if (wsServer.sockets.sockets.has(socketId)) {
          wsServer.sockets.sockets.get(socketId).emit('extenRinging', filteredCallerIdentity);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenConnected_ event emitted by _astproxy_ component.
 * The event indicates two extensions, but it emits the event for only data.num1,
 * because another event _extenConnected_ will signal the same for other extension.
 *
 * @method extenConnected
 * @param {object} data
 *   @param {string} data.num1 The identy of a part of the conversation
 *   @param {object} data.num2 The identy of other part of the conversation
 * @private
 */
function extenConnected(data) {
  try {
    if (typeof data !== 'object' || typeof data.num1 !== 'string' || typeof data.num2 !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event extenConnected between num1=' + data.num1 + ' and num2=' + data.num2);
    var user = compUser.getUserUsingEndpointExtension(data.num1);
    // emit the notification event for each logged in user associated
    // with the connected extension data.num1
    var socketId, username;
    for (socketId in wsid) {
      username = wsid[socketId].username;
      // the user is associated with the connected data.num1 extension and is logged in, so send to notification event
      if (user === username && wsServer.sockets.sockets.has(socketId)) {
        logger.log.info(IDLOG, 'emit event "' + EVT_EXTEN_CONNECTED + '" between "' + data.num1 + '" and ' +
          '"' + data.num2 + '" to "' + wsServer.sockets.sockets.get(socketId).nethcti.username + '" with socket.id ' + wsServer.sockets.sockets.get(socketId).id);
        var o = {};
        o[EVT_EXTEN_CONNECTED] = data.num1;
        wsServer.sockets.sockets.get(socketId).emit(EVT_EXTEN_CONNECTED, o);
        wsServer.sockets.sockets.get(socketId).emit(EVT_EXTEN_CONV_CONNECTED, {
          num1: data.num1,
          num2: data.num2,
          direction: data.direction,
          uniqueid: data.uniqueid,
          linkedid: data.linkedid,
          throughTrunk: data.throughTrunk
        });
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _queueChanged_ event emitted by _astproxy_
 * component. Something has changed in the queue, so notifies
 * all interested clients.
 *
 * @method queueChanged
 * @param {object} queue The queue object
 * @private
 */
function queueChanged(queue) {
  try {
    logger.log.info(IDLOG, 'received event queueChanged for queue ' + queue.getQueue());
    logger.log.info(IDLOG, 'emit event ' + EVT_QUEUE_UPDATE + ' for queue ' + queue.getQueue() + ' to websockets');
    // emits the event with clear numbers to all users with privacy disabled
    wsServer.sockets.in(WS_ROOM.QUEUES_AST_EVT_CLEAR).emit(EVT_QUEUE_UPDATE, queue.toJSON());
    // emits the event with hide numbers to all users with privacy enabled
    wsServer.sockets.in(WS_ROOM.QUEUES_AST_EVT_PRIVACY).emit(EVT_QUEUE_UPDATE, queue.toJSON(privacyStrReplace));
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _parkingChanged_ event emitted by _astproxy_
 * component. Something has changed in the parking, so notifies
 * all interested clients.
 *
 * @method parkingChanged
 * @param {object} parking The parking object
 * @private
 */
function parkingChanged(parking) {
  try {
    logger.log.info(IDLOG, 'received event parkingChanged for parking ' + parking.getParking());
    logger.log.info(IDLOG, 'emit event ' + EVT_PARKING_UPDATE + ' for parking ' + parking.getParking() + ' to websockets');

    // emits the event with clear numbers to all users with privacy disabled
    wsServer.sockets.in(WS_ROOM.PARKINGS_AST_EVT_CLEAR).emit(EVT_PARKING_UPDATE, parking.toJSON());
    // emits the event with hide numbers to all users with privacy enabled
    wsServer.sockets.in(WS_ROOM.PARKINGS_AST_EVT_PRIVACY).emit(EVT_PARKING_UPDATE, parking.toJSON(privacyStrReplace));
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Configurates the websocket server properties by a configuration file.
 * The file must use the JSON syntax.
 *
 * @method config
 * @param {string} path The path of the configuration file
 */
function config(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter');
    }

    // check file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }

    // read configuration file
    var json = JSON.parse(fs.readFileSync(path, 'utf8'));

    // initialize the port of the websocket server (http)
    if (json.websocket && json.websocket.http_port) {
      wsPort = json.websocket.http_port;
    } else {
      logger.log.warn(IDLOG, 'wrong ' + path + ': no ws "http_port"');
    }

    // initialize the interval at which update the token expiration of all users
    // that are connected by websocket
    var expires = compAuthe.getTokenExpirationTimeout();
    updateTokenExpirationInterval = expires / 2;

    logger.log.info(IDLOG, 'configuration done by ' + path);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Customize the privacy used to hide phone numbers by a configuration file.
 * The file must use the JSON syntax.
 *
 * @method configPrivacy
 * @param {string} path The path of the configuration file
 */
function configPrivacy(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter');
    }

    // check file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }
    CONFIG_PRIVACY_FILEPATH = path;

    // read configuration file
    var json = JSON.parse(fs.readFileSync(CONFIG_PRIVACY_FILEPATH, 'utf8'));

    // initialize the string used to hide last digits of phone numbers
    if (json.privacy_numbers) {
      privacyStrReplace = json.privacy_numbers;
    } else {
      logger.log.warn(IDLOG, 'wrong ' + file + ': no "privacy_numbers" key');
    }
    logger.log.info(IDLOG, 'privacy configuration done by ' + CONFIG_PRIVACY_FILEPATH);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Creates the websocket server (http) and adds the listeners for other components.
 *
 * @method start
 */
function start() {
  try {
    setComIpcListeners();

    // set the listener for the aterisk proxy module
    setAstProxyListeners();

    // set the listener for the voicemail module
    setVoicemailListeners();

    // set the listener for the post-it module
    // setPostitListeners();

    // set the listener for the user module
    setUserListeners();

    // set the listener for the streaming module
    setStreamingListeners();

    // starts the http websocket server
    startWsServer();

    // start the automatic update of token expiration of all users that are connected by websocket (http).
    // The interval is the half value of expiration provided by authentication component
    setInterval(function() {
      updateTokenExpirationOfAllWebsocketUsers();
    }, updateTokenExpirationInterval);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Creates the websocket server unsecure listening on localhost.
 *
 * @method startWsServer
 * @private
 */
function startWsServer() {
  try {
    var httpServer = http.createServer();
    wsServer = io(httpServer, {
      'transports': ['websocket'],
      'pingInterval': 25000, // default
      'pingTimeout': 10000000,
      'allowUpgrades': false
    });
    wsServer.on('connection', wsConnHdlr);
    httpServer.listen(wsPort, '127.0.0.1', () => {
      logger.log.warn(IDLOG, 'websocket server (ws) listening on port ' + wsPort);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Update the token expiration of all users that are connected by websocket (http).
 *
 * @method updateTokenExpirationOfAllWebsocketUsers
 * @private
 */
function updateTokenExpirationOfAllWebsocketUsers() {
  try {
    logger.log.info(IDLOG, 'update token expiration of all websocket users (http)');
    var id;
    for (id in wsid) {
      compAuthe.updateTokenExpires(wsid[id].username, wsid[id].token);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Websocket (http) connection handler.
 *
 * @method wsConnHdlr
 * @param {object} socket The client websocket.
 * @private
 */
function wsConnHdlr(socket) {
  try {
    // this event is emitted when a client websocket has been connected
    logger.log.info(IDLOG, 'emit event "' + EVT_WS_CLIENT_CONNECTED + '"');
    emitter.emit(EVT_WS_CLIENT_CONNECTED, socket);
    logger.log.warn(IDLOG, 'new ws connection from ' + getWebsocketEndpoint(socket) + ' (sid: ' + socket.id + ')');
    // set the listeners for the new http socket connection
    socket.on('ping', (cb) => {
      if (typeof cb === 'function') {
        cb();
      }
    });
    socket.on('login', function(data) {
      loginHdlr(socket, data);
    });
    socket.on('disconnect', reason => {
      disconnHdlr(socket, reason);
    });
    socket.on('disconnecting', reason => {
      logger.log.info(IDLOG, `disconnecting socket sid "${socket.id}" - reason: ${reason}`);
    });
    socket.on('error', err => {
      logger.log.error(IDLOG, `error on socket sid "${socket.id}" - ${err}`);
    });
    socket.on('message', function(data) {
      try {
        if (data.message === 'screenSharingStart' &&
          socket.nethcti && socket.nethcti.username && compAuthorization.authorizeScreenSharing(socket.nethcti.username) === true) {

          logger.log.info(IDLOG, 'screen sharing starting (roomId "' + data.roomId + '"): authorization successful for user "' + socket.nethcti.username + '"');
        } else if (data.message === 'screenSharingStart') {
          logger.log.warn(IDLOG, 'screen sharing start (roomId "' + data.roomId + '") by user "' + socket.nethcti.username + '" has been failed: user does not have the authorization');
          return;
        }
        for (let socketId in wsid) {
          if (data.destUser === wsid[socketId].username) {
            if (wsServer.sockets.sockets.get(socketId)) {
              wsServer.sockets.sockets.get(socketId).emit('message', data);
            }
          }
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
      }
    });
    logger.log.info(IDLOG, 'listeners for new http websocket connection have been set');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send the error result to the client.
 *
 * **It can throw an Exception.**
 *
 * @method sendError
 * @param {object} socket The client websocket
 * @param {string} [obj] The object to send
 */
function sendError(socket, obj) {
  try {
    // check parameter
    if (obj === undefined) {
      obj = {};
    }
    if (typeof obj !== 'object') {
      throw new Error('wrong parameter');
    }
    socket.emit('error', obj);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send response to the client for bad request received.
 *
 * @method badRequest
 * @param {object} socket The client websocket.
 */
function badRequest(socket) {
  try {
    socket.emit('bad_request');
    logger.log.warn(IDLOG, 'received bad request from ' + getWebsocketEndpoint(socket));
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return the endpoint of the websocket. The endpoint is
 * constructed by _ip\_address:port._
 *
 * @method getWebsocketEndpoint
 * @param {object} socket The websocket
 * @return {string} The websocket endpoint as _ip\_address:port._
 * @private
 */
function getWebsocketEndpoint(socket) {
  try {
    return socket.handshake.headers['x-forwarded-for'];
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Manage unauthorized access. It send 401 unauthorized response
 * to the client and disconnect the websocket.
 *
 * @method unauthorized
 * @param {object} socket The client websocket
 * @private
 */
function unauthorized(socket) {
  try {
    send401(socket); // send 401 unauthorized response to the client
    logger.log.warn(IDLOG, 'disconnect socket ' + getWebsocketEndpoint(socket));
    socket.disconnect();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Websocket login handler.
 *
 * @method loginHdlr
 * @param {object} socket The client websocket
 * @param {object} obj The data passed by the client
 *   @param {string} obj.accessKeyId The username of the account
 *   @param {string} obj.token The token received by the authentication REST request
 *   @param {string} [obj.uaType] The user agent type ("mobile" | "desktop")
 * @private
 */
function loginHdlr(socket, obj) {
  try {
    if (typeof socket !== 'object' ||
      typeof obj !== 'object' ||
      typeof obj.token !== 'string' ||
      typeof obj.accessKeyId !== 'string' ||
      (typeof obj.uaType === 'string' && obj.uaType !== USER_AGENT_TYPE.MOBILE && obj.uaType !== USER_AGENT_TYPE.DESKTOP)) {

      logger.log.warn(IDLOG, 'bad authentication login request from ' + getWebsocketEndpoint(socket));
      unauthorized(socket);
      return;
    }

    if (compAuthe.isShibbolethUser(obj.accessKeyId)) {
      obj.accessKeyId = compAuthe.getShibbolethUsername(obj.accessKeyId);
    }

    if (compAuthe.verifyToken(obj.accessKeyId, obj.token, false) === true) { // user successfully authenticated
      logger.log.info(IDLOG, 'user "' + obj.accessKeyId + '" successfully authenticated from ' + getWebsocketEndpoint(socket) +
        ' with socket id ' + socket.id);
      // if uaType has been specified it checks for other already logged in user.
      // If it is already present, it logout previously logged in user and login current one
      var takeOvered = false;
      if (obj.uaType) {
        for (var sid in wsid) {
          if (wsServer.sockets &&
            wsServer.sockets.sockets.has(sid) &&
            wsServer.sockets.sockets.get(sid).nethcti &&
            wsServer.sockets.sockets.get(sid).nethcti.username === obj.accessKeyId &&
            wsServer.sockets.sockets.get(sid).nethcti.uaType === obj.uaType) {

              takeOvered = true;
              logger.log.warn(IDLOG, `double login by user "${obj.accessKeyId}" (${getWebsocketEndpoint(wsServer.sockets.sockets.get(sid))}): do takeOver procedure`);

              wsServer.sockets.sockets.get(sid).on('takeOverAck', function () {
                try {
                  logger.log.warn(IDLOG, `recv ack for login takeOver procedure by user "${obj.accessKeyId}" (${getWebsocketEndpoint(wsServer.sockets.sockets.get(sid))})`);
                  if (wsServer.takeOverTimeouts[sid]) {
                    clearTimeout(wsServer.takeOverTimeouts[sid]);
                    delete wsServer.takeOverTimeouts[sid];
                  }
                  if (wsServer.sockets.sockets.has(sid)) {
                    wsServer.sockets.sockets.get(sid).removeAllListeners('takeOverAck');
                  }
                  doLogin(socket, obj);

                } catch (err) {
                  logger.log.error(IDLOG, err.stack);
                  unauthorized(socket);
                }
              });

              wsServer.sockets.sockets.get(sid).emit('takeOver');

              // in case takeOverAck event never arrives
              if (!wsServer.takeOverTimeouts) {
                wsServer.takeOverTimeouts = {};
              }
              wsServer.takeOverTimeouts[sid] = setTimeout(function () {
                try {
                  logger.log.warn(IDLOG, `no ack for login takeOver procedure recv by user "${obj.accessKeyId}" (${getWebsocketEndpoint(wsServer.sockets.sockets.get(sid))})`);
                  if (wsServer.sockets.sockets.has(sid)) {
                    wsServer.sockets.sockets.get(sid).removeAllListeners('takeOverAck');
                  }
                  doLogin(socket, obj);
                  delete wsServer.takeOverTimeouts[sid];
                } catch (err) {
                  logger.log.error(IDLOG, err.stack);
                  unauthorized(socket);
                }
              }, 8000);
          }
        }
      }
      if (!takeOvered) {
        doLogin(socket, obj);
      }
    } else { // authentication failed
      logger.log.warn(IDLOG, 'authentication failed for user "' + obj.accessKeyId + '" from ' + getWebsocketEndpoint(socket) + ' with id ' + socket.id);
      unauthorized(socket);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    unauthorized(socket);
  }
}

/**
 * Does the login.
 *
 * @method doLogin
 * @param {object} socket The client websocket
 * @param {object} obj The data passed by the client
 *   @param {string} obj.accessKeyId The username of the account
 *   @param {string} obj.token The token received by the authentication REST request
 *   @param {string} [obj.uaType] The user agent type ("mobile" | "desktop")
 * @private
 */
function doLogin(socket, obj) {
  try {
    // add websocket id for future fast authentication for each request from the clients
    addWebsocketId(obj.accessKeyId, obj.token, socket.id);

    // sets the socket object that will contains the cti data
    if (!socket.nethcti) {
      socket.nethcti = {};
    }
    if (socket.handshake &&
      socket.handshake.headers &&
      socket.handshake.headers['user-agent']) {

      // set the origin application (cti) property to the client socket
      socket.nethcti.userAgent = socket.handshake.headers['user-agent'];
      logger.log.info(IDLOG, 'set userAgent "' + socket.nethcti.userAgent + '" to socket "' + socket.id + '"');
    }
    socket.nethcti.uaType = obj.uaType;
    socket.nethcti.username = obj.accessKeyId;

    // send authenticated successfully response
    sendAutheSuccess(socket);
    var username = astProxy.isExten(obj.accessKeyId) ? compUser.getUserUsingEndpointExtension(obj.accessKeyId) : obj.accessKeyId;
    if (compAuthe.isShibbolethUser(username)) {
      username = compAuthe.getShibbolethUsername(username);
    }

    // if the user has the "presence panel" permission, than he will receive
    // the asterisk events that involve the extensions
    if (compAuthorization.authorizePresencePanelUser(username) === true) {

      if (compAuthorization.isPrivacyEnabled(username) === true) {
        // join the user to the websocket room to receive the asterisk events that
        // involve the extensions, using hide numbers
        socket.join(WS_ROOM.EXTENSIONS_AST_EVT_PRIVACY);

      } else {
        // join the user to the websocket room to receive the asterisk events that
        // affects the extensions, using clear numbers
        socket.join(WS_ROOM.EXTENSIONS_AST_EVT_CLEAR);
      }
    }

    // if the user has the queues permission, than he will receive the asterisk events that affect the queues
    if (compAuthorization.authorizeQueuesUser(username) === true || compAuthorization.authorizeAdminQueuesUser(username) === true) {

      if (compAuthorization.isPrivacyEnabled(username) === true && compAuthorization.authorizeAdminQueuesUser(username) === false) {
        // join the user to the websocket room to receive the asterisk events that affects the queues, using hide numbers
        socket.join(WS_ROOM.QUEUES_AST_EVT_PRIVACY);

      } else {
        // join the user to the websocket room to receive the asterisk events that affects the queues, using hide numbers
        socket.join(WS_ROOM.QUEUES_AST_EVT_CLEAR);
      }
    }

    // if the user has the trunks permission, than he will receive the asterisk events that affects the trunks
    if (compAuthorization.authorizeOpTrunksUser(username) === true) {

      if (compAuthorization.isPrivacyEnabled(username) === true) {
        // join the user to the websocket room to receive the asterisk events that affects the trunks, using hide numbers
        socket.join(WS_ROOM.TRUNKS_AST_EVT_PRIVACY);

      } else {
        // join the user to the websocket room to receive the asterisk events that affects the trunks, using clear numbers
        socket.join(WS_ROOM.TRUNKS_AST_EVT_CLEAR);
      }
    }

    // if the user has the parkings permission, than he will receive the asterisk events that affects the parkings
    if (compAuthorization.authorizeOpParkingsUser(username) === true) {

      if (compAuthorization.isPrivacyEnabled(username) === true) {
        // join the user to the websocket room to receive the asterisk events that affects the parkings, using hide numbers
        socket.join(WS_ROOM.PARKINGS_AST_EVT_PRIVACY);

      } else {
        // join the user to the websocket room to receive the asterisk events that affects the parkings, using clear numbers
        socket.join(WS_ROOM.PARKINGS_AST_EVT_CLEAR);
      }
    }
    // qmanager instances
    if (compAuthorization.authorizeQManagerUser(username) === true) {
      socket.join(WS_ROOM.QMANAGER_EVT);
    }
    // emits the event for a logged in client. This event is emitted when a user has been logged in by a websocket connection
    logger.log.info(IDLOG, 'emit event "' + EVT_WS_CLIENT_LOGGEDIN + '" for username "' + obj.accessKeyId + '"');
    emitter.emit(EVT_WS_CLIENT_LOGGEDIN, obj.accessKeyId);
    logWsNumber();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    unauthorized(socket);
  }
}

/**
 * Websocket disconnection handler.
 *
 * @method disconnHdlr
 * @param {object} socket The client websocket
 * @param {string} reason The disconnection reason
 * @private
 */
function disconnHdlr(socket, reason) {
  try {
    logger.log.warn(IDLOG, 'ws disconnected ' + getWebsocketEndpoint(socket) + ' - reason: ' + reason + (wsid[socket.id] ? ' (user: ' + wsid[socket.id].username + ')' : ''));
    var username;
    // when the user is not authenticated but connected by websocket,
    // the "socket.id" is not present in the "wsid" property
    if (wsid[socket.id]) {

      var sid;
      var count = 0; // counter of the user socket connections that involve cti application
      username = wsid[socket.id].username;

      // count the number of cti sockets for the user from both websocket secure and not
      for (let tempSock of wsServer.sockets.sockets.values()) {
        if (tempSock.nethcti &&
            tempSock.nethcti.username === username &&
            tempSock.nethcti.userAgent === USER_AGENT) {

          count += 1;
        }
      }
      // set the offline cti presence only if the socket is the last and comes from the cti application
      if ((socket.nethcti.userAgent === USER_AGENT && // the socket connection comes from the cti application
        count === 1) || count === 0) { // only last socket connection is present

        username = wsid[socket.id].username;
        // emits the event for the disconnected client. This event is emitted when
        // all the websocket connections of the user has been closed.
        logger.log.info(IDLOG, 'emit event "' + EVT_ALL_WS_CLIENT_DISCONNECTION + '" for username ' + username);
        emitter.emit(EVT_ALL_WS_CLIENT_DISCONNECTION, username);
        compAuthe.removeShibbolethMap(username);
      }
    }
    // remove trusted identifier of the websocket
    removeWebsocketId(socket.id);
    logWsNumber();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Log the number of websocket connections.
 *
 * @method logWsNumber
 * @private
 */
let logWsNumber = () => {
  try {
    logger.log.warn(IDLOG, `ws conn ${wsServer.sockets.sockets.size} - wsid conn ${getNumConnectedClients()}`);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
};

/**
 * Removes the client websocket identifier from the private object _wsid_.
 *
 * @method removeWebsocketId
 * @param {string} socketId The client websocket identifier
 * @private
 */
function removeWebsocketId(socketId) {
  try {
    if (wsid[socketId]) {
      var userTemp = wsid[socketId].username;
      var tokenTemp = wsid[socketId].token;
      delete wsid[socketId];
      logger.log.info(IDLOG, 'removed client websocket ' + socketId + ' for the user ' + userTemp + ' with token ' + tokenTemp);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Adds the client websocket identifier into the private
 * object _wsid_. If it already exists it will be overwritten.
 *
 * @method addWebsocketId
 * @param {string} user     The user used as key
 * @param {string} token    The access token
 * @param {string} socketId The client websocket identifier to store in the memory
 * @private
 */
function addWebsocketId(user, token, socketId) {
  try {
    if (wsServer.sockets.sockets.has(socketId)) {
      wsid[socketId] = {
        username: user,
        token: token
      };
      logger.log.info(IDLOG, 'added client websocket identifier ' + socketId + ' for user ' + user + ' with token ' + token);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send 401 unauthorization response through websocket.
 *
 * @method send401
 * @param {object} socket The client websocket
 * @private
 */
function send401(socket) {
  try {
    logger.log.warn(IDLOG, 'send 401 unauthorized to ' + getWebsocketEndpoint(socket));
    socket.emit('401', {
      message: 'unauthorized access'
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send authorized successfully response through websocket.
 *
 * @method sendAutheSuccess
 * @param {object} socket The client websocket
 * @private
 */
function sendAutheSuccess(socket) {
  try {
    socket.emit('authe_ok', {
      message: 'authorized successfully'
    });
    logger.log.warn(IDLOG, 'sent authorized successfully ("authe_ok") to "' + socket.nethcti.username + '" ' + getWebsocketEndpoint(socket) + ' with sid ' + socket.id);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the number of connected clients.
 *
 * @method getNumConnectedClients
 * @param {number} The number of connected clients.
 * @private
 */
function getNumConnectedClients() {
  try {
    return Object.keys(wsid).length;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return -1;
  }
}

/**
 * Subscribe a callback function to a custom event fired by this object.
 * It's the same of nodejs _events.EventEmitter.on_ method.
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
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handle the module destroy process.
 *
 * @method onDestroy
 */
function stop() {
  if (wsServer && wsServer.close) {
    wsServer.close();
  }
}

/**
 * Reload the component.
 *
 * @method reset
 * @private
 */
function reset() {
  try {
    privacyStrReplace = '';
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reload
 * @private
 */
function reload() {
  try {
    reset();
    configPrivacy(CONFIG_PRIVACY_FILEPATH);
    logger.log.info(IDLOG, 'emit event "' + EVT_RELOADED + '"');
    emitter.emit(EVT_RELOADED);
    logger.log.warn(IDLOG, 'reloaded');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the info about the component.
 *
 * @method dump
 * @return {object} The data about the component.
 */
let dump = () => {
  try {
    let wsServerSockets = {};
    for (let [sid, socketValue] of wsServer.sockets.sockets) {
      wsServerSockets[sid] = {
        rooms: socketValue.rooms,
        headers: socketValue.handshake.headers,
        nethcti: socketValue.nethcti,
        connected: socketValue.connected,
        disconnected: socketValue.disconnected,
        url: socketValue.handshake.url,
        query: socketValue.handshake.query
      };
    }
    return {
      wsid: wsid,
      wsidLength: Object.keys(wsid).length,
      wsServerSockets: wsServerSockets,
      wsServerSocketsLength: Object.keys(wsServerSockets).length,
      rooms: wsServer.sockets.adapter.rooms
    };
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
};

// public interface
exports.on = on;
exports.dump = dump;
exports.start = start;
exports.reload = reload;
exports.stop = stop;
exports.config = config;
exports.setAuthe = setAuthe;
exports.setLogger = setLogger;
exports.setAstProxy = setAstProxy;
exports.EVT_RELOADED = EVT_RELOADED;
exports.setCompUser = setCompUser;
exports.configPrivacy = configPrivacy;
exports.setCompPostit = setCompPostit;
exports.setCompVoicemail = setCompVoicemail;
exports.setCompAuthorization = setCompAuthorization;
exports.setCompStreaming = setCompStreaming;
exports.sendAllCompReloaded = sendAllCompReloaded;
exports.sendEventToAllClients = sendEventToAllClients;
exports.sendCallWebrtcToClient = sendCallWebrtcToClient;
exports.getNumConnectedClients = getNumConnectedClients;
exports.EVT_WS_CLIENT_LOGGEDIN = EVT_WS_CLIENT_LOGGEDIN;
exports.EVT_WS_CLIENT_CONNECTED = EVT_WS_CLIENT_CONNECTED;
exports.sendAnswerWebrtcToClient = sendAnswerWebrtcToClient;
exports.EVT_ALL_WS_CLIENT_DISCONNECTION = EVT_ALL_WS_CLIENT_DISCONNECTION;
exports.sendAll = sendAll;