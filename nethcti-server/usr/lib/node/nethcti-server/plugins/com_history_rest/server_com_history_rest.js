/**
 * Provides the REST server for history calls functions using
 * _history_ component.
 *
 * @module com_history_rest
 * @main com_history_rest
 */

/**
 * Provides the REST server.
 *
 * @class server_com_history_rest
 */
var fs = require('fs');
var restify = require('restify');
var plugins = require('jsplugs')().require('./plugins/com_history_rest/plugins_rest');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [server_com_history_rest]
 */
var IDLOG = '[server_com_history_rest]';

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
 * Set the history architect component to be used by REST plugins.
 *
 * @method setCompHistory
 * @param {object} compHistory The architect history component
 * @static
 */
function setCompHistory(compHistory) {
  try {
    // check parameter
    if (typeof compHistory !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set history call architect component to all REST plugins
    for (p in plugins) {
      if (typeof plugins[p].setCompHistory === 'function') {
        plugins[p].setCompHistory(compHistory);
      }
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the operator architect component to be used by REST plugins.
 *
 * @method setCompOperator
 * @param {object} compOperator The architect operator component
 * @static
 */
function setCompOperator(compOperator) {
  try {
    if (typeof compOperator !== 'object') {
      throw new Error('wrong parameter');
    }
    for (let p in plugins) {
      if (typeof plugins[p].setCompOperator === 'function') {
        plugins[p].setCompOperator(compOperator);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the static http architect component to be used by REST plugins.
 *
 * @method setCompStaticHttp
 * @param {object} comp The architect static http component
 * @static
 */
function setCompStaticHttp(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set static http call architect component to all REST plugins
    for (p in plugins) {
      if (typeof plugins[p].setCompStaticHttp === 'function') {
        plugins[p].setCompStaticHttp(comp);
      }
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set asterisk proxy architect component to be used by REST plugins.
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

    var p;
    // set static http call architect component to all REST plugins
    for (p in plugins) {
      if (typeof plugins[p].setCompAstProxy === 'function') {
        plugins[p].setCompAstProxy(comp);
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
 * Set the cel architect component to be used by REST plugins.
 *
 * @method setCompCel
 * @param {object} comp The architect cel component
 * @static
 */
function setCompCel(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set utility architect component to all REST plugins
    for (p in plugins) {
      if (typeof plugins[p].setCompCel === 'function') {
        plugins[p].setCompCel(comp);
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
 * @param {object} comp The architect user component
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
 * Sets the authorization architect component for all REST plugins.
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

    // set the authorization for all REST plugins
    setAllRestPluginsAuthorization(ca);

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
  if (json.history && json.history.port) {
    port = json.history.port;

  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "port" key in history');
  }

  // initialize the address of the REST server
  if (json.history && json.history.address) {
    address = json.history.address;

  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "address" key in history');
  }
  logger.log.info(IDLOG, 'configuration done by ' + path);
}

/**
 * Customize the privacy used to hide phone numbers by a configuration file.
 * The file must use the JSON syntax.
 *
 * **The method can throw an Exception.**
 *
 * @method configPrivacy
 * @param {string} path The path of the configuration file
 */
function configPrivacy(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter');
    }

    // check file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }

    // read configuration file
    var json = JSON.parse(fs.readFileSync(path, 'utf8'));

    if (json.privacy_numbers) {
      // set the privacy for all REST plugins
      setAllRestPluginsPrivacy(json.privacy_numbers);

    } else {
      logger.log.warn(IDLOG, 'wrong ' + path + ': no "privacy_numbers"');
    }

    logger.log.info(IDLOG, 'privacy configuration done by ' + path);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Calls _setPrivacy_ function for all REST plugins.
 *
 * @method setAllRestPluginsPrivacy
 * @param {string} str The string used to hide last digits of phone numbers
 * @private
 */
function setAllRestPluginsPrivacy(str) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setPrivacy === 'function') {
        plugins[key].setPrivacy(str);
        logger.log.info(IDLOG, 'privacy has been set for rest plugin ' + key);
      }
    }
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
exports.setCompCel = setCompCel;
exports.setCompUser = setCompUser;
exports.setCompUtil = setCompUtil;
exports.configPrivacy = configPrivacy;
exports.setCompHistory = setCompHistory;
exports.setCompOperator = setCompOperator;
exports.setCompAstProxy = setCompAstProxy;
exports.setCompStaticHttp = setCompStaticHttp;
exports.setCompAuthorization = setCompAuthorization;
