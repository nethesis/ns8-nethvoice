/**
 * Provides the keys of the user configurations.
 *
 * @class user_config_keys
 * @static
 */

/**
 * The list of the user configuration keys.
 *
 * @property USER_CONFIG_KEYS
 * @type {object}
 * @readOnly
 * @default {
    "notifications":     "notifications",
    "queue_auto_login":  "queue_auto_login",
    "queue_auto_logout": "queue_auto_logout",
    "auto_dndon_logout": "auto_dndon_logout",
    "auto_dndoff_login": "auto_dndoff_login",
    "default_extension": "default_extension"
 }
*/
var USER_CONFIG_KEYS = {
  'notifications': 'notifications',
  'queue_auto_login': 'queue_auto_login',
  'queue_auto_logout': 'queue_auto_logout',
  'auto_dndon_logout': 'auto_dndon_logout',
  'auto_dndoff_login': 'auto_dndoff_login',
  'default_extension': 'default_extension'
};

/**
 * The list of the type of "when" send a notification.
 *
 * @property NOTIF_WHEN
 * @type {object}
 * @readOnly
 * @default {
    "never":   "never",
    "always":  "always",
    "offline": "offline"
}
 */
var NOTIF_WHEN = {
  'never': 'never',
  'always': 'always',
  'offline': 'offline'
};

// public interface
exports.NOTIF_WHEN = NOTIF_WHEN;
exports.USER_CONFIG_KEYS = USER_CONFIG_KEYS;
