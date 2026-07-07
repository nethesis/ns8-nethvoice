var utilChannel13 = require('./proxy_logic_13/util_channel_13');

/**
 * Abstraction of an asterisk channel.
 *
 * **It can throw exceptions.**
 *
 * @class TrunkChannel
 * @param {object} channel The channel object
 *   @param {string} channel.channel        The channel identifier
 *   @param {string} channel.callerNum      The caller number
 *   @param {string} channel.callerName     The caller name
 *   @param {string} channel.bridgedNum     The connected number
 *   @param {string} channel.bridgedName    The connected name
 *   @param {string} channel.bridgedChannel The connected asterisk channel
 *   @param {string} channel.status         The status description of the asterisk channel
 * @return {object} The channel object.
 * @constructor
 */
exports.TrunkChannel = function(obj) {
  // check parameter
  if (obj.channel === undefined ||
    obj.status === undefined ||
    obj.uniqueid === undefined ||
    obj.callerNum === undefined ||
    obj.callerName === undefined ||
    obj.bridgedNum === undefined ||
    obj.bridgedName === undefined) {

    throw new Error('wrong parameter: ' + JSON.stringify(obj));
  }

  /**
   * The channel identifier.
   *
   * @property {string} channel
   * @required
   * @private
   */
  var channel = obj.channel;

  /**
   * The unique identifier.
   *
   * @property {string} uniqueid
   * @required
   * @private
   */
  var uniqueid = obj.uniqueid;

  /**
   * True if the channel involves a meetme conference.
   *
   * @property {boolean} inConference
   * @required
   * @private
   */
  var inConference = obj.inConference;

  /**
   * The creation time in milliseconds from Jan 1, 1970.
   *
   * @property {number} startTime
   * @private
   */
  var startTime = parseInt(obj.uniqueid.split('.')[0]) * 1000;

  /**
   * The caller number.
   *
   * @property callerNum
   * @type string
   * @required
   * @private
   */
  var callerNum = obj.callerNum;

  /**
   * The caller name.
   *
   * @property {string} callerName
   * @required
   * @private
   */
  var callerName = obj.callerName;

  /**
   * The connected number.
   *
   * @property {string} bridgedNum
   * @required
   * @private
   */
  var bridgedNum = obj.bridgedNum;

  /**
   * The connected name.
   *
   * @property {string} bridgedName
   * @required
   * @private
   */
  var bridgedName = obj.bridgedName;

  /**
   * The connected channel.
   *
   * @property {string} bridgedChannel
   * @required
   * @private
   */
  var bridgedChannel = obj.bridgedChannel;

  /**
   * The status description of the asterisk channel.
   *
   * @property {string} channelStatus
   * @required
   * @private
   */
  var channelStatus = obj.status;

  /**
   * The type of the channel can be source or destination.
   *
   * @property {string} type
   * @required
   * @private
   */
  var type;
  if (channelStatus === STATUS_ENUM.RING || !obj.uniqueid_linked) {
    type = TYPE.SOURCE;

  } else if (channelStatus === STATUS_ENUM.RINGING) {
    type = TYPE.DEST;

  } else {
    var numUniqueid = obj.uniqueid.split('.').pop();
    var numUniqueidLinked = obj.uniqueid_linked.split('.').pop();
    type = (numUniqueid < numUniqueidLinked) ? TYPE.SOURCE : TYPE.DEST;
  }

  /**
   * Returns true if the channel status is "up".
   *
   * @method isStatusUp
   * @return {boolean} True if the channel status is "up".
   */
  function isStatusUp() {
    return (channelStatus === utilChannel13.AST_CHANNEL_STATE_2_STRING_ADAPTER['6']);
  }

  /**
   * Return the channel identifier.
   *
   * @method getChannel
   * @return {string} The channel identifier.
   */
  function getChannel() {
    return channel;
  }

  /**
   * Return the unique identifier.
   *
   * @method getUniqueId
   * @return {string} The unique identifier.
   */
  function getUniqueId() {
    return uniqueid;
  }

  /**
   * Return the caller number.
   *
   * @method getCallerNum
   * @return {string} The caller number
   */
  function getCallerNum() {
    return callerNum;
  }

  /**
   * Return the caller name.
   *
   * @method getCallerName
   * @return {string} The caller name.
   */
  function getCallerName() {
    return callerName;
  }

  /**
   * Return the connected number.
   *
   * @method getBridgedNum
   * @return {string} The connected number.
   */
  function getBridgedNum() {
    return bridgedNum;
  }

  /**
   * Return the connected name.
   *
   * @method getBridgedName
   * @return {string} The connected name
   */
  function getBridgedName() {
    return bridgedName;
  }

  /**
   * Return the connected channel identifier.
   *
   * @method getBridgedChannel
   * @return {string} The connected channel identifier.
   */
  function getBridgedChannel() {
    return bridgedChannel;
  }

  /**
   * Return the channel status description.
   *
   * @method getChannelStatus
   * @return {string} The channel status description.
   */
  function getChannelStatus() {
    return channelStatus;
  }

  /**
   * Return the channel time creation from Jan 1, 1970.
   *
   * @method getStartTime
   * @return {number} The channel creation time from Jan 1, 1970.
   */
  function getStartTime() {
    return startTime;
  }

  /**
   * Return the readable string of the extension.
   *
   * @method toString
   * @return {string} The readable description of the extension
   */
  function toString() {
    return 'TrunkChannel ' + channel;
  }

  /**
   * Check if the channel is the source.
   *
   * @method isSource
   * @return {boolean} Return true if the channel is the source, false otherwise.
   */
  function isSource() {
    return type === TYPE.SOURCE;
  }

  /**
   * True if the channel involves a meetme conference.
   *
   * @method isInConference
   * @return {boolean} Returns true if the channel involves a meetme conference.
   */
  function isInConference() {
    return inConference;
  }

  /**
   * Check if the channel status id "down".
   *
   * @method isDown
   * @return {boolean} Returns true if the channel status is "down".
   */
  function isDown() {
    return channelStatus === STATUS_ENUM.DOWN;
  }

  /**
   * Returns true if this channel is of the specified extension.
   *
   * @method isExtension
   * @param  {string}  exten The extension identifier
   * @return {boolean} True if the channel is of the specified extension identifier
   */
  function isExtension(exten) {
    return utilChannel13.extractExtensionFromChannel(channel) === exten;
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         type:           "destination",      // the channel type: it can be "destination" or "source"
   *         channel:        "PJSIP/214-0000034f"  // the channel identifier
   *         callerNum:      "214"
   *         startTime:      1365600403000       // the starting call timestamp
   *         callerName:     "sip214ale"
   *         bridgedNum:     "221"               // the number of the connected caller/called
   *         bridgedName:    "sip221ale"         // the name of the connected caller/called
   *         inConference:   true,               // true if the channel involves a meetme conference
   *         channelStatus:  "up"                // the channel status
   *         bridgedChannel: "PJSIP/221-0000034e", // the connected channel identifier
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStr) {
    return {
      type: type,
      channel: channel,
      callerNum: privacyStr ? (callerNum.slice(0, -privacyStr.length) + privacyStr) : callerNum,
      startTime: startTime,
      callerName: privacyStr ? privacyStr : callerName,
      bridgedNum: privacyStr ? (bridgedNum.slice(0, -privacyStr.length) + privacyStr) : bridgedNum,
      bridgedName: privacyStr ? privacyStr : bridgedName,
      inConference: inConference,
      channelStatus: channelStatus,
      bridgedChannel: bridgedChannel
    };
  }

  // public interface
  return {
    isDown: isDown,
    toJSON: toJSON,
    toString: toString,
    isSource: isSource,
    isStatusUp: isStatusUp,
    getChannel: getChannel,
    getUniqueId: getUniqueId,
    isExtension: isExtension,
    getStartTime: getStartTime,
    getCallerNum: getCallerNum,
    getCallerName: getCallerName,
    getBridgedNum: getBridgedNum,
    isInConference: isInConference,
    getBridgedName: getBridgedName,
    getChannelStatus: getChannelStatus,
    getBridgedChannel: getBridgedChannel,
  };
};

/**
 * The possible values for channel type.
 *
 * @property {object} TYPE
 * @private
 * @default {
    DEST:   "dest",
    SOURCE: "source"
}
 */
var TYPE = {
  DEST: 'dest',
  SOURCE: 'source'
};

/**
 * The TrunkChannel status enumeration.
 *
 * @property STATUS_ENUM
 * @type {object}
 * @private
 * @final
 * @default {
    DOWN:    "down",
    RING:    "ring",
    RINGING: "ringing"
}
 */
// the list is not complete. It's only used to determine
// the type of the channel and the trunk conversation direction
var STATUS_ENUM = {
  DOWN: 'down',
  RING: 'ring',
  RINGING: 'ringing'
};

/**
 * The TrunkChannel status enumeration. It's the same of
 * private _STATUS\_ENUM_.
 *
 * @property CHANNEL_STATUS_ENUM
 * @type {object}
 * @final
 * @default Equal to the private property STATUS_ENUM
 */
exports.CHANNEL_STATUS_ENUM = STATUS_ENUM;

/**
 * The possible values for channel type.
 *
 * @property {object} CHAN_TYPE
 * @default Has the same values as private TYPE property.
 */
exports.CHAN_TYPE = TYPE;
