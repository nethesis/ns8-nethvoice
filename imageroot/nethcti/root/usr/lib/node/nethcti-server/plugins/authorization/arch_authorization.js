/**
 * The architect component that exposes _authorization_ module.
 *
 * @class arch_authorization
 * @module authorization
 */
var authorization = require('./authorization');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_authorization]
 */
var IDLOG = '[arch_authorization]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    authorization: authorization
  });

  try {
    authorization.setLogger(logger.ctilog);
    authorization.setCompDbconn(imports.dbconn);
    authorization.setCompUser(imports.user);
    authorization.config({
      users: '/etc/nethcti/users.json',
      profiles: '/etc/nethcti/profiles.json',
      nethcti: '/etc/nethcti/nethcti.json'
    });
    // authorization.configRemoteOperators('/etc/nethcti/remote_operators.json');
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
