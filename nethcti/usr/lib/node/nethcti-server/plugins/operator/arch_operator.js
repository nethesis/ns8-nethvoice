/**
 * The architect component that exposes _operator_ module.
 *
 * @class arch_operator
 * @module operator
 */
var operator = require('./operator');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_operator]
 */
var IDLOG = '[arch_operator]';

module.exports = function(options, imports, register) {
  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    operator: operator
  });

  try {
    operator.setLogger(logger.ctilog);
    operator.config('/etc/nethcti/operator.json');
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
