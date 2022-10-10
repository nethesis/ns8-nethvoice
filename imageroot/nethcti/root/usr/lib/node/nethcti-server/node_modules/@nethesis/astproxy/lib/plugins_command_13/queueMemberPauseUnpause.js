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
 * @default [queueMemberPauseUnpause]
 */
var IDLOG = '[queueMemberPauseUnpause]';

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
     * Command plugin to pause or unpause an extension from the specified queue. The _queue_ parameter
     * can be omitted. If it's, the pause or unpause is done in all queues.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'queueMemberPauseUnpause', queue: '401', exten: '214', reason: 'some reason', paused: true }, function (res) {
     *         // some code
     *     });
     *
     *     astproxy.doCmd({ command: 'queueMemberPauseUnpause', exten: '214', reason: 'some reason', paused: true }, function (res) {
     *         // some code
     *     });
     *
     * @class queueMemberPauseUnpause
     * @static
     */
    var queueMemberPauseUnpause = {

      /**
       * Execute asterisk action to pause/unpause an agent of a queue.
       *
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function(am, args, cb) {
        try {
          var interf = 'Local/' + args.exten + '@from-queue/n';

          // action for asterisk
          var act = {
            Action: 'QueuePause',
            Interface: interf,
            Paused: args.paused,
            Reason: args.reason,
          };

          // if the parameter "args.queue" is omitted the action is done in all queues
          if (args.queue) {
            act.Queue = args.queue;
          }

          // set the action identifier
          act.ActionID = action.getActionId('queueMemberPauseUnpause');

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

          } else if (map[data.actionid] && data.response === 'Error' && data.message) {

            map[data.actionid](new Error(data.message));

          } else if (map[data.actionid] && data.response === 'Error') {

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
    exports.data = queueMemberPauseUnpause.data;
    exports.execute = queueMemberPauseUnpause.execute;
    exports.setLogger = queueMemberPauseUnpause.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
