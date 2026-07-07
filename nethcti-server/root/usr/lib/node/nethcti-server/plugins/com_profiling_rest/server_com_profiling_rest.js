/**
 * Provides the REST server for the configuration manager functions.
 *
 * @module com_profiling_rest
 * @main arch_com_profiling_rest
 */

/**
 * Provides the REST server.
 *
 * @class server_com_profiling_rest
 */
var fs = require('fs');
var restify = require('restify');
var plugins = require('jsplugs')().require('./plugins/com_profiling_rest/plugins_rest');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [server_com_profiling_rest]
 */
var IDLOG = '[server_com_profiling_rest]';

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
 * Listening port of the REST server. It can be customized by the
 * configuration file.
 *
 * @property port
 * @type string
 * @private
 */
var port;

/**
 * Listening address of the REST server. It can be customized by the
 * configuration file.
 *
 * @property address
 * @type string
 * @private
 */
var address;

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

      // set the logger for all REST plugins
      setAllRestPluginsLogger(log);

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
function setAllRestPluginsLogger(log) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setLogger === 'function') {
        plugins[key].setLogger(log);
        logger.log.info(IDLOG, 'new logger has been set for rest plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the utility architect component to be used by REST plugins.
 *
 * @method setCompUtil
 * @param {object} comp The architect utility component
 * @static
 */
function setCompUtil(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set utility architect component to all REST plugins
    for (p in plugins) {
      if (typeof plugins[p].setCompUtil === 'function') {
        plugins[p].setCompUtil(comp);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the profiling architect component for all REST plugins.
 *
 * @method setCompProfiling
 * @param {object} comp The profiling component
 * @static
 */
function setCompProfiling(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the authorization for all REST plugins
    setAllRestPluginsProfiling(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Called by _setCompProfiling_ function for all REST plugins.
 *
 * @method setAllRestPluginsProfiling
 * @private
 * @param comp The profiling component
 * @type {object}
 */
function setAllRestPluginsProfiling(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompProfiling === 'function') {
        plugins[key].setCompProfiling(comp);
        logger.log.info(IDLOG, 'profiling component has been set for rest plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the database architect component for all REST plugins.
 *
 * @method setCompDbConn
 * @param {object} comp The database component
 * @static
 */
function setCompDbConn(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the authorization for all REST plugins
    setAllRestPluginsDbConn(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Called by _setCompDbConn_ function for all REST plugins.
 *
 * @method setAllRestPluginsDbConn
 * @private
 * @param {object} comp The database component
 */
function setAllRestPluginsDbConn(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompDbConn === 'function') {
        plugins[key].setCompDbConn(comp);
        logger.log.info(IDLOG, 'database component has been set for rest plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the configuration architect component for all REST plugins.
 *
 * @method setCompConfigManager
 * @param {object} comp The configuration component
 * @static
 */
function setCompConfigManager(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the authorization for all REST plugins
    setAllRestPluginsConfigManager(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Called by _setCompConfigManager_ function for all REST plugins.
 *
 * @method setAllRestPluginsConfigManager
 * @private
 * @param comp The configuration component
 * @type {object}
 */
function setAllRestPluginsConfigManager(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompConfigManager === 'function') {
        plugins[key].setCompConfigManager(comp);
        logger.log.info(IDLOG, 'configuration component has been set for rest plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Executed by all REST request. It calls the appropriate REST plugin function.
 *
 * @method execute
 * @private
 */
function execute(req, res, next) {
  try {
    var tmp = req.url.split('/');
    var p = tmp[1];
    var name = tmp[2];

    logger.log.info(IDLOG, 'execute: ' + p + '.' + name);
    plugins[p][name].apply(plugins[p], [req, res, next]);

    return next();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Start the REST server.
 *
 * @method start
 * @static
 */
function start() {
  try {
    var p, root, get, post, k;

    /**
     * The REST server.
     *
     * @property server
     * @type {object}
     * @private
     */
    var server = restify.createServer();

    // set the middlewares to use
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.queryParser());
    server.use(restify.bodyParser());

    // accept CORS requests profiling
    server.use(restify.CORS({
      origins: ['*'],
      credentials: true,
      headers: ['Authorization']
    }));

    // load plugins
    for (p in plugins) {
      get = plugins[p].api.get;
      root = plugins[p].api.root;
      post = plugins[p].api.post;

      var k;
      // add routing functions
      for (k in get) {
        logger.log.info(IDLOG, 'Binding GET: /' + root + '/' + get[k]);
        server.get('/' + root + '/' + get[k], execute);
      }
      for (k in post) {
        logger.log.info(IDLOG, 'Binding POST: /' + root + '/' + post[k]);
        server.post('/' + root + '/' + post[k], execute);
      }
    }

    // start the REST server
    server.listen(port, address, function () {
      logger.log.info(IDLOG, server.name + ' listening at ' + server.url);
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Configurates the REST server properties by a configuration file.
 * The file must use the JSON syntax.
 *
 * **The method can throw an Exception.**
 *
 * @method config
 * @param {string} path The path of the configuration file
 */
function config(path) {
  // check parameter
  if (typeof path !== 'string') {
    throw new TypeError('wrong parameter');
  }
  // check file presence
  if (!fs.existsSync(path)) {
    throw new Error(path + ' does not exist');
  }
  // read configuration file
  var json = (JSON.parse(fs.readFileSync(path, 'utf8'))).rest;

  // initialize the port of the REST server
  if (json.profiling && json.profiling.port) {
    port = json.profiling.port;
  } else {
    logger.log.warn(IDLOG, 'no port has been specified in JSON file ' + path);
  }
  // initialize the address of the REST server
  if (json.profiling && json.profiling.address) {
    address = json.profiling.address;
  } else {
    logger.log.warn(IDLOG, 'no address has been specified in JSON file ' + path);
  }
  logger.log.info(IDLOG, 'configuration by file ' + path + ' ended');
}

// public interface
exports.start = start;
exports.config = config;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
exports.setCompDbConn = setCompDbConn;
exports.setCompProfiling = setCompProfiling;
exports.setCompConfigManager = setCompConfigManager;
