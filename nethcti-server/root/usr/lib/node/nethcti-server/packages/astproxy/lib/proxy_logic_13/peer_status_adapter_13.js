/**
 * Provides adapter from asterisk status of "PeerEntry" event to a status description string.
 *
 * @class peer_status_adapter_13
 * @static
 */
var ONLINE = 'online';
var OFFLINE = 'offline';

/**
 * Adapter from asterisk status of "PeerEntry" event to a status string.
 * The key is the status code and the value is the status string description.
 * The status reported by the "PeerEntry" event must be compared with this
 * property using the "indexOf" method, because when the status is online it
 * reports also the time in milliseconds, e.g. "OK (5 ms)".
 *
 * @property AST_PEER_STATUS_2_STR_ADAPTER
 * @type {object}
 * @readOnly
 */
var AST_PEER_STATUS_2_STR_ADAPTER = {
  'ok': ONLINE,
  'lagged': ONLINE,
  'unknown': OFFLINE,
  'reachable': ONLINE,
  'unreachable': OFFLINE,
  'unmonitored': OFFLINE
};

exports.AST_PEER_STATUS_2_STR_ADAPTER = AST_PEER_STATUS_2_STR_ADAPTER;
