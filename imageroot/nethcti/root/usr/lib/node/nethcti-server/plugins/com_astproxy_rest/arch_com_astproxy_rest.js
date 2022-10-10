/**
 * The architect component that starts _server\_com\_ast\_proxy\_rest_ module.
 *
 * @class arch_com_astproxy_rest
 * @module com_astproxy_rest
 */
var serverRest = require('./server_com_astproxy_rest.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_astproxy_rest]
 */
var IDLOG = '[arch_com_astproxy_rest]';

module.exports = function(options, imports, register) {

  register();

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  try {
    serverRest.setLogger(logger.ctilog);
    serverRest.config('/etc/nethcti/services.json');
    serverRest.configPrivacy('/etc/nethcti/nethcti.json');
    serverRest.setCompUtil(imports.util);
    serverRest.setCompUser(imports.user);
    serverRest.setCompOperator(imports.operator);
    serverRest.setCompAstProxy(imports.astProxy);
    serverRest.setCompAuthorization(imports.authorization);
    serverRest.setCompConfigManager(imports.configManager);
    serverRest.setCompComNethctiWs(imports.com_nethcti_ws);
    serverRest.setCompNethctiTcp(imports.com_nethcti_tcp);
    serverRest.setCompAlarm(imports.alarm);
    serverRest.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}
