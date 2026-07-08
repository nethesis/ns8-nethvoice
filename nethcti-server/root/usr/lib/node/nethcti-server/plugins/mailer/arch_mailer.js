/**
 * The architect component that exposes _mailer_ module.
 *
 * @class arch_mailer
 * @module mailer
 */
const mailer = require('./mailer');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_mailer]
 */
const IDLOG = '[arch_mailer]';
module.exports = (options, imports, register) => {
  register(null, {
    mailer: mailer
  });
  try {
    let logger = console;
    if (imports.logger) {
      logger = imports.logger;
    }
    mailer.setLogger(logger.ctilog);
    mailer.config('/etc/nethcti/mailer.json');
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}
