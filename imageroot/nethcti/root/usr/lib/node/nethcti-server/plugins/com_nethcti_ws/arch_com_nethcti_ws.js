/**
 * Supply the real time information.
 *
 * @class arch_com_nethcti_ws
 * @module com_nethcti_ws
 */
var comNethctiWs = require('./com_nethcti_ws');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_nethcti_ws]
 */
var IDLOG = '[arch_com_nethcti_ws]';

module.exports = function(options, imports, register) {

  register(null, {
    com_nethcti_ws: comNethctiWs,
    onDestroy: comNethctiWs.stop
  });

  var logger = console;

  try {

    if (imports.logger) {
      logger = imports.logger;
    }

    // wait for the authentication component ready event
    imports.authentication.on(imports.authentication.EVT_COMP_READY, function() {
      comNethctiWs.setLogger(logger.ctilog);
      comNethctiWs.setAuthe(imports.authentication);
      comNethctiWs.config('/etc/nethcti/services.json');
      comNethctiWs.configPrivacy('/etc/nethcti/nethcti.json');
      comNethctiWs.setCompUser(imports.user);
      // comNethctiWs.setCompPostit(imports.postit);
      comNethctiWs.setAstProxy(imports.astProxy);
      comNethctiWs.setCompVoicemail(imports.voicemail);
      comNethctiWs.setCompAuthorization(imports.authorization);
      comNethctiWs.setCompStreaming(imports.streaming);
      let idIntUserReady = setInterval(() => {
        if (imports.user.isConfigured() === true) {
          clearInterval(idIntUserReady);
          comNethctiWs.start();
        }
      }, 500);
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
