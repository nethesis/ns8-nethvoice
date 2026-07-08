/**
 * Manage the asterisk events.
 *
 * @module ast_proxy
 * @submodule plugins_event_13
 */
var utilChannel13 = require('../proxy_logic_13/util_channel_13');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [hangup]
 */
var IDLOG = '[hangup]';

/**
 * The asterisk proxy.
 *
 * @property astProxy
 * @type object
 * @private
 */
var astProxy;

/**
 * The hangup causes.
 *
 * @property CAUSE
 * @type {object}
 * @private
 */
var CAUSE = {
  0: 'not_defined',
  1: 'unallocated',
  2: 'no_route_transit_net',
  3: 'no_route_destination',
  5: 'misdialled_trunk_prefix',
  6: 'channel_unacceptable',
  7: 'call_awarded_delivered',
  8: 'pre_empted',
  14: 'number_ported_not_here',
  16: 'normal_clearing',
  17: 'user_busy',
  18: 'no_user_response',
  19: 'no_answer',
  20: 'subscriber_absent',
  21: 'call_rejected',
  22: 'number_changed',
  23: 'redirected_to_new_destination',
  26: 'answered_elsewhere',
  27: 'destination_out_of_order',
  28: 'invalid_number_format',
  29: 'facility_rejected',
  30: 'response_to_status_enquiry',
  31: 'normal_unspecified',
  34: 'normal_circuit_congestion',
  38: 'network_out_of_order',
  41: 'normal_temporary_failure',
  42: 'switch_congestion',
  43: 'access_info_discarded',
  44: 'requested_chan_unavail',
  50: 'facility_not_subscribed',
  52: 'outgoing_call_barred',
  54: 'incoming_call_barred',
  57: 'bearercapability_notauth',
  58: 'bearercapability_notavail',
  65: 'bearercapability_notimpl',
  66: 'chan_not_implemented',
  69: 'facility_not_implemented',
  81: 'invalid_call_reference',
  88: 'incompatible_destination',
  95: 'invalid_msg_unspecified',
  96: 'mandatory_ie_missing',
  97: 'message_type_nonexist',
  98: 'wrong_message',
  99: 'ie_nonexist',
  100: 'invalid_ie_contents',
  101: 'wrong_call_state',
  102: 'recovery_on_timer_expire',
  103: 'mandatory_ie_length_error',
  111: 'protocol_error',
  127: 'interworking'
};

(function() {

  /**
   * The logger. It must have at least three methods: _info, warn and error._
   *
   * @property logger
   * @type object
   * @private
   * @default console
   */
  var logger = console;

  try {
    /**
     * The plugin that handles the hangup event.
     *
     * @class hangup
     * @static
     */
    var hangup = {
      /**
       * It is called from _astproxy_ component for each hangup event
       * received from the asterisk.
       *
       * @method data
       * @param {object} data The asterisk event data
       * @static
       */
      data: function(data) {
        try {
          if (data &&
            data.calleridnum && data.channel &&
            data.cause && data.event === 'Hangup') {

            // extract the extension name from the channel
            var channelExten = utilChannel13.extractExtensionFromChannel(data.channel);

            logger.info(IDLOG, 'received event ' + data.event);
            astProxy.proxyLogic.evtHangupConversation({
              cause: CAUSE[data.cause],
              channel: data.channel,
              callerNum: data.calleridnum,
              channelExten: channelExten,
              calledNum: data.connectedlinenum
            });

          } else {
            logger.warn(IDLOG, 'hangup event not recognized');
          }

        } catch (err) {
          logger.error(IDLOG, err.stack);
        }
      },

      /**
       * Set the logger to be used.
       *
       * @method setLogger
       * @param {object} log The logger object. It must have at least
       * three methods: _info, warn and error_
       * @static
       */
      setLogger: function(log) {
        try {
          if (typeof log === 'object' &&
            typeof log.info === 'function' &&
            typeof log.warn === 'function' &&
            typeof log.error === 'function') {

            logger = log;
          } else {
            throw new Error('wrong logger object');
          }
        } catch (err) {
          logger.error(IDLOG, err.stack);
        }
      },

      /**
       * Store the asterisk proxy to visit.
       *
       * @method visit
       * @param {object} ap The asterisk proxy module.
       */
      visit: function(ap) {
        try {
          // check parameter
          if (!ap || typeof ap !== 'object') {
            throw new Error('wrong parameter');
          }
          astProxy = ap;
        } catch (err) {
          logger.error(IDLOG, err.stack);
        }
      }
    };

    // public interface
    exports.data = hangup.data;
    exports.visit = hangup.visit;
    exports.setLogger = hangup.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
