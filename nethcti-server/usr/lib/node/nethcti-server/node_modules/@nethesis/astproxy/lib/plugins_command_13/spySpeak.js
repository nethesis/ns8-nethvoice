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
 * @default [spySpeak]
 */
var IDLOG = '[spySpeak]';

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
     * The string to use for operation caller identifier to show on the phone.
     *
     * @property CALLER
     * @type string
     * @private
     * @default <unknown>
     * @readOnly
     */
     var CALLER = '<unknown>';

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
     * Command plugin to spy a call with only listening.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'spySpeak', spierId: 'SIP/214', spiedId: '220', chToSpy: 'SIP/220-0000003f',  }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class spySpeak
     * @static
     */
    var spySpeak = {

      /**
       * Execute asterisk action to spy a call with only listening.
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
            Data: args.chToSpy + ',wqS',
            Action: 'Originate',
            Channel: args.spierId,
            Callerid: CALLER,
            Application: 'ChanSpy',
            Async: true
          };

          // set the action identifier
          act.ActionID = action.getActionId('spySpeak');

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
    exports.data = spySpeak.data;
    exports.execute = spySpeak.execute;
    exports.setLogger = spySpeak.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
