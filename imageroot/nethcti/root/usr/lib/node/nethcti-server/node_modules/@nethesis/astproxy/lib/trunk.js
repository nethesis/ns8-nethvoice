/**
 * Abstraction of a trunk.
 *
 * **It can throw exceptions.**
 *
 * @class Trunk
 * @constructor
 * @param {string} ext The trunk identifier
 * @param {string} chType The channel type, e.g. sip, iax
 * @param {string} [maxCh] Maximum number of channels supported by the trunk
 * @return {object} The trunk object.
 */
exports.Trunk = function(ext, chType, maxCh) {
  // check the parameters
  if (!ext || !chType || typeof ext !== 'string' || typeof chType !== 'string') {

    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The trunk identifier.
   *
   * @property exten
   * @type {string}
   * @required
   * @private
   */
  var exten = ext;

  /**
   * The trunk name.
   *
   * @property name
   * @type {string}
   * @required
   * @private
   */
  var name = '';

  /**
   * The ip address of the trunk.
   *
   * @property ip
   * @type {string}
   * @private
   */
  var ip;

  /**
   * The port of the device.
   *
   * @property port
   * @type {string}
   * @private
   */
  var port;

  /**
   * The channel type.
   *
   * @property chanType
   * @type {string}
   * @required
   * @private
   */
  var chanType = chType;

  /**
   * The user context.
   *
   * @property userContext
   * @type {string}
   * @required
   * @private
   */
  var userContext;

  /**
   * The sip user agent.
   *
   * @property sipuseragent
   * @type {string}
   * @required
   * @private
   */
  var sipuseragent;

  /**
   * The trunk status.
   *
   * @property status
   * @type {string}
   * @private
   */
  var status;

  /**
   * The trunk registration.
   *
   * @property registration
   * @type {string}
   * @private
   */
  var registration;

  /**
   * The trunk supported codecs.
   *
   * @property codecs
   * @type {array}
   * @private
   */
  var codecs = [];

  /**
   * Maximum number of channels supported by the trunk.
   *
   * @property maxChannels
   * @type {number}
   * @private
   */
  var maxChannels = maxCh ? parseInt(maxCh) : 4;

  /**
   * The user conversations. The key is the conversation identifier
   * and the value is the _conversation_ object.
   *
   * @property conversations
   * @type {object}
   * @private
   */
  var conversations = {};

  /**
   * Return the trunk identifier.
   *
   * @method getExten
   * @return {string} The trunk identifier.
   */
  function getExten() {
    return exten;
  }

  /**
   * Return the readable string of the trunk.
   *
   * @method toString
   * @return {string} The readable description of the trunk
   */
  function toString() {
    return 'Trunk: ' + getChanType() + '/' + getExten();
  }

  /**
   * Return the channel type.
   *
   * @method getChanType
   * @return {string} The channel type
   */
  function getChanType() {
    return chanType;
  }

  /**
   * Check if the trunk is online.
   *
   * @method isOnline
   * @return {boolean} True if the truk is online, false otherwise.
   */
  function isOnline() {
    if (status === STATUS_ENUM.ONLINE) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Set the trunk ip address.
   *
   * @method setIp
   * @param {string} ipAddr The ip address
   */
  function setIp(ipAddr) {
    ip = ipAddr;
  }

  /**
   * Get the trunk ip address.
   *
   * @method getIp
   * @return {string} The ip address.
   */
  function getIp(ipAddr) {
    return ip;
  }

  /**
   * Get trunk codecs.
   *
   * @method getCodecs
   * @return {array} The codecs.
   */
  function getCodecs() {
    return codecs;
  }

  /**
   * Set trunk codecs.
   *
   * @method setCodecs
   * @param {array} c The codecs
   */
  function setCodecs(c) {
    codecs = c;
  }

  /**
   * Set the trunk ip port.
   *
   * @method setPort
   * @param {string} ipPort The ip port
   */
  function setPort(ipPort) {
    port = ipPort;
  }

  /**
   * Get the trunk ip port.
   *
   * @method getPort
   * @return {string} The ip port.
   */
  function getPort(ipPort) {
    return port;
  }

  /**
   * Set the trunk name.
   *
   * @method setName
   * @param {string} extName The trunk name
   */
  function setName(extName) {
    name = extName;
  }

  /**
   * Set the user context.
   *
   * @method setUserContext
   * @param {string} ctx The user context
   */
  function setUserContext(ctx) {
    userContext = ctx;
  }

  /**
   * Return the user context.
   *
   * @method getUserContext
   * @return {string} The user context.
   */
  function getUserContext() {
    return userContext;
  }

  /**
   * Return the trunk name.
   *
   * @method getName
   * @return {string} The trunk name.
   */
  function getName() {
    return name;
  }

  /**
   * Set the extension sip user agent.
   *
   * @method setSipUserAgent
   * @param {string} ua The extension sip user agent
   */
  function setSipUserAgent(ua) {
    sipuseragent = ua;
  }

  /**
   * Set the trunk status.
   *
   * @method setStatus
   * @param {string} trunkStatus The trunk status must be one of _STATUS\_ENUM_ property.
   */
  function setStatus(trunkStatus) {
    try {
      if (!trunkStatus) {
        throw new Error('wrong parameter trunkStatus "' + trunkStatus + '" for trunk ' + chanType + ' "' + name + '" ' + exten);
      }
      if (STATUS_ENUM[trunkStatus.toUpperCase()]) {
        status = trunkStatus;
        return true;
      }
      throw new Error('wrong parameter trunkStatus "' + trunkStatus + '" for trunk ' + chanType + ' "' + name + '" ' + exten);
    } catch (error) {
      logger.error(IDLOG, error.stack);
    }
  }

  /**
   * Get the trunk status.
   *
   * @method getStatus
   * @return {string} The trunk status.
   */
  function getStatus(extStatus) {
    return status;
  }

  /**
   * Set the trunk status.
   *
   * @method setRegistration
   * @param {string} registrationStatus The trunk registration status must be one of _REG\_ENUM_ property.
   */
   function setRegistration(registrationStatus) {
    try {
      if (!registrationStatus) {
        throw new Error('wrong parameter registrationStatus "' + registrationStatus + '" for trunk ' + chanType + ' "' + name + '" ' + exten);
      }
      if (REG_ENUM[registrationStatus.toUpperCase()]) {
        registration = registrationStatus;
        return true;
      }
      throw new Error('wrong parameter registrationStatus "' + registrationStatus + '" for trunk ' + chanType + ' "' + name + '" ' + exten);
    } catch (error) {
      logger.error(IDLOG, error.stack);
    }
  }

  /**
   * Get the trunk registration.
   *
   * @method getRegistration
   * @return {string} The trunk registration.
   */
  function getRegistration() {
    return registration;
  }

  /**
   * Sets the conversation. If it already exists it will be overwritten.
   *
   * @method addConversation
   * @param {object} conv The _conversation_ object.
   */
  function addConversation(conv) {
    // check parameter
    if (!conv || typeof conv !== 'object') {
      throw new Error('wrong parameter');
    }

    // add the conversation. If it already exists it will be overwritten
    conversations[conv.getId()] = conv;
  }

  /**
   * Return the conversation number.
   *
   * @method conversationCount
   * @return {number} The conversation number.
   */
  function conversationCount() {
    return Object.keys(conversations).length;
  }

  /**
   * Return the conversation list.
   *
   * @method getAllConversations
   * @return {object} All conversations of the trunk.
   */
  function getAllConversations() {
    return conversations;
  }

  /**
   * Return the specified conversation.
   *
   * @method getConversation
   * @param {string} convid The conversation identifier
   * @return {object} The specified conversation.
   */
  function getConversation(convid) {
    return conversations[convid];
  }

  /**
   * Removes the specified conversation.
   *
   * @method removeConversation
   * @param {string} The conversation identifier
   */
  function removeConversation(convid) {
    delete conversations[convid];
  }

  /**
   * Removes all conversations.
   *
   * @method removeAllConversations
   */
  function removeAllConversations() {
    conversations = {};
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         "ip":           "192.168.5.163",
   *         "port":         "5062",
   *         "name":         "2001",
   *         "exten":        "200",
   *         "codecs":       ["ulaw", "alaw"],
   *         "status":       "online",                       // the status can be: "busy", "online", "offline"
   *         "maxChannels":  4,                              // maximum number of channels supported by the trunk
   *         "sipuseragent": "Patton SN4638 5BIS",
   *         "conversations": { Conversation.{{#crossLink "Conversation/toJSON"}}{{/crossLink}}() } // the keys is the conversation identifiers
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStr) {

    var jsonConvs = {};
    var convid;

    // JSON representation of the conversations
    for (convid in conversations) {
      jsonConvs[convid] = conversations[convid].toJSON(privacyStr);
    }

    return {
      ip: ip,
      port: port,
      name: name,
      exten: exten,
      codecs: codecs,
      status: status || STATUS_ENUM.UNMONITORED, // set default status to unmonitored
      registration: registration || REG_ENUM.UNMONITORED, // ser default registration to unmonitored
      chanType: chanType,
      maxChannels: maxChannels,
      sipuseragent: sipuseragent,
      conversations: jsonConvs
    };
  }

  // public interface
  return {
    setIp: setIp,
    getIp: getIp,
    toJSON: toJSON,
    getName: getName,
    setName: setName,
    setPort: setPort,
    getPort: getPort,
    isOnline: isOnline,
    getExten: getExten,
    toString: toString,
    setStatus: setStatus,
    getStatus: getStatus,
    getCodecs: getCodecs,
    setCodecs: setCodecs,
    setRegistration: setRegistration,
    getRegistration: getRegistration,
    getChanType: getChanType,
    getUserContext: getUserContext,
    setUserContext: setUserContext,
    addConversation: addConversation,
    setSipUserAgent: setSipUserAgent,
    getConversation: getConversation,
    conversationCount: conversationCount,
    removeConversation: removeConversation,
    getAllConversations: getAllConversations,
    removeAllConversations: removeAllConversations
  };
};

/**
 * The trunk status enumeration.
 *
 * @property STATUS_ENUM
 * @type {object}
 * @private
 * @final
 * @default {
    BUSY:    "busy",
    ONLINE:  "online",
    OFFLINE: "offline"
 }
*/
var STATUS_ENUM = {
  BUSY: 'busy',
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNMONITORED: 'unmonitored'
};

/**
 * The trunk status enumeration. It's the same of
 * private _STATUS\_ENUM_.
 *
 * @property TRUNK_STATUS_ENUM
 * @type {object}
 * @final
 * @default Equal to the private property STATUS_ENUM
 */
exports.TRUNK_STATUS_ENUM = STATUS_ENUM;

/**
 * The trunk registration enumeration.
 *
 * @property REG_ENUM
 * @type {object}
 * @private
 * @final
 * @default {
    SENT: 'sent',
    UNREGISTERED: 'unregistered',
    REGISTERED: 'registered',
    REJECTED: 'rejected',
    NOAUTH: 'not authenticated',
    FAILED: 'failed'
 }
*/
var REG_ENUM = {
  SENT: 'sent',
  UNREGISTERED: 'unregistered',
  UNMONITORED: 'unmonitored',
  REGISTERED: 'registered',
  REJECTED: 'rejected',
  NOAUTH: 'noauth',
  FAILED: 'failed'
};

/**
 * The trunk registration enumeration. It's the same of
 * private _REG\_ENUM_.
 *
 * @property TRUNK_REG_ENUM
 * @type {object}
 * @final
 * @default Equal to the private property REG_ENUM
 */
exports.TRUNK_REG_ENUM = REG_ENUM;
