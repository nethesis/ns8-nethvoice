/**
 * The architect component that starts _server\_com\_dbconn\_rest_ module.
 *
 * @class arch_com_dbconn_rest
 * @module com_dbconn_rest
 */
var serverRest = require('./server_com_dbconn_rest.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_dbconn_rest]
 */
var IDLOG = '[arch_com_dbconn_rest]';

module.exports = function(options, imports, register) {

  register();

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  try {
    serverRest.setLogger(logger.ctilog);
    serverRest.config('/etc/nethcti/services.json');
    serverRest.setCompUtil(imports.util);
    serverRest.setCompDbConn(imports.dbconn);
    serverRest.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
