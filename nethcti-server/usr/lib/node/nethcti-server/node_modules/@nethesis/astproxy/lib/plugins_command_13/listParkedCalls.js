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
 * @default [listParkedCalls]
 */
var IDLOG = '[listParkedCalls]';

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
     * List of all parked calls.
     *
     * @property list
     * @type {object}
     * @private
     */
    var list = {};

    /**
     * Command plugin to get the list of all calls.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'listParkedCalls' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class listParkedCalls
     * @static
     */
    var listParkedCalls = {

      /**
       * Execute asterisk action to get the list of all calls.
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
            Action: 'ParkedCalls'
          };

          // set the action identifier
          act.ActionID = action.getActionId('listParkedCalls');

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
          if (data.event === 'ParkedCall' &&
            data.parkingspace &&
            data.parkeechannel &&
            data.parkingtimeout &&
            data.parkingduration &&
            data.parkerdialstring) {

            list[data.parkingspace] = {};
            list[data.parkingspace].channel = data.parkeechannel;
            list[data.parkingspace].parking = data.parkingspace;
            list[data.parkingspace].parkeeNum = data.parkerdialstring.indexOf('/') !== -1 ? data.parkerdialstring.split('/')[1] : '';
            list[data.parkingspace].timeout = parseInt(data.parkingtimeout);
            list[data.parkingspace].duration = parseInt(data.parkingduration);

          } else if (map[data.actionid] && data.event === 'ParkedCallsComplete') {
            map[data.actionid](null, list); // callback execution
            list = {}; // empty list
            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] && data.response === 'Error' && data.message) {
            map[data.actionid](new Error(data.message));
            list = {}; // empty list
            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] && data.response === 'Error') {
            map[data.actionid](new Error('error'));
            list = {}; // empty list
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
    exports.data = listParkedCalls.data;
    exports.execute = listParkedCalls.execute;
    exports.setLogger = listParkedCalls.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();

function isNotEmpty(element, index, array) {
  return (element !== '');
}
