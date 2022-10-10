/**
 * @submodule plugins_command_13
 */
var action = require('../action');
var AST_EXTEN_PJSIP_STATUS_2_STR_ADAPTER = require('../proxy_logic_13/exten_pjsip_status_adapter_13.js').AST_EXTEN_PJSIP_STATUS_2_STR_ADAPTER;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [pjsipDetails]
 */
var IDLOG = '[pjsipDetails]';

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
     * List of all pjsip extensions.
     *
     * @property list
     * @type object
     * @private
     */
    var list = {};

    /**
     * Command plugin to get the details of a SIP extension.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     ast_proxy.doCmd({ command: 'pjsipDetails', exten: '214' }, function (res) {
     *         // some code
     *     });
     *
     * @class pjsipDetails
     * @static
     */
    var pjsipDetails = {

      /**
       * Execute asterisk action to get the details of a SIP extension.
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
            Action: 'PJSIPShowEndpoint',
            Endpoint: args.exten
          };

          // set the action identifier
          act.ActionID = action.getActionId('pjsipDetails');

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
       * from asterisk and relative to this command
       *
       * @method data
       * @param {object} data The asterisk data for the current command
       * @static
       */
      data: function(data) {
        try {
          if (data.response === 'Success' && data.eventlist === 'start') {
            // initialize result only in the first event received
            if (!list[data.actionid]) {
              list[data.actionid] = {
                ip: '',
                name: '',
                port: '',
                exten: '',
                context: '',
                chantype: 'pjsip',
                sipuseragent: ''
              };
            }
          } else if (data.event === 'ContactStatusDetail') {

            if (data.viaaddress) {
              list[data.actionid].ip = data.viaaddress.split(':')[0];
              list[data.actionid].port = data.viaaddress.split(':')[1];

            } else if (data.uri && data.uri.indexOf('@') !== -1) {
              list[data.actionid].ip = (data.uri.split('@')[1]).split(':')[0];
              list[data.actionid].port = (data.uri.split('@')[1]).split(':')[1];
            }
            list[data.actionid].sipuseragent = data.useragent;

          } else if (data.event === 'EndpointDetail') {
            list[data.actionid].exten = data.objectname;
            list[data.actionid].codecs = data.allow ? data.allow.replace(/[()]/g, '').split('|') : [];
            list[data.actionid].context = data.context;
            list[data.actionid].status = AST_EXTEN_PJSIP_STATUS_2_STR_ADAPTER[data.devicestate];

          } else if (map[data.actionid] && data.event === 'EndpointDetailComplete') {
            map[data.actionid](null, list[data.actionid]); // callback execution

          } else if (map[data.actionid] && data.message && data.response === 'Error') {
            map[data.actionid](new Error(data.message));
            delete list[data.actionid]; // empties the list
            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] && data.response === 'Error') {
            map[data.actionid](new Error('error'));
            delete list[data.actionid]; // empties the list
            delete map[data.actionid]; // remove association ActionID-callback
          }
          if (data && data.event === 'EndpointDetailComplete') {
            delete list[data.actionid]; // empties the list
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
    exports.data = pjsipDetails.data;
    exports.execute = pjsipDetails.execute;
    exports.setLogger = pjsipDetails.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
