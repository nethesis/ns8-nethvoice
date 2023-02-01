/**
 * @module astproxy
 * @submodule plugins_event_13
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [cdr]
 */
var IDLOG = '[cdr]';

/**
 * The asterisk proxy.
 *
 * @property astProxy
 * @type object
 * @private
 */
var astProxy;

(function () {
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
     * The plugin that handles the Cdr event raised when a new call detail records
     * has been logged into the call history.
     *
     * @class cdr
     * @static
     */
    var cdr = {
      /**
       * It's called from _astproxy_ component for each
       * Cdr event received from the asterisk.
       *
       * @method data
       * @param {object} data The asterisk event data
       * @static
       */
      data: function (data) {
        try {
          if (data.event === 'Cdr') {
            logger.info(IDLOG, 'received event ' + data.event);
            astProxy.proxyLogic.evtNewCdr({
              source: data.source,
              channel: data.channel,
              endtime: data.endtime,
              duration: data.duration,
              amaflags: data.amaflags,
              uniqueid: data.uniqueid,
              callerid: data.callerid,
              starttime: data.starttime,
              answertime: data.answertime,
              destination: data.destination,
              disposition: data.disposition,
              lastapplication: data.lastapplication,
              billableseconds: data.billableseconds,
              destinationcontext: data.destinationcontext,
              destinationchannel: data.destinationchannel,
              accountcode: data.accountcode
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
    exports.data = cdr.data;
    exports.visit = cdr.visit;
    exports.setLogger = cdr.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
