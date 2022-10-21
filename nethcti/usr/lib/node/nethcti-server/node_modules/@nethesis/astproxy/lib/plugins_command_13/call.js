/**
 * @submodule plugins_command_13
 */
var action = require('../action');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [call]
 */
var IDLOG = '[call]';

/**
 * How long to wait for call to be answered (in ms.).
 *
 * @property CALL_TIMEOUT
 * @type {number}
 * @private
 * @default 15000
 */
var CALL_TIMEOUT = 15000;

/**
 * Call failure reasons.
 *
 * @property FAIL_REASON
 * @type {object}
 * @private
 */
var FAIL_REASON = {
  0: 'FAILURE',
  1: 'AST_CONTROL_HANGUP', // Other end has hungup
  2: 'AST_CONTROL_RING', // Local ring
  3: 'AST_CONTROL_RINGING', // Remote end is ringing
  4: 'AST_CONTROL_ANSWER', // Remote end has answered
  5: 'AST_CONTROL_BUSY', // Remote end is busy
  6: 'AST_CONTROL_TAKEOFFHOOK', // Make it go off hook
  7: 'AST_CONTROL_OFFHOOK', // Line is off hook
  8: 'AST_CONTROL_CONGESTION', // Congestion (circuits busy)
  9: 'AST_CONTROL_FLASH', // Flash hook
  10: 'AST_CONTROL_WINK', // Wink
  11: 'AST_CONTROL_OPTION', // Set a low-level option
  12: 'AST_CONTROL_RADIO_KEY', // Key Radio
  13: 'AST_CONTROL_RADIO_UNKEY', // Un-Key Radio
  14: 'AST_CONTROL_PROGRESS', // Indicate PROGRESS
  15: 'AST_CONTROL_PROCEEDING', // Indicate CALL PROCEEDING
  16: 'AST_CONTROL_HOLD', // Indicate call is placed on hold
  17: 'AST_CONTROL_UNHOLD', // Indicate call is left from hold
  18: 'AST_CONTROL_VIDUPDATE', // Indicate video frame update
  19: '_XXX_AST_CONTROL_T38', // T38 state change request/notification \deprecated This is no longer supported. Use AST_CONTROL_T38_PARAMETERS instead.
  20: 'AST_CONTROL_SRCUPDATE', // Indicate source of media has changed
  21: 'AST_CONTROL_TRANSFER', // Indicate status of a transfer request
  22: 'AST_CONTROL_CONNECTED_LINE', // Indicate connected line has changed
  23: 'AST_CONTROL_REDIRECTING', // Indicate redirecting id has changed
  24: 'AST_CONTROL_T38_PARAMETERS', // T38 state change request/notification with parameters
  25: 'AST_CONTROL_CC', // Indication that Call completion service is possible
  26: 'AST_CONTROL_SRCCHANGE', // Media source has changed and requires a new RTP SSRC
  27: 'AST_CONTROL_READ_ACTION', // Tell ast_read to take a specific action
  28: 'AST_CONTROL_AOC', // Advice of Charge with encoded generic AOC payload
  29: 'AST_CONTROL_END_OF_Q', // Indicate that this position was the end of the channel queue for a softhangup.
  30: 'AST_CONTROL_INCOMPLETE', // Indication that the extension dialed is incomplete
  31: 'AST_CONTROL_MCID', // Indicate that the caller is being malicious.
  32: 'AST_CONTROL_UPDATE_RTP_PEER', // Interrupt the bridge and have it update the peer
  33: 'AST_CONTROL_PVT_CAUSE_CODE' // Contains an update to the protocol-specific cause-code stored for branching dials
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
     * Map associations between ActionID and callback to execute at the end
     * of the command.
     *
     * @property map
     * @type {object}
     * @private
     */
    var map = {};

    /**
     * Command plugin to originate a new call.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     ast_proxy.doCmd({ command: 'call', chanType: 'pjsip', context: 'from-internal', from: '214', to: '12345' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class call
     * @static
     */
    var call = {

      /**
       * Executes asterisk action to originate a new call.
       *
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function(am, args, cb) {
        try {
          var ch = args.chanType ? (args.chanType + '/' + args.from) : ('Local/' + args.from + '@' + args.context);
          // action for asterisk
          var act = {
            Action: 'Originate',
            Channel: ch, // the caller
            Context: args.context,
            Priority: 1,
            CallerID: args.from,
            Timeout: CALL_TIMEOUT,
            Account: args.to,
            Exten: args.to, // the number to be called
            Async: true
          };

          // set the action identifier
          act.ActionID = action.getActionId('call');

          // add association ActionID-callback
          map[act.ActionID] = cb;

          // send action to asterisk
          am.send(act);

        } catch (err) {
          logger.error(IDLOG, err.stack);
        }
      },

      /**
       * It's called from _astproxy_ component for each data received
       * from asterisk and relative to this command.
       *
       * @method data
       * @param {object} data The asterisk data for the current command
       * @static
       */
      data: function(data) {
        try {
          // check callback and info presence and execute it
          if (map[data.actionid] &&
            data.event === 'OriginateResponse' &&
            data.response === 'Success') {

            map[data.actionid](null, {
              uniqueid: data.uniqueid
            });
            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] &&
            data.event === 'OriginateResponse' &&
            data.response === 'Failure') {

            map[data.actionid](new Error(FAIL_REASON[data.reason]));
            delete map[data.actionid]; // remove association ActionID-callback
          }

        } catch (err) {
          logger.error(IDLOG, err.stack);
          if (map[data.actionid]) {
            map[data.actionid](err);
            delete map[data.actionid];
          }
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
      }
    };

    // public interface
    exports.data = call.data;
    exports.execute = call.execute;
    exports.setLogger = call.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
