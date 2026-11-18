/**
 * The architect component.
 *
 * @class arch_com_videoconf_rest
 * @module com_videoconf_rest
 */
const serverRest = require('./server_com_videoconf_rest.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_videoconf_rest]
 */
const IDLOG = '[arch_com_videoconf_rest]';

module.exports = function(options, imports, register) {

  register();

  let logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  try {
    serverRest.setLogger(logger.ctilog);
    serverRest.config('/etc/nethcti/services.json');
    serverRest.setCompUtil(imports.util);
    serverRest.setCompAuthorization(imports.authorization);
    serverRest.setCompVideoconf(imports.videoconf);
    serverRest.setCompUser(imports.user);
    serverRest.setCompMailer(imports.mailer);
    serverRest.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
