/**
 * The architect component that starts _server\_com\_authentication\_rest_ module.
 *
 * @class arch_com_authentication_rest
 * @module com_authentication_rest
 */
var serverRest = require('./server_com_authentication_rest.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_authentication_rest]
 */
var IDLOG = '[arch_com_authentication_rest]';

module.exports = function(options, imports, register) {

  register(null, {
    com_authentication_rest: serverRest
  });

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  try {
    serverRest.setLogger(logger.ctilog);
    serverRest.config('/etc/nethcti/services.json');
    serverRest.setCompUtil(imports.util);
    serverRest.setCompUser(imports.user);
    serverRest.setCompAstProxy(imports.astProxy);
    serverRest.setCompAuthentication(imports.authentication);
    serverRest.setCompAuthorization(imports.authorization);
    serverRest.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}
