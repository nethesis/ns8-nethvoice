/**
 * Abstraction of an extension.
 *
 * **It can throw exceptions.**
 *
 * @class Extension
 * @param {string} ext The extension number
 * @param {string} chType The channel type, e.g. sip, iax
 * @return {object} The extension object.
 * @constructor
 */
exports.Extension = function(ext, chType) {
  // check the parameters
  if (!ext || !chType || typeof ext !== 'string' || typeof chType !== 'string') {
    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The Extension number.
   *
   * @property exten
   * @type {string}
   * @required
   * @private
   */
  var exten = ext;

  /**
   * The Extension name.
   *
   * @property name
   * @type {string}
   * @required
   * @private
   */
  var name = '';

  /**
   * The ip address of the device.
   *
   * @property ip
   * @type {string}
   * @private
   */
  var ip;

  /**
   * The supported codecs.
   *
   * @property codecs
   * @type {array}
   * @private
   */
  var codecs = [];

  /**
   * The extension context.
   *
   * @property context
   * @type {string}
   * @private
   */
  var context;

  /**
   * The don't disturb status.
   *
   * @property dnd
   * @type {boolean}
   * @private
   */
  var dnd;

  /**
   * The call forward status.
   *
   * @property cf
   * @type {string}
   * @private
   */
  var cf;

  /**
   * The call forward busy status.
   *
   * @property cfb
   * @type {string}
   * @private
   */
  var cfb;

  /**
   * The call forward unavailable status.
   *
   * @property cfu
   * @type {string}
   * @private
   */
  var cfu;

  /**
   * The call forward to voicemail status.
   *
   * @property cfVm
   * @type {string}
   * @private
   */
  var cfVm;

  /**
   * The call forward on busy to voicemail status.
   *
   * @property cfbVm
   * @type {string}
   * @private
   */
  var cfbVm;

  /**
   * The call forward on unavailable to voicemail status.
   *
   * @property cfuVm
   * @type {string}
   * @private
   */
  var cfuVm;

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
   * The sip user agent.
   *
   * @property sipuseragent
   * @type string
   * @required
   * @private
   */
  var sipuseragent;

  /**
   * The Extension status.
   *
   * @property status
   * @type string
   * @private
   */
  var status;

  /**
   * True if the extension uses websocket.
   *
   * @property useWebsocket
   * @type boolean
   * @private
   */
  var useWebsocket;

  /**
   * The username.
   *
   * @property username
   * @type string
   * @private
   */
  var username;

  /**
   * The mac address.
   *
   * @property mac
   * @type string
   * @private
   */
  let mac;

  /**
   * The user conversations. The key is the conversation identifier
   * and the value is the _conversation_ object.
   *
   * @property conversations
   * @type object
   * @private
   * @default {}
   */
  var conversations = {};

  /**
   * Return the extension number.
   *
   * @method getExten
   * @return {string} The extension number
   */
  function getExten() {
    return exten;
  }

  /**
   * Returns the extension context.
   *
   * @method getContext
   * @return {string} The extension context
   */
  function getContext() {
    return context;
  }

  /**
   * Return the readable string of the extension.
   *
   * @method toString
   * @return {string} The readable description of the extension
   */
  function toString() {
    return getChanType() + '/' + getExten();
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
   * Check if the extension is online.
   *
   * @method isOnline
   * @return {boolean} True if the extension is online, false otherwise.
   */
  function isOnline() {
    if (status === STATUS_ENUM.ONLINE) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Set the extension ip address.
   *
   * @method setIp
   * @param {string} ipAddr The ip address
   */
  function setIp(ipAddr) {
    ip = ipAddr;
  }

  /**
   * Get the username.
   *
   * @method getUsername
   * @return {string} The username.
   */
  function getUsername() {
    return username;
  }

  /**
   * Set the username.
   *
   * @method setUsername
   * @param {string} name The name of the user
   */
  function setUsername(name) {
    username = name;
  }

  /**
   * Get codecs.
   *
   * @method getCodecs
   * @return {array} The codecs.
   */
  function getCodecs() {
    return codecs;
  }

  /**
   * Set codecs.
   *
   * @method setCodecs
   * @param {array} c The codecs
   */
  function setCodecs(c) {
    codecs = c;
  }

  /**
   * Set the extension context.
   *
   * @method setContext
   * @param {string} ctx The context
   */
  function setContext(ctx) {
    context = ctx;
  }

  /**
   * Sets if the extension uses websocket.
   *
   * @method setUseWebsocket
   * @param {boolean} value True if the extension uses websocket
   */
  function setUseWebsocket(value) {
    useWebsocket = value;
  }

  /**
   * Returns true if the extension uses websocket.
   *
   * @method usingWebsocket
   * @return {boolean} True if the extension uses websocket.
   */
  function usingWebsocket() {
    return useWebsocket;
  }

  /**
   * Get the extension ip address.
   *
   * @method getIp
   * @return {string} The ip address.
   */
  function getIp(ipAddr) {
    return ip;
  }

  /**
   * Get the extension user agent.
   *
   * @method getUserAgent
   * @return {string} The user agent.
   */
  function getUserAgent() {
    return sipuseragent;
  }

  /**
   * Set the extension ip port.
   *
   * @method setPort
   * @param {string} ipPort The ip port
   */
  function setPort(ipPort) {
    port = ipPort;
  }

  /**
   * Get the extension ip port.
   *
   * @method getPort
   * @return {string} The ip port.
   */
  function getPort(ipPort) {
    return port;
  }

  /**
   * Set the extension name.
   *
   * @method setName
   * @param {string} extName The extension name
   */
  function setName(extName) {
    name = extName;
  }

  /**
   * Return the extension name.
   *
   * @method getName
   * @return {string} The extension name.
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
   * Set the extension status.
   *
   * @method setStatus
   * @param {string} extStatus The extension status must be one
   * of _STATUS\_ENUM_ property.
   *
   * **It can throw exception**.
   */
  function setStatus(extStatus) {
    if (STATUS_ENUM[extStatus.toUpperCase()]) {
      status = extStatus;
      return true;
    }
    throw new Error('wrong parameter extStatus');
  }

  /**
   * Get the extension status.
   *
   * @method getStatus
   * @return {string} The extension status.
   */
  function getStatus(extStatus) {
    return status;
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
   * Return the number of connected conversation through the specified queue.
   *
   * @method getCCCounterByQueue
   * @param {string} qid The queue identifier
   * @return {number} The number of conversation through the queue.
   */
  function getCCCounterByQueue(qid) {
    var c;
    var count = 0;
    for (c in conversations) {
      if (conversations[c].isThroughQueue() === true &&
        conversations[c].isConnected() === true &&
        conversations[c].getQueueId() === qid) {

        count += 1;
      }
    }
    return count;
  }

  /**
   * Return the conversation list.
   *
   * @method getAllConversations
   * @return {object} All conversations of the extension.
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
   * Set the don't disturb status.
   *
   * @method setDnd
   * @param {boolean} value The status of the don't disturb. True if it's activated, false otherwise.
   */
  function setDnd(value) {
    dnd = value;
  }

  /**
   * Get the don't disturb status.
   *
   * @method getDnd
   * @return {boolean} The don't disturb status. True if it's activated, false otherwise.
   */
  function getDnd() {
    return dnd;
  }

  /**
   * Set the call forward number.
   *
   * @method setCf
   * @param {string} value The number to set the call forward
   */
  function setCf(value) {
    cf = value;
  }

  /**
   * Set the call forward busy number.
   *
   * @method setCfb
   * @param {string} value The number to set the call forward busy
   */
  function setCfb(value) {
    cfb = value;
  }

  /**
   * Set the call forward on unavailable number.
   *
   * @method setCfu
   * @param {string} value The number to set the call forward on unavailable
   */
  function setCfu(value) {
    cfu = value;
  }

  /**
   * Set the call forward to voicemail.
   *
   * @method setCfVm
   * @param {string} value The destination voicemail number to set the call forward to voicemail.
   */
  function setCfVm(value) {
    cfVm = value;
  }

  /**
   * Set the call forward on busy to voicemail.
   *
   * @method setCfbVm
   * @param {string} value The destination voicemail number to set the call forward on busy to voicemail.
   */
  function setCfbVm(value) {
    cfbVm = value;
  }

  /**
   * Set the call forward on unavailable to voicemail.
   *
   * @method setCfuVm
   * @param {string} value The destination voicemail number to set the call forward on unavailable to voicemail.
   */
  function setCfuVm(value) {
    cfuVm = value;
  }

  /**
   * Set the mac address.
   *
   * @method setMac
   * @param {string} addr The mac address
   */
  function setMac(addr) {
    mac = addr;
  }

  /**
   * Get the call forward status.
   *
   * @method getCf
   * @return {string} The number of the call forward. Returns an empty string if it is disabled.
   */
  function getCf() {
    return cf;
  }

  /**
   * Get the call forward busy status.
   *
   * @method getCfb
   * @return {string} The number of the call forward busy. Returns an empty string if it is disabled.
   */
  function getCfb() {
    return cfb;
  }

  /**
   * Get the call forward on unavailable status.
   *
   * @method getCfu
   * @return {string} The number of the call forward on unavailable. Returns an empty string if it is disabled.
   */
  function getCfu() {
    return cfu;
  }

  /**
   * Get the call forward on busy to voicemail status.
   *
   * @method getCfbVm
   * @return {string} The voicemail number of the call forward on busy to voicemail. Returns an empty string if it is disabled.
   */
  function getCfbVm() {
    return cfbVm;
  }

  /**
   * Get the call forward on unavailable to voicemail status.
   *
   * @method getCfuVm
   * @return {string} The voicemail number of the call forward on unavailable to voicemail. Returns an empty string if it is disabled.
   */
  function getCfuVm() {
    return cfuVm;
  }

  /**
   * Get the call forward to voicemail status.
   *
   * @method getCfVm
   * @return {string} The voicemail number of the call forward to voicemail. Returns an empty string if it is disabled.
   */
  function getCfVm() {
    return cfVm;
  }

  /**
   * Disable the call forward status.
   *
   * @method disableCf
   */
  function disableCf() {
    cf = '';
  }

  /**
   * Disable the call forward busy status.
   *
   * @method disableCfb
   */
  function disableCfb() {
    cfb = '';
  }

  /**
   * Disable the call forward on unavailble status.
   *
   * @method disableCfu
   */
  function disableCfu() {
    cfu = '';
  }

  /**
   * Disable the call forward to voicemail status.
   *
   * @method disableCfVm
   */
  function disableCfVm() {
    cfVm = '';
  }

  /**
   * Disable the call forward on busy to voicemail status.
   *
   * @method disableCfbVm
   */
  function disableCfbVm() {
    cfbVm = '';
  }

  /**
   * Disable the call forward on unavailable to voicemail status.
   *
   * @method disableCfuVm
   */
  function disableCfuVm() {
    cfuVm = '';
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         "ip":           "192.168.5.163",
   *         "cf":           "221",                          // the call forward status. If it's disabled, it is an empty string
   *         "cfb":          "221",                          // the call forward on busy status. If it's disabled, it is an empty string
   *         "cfu":          "221",                          // the call forward on unavailable status. If it's disabled, it is an empty string
   *         "dnd":          false,                          // it's true if the don't disturb is active
   *         "cfVm":         "",                             // the call forward to voicemail status. If it's disabled, it is an empty string
   *         "cfbVm":        "",                             // the call forward on busy to voicemail status. If it's disabled, it is an empty string
   *         "cfuVm":        "",                             // the call forward on unavailable to voicemail status. If it's disabled, it is an empty string
   *         "codecs":       ["ulaw", "alaw"],
   *         "port":         "5062",
   *         "name":         "Alessandro",
   *         "exten":        "214",
   *         "status":       "online",                       // the status can be: "dnd", "busy", "online", "onhold", "offline", "ringing", "busy_ringing"
   *         "context":      "from-internal",                // the context
   *         "username":     "user1",
   *         "useWebsocket": false,                          // if the extension use websocket
   *         "sipuseragent": "Twinkle/1.4.2",
   *         "conversations": { Conversation.{{#crossLink "Conversation/toJSON"}}{{/crossLink}}() } // the keys is the conversation identifiers
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStrOutQueue] If it is specified, it obfuscates the number of all calls that does not pass through a queue
   * @param  {string} [privacyStrInQueue]  If it is specified, it obfuscates the number of all calls that pass through a queue
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStrOutQueue, privacyStrInQueue) {

    var jsonConvs = {};
    var convid;

    // JSON representation of the conversations
    for (convid in conversations) {
      jsonConvs[convid] = conversations[convid].toJSON(privacyStrOutQueue, privacyStrInQueue);
    }

    let cfTemp = cf;
    let cfbTemp = cfb;
    let cfuTemp = cfu;

    if (typeof cfTemp === 'string' && cfTemp.length > 0 && privacyStrOutQueue) {
      cfTemp = cfTemp.slice(0, -privacyStrOutQueue.length) + privacyStrOutQueue;
    }
    if (typeof cfbTemp === 'string' && cfbTemp.length > 0 && privacyStrOutQueue) {
      cfbTemp = cfbTemp.slice(0, -privacyStrOutQueue.length) + privacyStrOutQueue;
    }
    if (typeof cfuTemp === 'string' && cfuTemp.length > 0 && privacyStrOutQueue) {
      cfuTemp = cfuTemp.slice(0, -privacyStrOutQueue.length) + privacyStrOutQueue;
    }

    return {
      ip: ip,
      cf: cfTemp,
      mac: mac,
      cfb: cfbTemp,
      cfu: cfuTemp,
      dnd: dnd,
      cfVm: cfVm,
      port: port,
      name: name,
      cfbVm: cfbVm,
      cfuVm: cfuVm,
      exten: exten,
      codecs: codecs,
      status: status,
      context: context,
      chanType: chanType,
      username: username,
      useWebsocket: useWebsocket,
      sipuseragent: sipuseragent,
      conversations: jsonConvs
    };
  }

  // public interface
  return {
    setCf: setCf,
    getCf: getCf,
    setIp: setIp,
    getIp: getIp,
    setMac: setMac,
    setCfb: setCfb,
    getCfb: getCfb,
    setCfu: setCfu,
    getCfu: getCfu,
    toJSON: toJSON,
    setDnd: setDnd,
    getDnd: getDnd,
    setCfVm: setCfVm,
    getCfVm: getCfVm,
    getCfVm: getCfVm,
    setCfbVm: setCfbVm,
    getCfbVm: getCfbVm,
    setCfuVm: setCfuVm,
    getCfuVm: getCfuVm,
    getName: getName,
    setName: setName,
    setPort: setPort,
    getPort: getPort,
    isOnline: isOnline,
    getExten: getExten,
    toString: toString,
    disableCf: disableCf,
    setStatus: setStatus,
    setUsername: setUsername,
    getUsername: getUsername,
    getStatus: getStatus,
    getCodecs: getCodecs,
    setCodecs: setCodecs,
    disableCfb: disableCfb,
    disableCfu: disableCfu,
    setContext: setContext,
    getContext: getContext,
    disableCfVm: disableCfVm,
    getChanType: getChanType,
    getUserAgent: getUserAgent,
    disableCfbVm: disableCfbVm,
    disableCfuVm: disableCfuVm,
    usingWebsocket: usingWebsocket,
    setUseWebsocket: setUseWebsocket,
    addConversation: addConversation,
    setSipUserAgent: setSipUserAgent,
    getConversation: getConversation,
    conversationCount: conversationCount,
    removeConversation: removeConversation,
    getAllConversations: getAllConversations,
    getCCCounterByQueue: getCCCounterByQueue,
    removeAllConversations: removeAllConversations
  };
};

/**
 * The Extension status enumeration.
 *
 * @property STATUS_ENUM
 * @type {object}
 * @private
 * @final
 * @default {
    DND:          "dnd",         // Busy
    BUSY:         "busy",        // In Use
    ONLINE:       "online",      // Idle
    ONHOLD:       "onhold",
    OFFLINE:      "offline",     // Unavailable
    RINGING:      "ringing",     // Ringing
    BUSY_RINGING: "busy_ringing" // In Use & Ringin
}
 */
var STATUS_ENUM = {
  DND: 'dnd', // Busy
  BUSY: 'busy', // In Use
  ONLINE: 'online', // Idle
  ONHOLD: 'onhold',
  OFFLINE: 'offline', // Unavailable
  RINGING: 'ringing', // Ringing
  BUSY_RINGING: 'busy_ringing' // In Use & Ringin
};

/**
 * The Extension status enumeration. It's the same of
 * private _STATUS\_ENUM_.
 *
 * @property EXT_STATUS_ENUM
 * @type {object}
 * @final
 * @default Equal to the private property STATUS_ENUM
 */
exports.EXTEN_STATUS_ENUM = STATUS_ENUM;
