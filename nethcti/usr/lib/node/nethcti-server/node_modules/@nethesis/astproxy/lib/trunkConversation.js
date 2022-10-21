/**
 * Abstraction of a phone conversation through a trunk. This is equal to
 * _conversation.js_ except for the different calculation of the _counterPartNum_
 * and _direction_ properties.
 *
 * **It can throw exceptions.**
 *
 * @class TrunkConversation
 * @constructor
 * @return {object} The trunk conversation object.
 */
exports.TrunkConversation = function (ownerId, sourceChan, destChan) {
  // check parameters
  if (typeof ownerId !== 'string' ||
    (typeof destChan !== 'object' && typeof sourceChan !== 'object')) {

    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The owner of the channel.
   *
   * @property owner
   * @type {string}
   * @private
   */
  var owner = ownerId;

  /**
   * The source channel.
   *
   * @property chSource
   * @type {Channel}
   * @private
   */
  var chSource = sourceChan;

  /**
   * The destination channel.
   *
   * @property chDest
   * @type {Channel}
   * @private
   */
  var chDest = destChan;

  /**
   * The recordig status. It can be one of the "RECORDING_STATUS" property.
   *
   * @property recording
   * @type {string}
   * @default RECORDING_STATUS.FALSE
   * @private
   */
  var recording = RECORDING_STATUS.FALSE;

  /**
   * The timestamp of the starting time. This is necessary to
   * update the duration value.
   *
   * @property startime
   * @type {number}
   * @private
   */
  var startime = chSource ? chSource.getStartTime() : chDest.getStartTime();

  /**
   * The duration of the conversation in seconds.
   *
   * @property duration
   * @type {number}
   * @private
   */
  var duration;

  /**
   * The conversation identifier.
   *
   * @property id
   * @type {string}
   * @private
   */
  var id;
  if (chSource && chDest) {
    id = chSource.getChannel() + '>' + chDest.getChannel();
  } else if (chSource && !chDest) {
    id = chSource.getChannel() + '>';
  } else if (!chSource && chDest) {
    id = '>' + chDest.getChannel();
  }

  /**
   * The conversation direction.
   *
   * @property direction
   * @type {string}
   * @private
   */
  var direction;
  if (!chDest || (chDest && chDest.isExtension(owner))) {
    direction = DIRECTION.OUT;
  } else {
    direction = DIRECTION.IN;
  }

  /**
   * True if the conversation has gone through a queue.
   *
   * @property throughQueue
   * @type {boolean}
   * @private
   */
  var throughQueue;
  if (
    (chSource &&
      (
        chSource.getChannel().indexOf('from-queue') !== -1 ||
        (chSource.getBridgedChannel() && chSource.getBridgedChannel().indexOf('from-queue') !== -1)
      )
    ) ||
    (
      chDest &&
      (
        chDest.getChannel().indexOf('from-queue') !== -1 ||
        chDest.getBridgedChannel().indexOf('from-queue') !== -1
      )
    )
  ) {

    throughQueue = true;

  } else {
    throughQueue = false;
  }

  /**
   * The external number.
   *
   * @property externalNum
   * @type {string}
   * @private
   */
  /**
   * The name of the external number.
   *
   * @property externalName
   * @type {string}
   * @private
   */
  // "chSource" and "chDest" are always present at runtime. Instead,
  // during the boot, if there are some ringing calls, they may lack
  var externalNum;
  var externalName;
  if (chDest && chDest.isExtension(owner) === true) {
    externalNum = chDest.getCallerNum();
    externalName = chDest.getCallerName();

  } else if (chSource && chSource.isExtension(owner) === true) {
    externalNum = chSource.getCallerNum();
    externalName = chSource.getCallerName();
  }
  if (typeof externalName === 'string' && externalName.substring(0, 4) === 'CID:') {
    externalName = '';
  }

  /**
   * The internal extension.
   *
   * @property internalNum
   * @type {string}
   * @private
   */
  /**
   * The name of the internal extension.
   *
   * @property internalName
   * @type {string}
   * @private
   */
  // "chSource" and "chDest" are always present at runtime. Instead,
  // during the boot, if there are some ringing calls, they may lack
  var internalNum;
  var internalName;

  if (chDest && chDest.isExtension(owner) === true) {
    internalNum = chDest.getBridgedNum();
    internalName = chDest.getBridgedName();

  } else if (chSource && chSource.isExtension(owner) === true) {
    internalNum = chSource.getBridgedNum();
    internalName = chSource.getBridgedName();
  }

  /**
   * Return the source channel.
   *
   * @method getSourceChannel
   * @return {Channel} The source channel object.
   */
  function getSourceChannel() {
    return chSource;
  }

  /**
   * Return the destination channel.
   *
   * @method getDestinationChannel
   * @return {Channel} The destination channel object.
   */
  function getDestinationChannel() {
    return chDest;
  }

  /**
   * Returns the number of the extension involved in the conversation.
   *
   * @method getInternalNum
   * @return {string} The number of the extension involved in the conversation.
   */
  function getInternalNum() {
    return internalNum;
  }

  /**
   * Returns the name of the extension involved in the conversation.
   *
   * @method getInternalName
   * @return {string} The name of the extension involved in the conversation.
   */
  function getInternalName() {
    return internalName;
  }

  /**
   * Sets the name of the extension involved in the conversation.
   *
   * @method setInternalName
   * @param {string} name The name of the extension involved in the conversation.
   */
  function setInternalName(name) {
    internalName = name;
  }

  /**
   * Return the string representation of the conversation.
   *
   * @method toString
   * @return {string} The representation of the conversation.
   */
  function toString() {
    return id;
  }

  /**
   * Return the conversation identification.
   *
   * @method getId
   * @return {string} The conversation identification.
   */
  function getId() {
    return id;
  }

  /**
   * Returns true if the conversation is recording or is in mute recording.
   *
   * @method isRecording
   * @return {booelan} true if the conversation is recording or is in mute recording, false otherwise.
   */
  function isRecording() {
    if (recording === RECORDING_STATUS.FALSE) {
      return false;
    }
    return true;
  }

  /**
   * Sets the recording status.
   *
   * **It can throw an Exception.**
   *
   * @method setRecording
   * @param {boolean} value The value for the recording status.
   */
  function setRecording(value) {
    if (typeof value !== 'boolean') {
      throw new Error('wrong parameter');
    }

    if (value) {
      recording = RECORDING_STATUS.TRUE;
    } else {
      recording = RECORDING_STATUS.FALSE;
    }
  }

  /**
   * Sets the recording status to mute.
   *
   * **It can throw an Exception.**
   *
   * @method setRecordingMute
   */
  function setRecordingMute() {
    recording = RECORDING_STATUS.MUTE;
  }

  /**
   * Return the duration of the conversation.
   *
   * @method getDuration
   * @return {number} The conversation duration expressed in seconds.
   */
  function getDuration() {
    updateDuration();
    return duration;
  }

  /**
   * Update the duration in seconds.
   *
   * @method updateDuration
   * @private
   */
  function updateDuration() {
    var d = new Date();
    var diff = d.getTime() - startime;
    duration = Math.floor(diff / 1000);
  }

  /**
   * Returns the JSON representation of the object. If the conversation isn't
   * connected, one between the source channel and the destination channel can be null.
   *
   *     {
   *         id:           "SIP/214-000002f4>SIP/209-000002f5",
   *         owner:        "214",
   *         chDest:       Channel.{{#crossLink "Channel/toJSON"}}{{/crossLink}}(), // the source channel of the call
   *         chSource:     Channel.{{#crossLink "Channel/toJSON"}}{{/crossLink}}(), // the destination channel of the call
   *         duration:     26,
   *         recording:    false,                               // it's true if the conversation is recording, false otherwise
   *         direction:    "in",
   *         internalNum:  "209",                               // the internal number
   *         externalNum:  "0721405516",                        // the external number
   *         internalName: "Extension Name",                    // the internal name
   *         externalName: "Nethesis",                          // the external name
   *         throughQueue: false                                // if the call has gone through a queue
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStr) {

    updateDuration();

    return {
      id: id,
      owner: owner,
      chDest: chDest ? chDest.toJSON(privacyStr) : null,
      chSource: chSource ? chSource.toJSON(privacyStr) : null,
      duration: duration,
      recording: recording,
      direction: direction,
      internalNum: privacyStr && internalNum ? (internalNum.slice(0, -privacyStr.length) + privacyStr) : internalNum,
      externalNum: privacyStr && externalNum ? (externalNum.slice(0, -privacyStr.length) + privacyStr) : externalNum,
      internalName: privacyStr ? privacyStr : internalName,
      externalName: privacyStr ? privacyStr : externalName,
      throughQueue: throughQueue
    };
  }

  // public interface
  return {
    getId: getId,
    toJSON: toJSON,
    toString: toString,
    getDuration: getDuration,
    isRecording: isRecording,
    setRecording: setRecording,
    getInternalNum: getInternalNum,
    getInternalName: getInternalName,
    setInternalName: setInternalName,
    setRecordingMute: setRecordingMute,
    getSourceChannel: getSourceChannel,
    getDestinationChannel: getDestinationChannel
  };
};

/**
* The possible values for conversation direction.
*
* @property {object} DIRECTION
* @private
* @default {
    IN:  "in",
    OUT: "out"
}
*/
var DIRECTION = {
  IN: 'in',
  OUT: 'out'
};

/**
* The possible values for conversation recording.
*
* @property {object} RECORDING_STATUS
* @private
* @default {
    "MUTE":  "mute",
    "TRUE":  "true",
    "FALSE": "false"
}
*/
var RECORDING_STATUS = {
  MUTE: 'mute',
  TRUE: 'true',
  FALSE: 'false'
};
