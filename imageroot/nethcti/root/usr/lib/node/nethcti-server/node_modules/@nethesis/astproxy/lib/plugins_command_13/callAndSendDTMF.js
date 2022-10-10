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
* @default [callAndSendDTMF]
*/
var IDLOG = '[callAndSendDTMF]';

(function() {
    try {
        /**
        * The logger. It must have at least three methods: _info, warn and error._
        *
        * @property logger
        * @type object
        * @private
        * @default console
        */
        var logger = console;

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
        * Command plugin to originate a new call and then send DTMF tones.
        *
        * Use it with _astproxy_ module as follow:
        *
        *     ast_proxy.doCmd({ command: 'callAndSendDTMF', context: 'from-internal', chanType: 'sip', exten: '301', sequence: '0*' }, function (res) {
        *         // some code
        *     });
        *
        *
        * @class callAndSendDTMF
        * @static
        */
        var callAndSendDTMF = {

            /**
            * Execute asterisk action to originate a new call and then send DTMS tones.
            *
            * @method execute
            * @param {object}   am   Asterisk manager to send the action
            * @param {object}   args The object contains optional parameters passed to _doCmd_ method of the ast_proxy component
            * @param {function} cb   The callback function called at the end of the command
            * @static
            */
            execute: function (am, args, cb) {
                try {
                    // extract the parameters
                    var exten    = args.exten;
                    var chanType = args.chanType;
                    var sequence = args.sequence;
                    var context  = args.context;
                    var tyext    = chanType + '/' + exten;

                    // action for asterisk
                    var act = {
                        Action:      'Originate',
                        Channel:     tyext,
                        Context:     context,
                        Application: 'SendDTMF',
                        CallerID:    args.callerid,
                        Data:        'w' + sequence // w is for a half second pause
                    };

                    // set the action identifier
                    act.ActionID = action.getActionId('callAndSendDTMF');

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
                    if (map[data.actionid] && data.response === 'Success') {

                        map[data.actionid](null);  // success
                        delete map[data.actionid]; // remove association ActionID-callback

                    } else if (map[data.actionid] &&
                               data.response === 'Error' && data.message) {

                        map[data.actionid](new Error(data.message));
                        delete map[data.actionid]; // remove association ActionID-callback

                    } else if (map[data.actionid] && data.response === 'Error') {

                        map[data.actionid](new Error('error'));
                        delete map[data.actionid]; // remove association ActionID-callback
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
                    if (typeof log       === 'object'   &&
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
        exports.data      = callAndSendDTMF.data;
        exports.execute   = callAndSendDTMF.execute;
        exports.setLogger = callAndSendDTMF.setLogger;

    } catch (err) {
        logger.error(IDLOG, err.stack);
    }
})();
