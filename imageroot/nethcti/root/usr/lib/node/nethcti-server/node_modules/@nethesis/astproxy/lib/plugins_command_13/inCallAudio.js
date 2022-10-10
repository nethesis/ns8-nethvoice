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
 * @default [inCallAudio]
 */
var IDLOG = '[inCallAudio]';

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
     * Command plugin to originate a new inCallAudio.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     ast_proxy.doCmd({ command: 'inCallAudio', extension: '19872001', audioId: '111' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class inCallAudio
     * @static
     */
    var inCallAudio = {

      /**
       * Executes asterisk action to originate a new inCallAudio.
       *
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function(am, args, cb) {
        try {
          var act = {
            Action: 'Originate',
            Channel: 'Local/' + args.audioId + '@incall-audio-play',
            MaxRetries: 0,
            RetryTime: 15,
            WaitTime: 15,
            Context: 'incall-audio-spy',
            Exten: args.extension,
            Priority: 1
          };

          // set the action identifier
          act.ActionID = action.getActionId('inCallAudio');

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
          if (map[data.actionid] && data.response === 'Success') {
            map[data.actionid](null);
            delete map[data.actionid]; // remove association ActionID-callback
          } else if (map[data.actionid] && data.message && data.response === 'Error') {
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
    exports.data = inCallAudio.data;
    exports.execute = inCallAudio.execute;
    exports.setLogger = inCallAudio.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
