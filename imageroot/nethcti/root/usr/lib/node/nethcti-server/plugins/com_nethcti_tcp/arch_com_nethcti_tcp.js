/**
 * Provides the real time informations about extension ringings.
 *
 * @class arch_com_nethcti_tcp
 * @module com_nethcti_tcp
 */
var comNethctiTcp = require('./com_nethcti_tcp');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_nethcti_tcp]
 */
var IDLOG = '[arch_com_nethcti_tcp]';

module.exports = function(options, imports, register) {

  register(null, {
    com_nethcti_tcp: comNethctiTcp
  });

  var logger = console;

  try {
    if (imports.logger) {
      logger = imports.logger;
    }

    // wait for the authentication component ready event
    imports.authentication.on(imports.authentication.EVT_COMP_READY, function() {
      comNethctiTcp.setLogger(logger.ctilog);
      comNethctiTcp.setCompAuthe(imports.authentication);
      comNethctiTcp.config('/etc/nethcti/services.json');
      comNethctiTcp.configWinPopup('/etc/nethcti/win_popup.json');
      comNethctiTcp.setCompUser(imports.user);
      comNethctiTcp.setAstProxy(imports.astProxy);
      comNethctiTcp.setCompAuthorization(imports.authorization);
      comNethctiTcp.setCompConfigManager(imports.configManager);
      comNethctiTcp.setCompStreaming(imports.streaming);
      comNethctiTcp.start();
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
