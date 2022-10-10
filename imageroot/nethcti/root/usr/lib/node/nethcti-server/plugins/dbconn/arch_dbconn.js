/**
 * The architect component that exposes _dbconn_ module.
 *
 * @class arch_dbconn
 * @module dbconn
 */
var dbconnMain = require('./dbconn_main');
var dbconnPluginsManager = require('./dbconn_plugins_manager');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_dbconn]
 */
var IDLOG = '[arch_dbconn]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // attach some extra static apis
  dbconnPluginsManager.apiDbconn.reload = function() {
    try {
      dbconnMain.reset();
      dbconnMain.config('/etc/nethcti/nethcti.json');
      dbconnMain.configDbStatic('/etc/nethcti/dbstatic.d');
      dbconnMain.start();
      logger.ctilog.log.warn(IDLOG, 'reloaded');
    } catch (err) {
      logger.ctilog.log.error(IDLOG, err.stack);
    }
  };
  dbconnPluginsManager.apiDbconn.on = dbconnMain.on;
  dbconnPluginsManager.apiDbconn.getStats = dbconnMain.getStats;
  dbconnPluginsManager.apiDbconn.testConnection = dbconnMain.testConnection;
  dbconnPluginsManager.apiDbconn.EVT_READY = dbconnMain.EVT_READY;
  dbconnPluginsManager.apiDbconn.EVT_RELOADED = dbconnMain.EVT_RELOADED;

  // public interface for other architect components
  register(null, {
    dbconn: dbconnPluginsManager.apiDbconn
  });

  try {
    dbconnMain.setLogger(logger.ctilog);
    dbconnMain.config('/etc/nethcti/nethcti.json');
    dbconnMain.configDbStatic('/etc/nethcti/dbstatic.d');
    dbconnMain.start();
    dbconnPluginsManager.setLogger(logger.ctilog);
    dbconnPluginsManager.setCompDbconnMain(dbconnMain);
    dbconnPluginsManager.setCompUtil(imports.util);
    dbconnPluginsManager.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
