/**
 * The architect component that exposes _phonebook_ module.
 *
 * @class arch_phonebook
 * @module phonebook
 */
var phonebook = require('./phonebook');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_phonebook]
 */
var IDLOG = '[arch_phonebook]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    phonebook: phonebook
  });

  try {
    imports.dbconn.on(imports.dbconn.EVT_READY, function() {
      phonebook.setLogger(logger.ctilog);
      phonebook.setDbconn(imports.dbconn);
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
