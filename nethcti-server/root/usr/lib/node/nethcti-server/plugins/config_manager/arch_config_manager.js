/**
 * The architect component that exposes _config\_manager_ module.
 *
 * @class arch_config_manager
 * @module config_manager
 */
var configManager = require('./config_manager');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_config_manager]
 */
var IDLOG = '[arch_config_manager]';

module.exports = function(options, imports, register) {

  // public interface for other architect components
  register(null, {
    configManager: configManager
  });

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  try {
    configManager.setLogger(logger.ctilog);
    imports.user.on(imports.user.EVT_USERS_READY, function() {
      configManager.setCompUser(imports.user);
      configManager.setCompAstProxy(imports.astProxy);
      configManager.setCompAuthorization(imports.authorization);
      configManager.setCompComNethctiWs(imports.com_nethcti_ws);
      configManager.config('/etc/nethcti/nethcti.json');
      configManager.configUser();
      configManager.configChat('/etc/nethcti/chat.json');
      configManager.configPhoneUrls('/etc/nethcti/phone_urls.json');
      configManager.setComNethctiWsListeners();
    });

    imports.dbconn.on(imports.dbconn.EVT_READY, function() {
      configManager.setCompDbconn(imports.dbconn);
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
