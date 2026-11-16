/**
 * Provides functions related to the prefixes used in the call forward
 * to voicemail property in the asterisk database. This is useful for
 * those command plugins that get and set the call forward property. E.g.
 * the call forward and the call forward to voicemail use the same database
 * key (CF), but the second adds a prefix to the destination number.
 *
 * @class util_call_forward_13
 * @static
 */

/**
 * Prefixes used to set the call forward to voicemail property in the
 * asterisk database. This is because both call forward and the call
 * forward to voicemail uses the same CF property of the asterisk database.
 *
 * @property CFVM_PREFIX_CODE
 * @type {object}
 * @readOnly
 * @default {
    "*":   "*",
    "vmu": "vmu"
}
 */
var CFVM_PREFIX_CODE = {
  '*': '*',
  'vmu': 'vmu'
};

/**
 * The call forward types.
 *
 * @property CF_TYPES
 * @type {object}
 * @readOnly
 * @default {
    "unconditional": "unconditional"
}
 */
var CF_TYPES = {
  // 'busy': 'busy',
  // 'unavailable': 'unavailable',
  'unconditional': 'unconditional'
};

// public interface
exports.CF_TYPES = CF_TYPES;
exports.CFVM_PREFIX_CODE = CFVM_PREFIX_CODE;
