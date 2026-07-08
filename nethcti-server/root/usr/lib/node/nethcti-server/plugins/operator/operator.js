/**
 * Provides the operator functions.
 *
 * @module operator
 * @main operator
 */

/**
 * Provides the operator functions.
 *
 * @class operator
 * @static
 */
var fs = require('fs');
var Group = require('./group').Group;
var EventEmitter = require('events').EventEmitter;

/**
 * Fired when the componente has been reloaded.
 *
 * @event reloaded
 */
/**
 * The name of the reloaded event.
 *
 * @property EVT_RELOADED
 * @type string
 * @default "reloaded"
 */
var EVT_RELOADED = 'reloaded';

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [operator]
 */
var IDLOG = '[operator]';

/**
 * The configuration file path.
 *
 * @property CONFIG_FILEPATH
 * @type string
 * @private
 */
var CONFIG_FILEPATH;

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
 * The list of the groups of the operator panel. The keys are
 * the names of the groups and the values are the _Group_ objects.
 *
 * @property groups
 * @type object
 * @private
 * @default {}
 */
var groups = {};

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object') {

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
 * Configures the groups of the operator panel.
 *
 * **The method can throw an Exception.**
 *
 * @method config
 * @param {string} path The file path of the configuration file. It must use the JSON syntax.
 */
function config(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter');
    }

    // check file presence
    if (!fs.existsSync(path)) {
      logger.log.warn(IDLOG, path + ' does not exist');
      return;
    }
    CONFIG_FILEPATH = path;

    // read groups part from the JSON file
    var json = (JSON.parse(fs.readFileSync(CONFIG_FILEPATH, 'utf8'))).groups;

    // create the Group objects
    var g, newgroup;
    for (g in json) {
      newgroup = new Group(g);

      // json[g] is an array as readed from the JSON file
      newgroup.addUsers(json[g].toString().toLowerCase().split(','));
      groups[g] = newgroup;
    }
    logger.log.info(IDLOG, 'ended configuration by JSON file ' + CONFIG_FILEPATH);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the JSON representation of operator panel groups.
 *
 * @method getJSONGroups
 * @return {object} The JSON representation of operator panel groups.
 */
function getJSONGroups() {
  try {
    var obj = {};

    // construct the object to return
    var g;
    for (g in groups) {
      obj[g] = {
        users: groups[g].getUserList()
      };
    }

    return obj;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reset
 * @private
 */
function reset() {
  try {
    var k;
    for (k in groups) {
      delete groups[k];
    }
    groups = {};
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reload
 * @private
 */
function reload() {
  try {
    reset();
    config(CONFIG_FILEPATH);
    logger.log.info(IDLOG, 'emit event "' + EVT_RELOADED + '"');
    emitter.emit(EVT_RELOADED);
    logger.log.warn(IDLOG, 'reloaded');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Subscribe a callback function to a custom event fired by this object.
 * It's the same of nodejs _events.EventEmitter.on_ method.
 *
 * @method on
 * @param {string} type The name of the event
 * @param {function} cb The callback to execute in response to the event
 * @return {object} A subscription handle capable of detaching that subscription.
 */
function on(type, cb) {
  try {
    return emitter.on(type, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

exports.on = on;
exports.EVT_RELOADED = EVT_RELOADED;
exports.config = config;
exports.reload = reload;
exports.setLogger = setLogger;
exports.getJSONGroups = getJSONGroups;
