/**
 * @submodule plugins_command_13
 */
var action = require('../action');
var AST_PEER_STATUS_2_STR_ADAPTER = require('../proxy_logic_13/peer_status_adapter_13.js').AST_PEER_STATUS_2_STR_ADAPTER;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [listIaxPeers]
 */
var IDLOG = '[listIaxPeers]';

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
     * of the command.
     *
     * @property map
     * @type {object}
     * @private
     */
    var map = {};

    /**
     * List of all IAX extensions.
     *
     * @property list
     * @type {array}
     * @private
     */
    var list = [];

    /**
     * Command plugin to get the list of all IAX peers.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'listIaxPeers' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class listIaxPeers
     * @static
     */
    var listIaxPeers = {

      /**
       * Execute asterisk action to get the list of all IAX peers.
       * 
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function (am, args, cb) {
        try {
          // action for asterisk
          var act = {
            Action: 'IAXpeerlist'
          };

          // set the action identifier
          act.ActionID = action.getActionId('listIaxPeers');

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
      data: function (data) {
        try {
          // store new Extension object
          // data.objectname is extension number, e.g., 214
          if (data.event === 'PeerEntry' && data.objectname && data.channeltype) {

            // status is so calculated because when the peer is online the status is
            // composed by the string "OK" plus a time in milliseconds, e.g. "OK (5 ms)"
            var status = (data.status.split(' ')[0]).toLowerCase();

            list.push({
              ip: data.ipaddress === '(null)' ? '' : data.ipaddress,
              port: data.port === '0' ? '' : data.port,
              exten: data.objectname,
              status: AST_PEER_STATUS_2_STR_ADAPTER[status]
            });

          } else if (map[data.actionid] && data.event === 'PeerlistComplete') {
            map[data.actionid](null, list); // callback execution
          }

          if (data.event === 'PeerlistComplete') {
            list = []; // empty list
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
    exports.data = listIaxPeers.data;
    exports.execute = listIaxPeers.execute;
    exports.setLogger = listIaxPeers.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
