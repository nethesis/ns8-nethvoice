/**
 * Provides the HTTPS REST server for authentication functions using
 * _authentication_ component.
 *
 * @module com_authentication_rest
 * @main com_authentication_rest
 */

/**
 * Provides the HTTPS REST server.
 *
 * @class server_com_authentication_rest
 */
var fs = require('fs');
var restify = require('restify');
var plugins = require('jsplugs')().require('./plugins/com_authentication_rest/plugins_rest');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [server_com_authentication_rest]
 */
var IDLOG = '[server_com_authentication_rest]';

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
 * Listening port of the REST server.
 *
 * @property port
 * @type string
 * @private
 */
var port;

/**
 * Listening protocol of the REST server.
 *
 * @property proto
 * @type string
 * @private
 */
var proto;

/**
 * Listening address of the REST server.
 *
 * @property address
 * @type string
 * @private
 */
var address;

/**
 * The server.
 *
 * @property server
 * @type object
 * @private
 */
var server;

/**
 * True if the server is reloading.
 *
 * @property reloading
 * @type boolean
 * @private
 * @default false
 */
var reloading = false;

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
 * Set the asterisk proxy architect component to be used by REST plugins.
 *
 * @method setCompAstProxy
 * @param {object} comp The architect asterisk proxy component
 * @static
 */
function setCompAstProxy(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the asterisk proxy for all the REST plugins
    setAllRestPluginsAstProxy(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the asterisk proxy component for all the REST plugins.
 *
 * @method setAllRestPluginsAstProxy
 * @param {object} comp The asterisk proxy object
 * @private
 */
function setAllRestPluginsAstProxy(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompAstProxy === 'function') {
        plugins[key].setCompAstProxy(comp);
        logger.log.info(IDLOG, 'asterisk proxy component has been set for rest plugin ' + key);
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
 * Start the HTTPS REST server.
 *
 * @method start
 * @static
 */
function start() {
  try {
    var p, root, get, post, k;

    /**
     * The HTTPS REST server.
     *
     * @property server
     * @type {object}
     * @private
     */
    var options = {};
    server = restify.createServer(options);

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
      logger.log.warn(IDLOG, server.name + ' listening at ' + server.url);
    });

    server.on('close', function() {
      logger.log.warn(IDLOG, 'server closed');
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authentication architect component to be used by REST plugins.
 *
 * @method setCompAuthentication
 * @param {object} compAuthentication The architect authentication component
 * @static
 */
function setCompAuthentication(compAuthentication) {
  try {
    // check parameter
    if (typeof compAuthentication !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set authentication architect component to all REST plugins
    for (p in plugins) {
      plugins[p].setCompAuthentication(compAuthentication);
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authorization architect component to be used by REST plugins.
 *
 * @method setCompAuthorization
 * @param {object} comp The authorization component
 * @static
 */
function setCompAuthorization(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }
    for (var p in plugins) {
      plugins[p].setCompAuthorization(comp);
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
 * Set the user architect component to be used by REST plugins.
 *
 * @method setCompUser
 * @param {object} comp The user component
 * @static
 */
function setCompUser(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set utility architect component to all REST plugins
    for (p in plugins) {
      if (typeof plugins[p].setCompUser === 'function') {
        plugins[p].setCompUser(comp);
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
    throw new Error(path + ' does not exist');
  }
  // read configuration file
  var json = (JSON.parse(fs.readFileSync(path, 'utf8'))).rest;

  // initialize the port of the REST server
  if (json.authentication.port) {
    port = json.authentication.port;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "port" key in rest authentication');
  }
  // initialize the address of the REST server
  if (json.authentication.address) {
    address = json.authentication.address;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "address" key in rest authentication');
  }
  // initialize proto of the REST server
  if (json.authentication.proto) {
    proto = json.authentication.proto;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "proto" key in rest authentication');
  }
  logger.log.info(IDLOG, 'configuration done by ' + path);
}

/**
 * Reload the component.
 *
 * @method reload
 */
function reload() {
  try {
    logger.log.info(IDLOG, 'reloading');
    reloading = true;
    reset();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reset the component.
 *
 * @method reset
 */
function reset() {
  try {
    logger.log.info(IDLOG, 'server closing...');
    server.close(function () {
      if (reloading === true) {
        reloading = false;
        server = undefined;
        start();
        logger.log.warn(IDLOG, 'reloaded');
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

// public interface
exports.start = start;
exports.config = config;
exports.reload = reload;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
exports.setCompUser = setCompUser;
exports.setCompAstProxy = setCompAstProxy;
exports.setCompAuthentication = setCompAuthentication;
exports.setCompAuthorization = setCompAuthorization;
