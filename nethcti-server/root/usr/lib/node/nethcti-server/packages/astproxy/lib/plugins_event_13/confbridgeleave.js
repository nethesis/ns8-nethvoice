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
 * @default [confBridgeLeave]
 */
var IDLOG = '[confBridgeLeave]';

/**
 * The asterisk proxy.
 *
 * @property astProxy
 * @type object
 * @private
 */
var astProxy;

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
     * The plugin that handles the ConfBridgeLeave event.
     *
     * @class confBridgeLeave
     * @static
     */
    var confBridgeLeave = {
      /**
       * It's called from _astproxy_ component for each
       * ConfBridgeLeave event received from the asterisk.
       *
       * @method data
       * @param {object} data The asterisk event data
       * @static
       */
      data: function (data) {
        try {
          if (data.conference &&
            data.calleridnum &&
            data.calleridname &&
            data.event === 'ConfbridgeLeave') {

            logger.info(IDLOG, 'received event ' + data.event);

            var CONFBRIDGE_CONF_CODE = astProxy.proxyLogic.getConfBridgeConfCode();
            var extOwnerId = data.conference.substring(CONFBRIDGE_CONF_CODE.length, data.conference.length);
            astProxy.proxyLogic.evtRemoveConfBridgeUserConf({
              confId: extOwnerId,
              userId: `${extOwnerId}-${data.calleridnum}`,
              extenId: data.calleridnum
            });

          } else {
            logger.warn(IDLOG, 'ConfBridgeLeave event not recognized');
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
    exports.data = confBridgeLeave.data;
    exports.visit = confBridgeLeave.visit;
    exports.setLogger = confBridgeLeave.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
