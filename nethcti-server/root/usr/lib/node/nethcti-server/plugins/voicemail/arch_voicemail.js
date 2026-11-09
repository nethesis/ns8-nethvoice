/**
 * The architect component that exposes _voicemail_ module.
 *
 * @class arch_voicemail
 * @module voicemail
 */
var voicemail = require('./voicemail');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_voicemail]
 */
var IDLOG = '[arch_voicemail]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    voicemail: voicemail
  });

  try {
    voicemail.setLogger(logger.ctilog);

    // wait for the creation of the users
    imports.user.on(imports.user.EVT_USERS_READY, function() {
      voicemail.setCompUser(imports.user);
      voicemail.setAstProxy(imports.astProxy);
      voicemail.start();
    });

    imports.dbconn.on(imports.dbconn.EVT_READY, function() {
      voicemail.setDbconn(imports.dbconn);
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
