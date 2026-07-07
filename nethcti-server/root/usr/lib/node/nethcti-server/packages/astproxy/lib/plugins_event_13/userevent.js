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
* @default [userevent]
*/
var IDLOG = '[userevent]';

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
    * The plugin that handles the UserEvent event.
    *
    * @class userevent
    * @static
    */
    var userevent = {
      /**
      * It's called from _ast\_proxy_ component for each
      * UserEvent event received from the asterisk.
      *
      * @method data
      * @param {object} data The asterisk event data
      * @static
      */
      data: function (data) {
        try {
          if (data.calleridnum && data.uniqueid && data.value && data.userevent === 'CallIn' && data.event === 'UserEvent') {
            logger.info(`recv ${data.event} "${data.userevent}" from number ${data.calleridnum}`);
            astProxy.proxyLogic.evtNewExternalCallIn({
              callerNum: data.calleridnum,
              calledNum: data.value,
              uniqueid: data.uniqueid
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
          if (typeof log === 'object'   &&
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
          if (!ap || typeof ap !== 'object') {
            throw new Error('wrong parameter');
          }
          astProxy = ap;
        } catch (err) {
          logger.error(IDLOG, err.stack);
        }
      }
    };
    exports.data = userevent.data;
    exports.visit = userevent.visit;
    exports.setLogger = userevent.setLogger;
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
