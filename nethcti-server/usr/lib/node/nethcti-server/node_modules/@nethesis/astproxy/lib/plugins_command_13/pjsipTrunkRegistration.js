/**
 * @submodule plugins_command_13
 */
var action = require('../action');
var AST_TRUNK_REG_2_STR_ADAPTER = require('../proxy_logic_13/trunk_reg_adapter_13.js').AST_TRUNK_REG_2_STR_ADAPTER;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [pjsipTrunkRegistration]
 */
var IDLOG = '[pjsipTrunkRegistration]';

(function () {

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
     * Reference between the trunk's informations passed in arguments and the trunk's informations in registry
     *
     * @property ref
     * @type {object}
     * @private
     */
    var ref = {};

    /**
     * Command plugin to get the pjsip trunk registration.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'pjsipTrunkRegistration', trunk: '3001' }, function (res) {
     *         // some code
     *     });
     *
     * @class pjsipTrunkRegistration
     * @static
     */
    var pjsipTrunkRegistration = {

      /**
       * Execute asterisk action to get the trunk status.
       * 
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function (am, args, cb) {
        try {

          // check arguments
          if (!args["trunk"] && !args["trunk"].host && !args["trunk"].username) {
            throw new Error('wrong parameters: ' + JSON.stringify(args));
          }

          // action for asterisk
          var act = {
            Action: 'PJSIPShowRegistrationsOutbound'
          };

          // set the action identifier
          act.ActionID = action.getActionId('pjsipTrunkRegistration');

          // save arguments informations
          ref[act.ActionID] = args.trunk

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
      data: function (data) {
        try {

          // check callback and info presence and execute it
          if (map[data.actionid] &&
            ref[data.actionid] &&
            ref[data.actionid].name &&
            data.endpoint &&
            data.status &&
            data.event === 'OutboundRegistrationDetail') {

            if (data.endpoint === ref[data.actionid].name) {

              // execute callback
              map[data.actionid](null, {
                trunk: ref[data.actionid].name,
                registration: AST_TRUNK_REG_2_STR_ADAPTER[data.status.toLowerCase()]
              });

            }

          } else if (map[data.actionid] &&
            data.message &&
            data.response === 'Error') {

            map[data.actionid](new Error(data.message));

            // remove association ActionID-callback
            delete map[data.actionid];

          } else if (map[data.actionid] && data.response === 'Error') {

            map[data.actionid](new Error('error'));

            // remove association ActionID-callback
            delete map[data.actionid];

          } else if (map[data.actionid] && data.event === 'RegistrationsComplete') {

            // remove association ActionID-callback
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
      setLogger: function (log) {
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
    exports.data = pjsipTrunkRegistration.data;
    exports.execute = pjsipTrunkRegistration.execute;
    exports.setLogger = pjsipTrunkRegistration.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
