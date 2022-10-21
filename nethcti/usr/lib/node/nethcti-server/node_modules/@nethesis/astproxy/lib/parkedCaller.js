/**
 * Abstraction of a parked caller.
 *
 * **It can throw exception.**
 *
 * @class ParkedCaller
 * @param {object} data              The caller information object
 *   @param {string} data.channel    The parked channel
 *   @param {string} data.callerNum  The caller number
 *   @param {string} data.callerName The caller name
 *   @param {string} data.parking    The parking identifier
 *   @param {string} data.timeout    The timestamp of waited time elapsed in the parking
 * @constructor
 * @return {object} The parked caller object.
 */
exports.ParkedCaller = function(data) {
  // check the parameter
  if (!data ||
    typeof data.parking !== 'string' ||
    typeof data.channel !== 'string' ||
    typeof data.timeout !== 'number' ||
    typeof data.parkeeNum !== 'string' ||
    typeof data.parkeeName !== 'string' ||
    typeof data.callerNum !== 'string' ||
    typeof data.callerName !== 'string') {

    throw new Error('wrong parameters: ' + JSON.stringify(arguments));
  }

  /**
   * The caller number.
   *
   * @property num
   * @type {string}
   * @required
   * @private
   */
  var num = data.callerNum;

  /**
   * The caller name.
   *
   * @property name
   * @type {string}
   * @private
   */
  var name = data.callerName;

  /**
   * The caller channel.
   *
   * @property channel
   * @type {string}
   * @private
   */
  var channel = data.channel;

  /**
   * The number of the parker.
   *
   * @property parkeeNum
   * @type {string}
   * @private
   */
  var parkeeNum = data.parkeeNum;

  /**
   * The name of the parker.
   *
   * @property parkeeName
   * @type {string}
   * @private
   */
  var parkeeName = data.parkeeName;

  /**
   * The number of the parking.
   *
   * @property parking
   * @type {string}
   * @private
   */
  var parking = data.parking;

  /**
   * The timeout in seconds to exit from the parking.
   *
   * @property timeout
   * @type {number}
   * @private
   */
  var timeout = data.timeout;

  /**
   * The timestamp of the timeout. It is the countdown to exit
   * from the parking. It's necessary to update timeout.
   *
   * @property timestampTimeout
   * @type {number}
   * @private
   */
  var timestampTimeout;
  var d = new Date();
  d.setSeconds(d.getSeconds() + timeout);
  timestampTimeout = d.getTime();

  /**
   * Return the timestamp of the timeout.
   *
   * @method getTimeout
   * @return {number} The timestamp of the timeout.
   */
  function getTimeout() {
    updateTimeout();
    return timeout;
  }

  /**
   * Update the timeout in seconds.
   *
   * @method updateTimeout
   */
  function updateTimeout() {
    var d = new Date();
    var diff = timestampTimeout - d.getTime();
    timeout = Math.floor(diff / 1000);
  }

  /**
   * Return the number of the parking.
   *
   * @method getParking
   * @return {string} The number of the parking.
   */
  function getParking() {
    return parking;
  }

  /**
   * Return the caller channel.
   *
   * @method getChannel
   * @return {string} The caller channel.
   */
  function getChannel() {
    return channel;
  }

  /**
   * Return the name.
   *
   * @method getName
   * @return {string} The name.
   */
  function getName() {
    return name;
  }

  /**
   * Return the number of the caller.
   *
   * @method getNumber
   * @return {string} The number of the caller.
   */
  function getNumber() {
    return num;
  }

  /**
   * Return the readable string description of the parked caller.
   *
   * @method toString
   * @return {string} The readable description of the parked caller.
   */
  function toString() {
    return 'Parked caller: ' + getNumber() + ' in the parking ' + getParking();
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         num:        "221",              // the number of the parked channel
   *         name:       "Alessandro",       // the name of the parked channel
   *         parkeeNum:  "205",              // the number of the parker
   *         parkeeName: "Andrea",           // the name of the parker
   *         parking:    "71",               // the parking identifier
   *         channel:    "SIP/214-00000573", // the asterisk channel
   *         timeout:    "40"                // seconds to exit from parking
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStr] If it's specified, it hides the last digits of the phone number
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStr) {

    updateTimeout();

    return {
      num: privacyStr ? (num.slice(0, -privacyStr.length) + privacyStr) : num,
      name: privacyStr ? privacyStr : name,
      parking: parking,
      channel: channel,
      timeout: timeout,
      parkeeNum: privacyStr ? (parkeeNum.slice(0, -privacyStr.length) + privacyStr) : parkeeNum,
      parkeeName: privacyStr ? privacyStr : parkeeName
    };
  }

  // public interface
  return {
    toJSON: toJSON,
    getName: getName,
    toString: toString,
    getNumber: getNumber,
    getTimeout: getTimeout,
    getChannel: getChannel,
    getParking: getParking
  };
};
