'use strict';
/**
 * The architect component that exposes _alarm_ module.
 *
 * @class arch_alarm
 * @module alarm
 */
const alarm = require('./alarm');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_alarm]
 */
const IDLOG = '[arch_alarm]';

module.exports = (options, imports, register) => {
  register(null, {
    alarm: alarm
  });
  let logger = console;
  try {
    if (imports.logger) {
      logger = imports.logger;
    }
    alarm.setLogger(logger.ctilog);
    alarm.setCompComIpc(imports.comIpc);
    alarm.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}
