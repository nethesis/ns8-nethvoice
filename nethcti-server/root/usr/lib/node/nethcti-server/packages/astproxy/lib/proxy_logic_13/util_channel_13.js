/**
 * Provides some utility functions to use with channels.
 *
 * @class util_channel_13
 * @static
 */

/**
 * Adapter from asterisk channel status code to status string
 * for _Channel_ object. The key is the status code and the value
 * is the status string description.
 *
 * @property AST_CHANNEL_STATE_2_STRING_ADAPTER
 * @type {object}
 * @readOnly
 * @private
 * @default {
    0: "down",
    1: "reserved",
    2: "offhook",
    3: "dialing",
    4: "ring",
    5: "ringing",
    6: "up",
    7: "busy",
    8: "dialing_offhook",
    9: "prering"
}
 */
var AST_CHANNEL_STATE_2_STRING_ADAPTER = {
  0: 'down',
  1: 'reserved',
  2: 'offhook',
  3: 'dialing',
  4: 'ring',
  5: 'ringing',
  6: 'up',
  7: 'busy',
  8: 'dialing_offhook',
  9: 'prering'
};

/**
 * Extracts the extension name from the channel
 * e.g. the channel can be "SIP/614-00000070" or "SIP/Eutelia-07211835565-00000045"
 * the first example concerns an extension and its name is "614"
 * the second example concerns a trunk and its name is "Eutelia-07211835565".
 *
 * **It can throw exceptions.**
 *
 * @class extractExtensionFromChannel
 * @param  {string} The channel
 * @return {string} The extension identifier
 */
function extractExtensionFromChannel(channel) {
  return channel.substring(0, channel.lastIndexOf('-')).split('/')[1];
}

exports.extractExtensionFromChannel = extractExtensionFromChannel;
exports.AST_CHANNEL_STATE_2_STRING_ADAPTER = AST_CHANNEL_STATE_2_STRING_ADAPTER;
