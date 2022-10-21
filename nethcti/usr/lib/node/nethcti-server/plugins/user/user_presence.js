/**
 * Provides the status of the user presence.
 *
 * **It can throw Exceptions.**
 *
 * @class user_presence
 * @static
 */

/**
 * The list of the conditional user presence on busy.
 *
 * @property STATUS_ONBUSY
 * @type {object}
 * @readOnly
 * @default {
    "online": "online",
    "voicemail": "voicemail",
    "cellphone": "cellphone",
    "callforward": "callforward"
  }
 */
var STATUS_ONBUSY = {
  online: 'online',
  voicemail: 'voicemail',
  cellphone: 'cellphone',
  callforward: 'callforward'
};

/**
 * The list of the conditional user presence on unavailable.
 *
 * @property STATUS_ONUNAVAILABLE
 * @type {object}
 * @readOnly
 * @default {
    "online": "online",
    "voicemail": "voicemail",
    "cellphone": "cellphone",
    "callforward": "callforward"
  }
 */
var STATUS_ONUNAVAILABLE = {
  online: 'online',
  voicemail: 'voicemail',
  cellphone: 'cellphone',
  callforward: 'callforward'
};

/**
 * The list of the user presence.
 *
 * @property STATUS
 * @type {object}
 * @readOnly
 * @default {
    "dnd": "dnd",
    "online": "online",
    "voicemail": "voicemail",
    "cellphone": "cellphone",
    "callforward": "callforward"
  }
 */
var STATUS = {
  online: 'online',
  dnd: 'dnd',
  voicemail: 'voicemail',
  cellphone: 'cellphone',
  callforward: 'callforward'
};

/**
 * Checks if the user presence status is valid.
 *
 * @method isValidUserPresence
 * @param  {string}  status The status of the user presence
 * @return {boolean} Return true if the user presence status is valid, false otherwise.
 */
function isValidUserPresence(status) {
  if (STATUS[status] !== undefined) {
    return true;
  }
  return false;
}

/**
 * Checks if the user presence status on busy is valid.
 *
 * @method isValidUserPresenceOnBusy
 * @param  {string}  status The status of the user presence on busy
 * @return {boolean} Return true if the user presence status on busy is valid, false otherwise.
 */
function isValidUserPresenceOnBusy(status) {
  if (STATUS_ONBUSY[status] !== undefined) {
    return true;
  }
  return false;
}

/**
 * Checks if the user presence status on unavailable is valid.
 *
 * @method isValidUserPresenceOnUnavailable
 * @param  {string}  status The status of the user presence on unavailable
 * @return {boolean} Return true if the user presence status on unavailable is valid, false otherwise.
 */
function isValidUserPresenceOnUnavailable(status) {
  if (STATUS_ONUNAVAILABLE[status] !== undefined) {
    return true;
  }
  return false;
}

// public interface
exports.STATUS = STATUS;
exports.STATUS_ONBUSY = STATUS_ONBUSY;
exports.isValidUserPresence = isValidUserPresence;
exports.STATUS_ONUNAVAILABLE = STATUS_ONUNAVAILABLE;
exports.isValidUserPresenceOnBusy = isValidUserPresenceOnBusy;
exports.isValidUserPresenceOnUnavailable = isValidUserPresenceOnUnavailable;
