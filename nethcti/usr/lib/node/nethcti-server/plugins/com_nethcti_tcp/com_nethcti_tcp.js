/**
 * Communicates in real time mode with clients using a TCP connection.
 *
 * @module com_nethcti_tcp
 * @main com_nethcti_tcp
 */

/**
 * Core module that communicates with clients using a TCP connection.
 *
 * @class com_nethcti_tcp
 * @static
 */
var fs = require('fs');
var net = require('net');
var tls = require('tls');
var pathReq = require('path');
var EventEmitter = require('events').EventEmitter;

/**
 * Fired when the componente has been reloaded.
 *
 * @event reloaded
 */
/**
 * The name of the reloaded event.
 *
 * Example:
 *
 *     "reloaded"
 *
 * @property EVT_RELOADED
 * @type string
 * @default "reloaded"
 */
var EVT_RELOADED = 'reloaded';

/**
 * Fired when the nethifier led has to be set.
 *
 * @event setColorLed
 */
/**
 * The name of the set led color event.
 *
 * Example:
 *
 *     "setColorLed"
 *
 * @property EVT_COLOR_LED
 * @type string
 * @default "setColorLed"
 */
var EVT_COLOR_LED = 'setColorLed';

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * Emitted to a tcp client connection on extension hangup.
 *
 * @event extenHangup
 * @param {object} data The data about the event
 *
 * Example:
 *
 *     { "extenHangup": "223" }
 *
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
 * Emitted to a tcp client connection on extension presence changed.
 *
 * @event userPresenceChanged
 * @param {object} data The data about the event
 *
 * Example:
 *
 *     { presence: { username: 'andrea', status: 'dnd' } }
 *
 */
/**
 * The name of the extension presence changed event.
 *
 * @property EVT_USER_PRESENCE_CHANGED
 * @type string
 * @default "userPresenceChanged"
 */
var EVT_USER_PRESENCE_CHANGED = 'userPresenceChanged';

/**
 * Emitted to a tcp client with supported commands on login action received.
 *
 * @event commands
 * @param {object} data The data about the event
 *
 */
/**
 * The name of the suported commands event.
 *
 * Example:
 *
     {
        "commands": {
          "url": {
            "command": "url",
            "runwith": ""
          }
        }
     }
 *
 *
 * @property EVT_COMMANDS
 * @type string
 * @default "commands"
 */
var EVT_COMMANDS = 'commands';

/**
 * Emitted to a tcp client connection on extension ringing.
 *
 * @event notification
 * @param {object} data The data about the event
 *
 */
/**
 * The name of the extension ringing event.
 *
 * Example:
 *
     {
        "notification": {
          "id": "91200<-202",
          "url": "https://<server>/webrest/...",
          "width": "480",
          "height": "280",
          "action": 'open',
          "closetimeout": "10"
        }
     }
 *
 * @property EVT_NOTIFICATION
 * @type string
 * @default "notification"
 */
var EVT_NOTIFICATION = 'notification';

/**
 * Emitted to a tcp client connection on action ping received.
 *
 * @event ping
 * @param {object} data The data about the event
 *
 */
/**
 * The name of the ping event.
 *
 * Example:
 *
     {
        "ping": "active"
     }
 *
 * @property EVT_PING
 * @type string
 * @default "ping"
 */
var EVT_PING = 'ping';

/**
 * Emitted to a tcp client connection on extension connected on a conversation.
 *
 * @event extenConnected
 * @param {object} data The data about the event
 *
 * Example:
 *
 *     { "extenConnected": "223" }
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
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type {string}
 * @private
 * @final
 * @readOnly
 * @default [com_nethcti_tcp]
 */
var IDLOG = '[com_nethcti_tcp]';

/**
 * The color mapping for nethifier led. The colors are in RGB format and
 * if you want to bliking it append "|blink" at the end.
 *
 * @property LED_COLOR_MAPPING
 * @type {object}
 * @private
 * @final
 * @readOnly
 * @default {
  ringing: '255:0:0|blink',
  dnd: '255:0:0',
  busy: '255:0:0',
  online: '0:255:0',
  callForward: '0:0:255',
  voicemail: '0:0:255',
  cellphone: '0:0:255'
}
 */
var LED_COLOR_MAPPING = {
  ringing: '255:0:0|blink',
  dnd: '255:0:0',
  busy: '255:0:0',
  online: '0:255:0',
  callforward: '0:0:255',
  voicemail: '0:0:255',
  cellphone: '0:0:255'
};

/**
 * The enconding used to write the TCP client sockets.
 *
 * @property ENCODING
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "utf8"
 */
var ENCODING = 'utf8';

/**
 * The configuration file path of the windows popup.
 *
 * @property CONFIG_WINPOPUP_FILEPATH
 * @type string
 * @private
 */
var CONFIG_WINPOPUP_FILEPATH;

/**
 * The name of the template file for a call notification popup.
 *
 * @property CALL_NOTIF_TEMPLATE_NAME
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "call.html"
 */
var CALL_NOTIF_TEMPLATE_NAME = 'call.html';

