/**
 * Provides the cel (Channel Event Logging) functions.
 *
 * @module cel
 * @main arch_cel
 */

/**
 * Provides the cel (Channel Event Logging) functions.
 *
 * @class cel
 * @static
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [cel]
 */
var IDLOG = '[cel]';

/**
 * The logger. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
var logger = console;

/**
 * The architect component to be used for database.
 *
 * @property compDbconn
 * @type object
 * @private
 */
var compDbconn;

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least
 * three methods: _info, warn and error_ as console object.
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' && typeof log.log.info === 'function' && typeof log.log.warn === 'function' && typeof log.log.error === 'function') {

      logger = log;
      logger.log.info(IDLOG, 'new logger has been set');

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the database architect component.
 *
 * @method setCompDbconn
 * @param {object} comp The database architect component.
 */
function setCompDbconn(comp) {
  try {
    compDbconn = comp;
    logger.log.info(IDLOG, 'set database architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

// public interface
exports.setLogger = setLogger;
exports.setCompDbconn = setCompDbconn;
