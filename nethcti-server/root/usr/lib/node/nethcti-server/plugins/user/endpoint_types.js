/**
 * Provides the type of the endpoints and some functions for it.
 *
 * **It can throw Exceptions.**
 *
 * @class endpoint_types
 * @static
 */

/**
 * The public list of the endpoint types.
 *
 * @property TYPES
 * @type {object}
 * @readOnly
 * @default {
    email: "email",
    jabber: "jabber",
    extension: "extension",
    cellphone: "cellphone",
    voicemail: "voicemail",
    mainextension: "mainextension"
}
 */
var TYPES = {
  email: 'email',
  jabber: 'jabber',
  // calendar: 'calendar',
  extension: 'extension',
  cellphone: 'cellphone',
  voicemail: 'voicemail',
  mainextension: 'mainextension'
};

/**
 * Checks if the endpoint type is valid.
 *
 * @method isValidEndpointType
 * @param  {string}  type The type of the endpoint
 * @return {boolean} Return true if the type is valid, false otherwise.
 */
function isValidEndpointType(type) {
  if (typeof type !== 'string') {
    throw new Error('wrong parameter');
  }
  if (TYPES[type] !== undefined) {
    return true;
  }
  return false;
}

// public interface
exports.TYPES = TYPES;
exports.isValidEndpointType = isValidEndpointType;
