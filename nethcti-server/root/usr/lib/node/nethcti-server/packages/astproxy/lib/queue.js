/**
 * Abstraction of a queue.
 *
 * **It can throw exception.**
 *
 * @class Queue
 * @constructor
 * @param {string} queueNum The queue number
 * @return {object} The queue object.
 */
exports.Queue = function(queueNum) {
  // check the parameter
  if (typeof queueNum !== 'string') {
    throw new Error('wrong parameter: ' + queueNum);
  }

  /**
   * The queue number.
   *
   * @property queue
   * @type {string}
   * @required
   * @private
   */
  var queue = queueNum;

  /**
   * The queue name.
   *
   * @property name
   * @type {string}
   * @private
   */
  var name = '';

  /**
   * The average hold time.
   *
   * @property avgHoldTime
   * @type {string}
   * @private
   */
  var avgHoldTime;

  /**
   * The average talk time.
   *
   * @property avgTalkTime
   * @type {string}
   * @private
   */
  var avgTalkTime;

  /**
   * The service level time period.
   *
   * @property serviceLevelTimePeriod
   * @type {string}
   * @private
   */
  var serviceLevelTimePeriod;

  /**
   * The service level percentage.
   *
   * @property serviceLevelPercentage
   * @type {string}
   * @private
   */
  var serviceLevelPercentage;

  /**
   * The number of completed calls.
   *
   * @property completedCallsCount
   * @type {number}
   * @private
   */
  var completedCallsCount;

  /**
   * The number of abandoned calls.
   *
   * @property abandonedCallsCount
   * @type {number}
   * @private
   */
  var abandonedCallsCount;

  /**
   * The members of the queue. The key is the member number and
   * the value is a _QueueMember_ object.
   *
   * @property members
   * @type {object}
   * @private
   */
  var members = {};

  /**
   * The waiting callers of the queue. The key is the channel and
   * the value is a _QueueWaitingCaller_ object.
   *
   * @property waitingCallers
   * @type {object}
   * @private
   */
  var waitingCallers = {};

  /**
   * Returns the specified member.
   *
   * @method getMember
   * @param  {string} memberId The member identifier
   * @return {object} The member.
   */
  function getMember(memberId) {
    return members[memberId];
  }

  /**
   * Returns all the members.
   *
   * @method getAllMembers
   * @return {object} All the members.
   */
  function getAllMembers() {
    return members;
  }

  /**
   * Returns the list of all members.
   *
   * @method getMembersList
   * @return {array} The list of all members.
   */
  function getMembersList() {
    return Object.keys(members);
  }

  /**
   * Returns all the waiting callers.
   *
   * @method getAllWaitingCallers
   * @return {object} All the waiting callers.
   */
  function getAllWaitingCallers() {
    return waitingCallers;
  }

  /**
   * Return a waiting caller.
   *
   * @method getWaitingCaller
   * @param {string} id The waiting caller identifier
   * @return {object} A waiting caller or undefined.
   */
  function getWaitingCaller(id) {
    return waitingCallers[id];
  }

  /**
   * Return the number of waiting calls.
   *
   * @method getWaitingCounter
   * @return {number} The number of waiting calls.
   */
  function getWaitingCounter() {
    return Object.keys(waitingCallers).length;
  }

  /**
   * Returns true if the waiting caller exists.
   *
   * @method waitingCallerExists
   * @param {string} id The waiting caller identifier
   * @return {boolean} True if the waiting caller exists.
   */
  function waitingCallerExists(id) {
    return waitingCallers[id] ? true : false;
  }

  /**
   * Adds the queue member to the private _members_ object property.
   * If the queue member already exists, it will be overwritten.
   *
   * **It can throw an Exception.**
   *
   * @method addMember
   * @param {object} m A _QueueMember_ object.
   */
  function addMember(m) {
    // check the parameter
    if (typeof m !== 'object') {
      throw new Error('wrong parameter');
    }
    members[m.getMember()] = m;
  }

  /**
   * Adds the queue waiting caller to the private _waitingCaller_ object property.
   * If the waiting caller already exists, it will be overwritten.
   *
   * **It can throw an Exception.**
   *
   * @method addWaitingCaller
   * @param {object} wCaller A _QueueWaitingCaller_ object.
   */
  function addWaitingCaller(wCaller) {
    // check the parameter
    if (typeof wCaller !== 'object') {
      throw new Error('wrong parameter');
    }
    waitingCallers[wCaller.getChannel()] = wCaller;
  }

  /**
   * Removes the waiting caller from the private _waitingCallers_ object property.
   *
   * **It can throw an Exception.**
   *
   * @method removeWaitingCaller
   * @param {string} channel The channel identifier.
   */
  function removeWaitingCaller(channel) {
    // check the parameter
    if (typeof channel !== 'string') {
      throw new Error('wrong parameter');
    }
    delete waitingCallers[channel];
  }

  /**
   * Removes all the waiting callers from the private _waitingCallers_ object property.
   *
   * **It can throw an Exception.**
   *
   * @method removeAllWaitingCallers
   */
  function removeAllWaitingCallers() {
    waitingCallers = {};
  }

  /**
   * Update the waiting time of all waiting callers of all queues.
   *
   * @method updateWaitingTimeOfWaitingCallers
   */
  function updateWaitingTimeOfWaitingCallers() {
    var wc;
    for (wc in waitingCallers) {
      waitingCallers[wc].updateWaiting();
    }
  }

  /**
   * Removes the queue member from the private _members_ object property.
   *
   * **It can throw an Exception.**
   *
   * @method removeMember
   * @param {string} m The queue member number identifier.
   */
  function removeMember(m) {
    // check the parameter
    if (typeof m !== 'string') {
      throw new Error('wrong parameter');
    }
    delete members[m];
  }

  /**
   * Return the number of completed calls.
   *
   * @method getCompletedCallsCount
   * @return {number} The number of completed calls.
   */
  function getCompletedCallsCount() {
    return completedCallsCount;
  }

  /**
   * Sets the service level time period.
   *
   * @method setServiceLevelTimePeriod
   * @param {string} level The service level time period.
   */
  function setServiceLevelTimePeriod(level) {
    serviceLevelTimePeriod = level;
  }

  /**
   * Sets the service level percentage.
   *
   * @method setServiceLevelPercentage
   * @param {string} percentage The service level percentage.
   */
  function setServiceLevelPercentage(percentage) {
    serviceLevelPercentage = percentage;
  }

  /*
   * Sets the number of completed calls.
   *
   * @method setCompletedCallsCount
   * @param {number} num The number of completed calls.
   */
  function setCompletedCallsCount(num) {
    completedCallsCount = num;
  }

  /**
   * Return the number of abandoned calls.
   *
   * @method getAbandonedCallsCount
   * @return {number} The number of abandoned calls.
   */
  function getAbandonedCallsCount() {
    return abandonedCallsCount;
  }

  /**
   * Set the number of abandoned calls.
   *
   * @method setAbandonedCallsCount
   * @param {number} num The number of abandoned calls.
   */
  function setAbandonedCallsCount(num) {
    abandonedCallsCount = num;
  }

  /**
   * Return the average talk time.
   *
   * @method getAvgTalkTime
   * @return {string} The average talk time.
   */
  function getAvgTalkTime() {
    return avgTalkTime;
  }

  /**
   * Set the average talk time.
   *
   * @method setAvgTalkTime
   * @param {string} time The time in seconds.
   */
  function setAvgTalkTime(time) {
    avgTalkTime = time;
  }

  /**
   * Return the average hold time.
   *
   * @method getAvgHoldTime
   * @return {string} The average hold time.
   */
  function getAvgHoldTime() {
    return avgHoldTime;
  }

  /**
   * Set the average hold time.
   *
   * @method setAvgHoldTime
   * @param {string} time The time in seconds.
   */
  function setAvgHoldTime(time) {
    avgHoldTime = time;
  }

  /**
   * Set the queue name.
   *
   * @method setName
   * @param {string} qName The queue name
   */
  function setName(qName) {
    name = qName;
  }

  /**
   * Return the queue name.
   *
   * @method getName
   * @return {string} The queue name.
   */
  function getName() {
    return name;
  }

  /**
   * Return the queue number.
   *
   * @method getQueue
   * @return {string} The queue number
   */
  function getQueue() {
    return queue;
  }

  /**
   * Return the readable string description of the queue.
   *
   * @method toString
   * @return {string} The readable description of the extension
   */
  function toString() {
    return 'QUEUE/' + getQueue();
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         name:                   "Coda401",
   *         queue:                  "401",
   *         members:                { QueueMember.{{#crossLink "QueueMember/toJSON"}}{{/crossLink}}() } // the keys is the extension numbers
   *         avgHoldTime:            "37"
   *         avgTalkTime:            "590",
   *         waitingCallers:         { QueueWaitingCaller.{{#crossLink "QueueWaitingCaller/toJSON"}}{{/crossLink}}() } // the keys is the channel identifier
   *         abandonedCallsCount:    "26",
   *         completedCallsCount:    "11"
   *         serviceLevelTimePeriod: "60"
   *         serviceLevelPercentage: "100.0"
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStr) {

    updateWaitingTimeOfWaitingCallers();

    var k;
    var jsonMembers = {};
    var jsonWCallers = {};

    // JSON representation of the members
    for (k in members) {
      jsonMembers[k] = members[k].toJSON();
    }

    // JSON representation of waiting callers
    for (k in waitingCallers) {
      jsonWCallers[k] = waitingCallers[k].toJSON(privacyStr);
    }

    return {
      name: name,
      queue: queue,
      members: jsonMembers,
      avgHoldTime: avgHoldTime,
      avgTalkTime: avgTalkTime,
      waitingCallers: jsonWCallers,
      completedCallsCount: completedCallsCount,
      abandonedCallsCount: abandonedCallsCount,
      serviceLevelTimePeriod: serviceLevelTimePeriod,
      serviceLevelPercentage: serviceLevelPercentage
    };
  }

  // public interface
  return {
    toJSON: toJSON,
    setName: setName,
    getName: getName,
    getQueue: getQueue,
    toString: toString,
    addMember: addMember,
    getMember: getMember,
    removeMember: removeMember,
    getAllMembers: getAllMembers,
    getMembersList: getMembersList,
    getAvgHoldTime: getAvgHoldTime,
    setAvgHoldTime: setAvgHoldTime,
    getAvgTalkTime: getAvgTalkTime,
    setAvgTalkTime: setAvgTalkTime,
    addWaitingCaller: addWaitingCaller,
    getWaitingCaller: getWaitingCaller,
    getWaitingCounter: getWaitingCounter,
    removeWaitingCaller: removeWaitingCaller,
    waitingCallerExists: waitingCallerExists,
    getAllWaitingCallers: getAllWaitingCallers,
    getCompletedCallsCount: getCompletedCallsCount,
    setCompletedCallsCount: setCompletedCallsCount,
    getAbandonedCallsCount: getAbandonedCallsCount,
    setAbandonedCallsCount: setAbandonedCallsCount,
    removeAllWaitingCallers: removeAllWaitingCallers,
    setServiceLevelTimePeriod: setServiceLevelTimePeriod,
    setServiceLevelPercentage: setServiceLevelPercentage
  };
};
