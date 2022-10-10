/**
 * The architect component that starts _server\_com\_voicemail\_rest_ module.
 *
 * @class arch_com_voicemail_rest
 * @module com_voicemail_rest
 */
var serverRest = require('./server_com_voicemail_rest.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_voicemail_rest]
 */
var IDLOG = '[arch_com_voicemail_rest]';

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
    serverRest.setCompUser(imports.user);
    serverRest.setCompAuthorization(imports.authorization);
    serverRest.setCompVoicemail(imports.voicemail);
    serverRest.setCompStaticHttp(imports.staticHttp);
    serverRest.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
