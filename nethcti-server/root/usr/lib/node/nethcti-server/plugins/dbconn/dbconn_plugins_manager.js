/**
 * It load all plugins present in "plugins" directory.
 * It exports all methods exported in the "apiList" object.
 *
 * @module dbconn
 * @main dbconn
 */

/**
 * Exports all plugins methods.
 *
 * @class dbconn_plugins_manager
 */
var fs = require('fs');
var plugins = require('jsplugs')().require('./plugins/dbconn/plugins');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [dbconn_plugins_manager]
 */
var IDLOG = '[dbconn_plugins_manager]';

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
 * The architect component to be used for user functions.
 *
 * @property compDbconnMain
 * @type object
 * @private
 */
var compDbconnMain;

/**
 * It contains all plugins methods exported by "apiList" object.
 *
 * @property apiDbconn
 * @type object
 */
var apiDbconn = {};

/**
 * Set the component to be used by REST plugins.
 *
 * @method setCompDbconnMain
 * @param {object} comp The architect component
 * @static
 */
function setCompDbconnMain(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }
    compDbconnMain = comp;

    // set the component for all plugins
    setAllPluginsDbconnMain(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the util component to be used by REST plugins.
 *
 * @method setCompUtil
 * @param {object} comp The util component
 * @static
 */
function setCompUtil(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }
    setAllPluginsUtil(comp);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Call _setCompUtil_ function for all REST plugins.
 *
 * @method setAllPluginsUtil
 * @private
 * @param comp The util object.
 * @type {object}
 */
function setAllPluginsUtil(comp) {
  try {
    var key;
    for (key in plugins) {
      if (typeof plugins[key].setCompUtil === 'function') {
        plugins[key].setCompUtil(comp);
        logger.log.info(IDLOG, 'util component has been set for plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Call _setCompDbconnMain_ function for all REST plugins.
 *
 * @method setAllPluginsDbconnMain
 * @private
 * @param comp The component.
 * @type {object}
 */
function setAllPluginsDbconnMain(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompDbconnMain === 'function') {
        plugins[key].setCompDbconnMain(comp);
        logger.log.info(IDLOG, 'new main dbconn has been set for plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

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

      // set the logger for all plugins
      setAllPluginsLogger(log);

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Call _setLogger_ function for all REST plugins.
 *
 * @method setAllRestPluginsLogger
 * @private
 * @param log The logger object.
 * @type {object}
 */
function setAllPluginsLogger(log) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setLogger === 'function') {
        plugins[key].setLogger(log);
        logger.log.info(IDLOG, 'new logger has been set for plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Loads all plugins exported methods in "apiDbconn" object
 * and emits the _EVT\_READY_ at the end.
 *
 * @method start
 * @static
 */
function start() {
  try {
    // load plugins
    var apiName, p;
    for (p in plugins) {
      for (apiName in plugins[p].apiList) {
        apiDbconn[apiName] = plugins[p].apiList[apiName];
      }
    }
    compDbconnMain.emit(compDbconnMain.EVT_READY);
    compDbconnMain.setReady(true);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

// public interface
exports.start = start;
exports.apiDbconn = apiDbconn;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
exports.setCompDbconnMain = setCompDbconnMain;
