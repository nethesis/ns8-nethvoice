/**
 * The architect component that exposes _offhour_ module.
 *
 * @class arch_offhour
 * @module postit
 */
var offhour = require('./offhour');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_offhour]
 */
var IDLOG = '[arch_offhour]';

module.exports = function (options, imports, register) {

  register(null, {
    offhour: offhour
  });

  var logger = console;

  try {
    if (imports.logger) {
      logger = imports.logger;
    }

    imports.dbconn.on(imports.dbconn.EVT_READY, function () {
      offhour.setLogger(logger.ctilog);
      offhour.setCompUser(imports.user);
      offhour.setCompDbconn(imports.dbconn);
      offhour.setCompAstProxy(imports.astProxy);
      offhour.setCompConfigManager(imports.configManager);
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
