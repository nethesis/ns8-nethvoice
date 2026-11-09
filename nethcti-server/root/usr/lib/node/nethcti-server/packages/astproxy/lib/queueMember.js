/**
 * Abstraction of a queue member.
 *
 * **It can throw exception.**
 *
 * @class QueueMember
 * @param  {string}  memberNum   The member number
 * @param  {string}  queueId     The name of the queue membership
 * @param  {boolean} pausedValue True if the extension is paused from the queue
 * @param  {boolean} loggedIn    True if the extension is logged in the queue
 * @return {object}  The queue member object.
 * @constructor
 */
exports.QueueMember = function(memberNum, queueId, pausedValue, loggedInValue) {
  // check the parameters
  if (typeof queueId !== 'string' || typeof loggedInValue !== 'boolean' ||
    typeof memberNum !== 'string' || typeof pausedValue !== 'boolean') {

    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The member number.
   *
   * @property member
   * @type {string}
   * @required
   * @private
   */
  var member = memberNum;

  /**
   * The member name.
   *
   * @property name
   * @type {string}
   * @private
   */
  var name = '';

  /**
   * The identifier of queue membership.
   *
   * @property queue
   * @type {string}
   * @private
   */
  var queue = queueId;

  /**
   * The member typology.
   *
   * @property type
   * @type {string}
   * @private
   */
  var type;

  /**
   * The pause status of the member.
   *
   * @property paused
   * @type {boolean}
   * @private
   */
  var paused = pausedValue;

  /**
   * The logged in status of the member.
   *
   * @property loggedIn
   * @type {boolean}
   * @private
   */
  var loggedIn = loggedInValue;

  /**
   * The number of the taken calls.
   *
   * @property callsTakenCount
   * @type {number}
   * @default 0
   * @private
   */
  var callsTakenCount = 0;

  /**
   * The timestamp of the last taken call.
   *
   * @property lastCallTimestamp
   * @type {number}
   * @default 0
   * @private
   */
  var lastCallTimestamp = 0;

  /**
   * The timestamp of the last started pause.
   *
   * @property lastPausedInTimestamp
   * @type {number}
   * @default 0
   * @private
   */
  var lastPausedInTimestamp = 0;

  /**
   * The timestamp of the last ended pause.
   *
   * @property lastPausedOutTimestamp
   * @type {number}
   * @default 0
   * @private
   */
  var lastPausedOutTimestamp = 0;

  /**
   * The reason of the last started pause.
   *
   * @property lastPausedInReason
   * @type {string}
   * @default ""
   * @private
   */
  var lastPausedInReason = '';

  /**
   * Return the timestamp of the last taken call.
   *
   * @method getLastCallTimestamp
   * @return {number} The timestamp of the last taken call.
   */
  function getLastCallTimestamp() {
    return lastCallTimestamp;
  }

  /**
   * Set the timestamp of the last taken call.
   *
   * **It can throw an Exception**.
   *
   * @method setLastCallTimestamp
   * @param {number} num The timestamp number.
   */
  function setLastCallTimestamp(num) {
    // check the parameter
    if (typeof num !== 'number') {
      throw new Error('wrong parameter');
    }

    lastCallTimestamp = num;
  }

  /**
   * Set the logged in status of the member.
   *
   * **It can throw an Exception**.
   *
   * @method setLoggedIn
   * @param {boolean} value True if the member is logged in the queue
   */
  function setLoggedIn(value) {
    // check the parameter
    if (typeof value !== 'boolean') {
      throw new Error('wrong parameter');
    }

    loggedIn = value;
  }

  /**
   * Checks the logged in status of the member.
   *
   * **It can throw an Exception**.
   *
   * @method isLoggedIn
   * @return {boolean} True if the member is logged into the queue
   */
  function isLoggedIn() {
    return loggedIn;
  }

  /**
   * Set the timestamp and the reason of the last started pause.
   *
   * **It can throw an Exception**.
   *
   * @method setLastPausedInData
   * @param {number} timestamp The timestamp number
   * @param {string} reason    The reason descripion
   */
  function setLastPausedInData(timestamp, reason) {
    // check the parameters
    if (typeof timestamp !== 'number' ||
      typeof reason !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    lastPausedInReason = reason;
    lastPausedInTimestamp = timestamp;
  }

  /**
   * Set the timestamp of the last ended pause.
   *
   * **It can throw an Exception**.
   *
   * @method setLastPausedOutData
   * @param {number} timestamp The timestamp number
   */
  function setLastPausedOutData(timestamp) {
    // check the parameter
    if (typeof timestamp !== 'number') {
      throw new Error('wrong parameter');
    }

    lastPausedOutTimestamp = timestamp;
  }

  /**
   * Return the number of the taken calls.
   *
   * @method getCallsTakenCount
   * @return {number} The number of the taken calls.
   */
  function getCallsTakenCount() {
    return callsTakenCount;
  }

  /**
   * Set the number of the taken calls.
   *
   * **It can throw an Exception**.
   *
   * @method setCallsTakenCount
   * @param {number} num The number of the taken calls.
   */
  function setCallsTakenCount(num) {
    // check the parameter
    if (typeof num !== 'number') {
      throw new Error('wrong parameter');
    }

    callsTakenCount = num;
  }

  /**
   * Set the member type.
   *
   * @method setType
   * @param {string} value The member type
   */
  function setType(value) {
    type = value;
  }

  /**
   * Sets the paused status of the member. If the pause has been started
   * a reason description is needed. It updates the _lastPausedInTimestamp_
   * or _lastPausedOutTimestamp_ property consequently.
   *
   * **It can throw an Exception**.
   *
   * @method setPaused
   * @param {boolean} value  True if the pause has been started, false if it has been stopped.
   * @param {string}  reason The reason description of the started pause
   */
  function setPaused(value, reason) {
    // check the parameters
    if (typeof value !== 'boolean' ||
      (typeof reason !== 'string' && value === true)) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    paused = value;

    if (paused) {
      lastPausedInReason = reason;
      lastPausedInTimestamp = new Date().getTime();

    } else {
      lastPausedOutTimestamp = new Date().getTime();
    }
  }

  /**
   * Get the pause reason.
   *
   * @method getPauseReason
   * @param {string} reason The reason of the pause
   */
  function getPauseReason() {
    return lastPausedInReason;
  }

  /**
   * Checks the pause status of the member.
   *
   * @method isInPause
   * @return {boolean} True if the member is in pause into the queue
   */
  function isInPause() {
    return paused;
  }

  /**
   * Return the type of the member.
   *
   * @method getType
   * @return {string} The type of the member.
   */
  function getType() {
    return type;
  }

  /**
   * Checks if the member is dynamic.
   *
   * @method isDynamic
   * @return {boolean} True if the member is dynamic.
   */
  function isDynamic() {
    if (type === TYPES_ENUM.DYNAMIC) {
      return true;
    }
    return false;
  }

  /**
   * Return the name of the queue membership.
   *
   * @method getQueue
   * @return {string} The name of the queue membership.
   */
  function getQueue() {
    return queue;
  }

  /**
   * Set the member name.
   *
   * @method setName
   * @param {string} memberName The member name
   */
  function setName(memberName) {
    name = memberName;
  }

  /**
   * Return the member name.
   *
   * @method getName
   * @return {string} The member name.
   */
  function getName() {
    return name;
  }

  /**
   * Return the member number.
   *
   * @method getMember
   * @return {string} The member number
   */
  function getMember() {
    return member;
  }

  /**
   * Return the readable string description of the member.
   *
   * @method toString
   * @return {string} The readable description of the extension
   */
  function toString() {
    return 'Queue member: ' + getMember();
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         type:                   "static",
   *         name:                   "Name",
   *         queue:                  "401",
   *         member:                 "214",
   *         paused:                 true,          // the paused status
   *         loggedIn:               true,          // if the member is logged in or not
   *         callsTakenCount:        0,             // the number of taken calls
   *         lastCallTimestamp:      1365590191     // the timestamp of the last taken call
   *         lastPausedInReason:     "some reason"  // the reason description of the last started pause
   *         lastPausedInTimestamp:  1365591191     // the timestamp of the last started pause
   *         lastPausedOutTimestamp: 1365594191     // the timestamp of the last ended pause
   *     }
   *
   * @method toJSON
   * @return {object} The JSON representation of the object.
   */
  function toJSON() {
    return {
      type: type,
      name: name,
      queue: queue,
      member: member,
      paused: paused,
      loggedIn: loggedIn,
      callsTakenCount: callsTakenCount,
      lastCallTimestamp: lastCallTimestamp,
      lastPausedInReason: lastPausedInReason,
      lastPausedInTimestamp: lastPausedInTimestamp,
      lastPausedOutTimestamp: lastPausedOutTimestamp
    };
  }

  // public interface
  return {
    toJSON: toJSON,
    setName: setName,
    getName: getName,
    getType: getType,
    setType: setType,
    getQueue: getQueue,
    toString: toString,
    isInPause: isInPause,
    isDynamic: isDynamic,
    setPaused: setPaused,
    getMember: getMember,
    isLoggedIn: isLoggedIn,
    setLoggedIn: setLoggedIn,
    getPauseReason: getPauseReason,
    setCallsTakenCount: setCallsTakenCount,
    getCallsTakenCount: getCallsTakenCount,
    setLastPausedInData: setLastPausedInData,
    setLastPausedOutData: setLastPausedOutData,
    setLastCallTimestamp: setLastCallTimestamp,
    getLastCallTimestamp: getLastCallTimestamp
  };
};

/**
 * The queue member types enumeration.
 *
 * @property TYPES_ENUM
 * @type {object}
 * @private
 * @final
 * @default {
    STATIC:   "static",
    DYNAMIC:  "dynamic",
    REALTIME: "realtime"
 }
 */
var TYPES_ENUM = {
  STATIC: 'static',
  DYNAMIC: 'dynamic',
  REALTIME: 'realtime'
};

/**
 * The QueueMember types enumeration. It's the same of
 * the private _TYPES\_ENUM_.
 *
 * @property QUEUE_MEMBER_TYPES_ENUM
 * @type {object}
 * @final
 * @default Equal to the private property TYPES_ENUM
 */
exports.QUEUE_MEMBER_TYPES_ENUM = TYPES_ENUM;

/**
 * The QueueMember status enumeration.
 *
 * @property STATUS_ENUM
 * @type {object}
 * @private
 * @final
 * @default {
    "FREE": "free",
    "BUSY": "busy"
 }
 */
var STATUS_ENUM = {
  'FREE': 'free',
  'BUSY': 'busy'
};

/**
 * The QueueMember status enumeration. It's the same of
 * private _STATUS\_ENUM_.
 *
 * @property QUEUE_MEMBER_STATUS_ENUM
 * @type {object}
 * @final
 * @default Equal to the private property STATUS_ENUM
 */
exports.QUEUE_MEMBER_STATUS_ENUM = STATUS_ENUM;