/**
 * The name of the template file for a streaming notification popup.
 *
 * @property STREAMING_NOTIF_TEMPLATE_NAME
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "streaming.html"
 */
var STREAMING_NOTIF_TEMPLATE_NAME = 'streaming.html';

/**
 * The timeout to automatic close notification popup.
 *
 * @property notifCloseTimeout
 * @type string
 * @private
 * @default 10
 */
var notifCloseTimeout = 10;

/**
* The size of the call notification popup. It is
* customized by the _configWinPopup_ method.
*
* @property callNotifSize
* @type object
* @private
* @default {
    width: 400,
    heigth: 96
}
*/
var callNotifSize = {
  width: 400,
  height: 96
};

/**
* The size of the streaming notification popup. It is
* customized by the _configWinPopup_ method.
*
* @property streamNotifSize
* @type object
* @private
* @default {
    width: 400,
    heigth: 400
}
*/
var streamNotifSize = {
  width: 400,
  height: 400
};

/**
 * The path of the template file for a call notification popup. It is
 * constructed by the _config_ method.
 *
 * @property callNotifTemplatePath
 * @type string
 * @private
 */
var callNotifTemplatePath;

/**
 * The supported commands for windows popup notifications. It is
 * initialized by the _configWinPopup_ method.
 *
 * @property notifSupportedCommands
 * @type object
 * @private
 * @default {}
 */
var notifSupportedCommands = {};

/**
 * The path of the template file for a streaming notification popup. It is
 * constructed by the _config_ method.
 *
 * @property streamingNotifTemplatePath
 * @type string
 * @private
 */
var streamingNotifTemplatePath;

/**
 * The TCP server port. It is customized by the configuration file.
 *
 * @property tcpPort
 * @type string
 * @private
 */
var tcpPort;

/**
 * The TLS server port. It is customized by the configuration file.
 *
 * @property tlsPort
 * @type string
 * @private
 */
 var tlsPort;

/**
 * The TLS server private key path. It is customized by the configuration file.
 *
 * @property tlsKey
 * @type string
 * @private
 */
 var tlsKey;

/**
 * The TLS server certificate path. It is customized by the configuration file.
 *
 * @property tlsCert
 * @type string
 * @private
 */
 var tlsCert;

/**
 * The protocol used by the cti server. It is used by the windows popup notification
 * to open the NethCTI application using the configured protocol. It is customized
 * by the configuration file.
 *
 * @property ctiProto
 * @type string
 * @private
 * @default "https"
 */
var ctiProto = 'https';

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
 * The TCP server.
 *
 * @property server
 * @type {object}
 * @private
 */
var server;

/**
 * The asterisk proxy component.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * The config manager module.
 *
 * @property compConfigManager
 * @type object
 * @private
 */
var compConfigManager;

/**
 * The streaming component.
 *
 * @property compStreaming
 * @type object
 * @private
 */
var compStreaming;

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
 * Contains all client socket of authenticated clients. The key is the client
 * socket identifier and the value is an object containing the socket object
 * and the token of the user.
 *
 * @property sockets
 * @type object
 * @private
 */
var sockets = {};

/**
 * Interval time to automatic update token expiration of all users that
 * are connected by socket.
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
 * @method setCompAuthe
 * @param {object} autheMod The authentication module.
 */
