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
 * @default [listQueues]
 */
var IDLOG = '[listQueues]';

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
     * List of all queues.
     *
     * @property list
     * @type {array}
     * @private
     */
    var list = [];

    /**
     * Command plugin to get the list of all queues.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'listQueues' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class listQueues
     * @static
     */
    var listQueues = {

      /**
       * Execute asterisk action to get the list of all queues.
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
            Action: 'QueueSummary'
          };

          // set the action identifier
          act.ActionID = action.getActionId('listQueues');

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
       * @param {object} data The asterisk data for the current command.
       * @static
       */
      data: function(data) {
        try {
          // store new queue information object
          // data.queue is the queue number, e.g., 401
          if (data &&
            data.queue &&
            data.queue !== 'default' && // discard queue with 'default' number
            data.event === 'QueueSummary') {

            list.push({
              queue: data.queue
            });

          } else if (map[data.actionid] && data.event === 'QueueSummaryComplete') {
            map[data.actionid](null, list); // callback execution
          }

          if (data.event === 'QueueSummaryComplete') {
            list = []; // empties the list
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
    exports.data = listQueues.data;
    exports.execute = listQueues.execute;
    exports.setLogger = listQueues.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
