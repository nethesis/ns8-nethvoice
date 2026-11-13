/**
 * Provides adapter from asterisk queue member status code to
 * status description string.
 *
 * @class queue_member_status_adapter_13
 * @static
 */
var QUEUE_MEMBER_STATUS_ENUM = require('../queueMember').QUEUE_MEMBER_STATUS_ENUM;

/**
 * Adapter from asterisk queue member status code to status string
 * for _QueueMember_ object. The key is the status code and the value
 * is the status string description.
 *
 * @property AST_QUEUE_MEMBER_STATUS_2_STR_ADAPTER
 * @type {object}
 * @readOnly
 */
var AST_QUEUE_MEMBER_STATUS_2_STR_ADAPTER = {
  0: QUEUE_MEMBER_STATUS_ENUM.FREE, // Unknown
  1: QUEUE_MEMBER_STATUS_ENUM.FREE, // Not in use
  2: QUEUE_MEMBER_STATUS_ENUM.BUSY, // In use
  3: QUEUE_MEMBER_STATUS_ENUM.BUSY, // Busy
  4: QUEUE_MEMBER_STATUS_ENUM.FREE, // Invalid
  5: QUEUE_MEMBER_STATUS_ENUM.FREE, // Unavailable
  6: QUEUE_MEMBER_STATUS_ENUM.FREE, // Ringing
  7: QUEUE_MEMBER_STATUS_ENUM.BUSY, // Ringinuse
  8: QUEUE_MEMBER_STATUS_ENUM.BUSY, // Onhold
};

exports.AST_QUEUE_MEMBER_STATUS_2_STR_ADAPTER = AST_QUEUE_MEMBER_STATUS_2_STR_ADAPTER;
