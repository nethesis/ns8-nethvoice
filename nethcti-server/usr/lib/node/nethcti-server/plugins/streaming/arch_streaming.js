/**
 * The architect component that exposes _streaming_ module.
 *
 * @class arch_streaming
 * @module streaming
 */
var streaming = require('./streaming');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_streaming]
 */
var IDLOG = '[arch_streaming]';

module.exports = function(options, imports, register) {
  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    streaming: streaming
  });

  try {
    streaming.setLogger(logger.ctilog);
    streaming.config('/etc/nethcti/streaming.json');
    streaming.setCompAstProxy(imports.astProxy);
    streaming.setCompAuthorization(imports.authorization);
    streaming.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
