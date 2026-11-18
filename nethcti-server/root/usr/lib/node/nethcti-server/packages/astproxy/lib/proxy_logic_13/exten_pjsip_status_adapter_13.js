/**
 * Provides adapter from asterisk pjsip extensions status to
 * status description string.
 *
 * @class exten_pjsip_status_adapter_13
 * @static
 */
var EXTEN_STATUS_ENUM = require('../extension').EXTEN_STATUS_ENUM;

/**
 * Adapter from asterisk pjsip extension status to status string
 * for _Extension_ object. The key is the status and the value
 * is the status string description.
 *
 * @property AST_EXTEN_PJSIP_STATUS_2_STR_ADAPTER
 * @type {object}
 * @readOnly
 */
var AST_EXTEN_PJSIP_STATUS_2_STR_ADAPTER = {
  'Unknown': EXTEN_STATUS_ENUM.OFFLINE,
  'Not in use': EXTEN_STATUS_ENUM.ONLINE,
  'In use': EXTEN_STATUS_ENUM.BUSY,
  'Busy': EXTEN_STATUS_ENUM.BUSY,
  'Invalid': EXTEN_STATUS_ENUM.OFFLINE,
  'Unavailable': EXTEN_STATUS_ENUM.OFFLINE,
  'Ringing': EXTEN_STATUS_ENUM.RINGING,
  'Ring+Inuse': EXTEN_STATUS_ENUM.BUSY_RINGING,
  'On Hold': EXTEN_STATUS_ENUM.ONHOLD
};

exports.AST_EXTEN_PJSIP_STATUS_2_STR_ADAPTER = AST_EXTEN_PJSIP_STATUS_2_STR_ADAPTER;
