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
 * @default [sipDetails]
 */
var IDLOG = '[sipDetails]';

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
     * Command plugin to get the details of a SIP extension.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'sipDetails', exten: '214' }, function (res) {
     *         // some code
     *     });
     *
     * @class sipDetails
     * @static
     */
    var sipDetails = {

      /**
       * Execute asterisk action to get the details of a SIP extension.
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
            Action: 'SIPshowpeer',
            Peer: args.exten
          };

          // set the action identifier
          act.ActionID = action.getActionId('sipDetails');

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
      data: function (data) {
        try {
          // check callback and info presence and execute it
          if (map[data.actionid] && data.response === 'Success') {

            // fix the ip address if it's null
            var ip = data.addressip === '(null)' ? '' : data.addressip;

            // fix the port address if it's null
            var port = data.addressport === '0' ? '' : data.addressport;

            // cleans the name
            // removes extension number if it's present
            // e.g. '"User" <214>' becomes 'User'
            var name;
            if (data.callerid.indexOf('<') !== -1 &&
              data.callerid.indexOf('>') !== -1) {

              name = data.callerid.split('<')[0];
            }
            // removes quotes, initial and final whitespaces
            name = name.replace(/["]/g, '').trim();

            // execute callback
            map[data.actionid](null, {
              exten: {
                ip: ip,
                name: name,
                port: port,
                exten: data.objectname,
                codecs: data.codecs ? data.codecs.replace(/[()]/g, '').split('|') : [],
                context: data.context || '',
                chantype: data.channeltype,
                sipuseragent: data.sipuseragent
              }
            });

          } else if (map[data.actionid] &&
            data.message &&
            data.response === 'Error') {

            map[data.actionid](new Error(data.message));

          } else if (map[data.actionid]) {
            map[data.actionid](new Error('error'));
          }

          // remove association ActionID-callback
          delete map[data.actionid];

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
    exports.data = sipDetails.data;
    exports.execute = sipDetails.execute;
    exports.setLogger = sipDetails.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
