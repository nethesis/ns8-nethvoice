/**
 * @module astproxy
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
 * @default [dbGet]
 */
var IDLOG = '[dbGet]';

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
     * Command plugin to get DND status of an extension.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'dbGet', family: 'QPENALTY', key: '401/agents/200' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class dbGet
     * @static
     */
    var dbGet = {

      /**
       * Execute asterisk action to get the DND status.
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
            Family: args.family,
            Key: args.key
          };

          // set the action identifier
          act.ActionID = action.getActionId('dbGet');

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
          if (map[data.actionid] && data.val && data.event === 'DBGetResponse' && data.key && data.family) {
            map[data.actionid](null, {
              family: data.family,
              key: data.key,
              val: data.val
            });
            delete map[data.actionid];

          } else if (map[data.actionid] && data.response === 'Error') {
            map[data.actionid](new Error('error'));
            delete map[data.actionid];
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
    exports.data = dbGet.data;
    exports.execute = dbGet.execute;
    exports.setLogger = dbGet.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
