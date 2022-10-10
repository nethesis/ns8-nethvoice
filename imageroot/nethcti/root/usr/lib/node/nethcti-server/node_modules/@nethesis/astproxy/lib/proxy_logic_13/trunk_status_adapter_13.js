/**
 * Provides adapter from asterisk trunk status to status description string.
 *
 * @class trunk_status_adapter_13
 * @static
 */
var TRUNK_STATUS_ENUM = require('../trunk').TRUNK_STATUS_ENUM;

/**
 * Adapter from asterisk trunk status to status string.
 * The key is the status code and the value is the status string description.
 *
 * @property AST_TRUNK_STATUS_2_STR_ADAPTER
 * @type {object}
 * @readOnly
 */
var AST_TRUNK_STATUS_2_STR_ADAPTER = {
  'lagged': TRUNK_STATUS_ENUM.ONLINE,
  'unknown': TRUNK_STATUS_ENUM.OFFLINE,
  'reachable': TRUNK_STATUS_ENUM.ONLINE,
  'unreachable': TRUNK_STATUS_ENUM.OFFLINE,
  'unmonitored': TRUNK_STATUS_ENUM.OFFLINE
};

exports.AST_TRUNK_STATUS_2_STR_ADAPTER = AST_TRUNK_STATUS_2_STR_ADAPTER;
