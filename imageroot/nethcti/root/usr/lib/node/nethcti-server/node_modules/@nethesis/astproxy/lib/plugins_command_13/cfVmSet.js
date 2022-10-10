/**
 * @module astproxy
 * @submodule plugins_command_13
 */
var action = require('../action');
var CFVM_PREFIX_CODE = require('../proxy_logic_13/util_call_forward_13').CFVM_PREFIX_CODE;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [cfVmSet]
 */
var IDLOG = '[cfVmSet]';

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
     * of the command
     *
     * @property map
     * @type {object}
     * @private
     */
    var map = {};

    /**
     * Command plugin to set the unconditional CF to voicemail status of an extension.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'cfVmSet', exten: '214', val: '214' }, function (res) {
     *         // some code
     *     });
     *
     * @class cfVmSet
     * @static
     */
    var cfVmSet = {
      /**
       * Execute asterisk action to set the unconditional CF to voicemail status.
       *
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function(am, args, cb) {
        try {
          var act;
          // action for asterisk
          if (args.activate) {

            // unconditional call forward to voicemail sets the CF property of the asterisk database as
            // well as the other type of call forward to a number. So, to distinguish them,
            // the call forward to a voicemail adds a prefix code to the destination
            // voicemail number
            var to = CFVM_PREFIX_CODE.vmu + args.val;
            act = {
              Action: 'DBPut',
              Family: 'CF',
              Key: args.exten,
              Val: to
            };
          } else {
            act = {
              Action: 'DBDel',
              Family: 'CF',
              Key: args.exten
            };
          }

          // set the action identifier
          act.ActionID = action.getActionId('cfVmSet');

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
       * from asterisk and relative to this command
       *
       * @method data
       * @param {object} data The asterisk data for the current command
       * @static
       */
      data: function(data) {
        try {
          // check callback and info presence and execute it
          if (map[data.actionid] &&
            (
              data.message === 'Updated database successfully' ||
              data.message === 'Key deleted successfully'
            ) &&
            data.response === 'Success') {

            map[data.actionid](null);
            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] && data.response === 'Error') {
            map[data.actionid](new Error('error'));
            delete map[data.actionid]; // remove association ActionID-callback
          }

        } catch (err) {
          logger.error(IDLOG, err.stack);
          if (map[data.actionid]) {
            map[data.actionid](err);
            delete map[data.actionid]; // remove association ActionID-callback
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
    exports.data = cfVmSet.data;
    exports.execute = cfVmSet.execute;
    exports.setLogger = cfVmSet.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
