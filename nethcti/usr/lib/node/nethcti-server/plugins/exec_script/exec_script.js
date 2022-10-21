/**
 * Provides the functions to execute scripts.
 *
 * @module exec_script
 * @main arch__exec_script
 */
var fs = require('fs');
var childProcess = require('child_process');

/**
 * Provides the functionalities to execute scripts.
 *
 * @class exec_script
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
 * @default [exec_script]
 */
var IDLOG = '[exec_script]';

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
 * The asterisk proxy module.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * The configuration file content.
 *
 * @property configJSON
 * @type object
 * @private
 */
var configJSON;

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
    if (typeof log === 'object' &&
      typeof log.log.info === 'function' &&
      typeof log.log.warn === 'function' &&
      typeof log.log.error === 'function') {

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
 * Set the module to be used for asterisk proxy functionalities.
 *
 * @method setAstProxy
 * @param {object} comp The asterisk proxy module.
 */
function setAstProxy(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong astProxy object');
    }
    compAstProxy = comp;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the configuration to be use to execute the scripts.
 *
 * @method config
 * @param {string} path The file path of the JSON configuration file that contains the script paths and timeouts.
 */
function config(path) {
  try {
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter');
    }

    // check the file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }

    // read the configuration file
    configJSON = JSON.parse(fs.readFileSync(path, 'utf8'));

    // check the configuration file content
    if (typeof configJSON !== 'object' ||
      (configJSON.cdr && (typeof configJSON.cdr !== 'object' || typeof configJSON.cdr.script !== 'string' || typeof configJSON.cdr.timeout !== 'number'))) {

      configJSON = undefined;
      throw new Error('wrong configuration file ' + path);
    }
    logger.log.info(IDLOG, 'successfully configured');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Start the components.
 *
 * @method start
 */
function start() {
  try {
    // check if the configuration has been done succesfully
    if (typeof configJSON !== 'object') {
      logger.log.warn(IDLOG, 'component is not configured correctly, so it will be ignored');

    } else {
      setAstProxyListeners();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the event listeners for the asterisk proxy component.
 *
 * @method setAstProxyListeners
 * @private
 */
function setAstProxyListeners() {
  try {
    if (!compAstProxy || typeof compAstProxy.on !== 'function') {
      throw new Error('wrong astProxy object');
    }

    if (typeof configJSON.cdr === 'object' &&
      typeof configJSON.cdr.script === 'string' && typeof configJSON.cdr.timeout === 'number') {

      // listen for each new call detail records (cdr) emitted by the asterisk proxy component.
      // It emits the event each time a new cdr has been logged into the call history
      compAstProxy.on(compAstProxy.EVT_NEW_CDR, evtNewCdr);
      compAstProxy.on(compAstProxy.EVT_CALLIN_BY_TRUNK, evtCallInByTrunk);
      logger.log.info(IDLOG, 'new listener has been set for "' + compAstProxy.EVT_NEW_CDR + '" event in the astProxy component');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * A new call detail records (cdr) has been logged into the call history. It executes
 * an external script and it will kill the child process if it runs longer than timeout
 * interval.
 *
 * @method evtNewCdr
 * @param {object} data
 *  @param {string} data.source             The calling party’s caller ID number
 *  @param {string} data.channel            The calling party’s channel
 *  @param {string} data.endtime            The end time of the call
 *  @param {string} data.duration           The number of seconds between the start and end times for the call
 *  @param {string} data.amaflags           The Automatic Message Accounting (AMA) flag associated with this call. This may be one of the following: OMIT, BILLING, DOCUMENTATION, or Unknown
 *  @param {string} data.uniqueid           The unique ID for the src channel
 *  @param {string} data.callerid           The full caller ID, including the name, of the calling party
 *  @param {string} data.starttime          The start time of the call
 *  @param {string} data.answertime         The answered time of the call
 *  @param {string} data.destination        The destination extension for the call
 *  @param {string} data.disposition        An indication of what happened to the call. This may be NO ANSWER, FAILED, BUSY, ANSWERED, or UNKNOWN
 *  @param {string} data.lastapplication    The last dialplan application that was executed
 *  @param {string} data.billableseconds    The number of seconds between the answer and end times for the call
 *  @param {string} data.destinationcontext The destination context for the call
 *  @param {string} data.destinationchannel The called party’s channel
 */
function evtNewCdr(data) {
  try {
    if (typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received event "' + compAstProxy.EVT_NEW_CDR + '" from astProxy component with uniqueid "' + data.uniqueid + '"');

    // transform the data as a string sequence parameters to pass to the script
    var k, temp;
    var SEP = ' ';
    var params = '';

    for (k in data) {
      if (data[k] === null || data[k] === undefined) {
        data[k] = '';
      }
      temp = data[k].replace(/'/g, "\\'");
      temp = '"' + data[k].replace(/"/g, "\\\"") + '"';
      params += temp + SEP;
    }

    // execute the script
    var cmd = (configJSON.cdr.script + SEP + params).trim();
    logger.log.info(IDLOG, 'executing script - ' + cmd + ' - with ' + configJSON.cdr.timeout +
      ' msec timeout after "' + compAstProxy.EVT_NEW_CDR + '" event with uniqueid "' + data.uniqueid + '"');

    childProcess.exec(cmd, {
      timeout: configJSON.cdr.timeout
    }, function (error, stdout, stderr) {
      try {
        if (error === null) {
          logger.log.info(IDLOG, 'script - ' + cmd + ' - succesfully executed after "' + compAstProxy.EVT_NEW_CDR +
            '" event with uniqueid "' + data.uniqueid + '"');
        } else {
          logger.log.error(IDLOG, 'executing script - ' + cmd + ' - with ' + configJSON.cdr.timeout + ' msec timeout after "' + compAstProxy.EVT_NEW_CDR +
          '" event with uniqueid "' + data.uniqueid + '": exit code "' + error.code + '" signal "' + error.signal + '"');
          logger.log.error(IDLOG, stderr);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * A new call has been arrived on a trunk. It executes an external script and
 * it will kill the child process if it runs longer than timeout interval.
 *
 * @method evtCallInByTrunk
 * @param {object} data
 *  @param {string} data.trunk The trunk id
 *  @param {string} data.callerNum The caller number
 */
function evtCallInByTrunk(data) {
  try {
    if (typeof data !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, `received event "${compAstProxy.EVT_CALLIN_BY_TRUNK}" from astProxy for trunk ${data.trunk} with caller num ${data.callerNum}`);
    let temp;
    let SEP = ' ';
    let params = '';
    for (let k in data) {
      if (data[k] === null || data[k] === undefined) {
        data[k] = '';
      }
      temp = data[k].replace(/'/g, "\\'");
      temp = '"' + data[k].replace(/"/g, "\\\"") + '"';
      params += temp + SEP;
    }
    let cmd = (configJSON.callIn.script + SEP + params).trim();
    logger.log.info(IDLOG, `executing script - ${cmd} (${configJSON.callIn.timeout} msec timeout) after "${compAstProxy.EVT_CALLIN_BY_TRUNK}" evt on trunk ${data.trunk} by caller num ${data.callerNum}`);
    childProcess.exec(cmd, {
      timeout: configJSON.callIn.timeout
    }, function (error, stdout, stderr) {
      try {
        if (error === null) {
          logger.log.info(IDLOG, `script - ${cmd} - successfully executed after "${compAstProxy.EVT_CALLIN_BY_TRUNK}" evt on trunk ${data.trunk} by caller num ${data.callerNum}`);
        } else {
          logger.log.error(IDLOG, `executing script - ${cmd} - with ${configJSON.callIn.timeout} msec timeout after "${compAstProxy.EVT_CALLIN_BY_TRUNK}" evt on trunk ${data.trunk} by caller num ${data.callerNum}: exit code "${error.code}" signal "${error.signal}"`);
          logger.log.error(IDLOG, stderr);
        }
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

// public interface
exports.start = start;
exports.config = config;
exports.setLogger = setLogger;
exports.setAstProxy = setAstProxy;