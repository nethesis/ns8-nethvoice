/**
 * Provides the REST server for serving static files as images, css files and so on.
 *
 * @module com_static_http
 * @main arch_com_static_http
 */

/**
 * Provides the REST server.
 *
 * @class server_com_static_http
 */
var fs = require('fs');
var http = require('http');
var path = require('path');
var nodeStatic = require('node-static');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [server_com_static_http]
 */
var IDLOG = '[server_com_static_http]';

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
 * @default "localhost"
 */
var address = 'localhost';

/**
 * The root directory of the static files to serve.
 *
 * @property webroot
 * @type string
 * @private
 * @default "static"
 */
var webroot = 'static';

/**
 * The root directory of the custom static files created by the user.
 *
 * @property customWebroot
 * @type string
 * @private
 */
var customWebroot;

/**
 * The node-static server instance for default static files.
 *
 * @property fileStaticRoot
 * @type object
 * @private
 */
var fileStaticRoot;

/**
 * The node-static server instance for customized static files created by the user.
 *
 * @property customFileStaticRoot
 * @type object
 * @private
 */
var customFileStaticRoot;

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

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the utility architect component.
 *
 * @method setCompUtil
 * @param {object} comp The utility architect component.
 */
function setCompUtil(comp) {
  try {
    compUtil = comp;
    logger.log.info(IDLOG, 'set util architect component');
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
    throw new TypeError('wrong parameter: ' + path);
  }

  // check file presence
  if (!fs.existsSync(path)) {
    throw new Error(path + ' does not exist');
  }

  // read configuration file
  var json = (JSON.parse(fs.readFileSync(path, 'utf8'))).rest;

  // initialize the port of the REST server
  if (json.static && json.static.port) {
    port = json.static.port;

  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "port" key in rest static');
  }

  // initialize the address of the REST server
  if (json.static && json.static.address) {
    address = json.static.address;

  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "address" key in rest static');
  }

  // initialize webroot
  if (json.static.webroot) {
    webroot = json.static.webroot;
  } else {
    webroot = path.join(__dirname, webroot);
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "webroot" key in rest static');
  }

  // initialize webroot for custom files created by the user
  if (json.static.customWebroot) {
    customWebroot = json.static.customWebroot;
  } else {
    logger.log.warn(IDLOG, 'wrong ' + path + ': no "customWebroot" key in rest static');
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
    // initialize node-static server instances
    fileStaticRoot = new(nodeStatic.Server)(webroot, {
      cache: 3600,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    customFileStaticRoot = new(nodeStatic.Server)(customWebroot, {
      cache: 3600,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

    // create http server
    var server = http.createServer(httpServerCb).listen(port, address);
    logger.log.info(IDLOG, 'listening at ' + address + ':' + port);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * The callback function of the create http server invocation.
 * First it looks the static resource into the webroot and then into the
 * customWebroot.
 *
 * @method httpServerCb
 * @param {object} req The http request
 * @param {object} res The http response
 * @static
 */
function httpServerCb(req, res) {
  try {
    req.addListener('end', function() {
      try {
        // remove 'static' from the request
        // For example "/static/img/logo.png" becomes "//img/logo.png"
        req.url = req.url.replace('static', '');
        customFileStaticRoot.serve(req, res, function(err1, result) {
          if (err1) {
            fileStaticRoot.serve(req, res, function(err3, result3) {
              if (err3 && err3.status && err3.message) {
                logger.log.error(IDLOG, 'serving "' + req.url + '": code ' + err3.status + ' "' + err3.message + '"');
              } else if (err3) {
                logger.log.error(IDLOG, 'serving "' + req.url + '": ' + err3);
              }
              if (err3) {
                res.writeHead(err3.status);
                res.end();
                return;
              }
              // Handle temp files: delete after serving
              if (path.basename(req.url).indexOf('tmpaudio') !== -1 || path.basename(req.url).indexOf('custom_msg_vm_') === 0) {
                fs.unlink(path.join(webroot, req.url), function(err2) {
                  if (err2) {
                    logger.log.error(IDLOG, 'deleting temp file ' + path.join(webroot, req.url) + ': ' + err2);
                  } else {
                    logger.log.info(IDLOG, 'temp file ' + path.join(webroot, req.url) + ' has been deleted');
                  }
                });
              }
            });
          }
        });
      } catch (err1) {
        logger.log.error(IDLOG, 'serving static file ' + req.url + ': ' + err1.stack);
        compUtil.net.sendHttp500(IDLOG, res, err1.toString());
      }
    }).resume();

  } catch (err) {
    logger.log.error(IDLOG, 'serving static file ' + req.url + ': ' + err.stack);
    compUtil.net.sendHttp500(IDLOG, res, err.toString());
  }
}

/**
 * Save given data to a file inside the webroot directory.
 * If the file exists it will be overwritten.
 *
 * @method saveFile
 * @param {string} dstpath The path of destination file
 * @param {object} data Raw data to save inside the file
 */
function saveFile(dstpath, data) {
  try {
    var destPath = path.join(webroot, dstpath);
    logger.log.info(IDLOG, 'saving file ' + destPath);
    fs.writeFile(destPath, data, function(err) {
      if (err) {
        throw err;
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, 'saving static file ' + req.url + ': ' + err.stack);
  }
}

/**
 * Copy given file path to a local file inside the webroot directory.
 *
 * @method copyFile
 * @param {string}   srcpath Original file path
 * @param {string}   dstpath Name of symlink
 * @param {function} cb      The callback function
 */
function copyFile(srcpath, dstpath, cb) {

  var destPath;

  try {
    // check parameters
    if (typeof srcpath !== 'string' || typeof dstpath !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    destPath = path.join(webroot, dstpath);

    // create source stream
    var src = fs.createReadStream(srcpath);
    src.on('error', function(err1) {
      var str = 'creating readable stream from "' + srcpath + '": ' + err1.toString();
      logger.log.error(IDLOG, str);
      cb(str);
    });

    // create destination stream
    var dest = fs.createWriteStream(destPath);
    dest.on('close', function() {
      logger.log.info(IDLOG, '"' + srcpath + '" has been copied into "' + destPath + '"');
      cb();
    });
    dest.on('error', function(err2) {
      var str = 'copying "' + srcpath + '" into "' + destPath + '": ' + err2.toString();
      logger.log.error(IDLOG, str);
      cb(str);
    });

    // copy file
    src.pipe(dest);

  } catch (err) {
    logger.log.error(IDLOG, 'copying static file ' + srcpath + ' -> ' + destPath + ': ' + err.stack);
  }
}

// public interface
exports.start = start;
exports.config = config;
exports.copyFile = copyFile;
exports.saveFile = saveFile;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
