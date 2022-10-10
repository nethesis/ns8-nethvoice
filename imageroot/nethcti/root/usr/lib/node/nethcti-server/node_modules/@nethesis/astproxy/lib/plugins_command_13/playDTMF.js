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
 * @default [playDTMF]
 */
var IDLOG = '[playDTMF]';

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
     * Command plugin to send a sequence of DMTF digits.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     ast_proxy.doCmd({ command: 'playDTMF', channel: 'SIP/301-0000000a', digit: '0' }, function (err) {
     *         // some code
     *     });
     *
     * @class playDTMF
     * @static
     */
    var playDTMF = {

      /**
       * Execute asterisk action to play one DTMF digit to the specified extension.
       *
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function(am, args, cb) {
        try {
          // asterisk action
          var act = {
            Action: 'PlayDTMF',
            Channel: args.channel,
            Digit: args.digit
          };

          // set the action identifier
          act.ActionID = action.getActionId('playDTMF');

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
          // check callback and info presence and execute it
          if (map[data.actionid] && data.response === 'Success') {
            map[data.actionid](null);
            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] && data.response === 'Error' && data.message) {
            map[data.actionid](new Error(data.message));
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
    exports.data = playDTMF.data;
    exports.execute = playDTMF.execute;
    exports.setLogger = playDTMF.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
