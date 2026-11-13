/**
 * The architect component that exposes _profiling_ module.
 *
 * @class arch_profiling
 * @module profiling
 */
var profiling = require('./profiling');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_profiling]
 */
var IDLOG = '[arch_profiling]';

module.exports = function (options, imports, register) {

  // public interface for other architect components
  register(null, {
    profiling: profiling
  });

  try {
    var logger = console;
    if (imports.logger) {
      logger = imports.logger;
    }

    profiling.config();
    profiling.setLogger(logger.ctilog);
    profiling.setCompComNethctiWs(imports.com_nethcti_ws);
    profiling.setCompComNethctiTcp(imports.com_nethcti_tcp);
    profiling.start();

  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}
