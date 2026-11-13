/**
* Manage the asterisk events.
*
* @module ast_proxy
* @submodule plugins_event_11
*/

/**
* The module identifier used by the logger.
*
* @property IDLOG
* @type string
* @private
* @final
* @readOnly
* @default [messagewaiting]
*/
var IDLOG = '[messagewaiting]';

/**
* The asterisk proxy.
*
* @property astProxy
* @type object
* @private
*/
var astProxy;

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
        * The plugin that handles the MessageWaiting event.
        *
        * @class messagewaiting
        * @static
        */
        var messagewaiting = {
            /**
            * It's called from _astproxy_ component for each MessageWaiting event
            * received from the asterisk.
            *
            * @method data
            * @param {object} data The asterisk event data
            * @static
            */
            data: function (data) {
                try {
                    var context, voicemail;
                    // a new voice message has been left in a voicemail
                    if (data     && data.mailbox && data.new &&
                        data.old && data.event === 'MessageWaiting') {

                        logger.info(IDLOG, 'received event ' + data.event);

                        // extract the information
                        context   = data.mailbox.split('@')[1];
                        voicemail = data.mailbox.split('@')[0];

                        astProxy.proxyLogic.evtNewVoicemailMessage({
                            context:   context,
                            countNew:  data.new,
                            countOld:  data.old,
                            voicemail: voicemail
                        });

                    }
                    // some operation has been made on a voicemail message by the phone,
                    // for example listen or delete
                    else if (data         && data.mailbox &&
                             data.waiting && data.event === 'MessageWaiting') {

                        logger.info(IDLOG, 'received event ' + data.event);

                        // extract the information
                        context   = data.mailbox.split('@')[1];
                        voicemail = data.mailbox.split('@')[0];

                        astProxy.proxyLogic.evtUpdateVoicemailMessages({
                            context:   context,
                            voicemail: voicemail
                        });
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
            },

            /**
            * Store the asterisk proxy to visit.
            *
            * @method visit
            * @param {object} ap The asterisk proxy module.
            */
            visit: function (ap) {
                try {
                    // check parameter
                    if (!ap || typeof ap !== 'object') {
                        throw new Error('wrong parameter');
                    }
                    astProxy = ap;
                } catch (err) {
                    logger.error(IDLOG, err.stack);
                }
            }
        };

        // public interface
        exports.data      = messagewaiting.data;
        exports.visit     = messagewaiting.visit;
        exports.setLogger = messagewaiting.setLogger;

    } catch (err) {
        logger.error(IDLOG, err.stack);
    }
})();
