/**
 * Provides the REST server for videoconf functions using
 * _videoconf_ component.
 *
 * @module com_videoconf_rest
 * @main com_videoconf_rest
 */

/**
 * Provides the REST server.
 *
 * @class server_com_videoconf_rest
 */
var fs = require('fs');
var restify = require('restify');
var plugins = require('jsplugs')().require('./plugins/com_videoconf_rest/plugins_rest');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [server_com_videoconf_rest]
 */
var IDLOG = '[server_com_videoconf_rest]';

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

    compUtil = comp;
    logger.log.info(IDLOG, 'util component has been set');

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
    if (compAuthorization.authorizeVideoconf(username) === true) {
      logger.log.info(IDLOG, 'videoconf authorization successfully for user "' + username + '"');
      logger.log.info(IDLOG, 'execute: ' + p + '.' + name);
      plugins[p][name].apply(plugins[p], [req, res, next]);

    } else { // authorization failed
      logger.log.warn(IDLOG, 'videoconf authorization failed for user "' + username + '"!');
      compUtil.net.sendHttp403(IDLOG, res);
    }
    return next();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the videoconf architect component to be used by REST plugins.
 *
 * @method setCompVideoconf
 * @param {object} compvideoconf The architect videoconf component
 * @static
 */
function setCompVideoconf(compVideoconf) {
  try {
    // check parameter
    if (typeof compVideoconf !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set videoconf architect component to all REST plugins
    for (p in plugins) {
      plugins[p].setCompVideoconf(compVideoconf);
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the user architect component to be used by REST plugins.
 *
 * @method setCompUser
 * @param {object} compUser The architect user component
 * @static
 */
function setCompUser(compUser) {
  try {
    if (typeof compUser !== 'object') {
      throw new Error('wrong parameter');
    }

    var p;
    // set videoconf architect component to all REST plugins
    for (p in plugins) {
      plugins[p].setCompUser(compUser);
    }

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the mailer architect component to be used by REST plugins.
 *
 * @method setCompMailer
 * @param {object} comp The architect mailer component
 * @static
 */
function setCompMailer(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }
    var p;
    for (p in plugins) {
      plugins[p].setCompMailer(comp);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authorization architect component.
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

    compAuthorization = comp;
    logger.log.info(IDLOG, 'authorization component has been set');

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
  if (json.videoconf && json.videoconf.port) {
    port = json.videoconf.port;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "port" key in rest user');
  }

  // initialize the address of the REST server
  if (json.videoconf && json.videoconf.address) {
    address = json.videoconf.address;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "address" key in rest user');
  }
  logger.log.info(IDLOG, 'configuration done by ' + path);
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
      headers: ['WWW-Authenticate', 'Authorization']
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

// public interface
exports.start = start;
exports.config = config;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
exports.setCompVideoconf = setCompVideoconf;
exports.setCompUser = setCompUser;
exports.setCompMailer = setCompMailer;
exports.setCompAuthorization = setCompAuthorization;
