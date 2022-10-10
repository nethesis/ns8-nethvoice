/**
 * Provides the REST server for asterisk proxy functions using
 * _astproxy_ component.
 *
 * @module com_astproxy_rest
 * @main com_astproxy_rest
 */

/**
 * Provides the REST server.
 *
 * @class server_com_astproxy_rest
 */
var fs = require('fs');
var restify = require('restify');
var plugins = require('jsplugs')().require('./plugins/com_astproxy_rest/plugins_rest');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [server_com_astproxy_rest]
 */
var IDLOG = '[server_com_astproxy_rest]';

/**
 * The configuration file path of the privacy.
 *
 * @property CONFIG_PRIVACY_FILEPATH
 * @type string
 * @private
 */
var CONFIG_PRIVACY_FILEPATH;

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
 * Sets the component that communicates with clients using websocket.
 *
 * @method setCompComNethctiWs
 * @param {object} comp The websocket communication architect component.
 */
function setCompComNethctiWs(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the remote sites communication component for all the REST plugins
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompComNethctiWs === 'function') {
        plugins[key].setCompComNethctiWs(comp);
        logger.log.info(IDLOG, 'websocket communication component has been set for rest plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the component that communicates with clients using tcp.
 *
 * @method setCompNethctiTcp
 * @param {object} comp The tcp communication architect component.
 */
function setCompNethctiTcp(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }
    for (let key in plugins) {
      if (typeof plugins[key].setCompNethctiTcp === 'function') {
        plugins[key].setCompNethctiTcp(comp);
        logger.log.info(IDLOG, `tcp communication component has been set for rest plugin ${key}`);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the component.
 *
 * @method setCompAlarm
 * @param {object} comp The component.
 */
function setCompAlarm(comp) {
  try {
    for (let key in plugins) {
      if (typeof plugins[key].setCompAlarm === 'function') {
        plugins[key].setCompAlarm(comp);
        logger.log.info(IDLOG, 'alarm component has been set for rest plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set configuration manager architect component used by configuration functions.
 *
 * @method setCompConfigManager
 * @param {object} comp The configuration manager architect component.
 */
function setCompConfigManager(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the configuration manager for all the REST plugins
    setAllRestPluginsCompConfigManager(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the configuration manager for all the REST plugins.
 *
 * @method setAllRestPluginsCompConfigManager
 * @param {object} comp The configuration manager
 * @private
 */
function setAllRestPluginsCompConfigManager(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompConfigManager === 'function') {
        plugins[key].setCompConfigManager(comp);
        logger.log.info(IDLOG, 'configuration manager component has been set for rest plugin ' + key);
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
 * @param {object} comp The architect operator component
 * @static
 */
function setCompOperator(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the asterisk proxy for all the REST plugins
    setAllRestPluginsCompOperator(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the operator component for all the REST plugins.
 *
 * @method setAllRestPluginsCompOperator
 * @param {object} comp The operator object
 * @private
 */
function setAllRestPluginsCompOperator(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompOperator === 'function') {
        plugins[key].setCompOperator(comp);
        logger.log.info(IDLOG, 'operator component has been set for rest plugin ' + key);
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

    // set the user component for all the REST plugins
    setAllRestPluginsCompUser(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the user component for all the REST plugins.
 *
 * @method setAllRestPluginsCompUser
 * @param {object} comp The user object
 * @private
 */
function setAllRestPluginsCompUser(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompUser === 'function') {
        plugins[key].setCompUser(comp);
        logger.log.info(IDLOG, 'user component has been set for rest plugin ' + key);
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
 * @param {object} cap The architect asterisk proxy component
 * @static
 */
function setCompAstProxy(cap) {
  try {
    // check parameter
    if (typeof cap !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the asterisk proxy for all the REST plugins
    setAllRestPluginsAstProxy(cap);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the asterisk proxy component for all the REST plugins.
 *
 * @method setAllRestPluginsAstProxy
 * @param {object} ap The asterisk proxy object.
 * @private
 */
function setAllRestPluginsAstProxy(ap) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompAstProxy === 'function') {
        plugins[key].setCompAstProxy(ap);
        logger.log.info(IDLOG, 'asterisk proxy component has been set for rest plugin ' + key);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authorization architect component for all REST plugins.
 *
 * @method setCompAuthorization
 * @param {object} comp The architect authorization component
 * @static
 */
function setCompAuthorization(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    // set the authorization for all REST plugins
    setAllRestPluginsAuthorization(comp);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Called by _setCompAuthorization_ function for all REST plugins.
 *
 * @method setAllRestPluginsAuthorization
 * @private
 * @param comp The architect authorization component
 * @type {object}
 */
function setAllRestPluginsAuthorization(comp) {
  try {
    var key;
    for (key in plugins) {

      if (typeof plugins[key].setCompAuthorization === 'function') {
        plugins[key].setCompAuthorization(comp);
        logger.log.info(IDLOG, 'authorization component has been set for rest plugin ' + key);
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
 * Configurates the REST server properties by the configuration file.
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
  if (json.astproxy && json.astproxy.port) {
    port = json.astproxy.port;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "port" key in rest astproxy');
  }

  // initialize the address of the REST server
  if (json.astproxy && json.astproxy.address) {
    address = json.astproxy.address;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "address" key in rest astproxy');
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
      throw new TypeError('wrong parameter: ' + path);
    }

    // check file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }
    CONFIG_PRIVACY_FILEPATH = path;

    // read configuration file
    var json = JSON.parse(fs.readFileSync(CONFIG_PRIVACY_FILEPATH, 'utf8'));

    if (json.privacy_numbers) {
      setAllRestPluginsPrivacy(json.privacy_numbers);
    } else {
      logger.log.warn(IDLOG, 'wrong ' + CONFIG_PRIVACY_FILEPATH + ': no "privacy_numbers" key');
    }

    logger.log.info(IDLOG, 'configuration privacy done by ' + CONFIG_PRIVACY_FILEPATH);

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
    var p, root, get, post, del, k;

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
      del = plugins[p].api.del;

      // add routing functions
      for (k in get) {
        logger.log.info(IDLOG, 'Binding GET: /' + root + '/' + get[k]);
        server.get('/' + root + '/' + get[k], execute);
      }
      for (k in post) {
        logger.log.info(IDLOG, 'Binding POST: /' + root + '/' + post[k]);
        server.post('/' + root + '/' + post[k], execute);
      }
      for (k in del) {
        logger.log.info(IDLOG, 'Binding DELETE: /' + root + '/' + del[k]);
        server.del('/' + root + '/' + del[k], execute);
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

/**
 * Reload the component.
 *
 * @method reload
 * @private
 */
function reload() {
  try {
    configPrivacy(CONFIG_PRIVACY_FILEPATH);
    logger.log.warn(IDLOG, 'reloaded');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

// public interface
exports.start = start;
exports.reload = reload;
exports.config = config;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
exports.setCompUser = setCompUser;
exports.configPrivacy = configPrivacy;
exports.setCompOperator = setCompOperator;
exports.setCompAstProxy = setCompAstProxy;
exports.setCompAlarm = setCompAlarm;
exports.setCompComNethctiWs = setCompComNethctiWs;
exports.setCompNethctiTcp = setCompNethctiTcp;
exports.setCompAuthorization = setCompAuthorization;
exports.setCompConfigManager = setCompConfigManager;