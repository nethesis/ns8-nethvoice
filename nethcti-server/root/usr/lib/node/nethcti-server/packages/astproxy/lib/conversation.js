/**
 * Abstraction of a phone conversation.
 *
 * **It can throw exceptions.**
 *
 * @class Conversation
 * @constructor
 * @return {object} The conversation object.
 */
exports.Conversation = function(ownerId, sourceChan, destChan, queue, linked, unique, spyConnected) {
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
   * The queue identifier if the conversation has gone through a queue,
   * undefined otherwise.
   *
   * @property queueId
   * @type {string}
   * @optional
   * @private
   */
  var queueId = queue;

  /**
   * The linkedId value that will be stored into the cdr database table.
   *
   * @property linkedId
   * @type {string}
   * @private
   */
  var linkedId = linked;

  /**
   * The uniqueId value that will be stored into the cdr database table.
   *
   * @property uniqueId
   * @type {string}
   * @private
   */
  var uniqueId = unique;

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
   * The timestamp of the starting time. This is necessary to
   *
   * @property inConference
   * @type {boolean}
   * @private
   */
  var inConference = false;
  if ((chSource && chSource.isInConference()) || (chDest && chDest.isInConference())) {
    inConference = true;
  }

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
  if (chSource && chSource.isExtension(owner) === true) {
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
  if ((chSource && (chSource.getChannel().indexOf('from-queue') !== -1 || chSource.getBridgedChannel().indexOf('from-queue') !== -1)) ||
    (chDest && (chDest.getChannel().indexOf('from-queue') !== -1 || chDest.getBridgedChannel().indexOf('from-queue') !== -1))
  ) {

    throughQueue = true;
  } else {
    throughQueue = false;
  }

  /**
   * True if the conversation has gone through a trunk.
   *
   * @property throughTrunk
   * @type {boolean}
   * @private
   */
  let throughTrunk;

  /**
   * The number of the counterpart.
   *
   * @property counterpartNum
   * @type {string}
   * @private
   */
  // "chSource" and "chDest" are always present at runtime. Instead,
  // during the boot, if there are some ringing calls, they may be lack
  var counterpartNum;
  if (chSource && chSource.isExtension(owner) === true) {
    counterpartNum = chSource.getBridgedNum();

  } else if (chDest && chDest.isExtension(owner) === true) {
    counterpartNum = chDest.getBridgedNum();

  } else if (chDest) {
    counterpartNum = chDest.getCallerNum();
  }

  /**
   * The name of the counterpart.
   *
   * @property counterpartName
   * @type {string}
   * @private
   */
  // "chSource" and "chDest" are always present at runtime. Instead,
  // during the boot, if there are some ringing calls, they may be lack
  var counterpartName;
  if (chSource && chSource.isExtension(owner) === true) {
    counterpartName = chSource.getBridgedName();

  } else if (chDest && chDest.isExtension(owner) === true) {
    counterpartName = chDest.getBridgedName();

  } else if (chDest) {
    counterpartName = chDest.getCallerName();
  }
  if (counterpartName.substring(0, 4) === 'CID:') {
    counterpartName = '';
  }

  /**
   * It is true only if the conversation was created after the answer of a spy conversation.
   *
   * @property inSpyConnected
   * @type {boolean}
   * @private
   */
  const inSpyConnected = spyConnected ? true : false;

  /**
   * It is true only if the parties involved in the conversation are connected.
   *
   * @property connected
   * @type {boolean}
   * @private
   */
  var connected = (chSource && chDest && chSource.isStatusUp() && chDest.isStatusUp()) || inConference || inSpyConnected;

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
   * Returns the queue identifier if the conversation involves the queue,
   * undefined otherwise.
   *
   * @method getQueueId
   * @return {Channel} The queue identifier.
   */
  function getQueueId() {
    return queueId;
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
   * Returns the counterpart number.
   *
   * @method getCounterpartNum
   * @return {string} The number of the counterpart.
   */
  function getCounterpartNum() {
    return counterpartNum;
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
   * True if the conversation involves a meetme conference.
   *
   * @method isInConference
   * @return {boolean} Returns true if the conversation involves a meetme conference.
   */
  function isInConference() {
    return inConference;
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
   * Sets if the conversation involves a trunk, so it is an external call.
   *
   * @method setThroughTrunk
   * @param {boolean} value True if the conversation involves an external counterpart.
   */
  function setThroughTrunk(value) {
    throughTrunk = value;
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
   * Returns true if the conversation is incoming.
   *
   * @method isIncoming
   * @return {boolean} True if the conversation is incoming.
   */
  function isIncoming(value) {
    if (direction === DIRECTION.IN) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Returns true if the conversation is connected.
   *
   * @method isConnected
   * @return {boolean} True if the conversation is connected.
   */
  function isConnected() {
    return connected;
  }

  /**
   * Returns true if the conversation is through a queue.
   *
   * @method isThroughQueue
   * @return {boolean} True if the conversation is through a queue.
   */
  function isThroughQueue() {
    return throughQueue;
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
   *         id:              "SIP/214-000002f4>SIP/209-000002f5",
   *         owner:           "214",
   *         chDest:          { Channel.{{#crossLink "Channel/toJSON"}}{{/crossLink}}() }, // the source channel of the call
   *         queueId:         "401",                // the queue identifier if the conversation has gone through a queue
   *         linkedId:        "1547571859.14", // the linkedid value that will be stored into the cdr database table
   *         uniqueId:        "1547571859.14", // the uniqueid value that will be stored into the cdr database table
   *         chSource:        { Channel.{{#crossLink "Channel/toJSON"}}{{/crossLink}}() }, // the destination channel of the call
   *         duration:        26,
   *         recording:       "false",              // it's "true" or "mute" if the conversation is recording, "false" otherwise
   *         direction:       "in",
   *         inConference:    true,                 // if the conversation involves a meetme conference
   *         throughQueue:    true,                 // if the call has gone through a queue
   *         throughTrunk:    true,                 // if the call has gone through a trunk
   *         counterpartNum:  "209",
   *         counterpartName: "user"
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStrOutQueue] If it is specified, it obfuscates the number of all calls that does not pass through a queue
   * @param  {string} [privacyStrInQueue]  If it is specified, it obfuscates the number of all calls that pass through a queue
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStrOutQueue, privacyStrInQueue) {

    updateDuration();

    var tempChDest, tempChSource, tempCounterpartNum, tempCounterpartName;

    if (throughQueue) {
      tempChDest = chDest ? chDest.toJSON(privacyStrInQueue) : null;
      tempChSource = chSource ? chSource.toJSON(privacyStrInQueue) : null;
      tempCounterpartNum = privacyStrInQueue ? (counterpartNum.slice(0, -privacyStrInQueue.length) + privacyStrInQueue) : counterpartNum;
      tempCounterpartName = privacyStrInQueue ? privacyStrInQueue : counterpartName;

    } else {
      tempChDest = chDest ? chDest.toJSON(privacyStrOutQueue) : null;
      tempChSource = chSource ? chSource.toJSON(privacyStrOutQueue) : null;
      tempCounterpartNum = privacyStrOutQueue ? (counterpartNum.slice(0, -privacyStrOutQueue.length) + privacyStrOutQueue) : counterpartNum;
      tempCounterpartName = privacyStrOutQueue ? privacyStrOutQueue : counterpartName;
    }

    return {
      id: id,
      owner: owner,
      chDest: tempChDest,
      queueId: queueId,
      linkedId: linkedId,
      uniqueId: uniqueId,
      chSource: tempChSource,
      duration: duration,
      startTime: startime,
      connected: connected,
      recording: recording,
      direction: direction,
      inConference: inConference,
      throughQueue: throughQueue,
      throughTrunk: throughTrunk,
      counterpartNum: tempCounterpartNum,
      counterpartName: tempCounterpartName
    };
  }

  // public interface
  return {
    getId: getId,
    toJSON: toJSON,
    toString: toString,
    getQueueId: getQueueId,
    isIncoming: isIncoming,
    getDuration: getDuration,
    isRecording: isRecording,
    isConnected: isConnected,
    setRecording: setRecording,
    isInConference: isInConference,
    isThroughQueue: isThroughQueue,
    setThroughTrunk: setThroughTrunk,
    setRecordingMute: setRecordingMute,
    getSourceChannel: getSourceChannel,
    getCounterpartNum: getCounterpartNum,
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
exports.RECORDING_STATUS = RECORDING_STATUS;