function setCompAuthe(autheMod) {
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
 * Sets the config manager module to be used.
 *
 * @method setCompConfigManager
 * @param {object} comp The config manager module.
 */
function setCompConfigManager(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong config manager object');
    }
    compConfigManager = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the streaming module to be used.
 *
 * @method setCompStreaming
 * @param {object} comp The streaming module.
 */
function setCompStreaming(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong streaming object');
    }
    compStreaming = comp;
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
    compAstProxy = ap;
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
    if (!compAstProxy || typeof compAstProxy.on !== 'function') {
      throw new Error('wrong compAstProxy object');
    }
    compAstProxy.on(compAstProxy.EVT_EXTEN_HANGUP, extenHangup);
    compAstProxy.on(compAstProxy.EVT_EXTEN_DIALING, extenDialing);
    compAstProxy.on(compAstProxy.EVT_EXTEN_CONNECTED, extenConnected);
    compUser.on(compUser.EVT_USER_PRESENCE_CHANGED, evtUserPresenceChanged);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns data about the streaming source filtered by user authorizations. If the user
 * doesn't have the authorization, an empty object is returned.
 *
 * @method getFilteredStreamData
 * @param {string} username The username
 * @param {string} callerNum The number of the caller
 * @return {object} The filtered streaming data
 * @private
 */
function getFilteredStreamData(username, callerNum) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof callerNum !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get the streaming data
    var streamJSON = compStreaming.getSourceJSONByExten(callerNum);
    // check if the user has the streaming permission, otherwise return an empty object
    if (compAuthorization.authorizeStreamingSourceUser(username, streamJSON.id) === true) {
      return {
        id: streamJSON.id,
        url: streamJSON.url,
        open: ((streamJSON.cmdOpen && streamJSON.cmdOpen !== '') ? true : false),
        description: streamJSON.description
      };
    }
    // the user has not the streaming permission, so return an empty object
    return {};

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
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
 *   @param {string} data.callerIdentity The identity data of the caller
 * @private
 */
function extenDialing(data) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.channel !== 'string' ||
      typeof data.dialingExten !== 'string' ||
      typeof data.destUniqueId !== 'string' ||
      typeof data.callerIdentity !== 'object') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.log.info(IDLOG, 'received event extenDialing for extension ' + data.dialingExten + ' with caller identity');
    var user = compUser.getUserUsingEndpointExtension(data.dialingExten);

    // emit the notification event for each logged in user associated
    // with the ringing extension to open a desktop notification popup
    var sockId, username, defaultExten;
    for (sockId in sockets) {

      // "sockets[sockId]" is a socket object that contains the "username", "token"
      // and "id" properties added by "connHdlr" and "loginHdlr" methods
      username = sockets[sockId].username;
      defaultExten = compConfigManager.getDefaultUserExtensionConf(username);

      // the user is associated with the ringing extension and is logged in, so send to notification event
      if (user === username && data.dialingExten === defaultExten) {

        // check if the caller is a streaming source
        var isStreaming = compStreaming.isExtenStreamingSource(data.callerIdentity.callerNum);
        data.mainExten = compUser.getEndpointMainExtension(username).getId();

        if (isStreaming) {
          sendStreamingNotificationEvent(username, data, sockets[sockId]);
        } else {
          sendCallNotificationEvent(username, data, sockets[sockId]);
        }
        sendColorLed(username, LED_COLOR_MAPPING.ringing, sockets[sockId]);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check if the user is connected.
 *
 * @method isUserConnected
 * @param {string} username The username to be checked
 * @return {boolean} True if the username is connected
 */
 function isUserConnected(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    for (let sockId in sockets) {
      if (username === sockets[sockId].username) {
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Handler for the _evtUserPresenceChanged_ event emitted by _user_ component.
 * The user has changed the presence, so notify all users associated with it, with the
 * presence data of the user.
 *
 * @method evtUserPresenceChanged
 * @param {object} data
 *   @param {object} data.presence The presence data
 * @private
 */
function evtUserPresenceChanged(data) {
  try {
    if (typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (data.presence) {
      logger.log.info(IDLOG, 'received event "' + EVT_USER_PRESENCE_CHANGED + '" for user "' + data.presence.username + '" (presence: "' + data.presence.status + '")');

      // emit the notification event for each logged in user associated
      // with the user that has changed the presence to set color led
      var sockId, username;
      for (sockId in sockets) {

        // "sockets[sockId]" is a socket object that contains the "username", "token"
        // and "id" properties added by "connHdlr" and "loginHdlr" methods
        username = sockets[sockId].username;

        // the user is associated with the user that has changed the presence and is logged in, so send notification event
        if (data.presence.username === username) {
          sendColorLed(username, LED_COLOR_MAPPING[data.presence.status], sockets[sockId]);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenHangup_ event emitted by _astproxy_ component.
 * The extension hangup, so notify all users associated with it, with the
 * identity data of the extension.
 *
 * @method extenHangup
 * @param {object} data
 *   @param {string} data.callerNum The identifier of the hangup extension
 *   @param {string} [data.cause] The cause of hangup
 *   @param {string} data.channelExten The extension of the channel
 * @private
 */
function extenHangup(data) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof data.callerNum !== 'string' ||
      typeof data.channelExten !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event "' + compAstProxy.EVT_EXTEN_HANGUP + '" for extension ' + data.channelExten + ' with caller identity');
    var user = compUser.getUserUsingEndpointExtension(data.channelExten);
    // emit the notification event for each logged in user associated
    // with the ringing extension to open a desktop notification popup
    var sockId, username;
    for (sockId in sockets) {
      // "sockets[sockId]" is a socket object that contains the "username", "token"
      // and "id" properties added by "connHdlr" and "loginHdlr" methods
      username = sockets[sockId].username;
      // the user is associated with the ringing extension and is logged in, so send to notification event
      if (user === username) {
        sendHangupNotificationEvent(username, data, sockets[sockId]);
        var presence = compUser.getPresence(username);
        sendColorLed(username, LED_COLOR_MAPPING[presence], sockets[sockId]);
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
    // check parameters
    if (typeof data !== 'object' || typeof data.num1 !== 'string' || typeof data.num2 !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event extenConnected between num1=' + data.num1 + ' and num2=' + data.num2);
    var user = compUser.getUserUsingEndpointExtension(data.num1);
    // emit the notification event for each logged in user associated
    // with the connected extension data.num1 to close a desktop notification popup
    var sockId, username;
    for (sockId in sockets) {
      // "sockets[sockId]" is a socket object that contains the "username", "token"
      // and "id" properties added by "connHdlr" and "loginHdlr" methods
      username = sockets[sockId].username;
      // the user is associated with the connected data.num1 extension and is logged in, so send to notification event
      if (user === username) {
        sendCallConnectedNotificationEvent(username, data, sockets[sockId]);
        sendColorLed(username, LED_COLOR_MAPPING.busy, sockets[sockId]);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sends the event to open a desktop notification popup about a streaming source.
 *
 * @method sendStreamingNotificationEvent
 * @param {string} username The username of the client
 * @param {object} data     The data about the caller
 * @param {object} socket   The TCP socket client
 * @private
 */
function sendStreamingNotificationEvent(username, data, socket) {
  try {
    // gets the data about the streaming source based on the user authorizations
    var streamingData = getFilteredStreamData(username, data.callerIdentity.callerNum);
    // check if the user has the relative streaming authorization. If he does
    // not have the authorization, the "streamingData" is an empty object. So
    // it sends the default notification for a generic call
    if (Object.keys(streamingData).length === 0) {
      sendCallNotificationEvent(username, data, socket);
      return;
    }

    var params = [
      'description=', escape(streamingData.description),
      '&ctiProto=', ctiProto,
      '&open=', streamingData.open,
      '&webrtc=', compUser.isExtenWebrtc(data.dialingExten),
      '&id=', streamingData.id
    ].join('');

    // add parameters to the HTTP GET url
    var url = streamingNotifTemplatePath + '?' + params;

    // create the id to identify the notification popup
    var notifid = data.callerIdentity.numCalled + '<-' + data.callerIdentity.callerNum;

    var notif = {
      notification: {
        id: notifid,
        url: url,
        width: streamNotifSize.width,
        height: streamNotifSize.height,
        action: 'open',
        closetimeout: notifCloseTimeout
      }
    };
    socketSend(socket, notif, function () {
      logger.log.info(IDLOG, 'sent "open streaming notification" to ' + socket.username + ' with socket.id ' + socket.id);
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send a message.
 *
 * @method socketSend
 * @param {object} socket The socket
 * @param {object} msg The message
 * @param {function} cb The callback function
 * @private
 */
function socketSend(socket, msg, cb) {
  try {
    socket.write(JSON.stringify(msg) + '\n', ENCODING, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send the event to open a desktop notification popup about an incoming call.
 *
 * @method sendCallNotificationEvent
 * @param {string} username The username of the client
 * @param {object} data The data about the caller
 * @param {object} socket The TCP socket client
 * @private
 */
function sendCallNotificationEvent(username, data, socket) {
  try {
    let uniqueId
    var extenAgent = compAstProxy.getExtensionAgent(data.dialingExten);
    var isSupported = compConfigManager.phoneSupportHttpApi(extenAgent);
    // check if the answer button is to be displayed
    var answerAction = (isSupported || compUser.isExtenWebrtc(data.dialingExten)) ? true : false;
    // the uniqueId of the conversation
    if (data.destUniqueId) {
      uniqueId = data.destUniqueId
    }
    // always add this information without filter them
    var params = [
      'callerNum=', data.callerIdentity.callerNum,
      '&ctiProto=', ctiProto,
      '&callerName=', data.callerIdentity.callerName,
      '&mainExten=', data.mainExten,
      '&dialExten=', data.dialingExten,
      '&answerAction=', answerAction,
      '&webrtc=', compUser.isExtenWebrtc(data.dialingExten),
      '&random=', (new Date()).getTime(),
      '&uniqueId=', `${uniqueId || ''}`
    ].join('');
    // add parameters to the HTTP GET url
    var url = callNotifTemplatePath + '?' + params;
    // create the id to identify the notification popup
    var notifid = data.callerIdentity.numCalled + '<-' + data.callerIdentity.callerNum;
    var notif = {};
    notif[EVT_NOTIFICATION] = {
      id: notifid,
      url: url,
      width: callNotifSize.width,
      height: callNotifSize.height,
      action: 'open',
      closetimeout: notifCloseTimeout
    };
    socketSend(socket, notif, function () {
      logger.log.info(IDLOG, 'sent "' + EVT_NOTIFICATION + '" evt to open call notification to ' + socket.username + ' with socket.id ' + socket.id);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send the event to enable nethifier debug.
 *
 * @method setNethifierLog
 * @param {string} username The username of the client
 * @param {string} state ("on" | "off") Enable/Disable nethifier debug
 */
function setNethifierLog(username, state) {
  try {
    if (typeof username !== 'string' || typeof state !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, `received setNethifierLog request to be send to tcp client ${username} to "${state}" the nethifier debug`);
    let data = state === 'on' ? { action: 'debug' } : { action: 'debug-off' };
    let found = false;
    for (let sockId in sockets) {
      // "sockets[sockId]" is a socket object that contains the "username", "token"
      // and "id" properties added by "connHdlr" and "loginHdlr" methods
      socketUsername = sockets[sockId].username;
      if (username === socketUsername) {
        found = true;
        socketSend(sockets[sockId], data, function () {
          logger.log.info(IDLOG, `sent "debug" evt to ${state === 'on' ? 'enable' : 'disable'} nethifier debug to ${sockets[sockId].username} with socket id ${sockets[sockId].id}`);
        });
      }
    }
    if (found === false) {
      logger.log.warn(IDLOG, 'no tcp user found to send nethifier "debug" msg');
    }
    return found;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send the event to open a desktop notification popup about an incoming call.
 *
 * @method sendPhoneRequest
 * @param {string} username The username of the client
 * @param {string} url The URL of the phone to be invocated by the tcp client
 */
function sendPhoneRequest(username, url) {
  try {
      if (typeof username !== 'string' || typeof url !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, `received send phone call request to be send to tcp client ${username} with phone url ${url}`);
    let data = {
      action: 'sendurl',
      url: url
    };
    for (let sockId in sockets) {
      // "sockets[sockId]" is a socket object that contains the "username", "token"
      // and "id" properties added by "connHdlr" and "loginHdlr" methods
      socketUsername = sockets[sockId].username;
      if (username === socketUsername) {
        socketSend(sockets[sockId], data, function () {
          logger.log.info(IDLOG, 'sent phoneCallRequest evt to originate a new phone call throught an http get req to ' + sockets[sockId].username + ' with socket id ' + sockets[sockId].id + ' - url to be invoked: ' + data);
        });
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send the color to be set in nethifier led.
 *
 * @method sendColorLed
 * @param {string} username The username of the client
 * @param {object} color The color to be set
 * @param {object} socket The TCP socket client
 * @private
 */
function sendColorLed(username, color, socket) {
  try {
    var notif = {};
    notif[EVT_COLOR_LED] = color;
    socketSend(socket, notif, function () {
      logger.log.info(IDLOG, 'sent "' + EVT_COLOR_LED + '" evt to set led color to ' + socket.username + ' with socket.id ' + socket.id);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send the event to close a desktop notification popup about a connected call.
 *
 * @method sendCallConnectedNotificationEvent
 * @param {string} username The username of the client
 * @param {object} data The data about the parts of the conversation
 * @param {object} socket The TCP socket client
 * @private
 */
function sendCallConnectedNotificationEvent(username, data, socket) {
  try {
    var evt = {};
    evt[EVT_EXTEN_CONNECTED] = data.num1;
    socketSend(socket, evt, function () {
      logger.log.info(IDLOG, 'sent "' + EVT_EXTEN_CONNECTED + '" evt between "' + data.num1 + '" and "' + data.num2 +
        '" to close call notification to ' + socket.username + ' with socket.id ' + socket.id);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send the hangup event to close a desktop notification popup about an incoming call.
 *
 * @method sendHangupNotificationEvent
 * @param {string} username The username of the extension
 * @param {object} data The data about the extension
 * @param {object} socket The TCP socket client
 * @private
 */
function sendHangupNotificationEvent(username, data, socket) {
  try {
    var evt = {};
    evt[EVT_EXTEN_HANGUP] = data.channelExten;
    socketSend(socket, evt, function () {
      logger.log.info(IDLOG, 'sent "' + EVT_EXTEN_HANGUP + '" evt for exten "' + data.channelExten +
        '" to close call notification to ' + socket.username + ' with socket.id ' + socket.id);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Configurates the TCP and TLS servers properties by a configuration file.
 * The file must use the JSON syntax.
 *
 * @method config
 * @param {string} path The path of the configuration file
 */
function config(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }

    // read configuration file
    var json = JSON.parse(fs.readFileSync(path, 'utf8'));

    // initialize the port of the tcp server
    if (json && json.tcp && json.tcp.port) {
      tcpPort = json.tcp.port;
    } else {
      logger.log.error(IDLOG, path + ': no tcp "port" has been specified');
    }

    // initialize the port, key and cert of the tls server
    if (json && json.tls) {
      // set tls port
      if (json.tls.port) {
        tlsPort = json.tls.port;
      } else {
        logger.log.error(IDLOG, path + ': no tls "port" has been specified');
      }
      // set tls key
      if (json.tls.key) {
        tlsKey = json.tls.key;
      } else {
        logger.log.error(IDLOG, path + ': no tls "key" has been specified');
      }
      // set tls cert
      if (json.tls.cert) {
        tlsCert = json.tls.cert;
      } else {
        logger.log.error(IDLOG, path + ': no tls "cert" has been specified');
      }
    } else {
      logger.log.error(IDLOG, path + ': no tls parameters have been specified');
    }

    // initialize the paths of the notification templates
    if (json && json.tcp && json.tcp.base_templates) {
      callNotifTemplatePath = json.tcp.base_templates + pathReq.sep + CALL_NOTIF_TEMPLATE_NAME;
      streamingNotifTemplatePath = json.tcp.base_templates + pathReq.sep + STREAMING_NOTIF_TEMPLATE_NAME;
    } else {
      logger.log.error(IDLOG, path + ': no "base_templates" has been specified');
    }

    // initialize the interval at which update the token expiration of all users
    // that are connected by tcp
    var expires = compAuthe.getTokenExpirationTimeout();
    updateTokenExpirationInterval = expires / 2;
    logger.log.info(IDLOG, 'configuration done by ' + path);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Configurates the settings to be used for Windows popup notifications of
 * incoming calls by a configuration file. The file must use the JSON syntax.
 *
 * @method configWinPopup
 * @param {string} path The path of the configuration file
 */
function configWinPopup(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check file presence
    if (!fs.existsSync(path)) {
      logger.log.warn(IDLOG, 'win popup configuration file ' + path + ' does not exist: use default values');
      return;
    }
    CONFIG_WINPOPUP_FILEPATH = path;

    // read configuration file
    var json = JSON.parse(fs.readFileSync(CONFIG_WINPOPUP_FILEPATH, 'utf8'));

    if (json && json.stream && json.stream.width) {
      streamNotifSize.width = json.stream.width;
    } else {
      logger.log.warn(IDLOG, 'no win stream popup width has been specified in ' + CONFIG_WINPOPUP_FILEPATH + ': use default ' + streamNotifSize.width);
    }

    if (json && json.stream && json.stream.height) {
      streamNotifSize.height = json.stream.height;
    } else {
      logger.log.warn(IDLOG, 'no win stream popup height has been specified in ' + CONFIG_WINPOPUP_FILEPATH + ': use default ' + streamNotifSize.height);
    }

    if (json && json.call && json.call.width) {
      callNotifSize.width = json.call.width;
    } else {
      logger.log.warn(IDLOG, 'no win call popup width has been specified in ' + CONFIG_WINPOPUP_FILEPATH + ': use default ' + callNotifSize.width);
    }

    if (json && json.call && json.call.height) {
      callNotifSize.height = json.call.height;
    } else {
      logger.log.warn(IDLOG, 'no win call popup height has been specified in ' + CONFIG_WINPOPUP_FILEPATH + ': use default ' + callNotifSize.height);
    }

    if (json && json.close_timeout) {
      notifCloseTimeout = json.close_timeout;
    } else {
      logger.log.warn(IDLOG, 'no win close popup timeout has been specified in ' + CONFIG_WINPOPUP_FILEPATH + ': use default ' + notifCloseTimeout);
    }

    if (json && json.commands && typeof json.commands === 'object') {
      notifSupportedCommands = json.commands;
    } else {
      logger.log.warn(IDLOG, 'wrong win popup commands in ' + CONFIG_WINPOPUP_FILEPATH);
    }

    // initialize the protocol used by windows notification popup to open the cti app
    if (json && json.cti_proto && (json.cti_proto === 'https' || json.cti_proto === 'http')) {
      ctiProto = json.cti_proto;
    } else {
      logger.log.warn(IDLOG, 'bad "cti_proto" for win popup in ' + CONFIG_WINPOPUP_FILEPATH + ': use default ' + ctiProto);
    }
    logger.log.info(IDLOG, 'configuration of notification popup done by ' + CONFIG_WINPOPUP_FILEPATH);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Creates the TCP and TLS servers and adds the listeners for other components.
 *
 * @method start
 */
function start() {
  try {
    // check the configuration. The server starts only if the configuration has been done
    // correctly, that is if the /etc/nethcti/services.json file exists and contains
    // the tcp and tls json object
    if (tcpPort === undefined || tlsPort === undefined || tlsKey === undefined || tlsCert === undefined) {
      logger.log.error(IDLOG, 'tcp and tls servers do not start, because the configuration is not present');
      return;
    }
    // also check if the notification template file path exist
    if (!callNotifTemplatePath || !streamingNotifTemplatePath) {
      logger.log.error(IDLOG, 'tcp and tls servers do not start: templates file path are undefined');
      return;
    }

    // set the listener for the aterisk proxy module
    setAstProxyListeners();

    // tcp server
    tcpServer = net.createServer();

    // add listeners
    tcpServer.on('connection', connHdlr);
    tcpServer.listen(tcpPort, function () {
      logger.log.warn(IDLOG, 'tcp server listening on ' + tcpServer.address().address + ':' + tcpServer.address().port);
    });

    // tls server
    tlsServer = tls.createServer({
        key: fs.readFileSync(tlsKey),
        cert: fs.readFileSync(tlsCert)
      }
    );

    // add listeners
    tlsServer.on('secureConnection', connHdlr)
    tlsServer.listen(tlsPort, function () {
      logger.log.warn(IDLOG, 'tls server listening on ' + tlsServer.address().address + ':' + tlsServer.address().port);
    });

    // start the automatic update of token expiration of all the users that are connected by tcp.
    // The interval is the half value of expiration provided by authentication component
    setInterval(function () {
      updateTokenExpirationOfAllTcpUsers();
    }, updateTokenExpirationInterval);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Update the token expiration of all users that are connected by TCP.
 *
 * @method updateTokenExpirationOfAllTcpUsers
 * @private
 */
function updateTokenExpirationOfAllTcpUsers() {
  try {
    logger.log.info(IDLOG, 'update token expiration of all TCP users');
    var id;
    for (id in sockets) {
      compAuthe.updateTokenExpires(sockets[id].username, sockets[id].token);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * TCP server connection handler. A new client connection has been made.
 *
 * @method connHdlr
 * @param {object} socket The client socket
 * @private
 */
function connHdlr(socket) {
  try {
    logger.log.info(IDLOG, 'new connection from ' + getClientSocketEndpoint(socket));

    // set the socket identifier
    socket.id = getClientSocketEndpoint(socket);

    // set the socket encoding
    socket.setEncoding('utf8');

    // add listeners to the new socket connection
    // Emitted when data is received.
    socket.on('data', function (data) {
      try {
        var parameters = JSON.parse(data);

        // dispatch the message
        if (parameters.action === 'login') {
          loginHdlr(socket, parameters);
        } else if (parameters.action === 'ping') {
          pingHdlr(socket);
        } else if (parameters.action === 'reset' && parameters.type === 'commands') {
          resetCommandsHdlr(socket, parameters);
        }

      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
      }
    });

    // Emitted when the other end of the socket sends a FIN packet
    socket.on('end', function () {
      try {
        disconnHdlr(socket);

      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
      }
    });

    // Emitted once the socket is fully closed. The argument had_error is a
    // boolean which says if the socket was closed due to a transmission error.
    socket.on('close', function (had_error) {
      try {
        disconnHdlr(socket);

      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
      }
    });

    // Emitted when an error occurs. The 'close' event will be called directly following this event.
    socket.on('error', function (error) {
      try {
        logger.log.error(IDLOG, error.stack);

      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
      }
    });

    // Emitted when the write buffer becomes empty. Can be used to throttle uploads.
    socket.on('drain', function () {});

    logger.log.info(IDLOG, 'listeners for the new socket connection have been set');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the endpoint of the client socket. The endpoint is constructed by _ip\_address:port._
 *
 * @method getSocketEndpoint
 * @param  {object} socket The TCP client socket
 * @return {string} The socket endpoint as _ip\_address:port._
 * @private
 */
function getClientSocketEndpoint(socket) {
  try {
    return socket.remoteAddress + ':' + socket.remotePort;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Manage unauthorized access. It send 401 unauthorized response
 * to the client and disconnect the socket.
 *
 * @method unauthorized
 * @param {object} socket The client socket
 * @private
 */
function unauthorized(socket) {
  try {
    send401(socket); // send 401 unauthorized response to the client
    socket.destroy();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * TCP socket login handler.
 *
 * @method loginHdlr
 * @param {object} socket The client socket
 * @param {object} obj
 *   @param {string} obj.username The username of the account
 *   @param {string} obj.token    The token constructed with the authentication REST request
 * @private
 */
function loginHdlr(socket, obj) {
  try {
    // check parameters
    if (typeof socket !== 'object' ||
      typeof obj !== 'object' ||
      typeof obj.token !== 'string' ||
      typeof obj.username !== 'string') {

      logger.log.warn(IDLOG, 'bad authentication login request from ' + getClientSocketEndpoint(socket));
      unauthorized(socket);
      return;
    }

    if (compAuthe.verifyToken(obj.username, obj.token, false) === true) { // user successfully authenticated

      logger.log.info(IDLOG, 'user "' + obj.username + '" successfully authenticated from ' + getClientSocketEndpoint(socket));

      if (obj.username.includes('@') && obj.username.split('@').length === 2) {
        socket.username = obj.username.split('@')[0];
      } else if (compAstProxy.isExten(obj.username)) {
        socket.username = compUser.getUserUsingEndpointExtension(obj.username);
      } else {
        socket.username = obj.username;
      }

      // sets the username and the token property to the client socket
      socket.token = obj.token;
      socket.nethifierVersion = obj.version ? obj.version : '<3.0.0';

      // add client socket to future fast authentication for each request from the clients
      addSocket(socket);

      // send authenticated successfully response
      sendAutheSuccess(socket);

      // send supported commands by windows notifications
      sendNotificationSupportedCommands(socket);
      var presence = compUser.getPresence(socket.username);
      sendColorLed(socket.username, LED_COLOR_MAPPING[presence], socket);

    } else { // authentication failed
      logger.log.warn(IDLOG, 'authentication failed for user "' + obj.username + '" from ' + getClientSocketEndpoint(socket));
      unauthorized(socket);
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    unauthorized(socket);
  }
}

/**
 * The handler to reset the commands of a nethifier client.
 *
 * @method resetCommandsHdlr
 * @param {object} socket The client socket
 * @param {object} obj
 *   @param {string} obj.username The username of the account
 *   @param {string} obj.token    The token constructed with the authentication REST request
 * @private
 */
function resetCommandsHdlr(socket, obj) {
  try {
    // check parameters
    if (typeof socket !== 'object' ||
      typeof obj !== 'object' ||
      typeof obj.token !== 'string' ||
      typeof obj.username !== 'string') {

      logger.log.warn(IDLOG, 'bad reset commands request from from ' + getClientSocketEndpoint(socket));
      unauthorized(socket);
      return;
    }

    if (compAuthe.verifyToken(obj.username, obj.token, false) === true) { // user successfully authenticated

      // send the message to reset the supported commands by windows notifications
      sendResetNotificationSupportedCommands(socket);

    } else { // authentication failed
      logger.log.warn(IDLOG, 'unauthorized reset commands request by user "' + obj.username + '" from ' + getClientSocketEndpoint(socket));
      unauthorized(socket);
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * TCP socket ping handler. It responds with an "active" message.
 *
 * @method pingHdlr
 * @param {object} socket The client socket
 * @private
 */
function pingHdlr(socket) {
  try {
    // check parameters
    if (typeof socket !== 'object') {
      throw new Error('wrong socket parameter');
    }
    var data = {};
    data[EVT_PING] = 'active';
    socketSend(socket, data, function () {
      logger.log.info(IDLOG, 'sent "' + EVT_PING + '" evt response "active" to ping request to ' + socket.username + ' with socket.id ' + socket.id);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send supported commands by the windows notifications of incoming calls.
 *
 * @method sendNotificationSupportedCommands
 * @param {object} socket The client socket
 * @private
 */
function sendNotificationSupportedCommands(socket) {
  try {
    if (typeof socket !== 'object') {
      throw new Error('wrong socket parameter');
    }
    var cmds = {};
    cmds[EVT_COMMANDS] = notifSupportedCommands;
    socketSend(socket, cmds, function () {
      logger.log.info(IDLOG, 'sent "' + EVT_COMMANDS + '" evt notification supported commands to ' + socket.username + ' ' + getClientSocketEndpoint(socket));
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sends the message to reset the supported commands by the windows notifications client.
 *
 * @method sendResetNotificationSupportedCommands
 * @param {object} socket The client socket
 * @private
 */
function sendResetNotificationSupportedCommands(socket) {
  try {
    // check parameters
    if (typeof socket !== 'object') {
      throw new Error('wrong socket parameter');
    }
    var obj = {
      action: 'reset',
      type: 'commands',
      commands: notifSupportedCommands
    };
    socketSend(socket, obj, function () {
      logger.log.info(IDLOG, 'sent reset notification supported commands to ' + socket.username + ' ' + getClientSocketEndpoint(socket));
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Client socket disconnection handler.
 *
 * @method disconnHdlr
 * @param {object} socket The client socket
 * @private
 */
function disconnHdlr(socket) {
  try {
    logger.log.info(IDLOG, 'client socket disconnected ' + getClientSocketEndpoint(socket));

    // remove trusted identifier of the socket
    removeClientSocket(socket.id);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Removes the client socket from the private object _sockets_.
 *
 * @method removeClientSocket
 * @param {string} socketId The client socket identifier
 * private
 */
function removeClientSocket(socketId) {
  try {
    if (sockets[socketId]) {
      var tokenTemp = sockets[socketId].token;
      var usernameTemp = sockets[socketId].username;
      delete sockets[socketId];
      logger.log.info(IDLOG, 'removed client socket ' + socketId + ' of the user ' + usernameTemp + ' with token ' + tokenTemp);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Adds the client socket into the private object _sockets_.
 * If it already exists it will be overwritten.
 *
 * @method addSocket
 * @param {string} socket The client socket
 * private
 */
function addSocket(socket) {
  try {
    sockets[socket.id] = socket;
    logger.log.info(IDLOG, 'added client socket ' + socket.id + ' for user ' + socket.username + ' with token ' + socket.token);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send 401 unauthorization response through the client socket.
 *
 * @method send401
 * @param {object} socket The client socket
 * @private
 */
function send401(socket) {
  try {
    socketSend(socket, '401', function () {
      logger.log.info(IDLOG, 'sent 401 unauthorized to ' + getClientSocketEndpoint(socket));
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Send authorized successfully response to the client by socket.
 *
 * @method sendAutheSuccess
 * @param {object} socket The client socket
 * @private
 */
function sendAutheSuccess(socket) {
  try {
    socketSend(socket, { message: 'authe_ok' }, function () {
      logger.log.info(IDLOG, 'sent authorized successfully to ' + socket.username + ' with socket.id ' + socket.id);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the number of connected clients.
 *
 * @method getNumConnectedClients
 * @return {object} The number of connected clients grouped by version and the total
 * @private
 */
function getNumConnectedClients() {
  try {
    var s;
    var o = { tot: 0 };
    for (s in sockets) {
      if (!o[sockets[s].nethifierVersion]) {
        o[sockets[s].nethifierVersion] = 1;
      } else {
        o[sockets[s].nethifierVersion] += 1;
      }
      o.tot += 1;
    }
    return o;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
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
    streamNotifSize = {
      width: 400,
      height: 400
    };
    callNotifSize = {
      width: 400,
      height: 96
    };
    notifSupportedCommands = {};
    notifCloseTimeout = 10;
    ctiProto = 'https';
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
    configWinPopup(CONFIG_WINPOPUP_FILEPATH);
    logger.log.info(IDLOG, 'emit event "' + EVT_RELOADED + '"');
    emitter.emit(EVT_RELOADED);
    logger.log.warn(IDLOG, 'reloaded');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
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

exports.on = on;
exports.EVT_RELOADED = EVT_RELOADED;
exports.start = start;
exports.config = config;
exports.reload = reload;
exports.setLogger = setLogger;
exports.setAstProxy = setAstProxy;
exports.setCompUser = setCompUser;
exports.setCompAuthe = setCompAuthe;
exports.configWinPopup = configWinPopup;
exports.setCompStreaming = setCompStreaming;
exports.setCompConfigManager = setCompConfigManager;
exports.setCompAuthorization = setCompAuthorization;
exports.getNumConnectedClients = getNumConnectedClients;
exports.sendPhoneRequest = sendPhoneRequest;
exports.setNethifierLog = setNethifierLog;
exports.isUserConnected = isUserConnected;