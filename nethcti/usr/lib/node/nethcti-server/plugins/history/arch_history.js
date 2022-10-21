/**
 * The architect component that exposes _history_ module.
 *
 * @class arch_history
 * @module history
 */
var history = require('./history');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_history]
 */
var IDLOG = '[arch_history]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    history: history
  });

  try {
    imports.dbconn.on(imports.dbconn.EVT_READY, function() {
      history.setLogger(logger.ctilog);
      history.setDbconn(imports.dbconn);
      history.setCompAstProxy(imports.astProxy);
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
