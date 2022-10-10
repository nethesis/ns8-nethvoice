/**
 * Manage the asterisk events.
 *
 * @module ast_proxy
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
 * @default [reload]
 */
var IDLOG = '[reload]';

/**
 * The module reload status.
 *
 * @property STATUS
 * @type {object}
 * @private
 */
var STATUS = {
  0: 'success',
  1: 'request queued',
  2: 'module not found',
  3: 'error',
  4: 'reload already in progress',
  5: 'module uninitialized',
  6: 'reload not supported'
};

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
     * The plugin that handles the reload event.
     *
     * @class reload
     * @static
     */
    var reload = {
      /**
       * It is called from _astproxy_ component for each reload event
       * received from the asterisk.
       *
       * @method data
       * @param {object} data The asterisk event data
       * @static
       */
      data: function(data) {
        try {
          if (data && data.event === 'Reload') {
            logger.info(IDLOG, 'received event ' + data.event);
            astProxy.proxyLogic.evtAstModuleReloaded({
              module: data.module,
              status: STATUS[data.status]
            });
          } else {
            logger.warn(IDLOG, 'asterisk module reload event not recognized');
          }
        } catch (err) {
          logger.error(IDLOG, err.stack);
        }
      },

      /**
       * Set the logger to be used.
       *
       * @method setLogger
       * @param {object} log The logger object
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
    exports.data = reload.data;
    exports.visit = reload.visit;
    exports.setLogger = reload.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
