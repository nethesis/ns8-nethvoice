/**
 * The architect component that starts _server\_com\_offhour\_rest_ module.
 *
 * @class arch_com_offhour_rest
 * @module com_offhour_rest
 */
var serverRest = require('./server_com_offhour_rest.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_offhour_rest]
 */
var IDLOG = '[arch_com_offhour_rest]';

module.exports = function (options, imports, register) {

  register();

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  try {
    serverRest.setLogger(logger.ctilog);
    serverRest.config('/etc/nethcti/services.json');
    serverRest.setCompUtil(imports.util);
    serverRest.setCompAuthorization(imports.authorization);
    serverRest.setCompOffhour(imports.offhour);
    serverRest.setCompStaticHttp(imports.staticHttp);
    serverRest.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}
