/**
 * The architect component that starts _server\_com\_static\_http_ module.
 *
 * @class arch_com_static_http
 * @module com_static_http
 */
var serverRest = require('./server_com_static_http.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_static_http]
 */
var IDLOG = '[arch_com_static_http]';

module.exports = function(options, imports, register) {

  register(null, {
    staticHttp: serverRest
  });


  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  try {
    serverRest.setLogger(logger.ctilog);
    serverRest.config('/etc/nethcti/services.json');
    serverRest.setCompUtil(imports.util);
    serverRest.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
