/**
 * @module ast_proxy
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
 * @default [dialbegin]
 */
var IDLOG = '[dialbegin]';

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
     * The plugin that handles the DialBegin event.
     *
     * @class dialbegin
     * @static
     */
    var dialbegin = {
      /**
       * It is called from _astproxy_ component for each
       * DialBegin event received from the asterisk.
       *
       * @method data
       * @param {object} data The asterisk event data
       * @static
       */
      data: function(data) {
        try {
          if (data.channel && data.calleridnum &&
            data.destchannel && data.connectedlinenum &&
            data.calleridname && data.event === 'DialBegin') {

            // extract the extension name from the channels
            var chDestExten = utilChannel13.extractExtensionFromChannel(data.destchannel);
            var chSourceExten = utilChannel13.extractExtensionFromChannel(data.channel);

            logger.info(IDLOG, 'received event ' + data.event);
            astProxy.proxyLogic.evtConversationDialing({
              chDest: data.destchannel,
              chSource: data.channel,
              callerNum: data.calleridnum,
              callerName: data.calleridname === '<unknown>' ? '' : data.calleridname,
              dialingNum: data.connectedlinenum,
              chDestExten: chDestExten,
              chSourceExten: chSourceExten,
              destUniqueId: data.destuniqueid || ''
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
    exports.data = dialbegin.data;
    exports.visit = dialbegin.visit;
    exports.setLogger = dialbegin.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
