/**
 * Provides the REST server for the streaming functions.
 *
 * @module com_streaming_rest
 * @main arch_com_streaming_rest
 */

/**
 * Provides the REST server.
 *
 * @class server_com_streaming_rest
 */
var fs = require('fs');
var restify = require('restify');
var plugins = require('jsplugs')().require('./plugins/com_streaming_rest/plugins_rest');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [server_com_streaming_rest]
 */
var IDLOG = '[server_com_streaming_rest]';

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
 * @default "9011"
 */
var port = '9011';

/**
 * Listening address of the REST server. It can be customized by the
 * configuration file.
 *
 * @property address
 * @type string
 * @private
 * @default "localhost"
 */
var address = 'localhost';

/**
 * The architect component to be used for authorization.
 *
 * @property compAuthorization
 * @type object
 * @private
 */
var compAuthorization;

/**
 * The utility architect component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

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
 * Sets the utility architect component to be used by REST plugins.
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

    compUtil = comp;

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
 * Sets the config manager architect component to be used by REST plugins.
 *
 * @method setCompConfigManager
 * @param {object} comp The architect config manager component
 * @static
 */
function setCompConfigManager(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set user architect component to all REST plugins
    for (p in plugins) {
      if (typeof plugins[p].setCompConfigManager === 'function') {
        plugins[p].setCompConfigManager(comp);
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

    // check authorization
    var username = req.headers.authorization_user;
    if (username === 'admin' ||
      compAuthorization.authorizeStreamingUser(username) === true) {

      logger.log.info(IDLOG, 'streaming authorization successfully for user "' + username + '"');
      logger.log.info(IDLOG, 'execute: ' + p + '.' + name);
      plugins[p][name].apply(plugins[p], [req, res, next]);

    } else { // authorization failed
      logger.log.warn(IDLOG, 'streaming authorization failed for user "' + username + '"!');
      compUtil.net.sendHttp403(IDLOG, res);
    }
    return next();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the post-it architect component to be used by REST plugins.
 *
 * @method setCompStreaming
 * @param {object} compStreaming The architect post-it component
 * @static
 */
function setCompStreaming(compStreaming) {
  try {
    // check parameter
    if (typeof compStreaming !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set post-it architect component to all REST plugins
    for (p in plugins) {
      plugins[p].setCompStreaming(compStreaming);
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authorization architect component.
 *
 * @method setCompAuthorization
 * @param {object} ca The architect authorization component
 * @static
 */
function setCompAuthorization(ca) {
  try {
    // check parameter
    if (typeof ca !== 'object') {
      throw new Error('wrong parameter');
    }

    compAuthorization = ca;
    logger.log.info(IDLOG, 'authorization component has been set');

    // set the authorization for all REST plugins
    setAllRestPluginsAuthorization(ca);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Called by _setCompAuthorization_ function for all REST plugins.
 *
 * @method setAllRestPluginsAuthorization
 * @private
 * @param ca The architect authorization component
 * @type {object}
 */
function setAllRestPluginsAuthorization(ca) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompAuthorization === 'function') {
        plugins[key].setCompAuthorization(ca);
        logger.log.info(IDLOG, 'authorization component has been set for rest plugin ' + key);
      }
    }
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
    throw new Error(path + ' doesn\'t exist');
  }

  // read configuration file
  var json = (JSON.parse(fs.readFileSync(path, 'utf8'))).rest;

  // initialize the port of the REST server
  if (json.streaming && json.streaming.port) {
    port = json.streaming.port;

  } else {
    logger.log.warn(IDLOG, 'no port has been specified in JSON file ' + path);
  }

  // initialize the address of the REST server
  if (json.streaming && json.streaming.address) {
    address = json.streaming.address;

  } else {
    logger.log.warn(IDLOG, 'no address has been specified in JSON file ' + path);
  }
  logger.log.info(IDLOG, 'configuration by file ' + path + ' ended');
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
    server.use(restify.CORS({
      origins: ['*'],
      credentials: true,
      headers: ['WWW-Authenticate']
    }));

    // load plugins
    for (p in plugins) {
      get = plugins[p].api.get;
      root = plugins[p].api.root;
      post = plugins[p].api.post;

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
    server.listen(port, address, function() {
      logger.log.info(IDLOG, server.name + ' listening at ' + server.url);
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

// public interface
exports.start = start;
exports.config = config;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
exports.setCompStreaming = setCompStreaming;
exports.setCompAuthorization = setCompAuthorization;
exports.setCompConfigManager = setCompConfigManager;
