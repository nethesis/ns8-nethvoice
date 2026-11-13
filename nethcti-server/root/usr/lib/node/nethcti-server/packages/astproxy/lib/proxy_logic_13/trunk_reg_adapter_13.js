/**
 * Provides adapter from asterisk trunk registration to registration description string.
 *
 * @class trunk_reg_adapter_13
 * @static
 */
var TRUNK_REG_ENUM = require('../trunk').TRUNK_REG_ENUM;

/**
 * Adapter from asterisk trunk registration to registration string.
 * The key is the registration code and the value is the registration string description.
 *
 * @property AST_TRUNK_REG_2_STR_ADAPTER
 * @type {object}
 * @readOnly
 */
var AST_TRUNK_REG_2_STR_ADAPTER = {
  'auth. sent': TRUNK_REG_ENUM.SENT,
  'request sent': TRUNK_REG_ENUM.SENT,
  'no authentication': TRUNK_REG_ENUM.NOAUTH,
  'unregistered': TRUNK_REG_ENUM.UNREGISTERED,
  'unmonitored': TRUNK_REG_ENUM.UNMONITORED,
  'registered': TRUNK_REG_ENUM.REGISTERED,
  'rejected': TRUNK_REG_ENUM.REJECTED,
  'failed': TRUNK_REG_ENUM.FAILED
};

exports.AST_TRUNK_REG_2_STR_ADAPTER = AST_TRUNK_REG_2_STR_ADAPTER;
