/**
 * The architect component that exposes _execScript_ module.
 *
 * @class arch_exec_script
 * @module exec_script
 */
var execScript = require('./exec_script');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_exec_script]
 */
var IDLOG = '[arch_exec_script]';

module.exports = function (options, imports, register) {
  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }
  register(null, {
    execScript: {}
  });
  try {
    execScript.setLogger(logger.ctilog);
    execScript.setAstProxy(imports.astProxy);
    execScript.config('/etc/nethcti/exec_script.json');
    execScript.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}