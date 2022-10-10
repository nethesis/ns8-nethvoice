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
 * @default [listVoicemail]
 */
var IDLOG = '[listVoicemail]';

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
     * List of all voicemail.
     *
     * @property list
     * @type object
     * @private
     */
    var list = {};

    /**
     * Command plugin to get the list of all voicemail.
     *
     * Use it with _astproxy_ module as follow:
     *
     *     astproxy.doCmd({ command: 'listVoicemail' }, function (res) {
     *         // some code
     *     });
     *
     *
     * @class listVoicemail
     * @static
     */
    var listVoicemail = {

      /**
       * Execute asterisk action to get the list of all voicemail.
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
            Action: 'VoicemailUsersList'
          };

          // set the action identifier
          act.ActionID = action.getActionId('listVoicemail');

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
          // store new voicemail information object
          // data.objectname is the extension number, e.g., 214
          // data.email can be an empty string, so check that it is not undefined
          if (data && data.event === 'VoicemailUserEntry' &&
            data.fullname && data.email !== undefined &&
            data.vmcontext && data.voicemailbox &&
            data.maxmessagecount && data.maxmessagelength && data.newmessagecount) {

            // initialize result only in the first event received
            if (!list[data.actionid]) {
              list[data.actionid] = {};
            }

            var obj = {
              id: data.voicemailbox,
              owner: data.fullname,
              email: data.email,
              context: data.vmcontext,
              newMessageCount: data.newmessagecount,
              maxMessageCount: data.maxmessagecount,
              maxMessageLength: data.maxmessagelength
            };
            list[data.actionid][data.voicemailbox] = obj;

          } else if ((map[data.actionid] && data && data.event === 'VoicemailUserEntryComplete') ||
            (data.response === 'Success' && data.message === 'There are no voicemail users currently defined.')) {

            map[data.actionid](null, list[data.actionid]); // callback execution
          }

          if (data && data.event === 'VoicemailUserEntryComplete') {
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
    exports.data = listVoicemail.data;
    exports.execute = listVoicemail.execute;
    exports.setLogger = listVoicemail.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
