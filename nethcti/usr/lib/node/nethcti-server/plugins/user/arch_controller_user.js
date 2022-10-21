/**
 * The architect component that exposes _user_ module.
 *
 * @class arch_controller_user
 * @module user
 */
var userPresence = require('./user_presence');
var endpointTypes = require('./endpoint_types');
var controllerUser = require('./controller_user');
var endpointExtension = require('./endpointExtension');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_controller_user]
 */
var IDLOG = '[arch_controller_user]';

module.exports = function(options, imports, register) {

  var logger;

  // public interface for other architect components
  register(null, {
    user: {
      TYPES: endpointExtension.TYPES,
      ENDPOINT_TYPES: endpointTypes.TYPES,
      isValidUserPresence: userPresence.isValidUserPresence,
      isValidUserPresenceOnBusy: userPresence.isValidUserPresenceOnBusy,
      isValidUserPresenceOnUnavailable: userPresence.isValidUserPresenceOnUnavailable,
      USER_PRESENCE_STATUS: userPresence.STATUS,
      USER_PRESENCE_ONBUSY_STATUS: userPresence.STATUS_ONBUSY,
      USER_PRESENCE_ONUNAVAILABLE_STATUS: userPresence.STATUS_ONUNAVAILABLE,
      on: controllerUser.on,
      config: controllerUser.config,
      setLogger: controllerUser.setLogger,
      setPresence: controllerUser.setPresence,
      getPresence: controllerUser.getPresence,
      getQueueIds: controllerUser.getQueueIds,
      getParamUrl: controllerUser.getParamUrl,
      EVT_RELOADED: controllerUser.EVT_RELOADED,
      saveSettings: controllerUser.saveSettings,
      isConfigured: controllerUser.isConfigured,
      getUsernames: controllerUser.getUsernames,
      isUserPresent: controllerUser.isUserPresent,
      isExtenWebrtc: controllerUser.isExtenWebrtc,
      getAllUserExtensions: controllerUser.getAllUserExtensions,
      setCompDbconn: controllerUser.setCompDbconn,
      deleteSetting: controllerUser.deleteSetting,
      deleteSettings: controllerUser.deleteSettings,
      getUserSettings: controllerUser.getUserSettings,
      getUserInfoJSON: controllerUser.getUserInfoJSON,
      EVT_USERS_READY: controllerUser.EVT_USERS_READY,
      getPhoneWebUser: controllerUser.getPhoneWebUser,
      setCompAstProxy: controllerUser.setCompAstProxy,
      getPresenceList: controllerUser.getPresenceList,
      getPhoneWebPass: controllerUser.getPhoneWebPass,
      getEndpointsJSON: controllerUser.getEndpointsJSON,
      getVoicemailList: controllerUser.getVoicemailList,
      setPresenceOnBusy: controllerUser.setPresenceOnBusy,
      getPresenceOnBusy: controllerUser.getPresenceOnBusy,
      getConfigurations: controllerUser.getConfigurations,
      setConfigurations: controllerUser.setConfigurations,
      setMobilePhoneNumber: controllerUser.setMobilePhoneNumber,
      getAllEndpointsEmail: controllerUser.getAllEndpointsEmail,
      hasExtensionEndpoint: controllerUser.hasExtensionEndpoint,
      hasCellphoneEndpoint: controllerUser.hasCellphoneEndpoint,
      getEndpointVoicemail: controllerUser.getEndpointVoicemail,
      hasVoicemailEndpoint: controllerUser.hasVoicemailEndpoint,
      getUsernamesWithData: controllerUser.getUsernamesWithData,
      getPresenceListOnBusy: controllerUser.getPresenceListOnBusy,
      updateUserMainPresence: controllerUser.updateUserMainPresence,
      getPresenceOnUnavailable: controllerUser.getPresenceOnUnavailable,
      setPresenceOnUnavailable: controllerUser.setPresenceOnUnavailable,
      getPresenceCallforwardTo: controllerUser.getPresenceCallforwardTo,
      getAllEndpointsExtension: controllerUser.getAllEndpointsExtension,
      getAllEndpointsCellphone: controllerUser.getAllEndpointsCellphone,
      getEndpointMainExtension: controllerUser.getEndpointMainExtension,
      getAllUsersEndpointsJSON: controllerUser.getAllUsersEndpointsJSON,
      EVT_USER_PRESENCE_CHANGED: controllerUser.EVT_USER_PRESENCE_CHANGED,
      getPresenceListOnUnavailable: controllerUser.getPresenceListOnUnavailable,
      getAllUsersEndpointsExtension: controllerUser.getAllUsersEndpointsExtension,
      getUserUsingEndpointExtension: controllerUser.getUserUsingEndpointExtension,
      getUsersUsingEndpointVoicemail: controllerUser.getUsersUsingEndpointVoicemail,
      getPresenceOnBusyCallforwardTo: controllerUser.getPresenceOnBusyCallforwardTo,
      EVT_USER_MAIN_PRESENCE_CHANGED: controllerUser.EVT_USER_MAIN_PRESENCE_CHANGED,
      EVT_USER_PROFILE_AVATAR_CHANGED: controllerUser.EVT_USER_PROFILE_AVATAR_CHANGED,
      getPresenceOnUnavailableCallforwardTo: controllerUser.getPresenceOnUnavailableCallforwardTo
    }
  });

  try {
    logger = console;
    if (imports.logger) {
      logger = imports.logger;
    }
    controllerUser.setLogger(logger.ctilog);
    controllerUser.setCompAstProxy(imports.astProxy);
    controllerUser.setCompDbconn(imports.dbconn);
    imports.astProxy.on(imports.astProxy.EVT_READY, function() {
      controllerUser.config(
        '/etc/nethcti/users.json',
        '/etc/nethcti/recallonbusy.json'
      );
    });
    imports.astProxy.on(imports.astProxy.EVT_RELOADED, function() {
      controllerUser.reload();
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
