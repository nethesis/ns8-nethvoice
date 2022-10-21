/**
 * Provides the status of the user main presence.
 *
 * **It can throw Exceptions.**
 *
 * @class user_main_presence
 * @static
 */

/**
 * The list of the user main presence.
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
  callforward: 'callforward',
  busy: 'busy',
  ringing: 'ringing',
  offline: 'offline'
};

// public interface
exports.STATUS = STATUS;
