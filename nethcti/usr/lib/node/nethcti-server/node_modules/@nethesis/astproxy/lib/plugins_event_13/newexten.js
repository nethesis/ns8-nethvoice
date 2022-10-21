/**
 * @module astproxy
 * @submodule plugins_event_13
 */
var CFVM_PREFIX_CODE = require('../proxy_logic_13/util_call_forward_13').CFVM_PREFIX_CODE;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [newExten]
 */
var IDLOG = '[newExten]';

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
     * The plugin that handles the Newexten event.
     *
     * @class newExten
     * @static
     */
    var newExten = {
      /**
       * It's called from _astproxy_ component for each
       * Newexten event received from the asterisk.
       *
       * @method data
       * @param {object} data The asterisk event data
       * @static
       */
      data: function(data) {
        try {
          var ext;
          // DND on (e.g. data.appdata = 'DB(DND/202)=YES')
          if (data.event === 'Newexten' && data.appdata &&
            data.appdata.indexOf('DB(DND/') === 0 &&
            data.appdata.split('=')[1] === 'YES') {

            ext = (data.appdata.split('/')[1]).split(')')[0];
            logger.info(IDLOG, 'received event DND "on" for extension ' + ext);
            astProxy.proxyLogic.evtExtenDndChanged(ext, true);
          }
          // DND off (e.g. data.appdata = 'Deleting: DND/202 YES')
          else if (data.event === 'Newexten' && data.appdata &&
            data.appdata.indexOf('Deleting: DND/') === 0) {

            ext = (data.appdata.split('/')[1]).split(' ')[0];
            logger.info(IDLOG, 'received event DND "off" for extension ' + ext);
            astProxy.proxyLogic.evtExtenDndChanged(ext, false);
          }
          // CF/CFVM on (e.g. data.appdata = 'DB(CF/202)=200')
          else if (data.event === 'Newexten' && data.appdata &&
            data.appdata.indexOf('DB(CF/') === 0) {

            ext = (data.appdata.split('/')[1]).split(')')[0];
            var to = data.appdata.split('=')[1];

            // check if the destination of the call forward is a voicemail.
            // The call forward and the call forward to voicemail use the
            // same key database: CF, but the second adds a prefix to it
            var vm;
            var pre;
            var isCf2Vm = false;
            for (pre in CFVM_PREFIX_CODE) { // cycle in each cf to voicemail prefix code

              // check if the call forward value start with the prefix code.
              // If it is, the call forward is to voicemail
              if (to.substring(0, pre.length) === pre) {

                // get the voicemail number subtracting the prefix code
                vm = to.substring(pre.length, to.length);
                isCf2Vm = true;
                break;
              }
            }
            // CFVM on
            if (isCf2Vm) {
              logger.info(IDLOG, 'received event CFVM "on" for extension ' + ext + ' to vm ' + vm);
              astProxy.proxyLogic.evtExtenUnconditionalCfVmChanged(ext, true, vm);
            }
            // CF on
            else {
              logger.info(IDLOG, 'received event CF "on" for extension ' + ext + ' to ' + to);
              astProxy.proxyLogic.evtExtenUnconditionalCfChanged(ext, true, to);
            }
          }
          // CF/CFVM on (e.g. data.appdata = 'Deleting: CF/202 200')
          else if (data.event === 'Newexten' && data.appdata &&
            data.appdata.indexOf('Deleting: CF/') === 0) {

            ext = (data.appdata.split('/')[1]).split(' ')[0];
            logger.info(IDLOG, 'received event CF/CFVM "off" for extension ' + ext);
            astProxy.proxyLogic.evtExtenUnconditionalCfChanged(ext, false);
            astProxy.proxyLogic.evtExtenUnconditionalCfVmChanged(ext, false);
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
    exports.data = newExten.data;
    exports.visit = newExten.visit;
    exports.setLogger = newExten.setLogger;

  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
})();
