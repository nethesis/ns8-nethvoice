/**
 * @submodule plugins_command_13
 */
var action = require('../action');
var CF_TYPES = require('../proxy_logic_13/util_call_forward_13').CF_TYPES;
var CFVM_PREFIX_CODE = require('../proxy_logic_13/util_call_forward_13').CFVM_PREFIX_CODE;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [cfbVmGet]
 */
var IDLOG = '[cfbVmGet]';

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
     * Command plugin to get the call forward to voicemail on busy status of an extension.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'cfbVmGet', exten: '214' }, function (res) {
     *         // some code
     *     });
     *
     * @class cfbVmGet
     * @static
     */
    var cfbVmGet = {

      /**
       * Execute asterisk action to get the call forward to voicemail status.
       *
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function(am, args, cb) {
        try {
          // action for asterisk
          var act = {
            Action: 'DBGet',
            Family: 'CFB',
            Key: args.exten
          };

          // set the action identifier
          act.ActionID = action.getActionId('cfbVmGet_' + args.exten);

          // add association ActionID-callback
          map[act.ActionID] = cb;

          // send action to asterisk
          am.send(act);

        } catch (err) {
          logger.error(IDLOG, err.stack);
        }
      },

      /**
       * It is called from _astproxy_ component for each data received
       * from asterisk and relative to this command.
       *
       * @method data
       * @param {object} data The asterisk data for the current command
       * @static
       */
      data: function(data) {
        try {
          // get the extension number from the action id
          var exten = data.actionid.split('_')[1];

          // check callback and info presence and execute it
          if (map[data.actionid] && data.event === 'DBGetResponse' &&
            data.family === 'CFB' &&
            data.val) {

            // check if the destination of the call forward is a voicemail.
            // If it is a something other, the result is false. This is
            // because the call forward to a number is checked with an
            // other command plugin. The call forward and the call forward
            // to voicemail use the same key database: CFB, but the second adds
            // a prefix to it
            var vm;
            var pre;
            var isCf2Vm = false;
            for (pre in CFVM_PREFIX_CODE) { // cycle in each cf to voicemail prefix code

              // check if the call forward value start with the prefix code. If it is
              // the call forward is to voicemail
              if (data.val.substring(0, pre.length) === pre) {

                // get the voicemail number subtracting the prefix code
                vm = data.val.substring(pre.length, data.val.length);
                isCf2Vm = true;
                break;
              }
            }

            if (isCf2Vm) {
              map[data.actionid](null, {
                exten: exten,
                status: 'on',
                cf_type: CF_TYPES.busy,
                to: vm
              });
            } else {
              map[data.actionid](null, {
                exten: exten,
                status: 'off',
                cf_type: CF_TYPES.busy
              });
            }

            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] && data.response === 'Error') {
            map[data.actionid](null, {
              exten: exten,
              status: 'off',
              cf_type: CF_TYPES.busy
            });
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
    exports.data = cfbVmGet.data;
    exports.execute = cfbVmGet.execute;
    exports.setLogger = cfbVmGet.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
