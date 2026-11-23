'use strict';
const fs = require('fs');
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
 * The configuration file containing the queues alarms settings.
 *
 * @property AST_CONF_FILEPATH
 * @type string
 * @private
 * @final
 * @readOnly
 * @default "/etc/nethcti/asterisk.json"
 */
const AST_CONF_FILEPATH = '/etc/nethcti/asterisk.json';

/**
 * The default settings used to raise the queues alarms. Thresholds are
 * in seconds, except maxCallsPerOp and maxCalls. They can be overridden
 * by the "qm_alarms" key of the configuration file.
 *
 * @property DEFAULT_CONFIG
 * @type object
 * @private
 * @final
 * @readOnly
 */
const DEFAULT_CONFIG = {
  maxCallsPerOp: 2,
  maxCalls: 10,
  maxHoldtime: 120,
  callersMaxWait: 250,
  checkInterval: 30
};

/**
 * The settings used to raise the queues alarms.
 *
 * @property config
 * @type object
 * @private
 */
let config = Object.assign({}, DEFAULT_CONFIG);

/**
 * The asterisk proxy component.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
let compAstProxy;

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
 * Sets the asterisk proxy component to be used.
 *
 * @method setCompAstProxy
 * @param {object} comp The module to be set
 */
function setCompAstProxy(comp) {
  compAstProxy = comp;
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
    readConfig();
    setInterval(checkQueues, config.checkInterval * 1000);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reads the queues alarms settings from the configuration file. Missing
 * or invalid values fall back to the defaults.
 *
 * @method readConfig
 * @private
 */
function readConfig() {
  try {
    const json = JSON.parse(fs.readFileSync(AST_CONF_FILEPATH, 'utf8'));
    const custom = json.qm_alarms || {};
    const keys = {
      maxCallsPerOp: 'max_calls_per_op',
      maxCalls: 'max_calls',
      maxHoldtime: 'max_holdtime',
      callersMaxWait: 'callers_max_wait',
      checkInterval: 'check_interval'
    };
    for (const k in keys) {
      const value = parseFloat(custom[keys[k]]);
      if (!isNaN(value) && value >= 0) {
        config[k] = value;
      }
    }
    if (config.checkInterval <= 0) {
      config.checkInterval = DEFAULT_CONFIG.checkInterval;
    }
  } catch (err) {
    logger.log.warn(IDLOG, 'using default alarms settings: ' + err.message);
  }
  logger.log.info(IDLOG, 'alarms settings: ' + JSON.stringify(config));
}

/**
 * Checks the status of all the queues and updates their alarms.
 *
 * @method checkQueues
 * @private
 */
function checkQueues() {
  try {
    if (compAstProxy.getQMAlarmsNotificationsStatus() !== true) {
      return;
    }
    const queues = compAstProxy.getJSONQueues() || {};
    // drop the alarms of removed queues
    for (const q in alarms) {
      if (!queues[q]) {
        delete alarms[q];
      }
    }
    for (const q in queues) {
      const members = Object.values(queues[q].members || {});
      const callers = Object.values(queues[q].waitingCallers || {});
      const calls = callers.length;
      const onlineMembers = members.filter(m => m.loggedIn === true && m.paused !== true).length;
      const holdtime = parseInt(queues[q].avgHoldTime, 10) || 0;
      const callersMaxWait = callers.reduce((max, c) => Math.max(max, c.waiting || 0), 0);
      const status = {
        queueload: calls > config.maxCalls && holdtime > config.maxHoldtime,
        queuemaxwait: calls > config.maxCalls && callersMaxWait > config.callersMaxWait,
        queuefewop: calls > onlineMembers * config.maxCallsPerOp,
        queueholdtime: holdtime > config.maxHoldtime
      };
      for (const alarm in status) {
        const active = Boolean(alarms[q] && alarms[q][alarm]);
        if (status[alarm] !== active) {
          const data = {
            date: new Date().toISOString(),
            status: status[alarm] ? 'warning' : 'okay',
            alarm: alarm,
            queue: q
          };
          setAlarm(data);
          process.emit(compComIpc.EVT_ALARM, data);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Stores an active alarm or removes it when it is back to normal.
 *
 * @method setAlarm
 * @param {object} data The alarm data
 * @private
 */
function setAlarm(data) {
  if (data.status === 'okay') {
    if (alarms[data.queue]) {
      delete alarms[data.queue][data.alarm];
      if (Object.keys(alarms[data.queue]).length === 0) {
        delete alarms[data.queue];
      }
    }
    return;
  }
  if (!alarms[data.queue]) {
    alarms[data.queue] = {};
  }
  alarms[data.queue][data.alarm] = { status: data.status, date: data.date };
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
      setAlarm(data);
      process.emit(compComIpc.EVT_ALARM, data);
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
exports.setCompAstProxy = setCompAstProxy;
exports.getQueuesAlarms = getQueuesAlarms;