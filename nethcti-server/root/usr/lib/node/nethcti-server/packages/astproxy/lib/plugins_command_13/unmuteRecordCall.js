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
 * @default [unmuteRecordCall]
 */
var IDLOG = '[unmuteRecordCall]';

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
     * Command plugin to unmute the recording of a call.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     ast_proxy.doCmd({ command: 'unmuteRecordCall', channel: 'SIP/214-00000' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class unmuteRecordCall
     * @static
     */
    var unmuteRecordCall = {

      /**
       * Execute asterisk action to unmute the recording of a call.
       *
       * @method execute
       * @param {object}   am   Asterisk manager to send the action
       * @param {object}   args The object contains optional parameters passed to _doCmd_ method of the ast_proxy component
       * @param {function} cb   The callback function called at the end of the command
       * @static
       */
      execute: function(am, args, cb) {
        try {
          // action for asterisk
          var act = {
            Action: 'MixMonitorMute',
            Channel: args.channel,
            Direction: 'both',
            State: 0
          };

          // set the action identifier
          act.ActionID = action.getActionId('unmuteRecordCall');

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
            data.response === 'Success') {

            map[data.actionid](null);

          } else if (map[data.actionid] &&
            data.message &&
            data.response === 'Error') {

            map[data.actionid](new Error(data.message));

          } else {
            map[data.actionid](new Error('error'));
          }
          delete map[data.actionid]; // remove association ActionID-callback

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
    exports.data = unmuteRecordCall.data;
    exports.execute = unmuteRecordCall.execute;
    exports.setLogger = unmuteRecordCall.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
