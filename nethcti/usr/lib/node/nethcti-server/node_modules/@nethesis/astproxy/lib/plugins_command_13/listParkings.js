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
 * @default [listParkings]
 */
var IDLOG = '[listParkings]';

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
     * List of all parkings.
     *
     * @property list
     * @type {object}
     * @private
     */
    var list = {};

    /**
     * Command plugin to get the list of all parkings.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'listParkings' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class listParkings
     * @static
     */
    var listParkings = {

      /**
       * Execute asterisk action to get the list of all parkings.
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
            Action: 'Parkinglots'
          };

          // set the action identifier
          act.ActionID = action.getActionId('listParkings');

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
       * @param {object} data The asterisk data for the current command.
       * @static
       */
      data: function(data) {
        try {
          if (data.event === 'Parkinglot' && data.startspace && data.stopspace && data.timeout) {
            var i;
            // create the parking list
            for (i = parseInt(data.startspace); i <= parseInt(data.stopspace); i++) {
              list[i] = { timeout: parseInt(data.timeout) };
            }

          } else if (data.event === 'ParkinglotsComplete') {
            // invoke all callback in the 'map' object, because the current
            // event 'Parkinglot' does not have the 'ActionID' key. So, it is not
            // possible to associate the event with the correct callback that
            // has executed the command
            var k;
            for (k in map) {
              map[k](null, list);
            }

            map = {}; // delete all callback functions
            list = {}; // empty the list
          }

        } catch (err) {
          logger.error(IDLOG, err.stack);
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
    exports.data = listParkings.data;
    exports.execute = listParkings.execute;
    exports.setLogger = listParkings.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
