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
 * @default [meetmeList]
 */
var IDLOG = '[meetmeList]';

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
     * List of all channels. The key is the channel identifier
     * and the value is the _Channel_ object.
     *
     * @property list
     * @type {object}
     * @private
     */
    var list = {};

    /**
     * Command plugin to mute a meetme user.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'meetmeList', confId: '200', meetmeConfCode: '987' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class meetmeList
     * @static
     */
    var meetmeList = {

      /**
       * Execute asterisk action to mute a meetme user.
       *
       * @method execute
       * @param {object}   am   Asterisk manager to send the action
       * @param {object}   args The object contains optional parameters passed to _doCmd_ method of the astproxy component
       * @param {function} cb   The callback function called at the end of the command
       * @static
       */
      execute: function (am, args, cb) {
        try {
          // action for asterisk
          var act = {
            Action: 'MeetmeList',
            Conference: args.meetmeConfCode + args.confId
          };

          // set the action identifier
          act.ActionID = action.getActionId('meetmeList');

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
          // store new member object
          if (data.event === 'MeetmeList') {
            var obj = {
              conference: data.conference,
              userNumber: data.usernumber,
              callerIdNum: data.calleridnum,
              callerIdName: data.calleridname,
              connectedLineNum: data.connectedlinenum,
              connectedLineName: data.connectedlinename,
              channel: data.channel,
              admin: data.admin,
              role: data.role,
              muted: data.muted,
              talking: data.talking
            };
            list[data.usernumber] = obj;

          } else if (map[data.actionid] && data.event === 'MeetmeListComplete') {
            map[data.actionid](null, list);
          }
          if (data.event === 'MeetmeListComplete') {
            list = {};
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
    exports.data = meetmeList.data;
    exports.execute = meetmeList.execute;
    exports.setLogger = meetmeList.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
