'use strict';
/**
 * Provides the alarm functions.
 *
 * @module alarm
 * @main arch_alarm
 */
/**
 * Provides the alarm functionalities.
 *
 * @class alarm
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
 * @default [alarm]
 */
const IDLOG = '[alarm]';

/**
 * The logger. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
let logger = console;

/**
 * The data structure to store alarms.
 *
 * @property alarms
 * @type object
 * @private
 * @default {}
 */
const alarms = {};

/**
 * The communication ipc component.
 *
 * @property compComIpc
 * @type object
 * @private
 */
let compComIpc;

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' &&
      typeof log.log.info === 'function' &&
      typeof log.log.warn === 'function' &&
      typeof log.log.error === 'function') {

      logger = log;
    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the communication websocket component to be used.
 *
 * @method setCompComNethctiWs
 * @param {object} comp The module to be set
 */
function setCompComIpc(comp) {
  compComIpc = comp;
}

/**
 * Sets the event listeners for the communication ipc component.
 *
 * @method setComIpcListeners
 * @private
 */
function setComIpcListeners() {
  try {
    compComIpc.on(compComIpc.EVT_ALARM, evtAlarm);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Start the component.
 *
 * @method start
 * @private
 */
function start() {
  try {
    logger.log.info(IDLOG, 'set listeners for com ipc component');
    setComIpcListeners();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Received an alarm. Store it into the memory data structure.
 *
 * @method evtAlarm
 * @private
 */
function evtAlarm(data) {
  try {
    if (data.status && data.alarm && data.queue) {
      logger.log.info(IDLOG, 'received valid alarm: ' + JSON.stringify(data));
      if (!alarms[data.queue]) {
        alarms[data.queue] = {}
      }
      alarms[data.queue][data.alarm] = { status: data.status, date: data.date };
    } else {
      logger.log.warn(IDLOG, 'received invalid alarm: ' + JSON.stringify(data));
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get all the queues alarms.
 *
 * @method getQueuesAlarms
 * @private
 */
function getQueuesAlarms(data) {
  try {
    return alarms;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

exports.start = start;
exports.setLogger = setLogger;
exports.setCompComIpc = setCompComIpc;
exports.getQueuesAlarms = getQueuesAlarms;