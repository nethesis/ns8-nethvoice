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
 * @default [listConfBridgeConf]
 */
var IDLOG = '[listConfBridgeConf]';

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
     * List of all conferences. The key is the identifier of the extension owner
     * and the value is the conference object.
     *
     * @property list
     * @type {object}
     * @private
     */
    var list = {};

    /**
     * Remote sites phone prefixes.
     *
     * @property remoteSitesPrefixes
     * @type {array}
     * @private
     */
    var remoteSitesPrefixes;

    /**
     * Asterisk phone code used to start a ConfBridge conference.
     *
     * @property CONFBRIDGE_CONF_CODE
     * @type {string}
     * @private
     */
    var CONFBRIDGE_CONF_CODE;

    /**
     * Command plugin to list all members of all or single ConfBridge conference.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     ast_proxy.doCmd({ command: 'listConfBridgeConf', confBridgeConfCode: '1234' }, function (res) {
     *         // some code
     *     });
     *
     *     ast_proxy.doCmd({ command: 'listConfBridgeConf', confBridgeConfCode: '1234', confId: '202' }, function (res) {
     *         // some code
     *     });
     *
     *     ast_proxy.doCmd({ command: 'listConfBridgeConf', confBridgeConfCode: '1234', confId: '202', remoteSitesPrefixes: { "6": "nethesis", "4": "nethesis2" } }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class listConfBridgeConf
     * @static
     */
    var listConfBridgeConf = {

      /**
       * Execute asterisk action to list a ConfBridge conference.
       *
       * @method execute
       * @param {object} am Asterisk manager used to send the action
       * @param {object} args The object containing optional parameters
       * @param {function} cb The callback function
       * @static
       */
      execute: function (am, args, cb) {
        try {
          CONFBRIDGE_CONF_CODE = args.confBridgeConfCode;
          remoteSitesPrefixes = args.remoteSitesPrefixes;

          // action for asterisk
          var act = {
            Action: 'ConfBridgeList'
          };
          if (args.confId) {
            act.Conference = CONFBRIDGE_CONF_CODE + args.confId;
          }

          // set the action identifier
          act.ActionID = action.getActionId('listConfBridgeConf');

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
            (
              (data.eventlist === 'Complete' && data.event === 'ConfbridgeListComplete') ||
              (data.response === 'Error' && data.message === 'No active conferences.')
            )) {

            map[data.actionid](null, list);
            list = {}; // empty list
            delete map[data.actionid]; // remove association ActionID-callback

          } else if (map[data.actionid] &&
            data.channel &&
            data.conference &&
            data.calleridnum &&
            data.calleridname &&
            data.muted &&
            data.event === 'ConfbridgeList') {

            // filter extensions of remote sites. If the involved number is of remote site
            // it starts with phone prefix of remote site. So it checks the first character
            // number to be a remote site prefix. If it is, it will be removed
            // e.g. calleridnum = 4208 - 4 is the prefix and 208 is the remote extension
            var remoteSite, prefix;
            if (typeof remoteSitesPrefixes === 'object' &&
              remoteSitesPrefixes[data.calleridnum.substring(0, 1)] !== undefined) {

              prefix = data.calleridnum.substring(0, 1);
              remoteSite = remoteSitesPrefixes[prefix];
              data.calleridnum = data.calleridnum.substring(1, data.calleridnum.length);
            }

            var extenOwner = data.conference.substring(CONFBRIDGE_CONF_CODE.length, data.conference.length);
            var userObj = {
              id: `${extenOwner}-${data.calleridnum}`,
              name: data.calleridname === '<no name>' ? undefined : data.calleridname,
              site: remoteSite,
              muted: data.muted.toLowerCase() === 'no' ? false : true,
              prefix: prefix,
              extenId: data.calleridnum,
              isOwner: extenOwner === data.calleridnum ? true : false,
              channel: data.channel
            };

            if (!list[extenOwner]) {
              list[extenOwner] = {
                users: [],
                confId: extenOwner
              };
            }
            list[extenOwner].users.push(userObj);

          } else if (map[data.actionid] &&
            data.message &&
            data.message !== 'No active conferences.' &&
            data.response === 'Error') {

            map[data.actionid](new Error(data.message));

          } else if (data.eventlist !== 'start' &&
            data.response !== 'Success' &&
            data.message !== 'No active conferences.') {

            map[data.actionid](new Error('error'));
          }

        } catch (err) {
          logger.error(IDLOG, err.stack);
          if (map[data.actionid]) {
            map[data.actionid](err);
            delete map[data.actionid]; // remove association ActionID-callback
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
    exports.data = listConfBridgeConf.data;
    exports.execute = listConfBridgeConf.execute;
    exports.setLogger = listConfBridgeConf.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
