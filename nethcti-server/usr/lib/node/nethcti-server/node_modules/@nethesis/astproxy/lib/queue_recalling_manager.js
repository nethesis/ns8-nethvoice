/**
 * Provides the support to check if a user is still recalling a number
 * that is an entry into the queue recall table of the call center phone bar service.
 *
 * @class queue_recalling_manager
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
 * @default [queue_recalling_manager]
 */
var IDLOG = '[queue_recalling_manager]';

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
 * The asterisk component.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * Sets the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least
 * three methods: _info, warn and error_ as console object.
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' &&
      typeof log.info === 'function' &&
      typeof log.warn === 'function' &&
      typeof log.error === 'function') {

      logger = log;
      logger.info(IDLOG, 'new logger has been set');

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Sets the asterisk proxy component.
 *
 * @method setCompAstProxy
 * @param {object} comp The asterisk proxy component.
 */
function setCompAstProxy(comp) {
  try {
    compAstProxy = comp;
    logger.info(IDLOG, 'set asterisk proxy component');
  } catch (err) {
    logger.error(IDLOG, err.stack);
  }
}

/**
 * Request the list of the asterisk channels to be analized to understand
 * if the number has already in a conversation.
 *
 * @method checkQueueRecallingStatus
 * @param {string} num The number to be checked for the call
 * @param {function} cb The callback function
 */
function checkQueueRecallingStatus(num, cb) {
  try {
    if (typeof num !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters');
    }
    logger.info(IDLOG, 'requests the channel list to be analized to get the recalling status');
    compAstProxy.doCmd({
      command: 'listChannels'
    }, function (err, results) {
      if (err) {
        cb(err);
      } else {
        analizeQueueRecallingStatus(results, num, cb);
      }
    });
  } catch (err) {
    logger.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Analize the channel list to understand if the number has already in a conversation.
 *
 * @method analizeQueueRecallingStatus
 * @param {object} results The channel list
 * @param {string} num The number to be checked for the presence in the list
 * @param {function} cb The callback function
 * @private
 */
function analizeQueueRecallingStatus(results, num, cb) {
  try {
    if (typeof results !== 'object' || typeof num !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters');
    }
    var ch;
    for (ch in results) {
      if (results[ch].callerNum === num || results[ch].bridgedNum === num) {
        cb(null, true);
        return;
      }
    }
    cb(null, false);

  } catch (err) {
    logger.error(IDLOG, err.stack);
    cb(err);
  }
}

exports.setLogger = setLogger;
exports.setCompAstProxy = setCompAstProxy;
exports.checkQueueRecallingStatus = checkQueueRecallingStatus;