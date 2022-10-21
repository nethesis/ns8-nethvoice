/**
 * Provides the videoconf functions.
 *
 * @module videoconf
 * @main videoconf
 */
/**
 * Provides the videoconf functionalities.
 *
 * @class videoconf
 * @static
 */
const fs = require('fs');
const https = require('https');
const EventEmitter = require('events').EventEmitter;

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [videoconf]
 */
var IDLOG = '[videoconf]';

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
 let emitter = new EventEmitter();

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
let EVT_RELOADED = 'reloaded';

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
 * The base URL of the video conf platform.
 *
 * @property baseURL
 * @type string
 * @private
 */
let baseURL;

/**
 * The file path of the configuration file.
 *
 * @property CONFIG_FILEPATH
 * @type string
 * @private
 */
let CONFIG_FILEPATH;

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
 * Configure the component.
 *
 * @method config
 * @param {string} path The path of the configuration file
 */
function config(path) {
  try {
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }
    CONFIG_FILEPATH = path;
    const json = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (json && json.jitsi && json.jitsi.url) {
      baseURL = json.jitsi.url;
    } else {
      logger.log.warn(IDLOG, 'wrong config file ' + path);
    }
    logger.log.info(IDLOG, 'configuration done by ' + path);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the base URL of the video conf platform.
 *
 * @method getBaseUrl
 * @return {string} The base URL of the video conf platform
 */
function getBaseUrl() {
  return baseURL;
}

/**
 * Returns an URL to be used for a new room.
 *
 * @method getNewRoomUrl
 * @param {string} username The username to be addede to the URL
 * @param {string} name The fullname of the user
 * @return {string} The url for the new room.
 */
function getNewRoomUrl(username, name) {
  try {
    if (typeof baseURL !== 'string' || baseURL === '' || typeof username !== 'string' || typeof name !== 'string') {
      return null;
    }
    const id = username + '-' + new Date().getTime();
    const url = (new URL(baseURL)).href + id + '#config.callDisplayName=' + escape(`"${name}"`);
    logger.log.info(IDLOG, `created new URL for vc room ${url}`);
    return {
      id: id,
      url: url,
      provider: 'jitsi'
    };
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reset the component.
 *
 * @method reset
 * @static
 */
 function reset() {
  try {
    baseURL = undefined;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reload
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
exports.config = config;
exports.reload = reload;
exports.setLogger = setLogger;
exports.getBaseUrl = getBaseUrl;
exports.EVT_RELOADED = EVT_RELOADED;
exports.getNewRoomUrl = getNewRoomUrl;