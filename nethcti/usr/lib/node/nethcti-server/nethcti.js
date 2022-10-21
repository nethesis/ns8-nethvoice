/**
 * Main application that starts all architect modules.
 */
var fs = require('fs');
var path = require('path');
var architect = require('architect');
var PLUGINS_DIRNAME = 'plugins';

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_http_proxy]
 */
var IDLOG = '[nethcti]';

/**
 * The logger. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default {
  ctilog: {
    log: console
  }
}
 */
var logger = {
  ctilog: {
    log: console
  }
};

/**
 * Maintains the reload status of all components
 *
 * @property allCompReloadStatus
 * @type object
 * @private
 * @default {}
 */
var allCompReloadStatus = {};

/**
 * The application.
 *
 * @property app
 * @type object
 * @private
 */
var app;

try {
  process.setMaxListeners(31);
  fs.readdir(PLUGINS_DIRNAME, function(err, files) {
    try {
      if (err) {
        logger.ctilog.log.error(IDLOG, err.stack);
        process.exit(1);
      }

      var i;
      var modules = [];
      for (i = 0; i < files.length; i++) {
        modules.push(path.join(process.cwd(), PLUGINS_DIRNAME, files[i]));
      }

      architect.resolveConfig(modules, __dirname, function(err, config) {
        try {
          if (err) {
            logger.ctilog.log.error(IDLOG, err.stack);
            process.exit(1);
          }

          app = architect.createApp(config, function(err1, app) {
            if (err1) {
              logger.ctilog.log.error(IDLOG, err1.stack);
              process.exit(1);
            }
          });

          app.on('service', function(name, service) {
            if (name === 'logger') {
              logger = service;
            }
          });

          app.on('ready', function(uno, due) {
            try {
              logger.ctilog.log.warn(IDLOG, 'STARTED ' + process.argv[1] + ' [' + process.pid + ']');
              var sub = Object.keys(app.services).filter(function(k) {
                return (typeof app.services[k].on === 'function' && app.services[k].EVT_RELOADED);
              });
              // add reload listeners to synchronize on reload of all components
              sub.forEach(function(c) {
                app.services[c].on(app.services[c].EVT_RELOADED, function() {
                  compReloaded(c);
                });
                allCompReloadStatus[c] = false;
              });
            } catch (err1) {
              logger.ctilog.log.error(IDLOG, err1.stack);
            }
          });
        } catch (err) {
          logger.ctilog.log.error(IDLOG, err.stack);
        }
      });

      process.on('uncaughtException', function(err) {
        logger.ctilog.log.error(IDLOG, 'UncaughtException !!!\n',
          err.stack,
          '\nprocess exit: waiting for systemd restart');
        process.exit(1);
      });

      process.on('reloadApp', function () {
        logger.ctilog.log.warn(IDLOG, 'RELOAD all components');
        resetAllCompReloadStatus();
        // call reload on all components exposing the function
        Object.keys(app.services).forEach(function(k) {
          if (typeof app.services[k].reload === 'function') {
            app.services[k].reload();
          }
        });
      });

      process.on('reloadComp', function (name) {
        try {
          logger.ctilog.log.warn(IDLOG, 'RELOAD component ' + name);
          if (typeof app.services[name].reload === 'function') {
            app.services[name].reload();
          }
        } catch (error) {
          logger.ctilog.log.error(IDLOG, error.stack);
        }
      });

      process.on('SIGTERM', function() {
        app.destroy();
        logger.ctilog.log.warn(IDLOG, 'process HALTED by SIGTERM');
        process.exit(0);
      });

      process.on('SIGINT', function() {
        app.destroy();
        logger.ctilog.log.warn(IDLOG, 'process HALTED by SIGINT (Ctrl+C)');
        process.exit(0);
      });

      process.on('exit', function(code) {
        app.destroy();
        logger.ctilog.log.warn(IDLOG, 'exit with code: ' + code);
      });
    } catch (err) {
      logger.ctilog.log.error(IDLOG, err.stack);
    }
  });
} catch (err) {
  logger.ctilog.log.error(IDLOG, err.stack);
}

/**
 * Emits event to all client websocket connections only when
 * all components has been reloaded.
 *
 * @method compReloaded
 */
function compReloaded(comp) {
  try {
    allCompReloadStatus[comp] = true;
    var k;
    for (k in allCompReloadStatus) {
      if (!allCompReloadStatus[k]) {
        return;
      }
    }
    app.services.com_nethcti_ws.sendAllCompReloaded();
    resetAllCompReloadStatus();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}

/**
 * Reset reload status of all components.
 *
 * @method resetAllCompReloadStatus
 * @private
 */
function resetAllCompReloadStatus() {
  try {
    Object.keys(allCompReloadStatus).forEach(function(c) {
      allCompReloadStatus[c] = false;
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}
