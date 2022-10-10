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
 * @default [inoutDynQueues]
 */
var IDLOG = '[inoutDynQueues]';

/**
 * The prefix to use for caller id.
 *
 * @property PRE_CALLERID
 * @type {string}
 * @private
 * @default '"CTI"'
 */
var PRE_CALLERID = '"CTI"';

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
     * Command plugin to alternate the logon and logout of the specified extension
     * in all the queues for which it's a dynamic member.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'inoutDynQueues', context: 'from-internal', exten: '214' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class inoutDynQueues
     * @static
     */
    var inoutDynQueues = {

      /**
       * Execute asterisk action to originate a new call.
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
            Action: 'Originate',
            Channel: 'Local/*45@' + args.context, // *45 is the code to be used
            Context: 'app-blackhole',
            CallerID: PRE_CALLERID + ' <' + args.exten + '>',
            Priority: 1,
            Exten: 'ring'
          };

          // set the action identifier
          act.ActionID = action.getActionId('inoutDynQueues');

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
    exports.data = inoutDynQueues.data;
    exports.execute = inoutDynQueues.execute;
    exports.setLogger = inoutDynQueues.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
