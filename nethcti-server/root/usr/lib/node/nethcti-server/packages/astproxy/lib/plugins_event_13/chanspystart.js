/**
 * Manage the asterisk events.
 *
 * @module astproxy
 * @submodule plugins_event_13
 */
var utilChannel13 = require('../proxy_logic_13/util_channel_13');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [chanspystart]
 */
var IDLOG = '[chanspystart]';

/**
 * The asterisk proxy.
 *
 * @property astProxy
 * @type object
 * @private
 */
var astProxy;

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
     * The plugin that handles the ChanSpyStart event.
     *
     * @class chanspystart
     * @static
     */
    var chanspystart = {
      /**
       * It's called from _astproxy_ component for each ChanSpyStart event
       * received from the asterisk.
       *
       * @method data
       * @param {object} data The asterisk event data
       * @static
       */
      data: function(data) {
        try {
          if (data && data.spyerchannel && data.event === 'ChanSpyStart') {

            logger.info(IDLOG, 'received event ' + data.event);

            var spierId = utilChannel13.extractExtensionFromChannel(data.spyerchannel);

            if (spierId !== undefined) {
              astProxy.proxyLogic.evtSpyStartConversation({
                spierId: spierId
              });
            } else {
              logger.warn(IDLOG, 'event ChanSpyStart with unknown spier channel ' + data.spyerchannel);
            }
          } else {
            logger.warn(IDLOG, 'ChanSpyStart event not recognized');
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
      },

      /**
       * Store the asterisk proxy to visit.
       *
       * @method visit
       * @param {object} ap The asterisk proxy module.
       */
      visit: function(ap) {
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
    exports.data = chanspystart.data;
    exports.visit = chanspystart.visit;
    exports.setLogger = chanspystart.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
