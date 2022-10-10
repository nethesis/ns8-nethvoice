/**
 * The architect component that exposes _authentication_ module.
 *
 * @class arch_authentication
 * @module authentication
 */
var authentication = require('./authentication');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_authentication]
 */
var IDLOG = '[arch_authentication]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    authentication: {
      on: authentication.on,
      config: authentication.config,
      getNonce: authentication.getNonce,
      setLogger: authentication.setLogger,
      verifyToken: authentication.verifyToken,
      removeToken: authentication.removeToken,
      authenticate: authentication.authenticate,
      EVT_RELOADED: authentication.EVT_RELOADED,
      setCompDbconn: authentication.setCompDbconn,
      EVT_COMP_READY: authentication.EVT_COMP_READY,
      calculateToken: authentication.calculateToken,
      addShibbolethMap: authentication.addShibbolethMap,
      isShibbolethUser: authentication.isShibbolethUser,
      getAdminSecretKey: authentication.getAdminSecretKey,
      getRemoteSiteName: authentication.getRemoteSiteName,
      updateTokenExpires: authentication.updateTokenExpires,
      removeShibbolethMap: authentication.removeShibbolethMap,
      isUnautheCallEnabled: authentication.isUnautheCallEnabled,
      getShibbolethUsername: authentication.getShibbolethUsername,
      removePersistentToken: authentication.removePersistentToken,
      isUnautheCallIPEnabled: authentication.isUnautheCallIPEnabled,
      authenticateRemoteSite: authentication.authenticateRemoteSite,
      isAutoUpdateTokenExpires: authentication.isAutoUpdateTokenExpires,
      authenticateFreepbxAdmin: authentication.authenticateFreepbxAdmin,
      getTokenExpirationTimeout: authentication.getTokenExpirationTimeout,
      getNonceForPersistentToken: authentication.getNonceForPersistentToken,
      configRemoteAuthentications: authentication.configRemoteAuthentications,
      isRemoteSiteAlreadyLoggedIn: authentication.isRemoteSiteAlreadyLoggedIn,
      initFreepbxAdminAuthentication: authentication.initFreepbxAdminAuthentication
    }
  });

  try {
    imports.dbconn.on(imports.dbconn.EVT_READY, function() {
      authentication.setLogger(logger.ctilog);
      authentication.setCompDbconn(imports.dbconn);
      authentication.config('/etc/nethcti/authentication.json');
      authentication.initFreepbxAdminAuthentication();
      authentication.start();
    });
    imports.dbconn.on(imports.dbconn.EVT_RELOADED, function() {
      authentication.reload();
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
