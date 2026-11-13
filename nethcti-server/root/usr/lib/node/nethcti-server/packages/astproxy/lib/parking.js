/**
 * Abstraction of a parking.
 *
 * **It can throw exception.**
 *
 * @class Parking
 * @param {string} parkingNum The parking number
 * @return {object} The parking object.
 * @constructor
 */
exports.Parking = function(parkingNum) {
  // check the parameter
  if (typeof parkingNum !== 'string') {
    throw new Error('wrong parameter: ' + JSON.stringify(arguments));
  }

  /**
   * The parking number.
   *
   * @property parking
   * @type {string}
   * @required
   * @private
   */
  var parking = parkingNum;

  /**
   * The timeout of the parking
   *
   * @property timeout
   * @type {number}
   * @required
   * @private
   */
  var timeout;

  /**
   * The parking name.
   *
   * @property name
   * @type {string}
   * @private
   */
  var name = '';

  /**
   * The parked caller. Only one caller at time can be parked in a parking.
   *
   * @property parkedCaller
   * @type {object}
   * @private
   */
  var parkedCaller;

  /**
   * Adds a parked caller.
   *
   * @method addParkedCaller
   * @param {object} pCall The parked caller object.
   */
  function addParkedCaller(pCall) {
    parkedCaller = pCall;
  }

  /**
   * Returns the parked caller.
   *
   * @method getParkedCaller
   * @return {object} The parked caller.
   */
  function getParkedCaller() {
    return parkedCaller;
  }

  /**
   * Returns the parking timeout.
   *
   * @method getTimeout
   * @return {object} The timeout of the parking.
   */
  function getTimeout() {
    return timeout;
  }

  /**
   * Set the parking timeout.
   *
   * @method setTimeout
   * @param {number} time The timeout of the parking
   */
  function setTimeout(time) {
    timeout = time;
  }

  /**
   * Remove parked caller.
   *
   * @method removeParkedCaller
   */
  function removeParkedCaller() {
    parkedCaller = undefined;
  }

  /**
   * Set the parking name.
   *
   * @method setName
   * @param {string} pName The parking name
   */
  function setName(pName) {
    name = pName;
  }

  /**
   * Return the parking name.
   *
   * @method getName
   * @return {string} The parking name.
   */
  function getName() {
    return name;
  }

  /**
   * Return the parking number.
   *
   * @method getParking
   * @return {string} The parking number
   */
  function getParking() {
    return parking;
  }

  /**
   * Return the readable string description of the queue.
   *
   * @method toString
   * @return {string} The readable description of the extension
   */
  function toString() {
    return 'PARKING/' + getParking();
  }

  /**
   * Returns the JSON representation of the object.
   *
   *     {
   *         "name": "71",
   *         "parking": "71"
   *         "timeout": 45
   *         "parkedCaller": { ParkedCaller.{{#crossLink "ParkedCaller/toJSON"}}{{/crossLink}}() }
   *     }
   *
   * @method toJSON
   * @param  {string} [privacyStr] If it is specified, it hides the last digits of the phone number
   * @return {object} The JSON representation of the object.
   */
  function toJSON(privacyStr) {
    return {
      name: name,
      parking: parking,
      timeout: timeout,
      parkedCaller: parkedCaller ? parkedCaller.toJSON(privacyStr) : {}
    };
  }

  // public interface
  return {
    toJSON: toJSON,
    setName: setName,
    getName: getName,
    toString: toString,
    getParking: getParking,
    getTimeout: getTimeout,
    setTimeout: setTimeout,
    addParkedCaller: addParkedCaller,
    getParkedCaller: getParkedCaller,
    removeParkedCaller: removeParkedCaller
  };
};
