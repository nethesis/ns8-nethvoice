/**
 * Provides the user functions.
 *
 * @module user
 * @main controller_user
 */
var endpointTypes = require('./endpoint_types');
var userMainPresence = require('./user_main_presence');
var EndpointEmail = require('./endpointEmail').EndpointEmail;
var EndpointJabber = require('./endpointJabber').EndpointJabber;
var EndpointCalendar = require('./endpointCalendar').EndpointCalendar;
var EndpointExtension = require('./endpointExtension').EndpointExtension;
var EndpointCellphone = require('./endpointCellphone').EndpointCellphone;
var EndpointVoicemail = require('./endpointVoicemail').EndpointVoicemail;
var EndpointMainExtension = require('./endpointMainExtension').EndpointMainExtension;

/**
 * Abstraction of a user.
 *
 * **It can throw exceptions.**
 *
 * @class User
 * @param  {string} uname The username of the user
 * @param  {string} na    The name of the user
 * @return {object}       The user object.
 * @constructor
 */
exports.User = function (uname, na) {
  if (typeof uname !== 'string' || typeof na !== 'string') {
    throw new Error('wrong parameter');
  }

  /**
   * The username of the user.
   *
   * @property username
   * @type {string}
   * @required
   * @private
   */
  var username = uname;

  /**
   * The name of the user.
   *
   * @property name
   * @type {string}
   * @required
   * @private
   */
  var name = na;

  /**
   * The presence of the user.
   *
   * @property presence
   * @type {string}
   * @private
   */
  var presence;

  /**
   * The conditinoal presence of the user on busy.
   *
   * @property presenceOnBusy
   * @type {string}
   * @private
   */
  var presenceOnBusy;

  /**
   * The user's "recall on busy" permission status.
   *
   * @property recallOnBusy
   * @type {string}
   * @private
   */
   var recallOnBusy;

  /**
   * The user's mainPresence status.
   * The retrieved presence by combining the user presence with the endpoints status.
   *
   * @property mainPresence
   * @type {string}
   * @private
   */
   var mainPresence = userMainPresence.STATUS.offline;

  /**
   * The conditinoal presence of the user on unavailable.
   *
   * @property presenceOnUnavailable
   * @type {string}
   * @private
   */
  var presenceOnUnavailable;

  /**
   * The destination number of the "callforward" presence status on busy.
   *
   * @property presenceOnBusyCallforwardTo
   * @type {string}
   * @private
   * @default ""
   */
  var presenceOnBusyCallforwardTo = '';

  /**
   * The destination number of the "callforward" presence status on unavailable.
   *
   * @property presenceOnUnavailableCallforwardTo
   * @type {string}
   * @private
   * @default ""
   */
  var presenceOnUnavailableCallforwardTo = '';

  /**
   * The endpoints of the user. The keys are the endpoint types
   * and the values are objects that contains endpoint identifiers
   * as keys and Endpoint objects as values.
   *
   * @property endpoints
   * @private
   */
  var endpoints = {};
  var type;
  for (type in endpointTypes.TYPES) {
    endpoints[endpointTypes.TYPES[type]] = {};
  }

  /**
   * Returns the username of the user.
   *
   * @method getUsername
   * @return {string} The username
   */
  function getUsername() {
    return username;
  }

  /**
   * Returns the name of the user.
   *
   * @method getName
   * @return {string} The name
   */
  function getName() {
    return name;
  }

  /**
   * Get the presence status.
   *
   * @method getPresence
   * @return {string} The presence status.
   */
  function getPresence() {
    return presence ? presence : '';
  }

  /**
   * Get the mainPresence status.
   *
   * @method getMainPresence
   * @return {string} The main presence status.
   */
  function getMainPresence() {
    return mainPresence ? mainPresence : '';
  }

  /**
   * Set the presence status.
   *
   * @method setMainPresence
   * @param {string} status The presence status
   */
  function setMainPresence(status) {
    mainPresence = status;
  }

  /**
   * Get the "recall on busy" permission.
   *
   * @method getRecallOnBusy
   * @return {object} The "recall on busy" permission status.
   */
  function getRecallOnBusy() {
    return recallOnBusy ? recallOnBusy : '';
  }

  /**
   * Set the "recall on busy" permission.
   *
   * @method setRecallOnBusy
   * @param {string} status The "recall on busy" permission status.
   */
  function setRecallOnBusy(status) {
    recallOnBusy = status;
  }

  /**
   * Get the conditional presence status on busy.
   *
   * @method getPresenceOnBusy
   * @return {object} The conditional presence status on busy.
   */
  function getPresenceOnBusy() {
    return presenceOnBusy ? presenceOnBusy : '';
  }

  /**
   * Get the conditional presence status on unavailable.
   *
   * @method getPresenceOnUnavailable
   * @return {object} The conditional presence status on unavailable.
   */
  function getPresenceOnUnavailable() {
    return presenceOnUnavailable ? presenceOnUnavailable : '';
  }

  /**
   * Set the presence status.
   *
   * @method setPresence
   * @param {string} status The presence status
   */
  function setPresence(status) {
    presence = status;
  }

  /**
   * Set the presence status on busy.
   *
   * @method setPresenceOnBusy
   * @param {string} status The presence status on busy
   */
  function setPresenceOnBusy(status) {
    presenceOnBusy = status;
  }

  /**
   * Set the presence status on unavailable.
   *
   * @method setPresenceOnUnavailable
   * @param {string} status The presence status on unavailable
   */
  function setPresenceOnUnavailable(status) {
    presenceOnUnavailable = status;
  }

  /**
   * Set the destination of the "callforward" presence status.
   *
   * @method setPresenceCallforwardTo
   * @param {string} destination The destination number
   */
  function setPresenceCallforwardTo(destination) {
    presenceCallforwardTo = destination;
  }

  /**
   * Get the destination of the "callforward" presence status.
   *
   * @method getPresenceCallforwardTo
   * @param {string} destination The destination number
   */
  function getPresenceCallforwardTo(destination) {
    return presenceCallforwardTo;
  }

  /**
   * Set the destination of the "callforward" presence status on busy.
   *
   * @method setPresenceOnBusyCallforwardTo
   * @param {string} dest The destination number of call forward on "busy"
   */
  function setPresenceOnBusyCallforwardTo(dest) {
    presenceOnBusyCallforwardTo = dest;
  }

  /**
   * Return the destination of the "callforward" presence status on busy.
   *
   * @method getPresenceOnBusyCallforwardTo
   * @param {string} dest The destination number of call forward on "busy"
   */
  function getPresenceOnBusyCallforwardTo(dest) {
    return presenceOnBusyCallforwardTo;
  }

  /**
   * Set the destination of the "callforward" presence status on unavailable.
   *
   * @method setPresenceOnUnavailableCallforwardTo
   * @param {string} dest The destination number of call forward on "unavailable"
   */
  function setPresenceOnUnavailableCallforwardTo(dest) {
    presenceOnUnavailableCallforwardTo = dest;
  }

  /**
   * Return the destination of the "callforward" presence status on unavailable.
   *
   * @method getPresenceOnUnavailableCallforwardTo
   * @param {string} dest The destination number of call forward on "unavailable"
   */
  function getPresenceOnUnavailableCallforwardTo(dest) {
    return presenceOnUnavailableCallforwardTo;
  }

  /**
   * Set the conditional presence status for call forward on "unavailable".
   *
   * @method setCondPresenceCfUnavailable
   * @param {string} dest The destination number of call forward on "unavailable"
   */
  function setCondPresenceCfUnavailable(dest) {
    condPresence.cf_unavailable = dest;
  }

  /**
   * Returns all endpoints of the user.
   *
   * @method getAllEndpoints
   * @return {object} All the user endpoints.
   */
  function getAllEndpoints() {
    return endpoints;
  }

  /**
   * Returns all endpoints of the user in JSON format.
   *
   * **It can throw an Exception.**
   *
   * @method getAllEndpointsJSON
   * @return {object} All the user endpoints in JSON format.
   */
  function getAllEndpointsJSON() {

    var result = {}; // object to return
    var id, type, endptTemp;

    // cycle in all endpoints
    for (type in endpointTypes.TYPES) {

      // initialize object to return with endpoint type
      result[endpointTypes.TYPES[type]] = {};

      // it's all the endpoints of one type, e.g. the extension endpoints
      endptTemp = endpoints[endpointTypes.TYPES[type]];

      // cycle in all endpoints of one type, e.g. the extension endpoints
      for (id in endptTemp) {
        // check if the endpoint object has the toJSON function
        if (typeof endptTemp[id].toJSON === 'function') {
          result[endpointTypes.TYPES[type]][id] = endptTemp[id].toJSON();
        }
      }
    }
    return result;
  }

  /**
   * Adds an endpoint. The function assumes that the specified
   * endpoint type is valid. Otherwise it throws an exception.
   *
   * **It can throw an Exception.**
   *
   * @method addEndpoint
   * @param {string} type The endpoint type
   * @param {string} id The endpoint identifier
   * @param {object} data The object containing some information
   *   on endpoint to add
   */
  function addEndpoint(type, id, data) {
    if (typeof type !== 'string' ||
      typeof data !== 'object' ||
      typeof id !== 'string' ||
      !endpointTypes.isValidEndpointType(type)) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // create new endpoint object
    var newEndpoint;
    if (type === endpointTypes.TYPES.email) {
      newEndpoint = new EndpointEmail(id);
    } else if (type === endpointTypes.TYPES.jabber) {
      newEndpoint = new EndpointJabber(id);
      // } else if (type === endpointTypes.TYPES.calendar) {
      //   newEndpoint = new EndpointCalendar(id);
    } else if (type === endpointTypes.TYPES.extension) {
      newEndpoint = new EndpointExtension(id, data);
    } else if (type === endpointTypes.TYPES.cellphone) {
      newEndpoint = new EndpointCellphone(id);
    } else if (type === endpointTypes.TYPES.voicemail) {
      newEndpoint = new EndpointVoicemail(id);
    } else if (type === endpointTypes.TYPES.mainextension) {
      newEndpoint = new EndpointMainExtension(id);
    }
    // add endpoint by its type
    endpoints[type][id] = newEndpoint;
  }

  /**
   * Returns the readable string of the user.
   *
   * @method toString
   * @return {string} The readable description of the user
   */
  function toString() {
    return 'user "' + username + '"';
  }

  /**
   * Returns the JSON representation of the user.
   *
   * @method toJSON
   * @return {object} The JSON representation of the user object.
   */
  function toJSON() {
    var ep, endpoType;
    var jsonEndpoints = {};

    // JSON representation of the endpoints
    for (endpoType in endpoints) {
      if (!jsonEndpoints[endpoType]) {
        jsonEndpoints[endpoType] = [];
      }
      for (ep in endpoints[endpoType]) {
        jsonEndpoints[endpoType].push(endpoints[endpoType][ep].toJSON());
      }
    }

    return {
      name: getName(),
      username: username,
      mainPresence: getMainPresence(),
      presence: getPresence(),
      endpoints: jsonEndpoints,
      presenceOnBusy: getPresenceOnBusy(),
      presenceOnUnavailable: getPresenceOnUnavailable(),
      recallOnBusy: getRecallOnBusy()
    };
  }

  // public interface
  return {
    toJSON: toJSON,
    getName: getName,
    toString: toString,
    setPresence: setPresence,
    getPresence: getPresence,
    getUsername: getUsername,
    addEndpoint: addEndpoint,
    getMainPresence: getMainPresence,
    setMainPresence: setMainPresence,
    getAllEndpoints: getAllEndpoints,
    getRecallOnBusy: getRecallOnBusy,
    setRecallOnBusy: setRecallOnBusy,
    getPresenceOnBusy: getPresenceOnBusy,
    setPresenceOnBusy: setPresenceOnBusy,
    getAllEndpointsJSON: getAllEndpointsJSON,
    getPresenceOnUnavailable: getPresenceOnUnavailable,
    setPresenceOnUnavailable: setPresenceOnUnavailable,
    setPresenceCallforwardTo: setPresenceCallforwardTo,
    getPresenceCallforwardTo: getPresenceCallforwardTo,
    getPresenceOnBusyCallforwardTo: getPresenceOnBusyCallforwardTo,
    setPresenceOnBusyCallforwardTo: setPresenceOnBusyCallforwardTo,
    setPresenceOnUnavailableCallforwardTo: setPresenceOnUnavailableCallforwardTo,
    getPresenceOnUnavailableCallforwardTo: getPresenceOnUnavailableCallforwardTo
  };
};
