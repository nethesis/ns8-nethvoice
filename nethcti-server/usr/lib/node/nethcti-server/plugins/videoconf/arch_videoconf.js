/**
 * The architect component that exposes _videoconf_ module.
 *
 * @class arch_videoconf
 * @module videoconf
 */
var videoconf = require('./videoconf');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_videoconf]
 */
var IDLOG = '[arch_videoconf]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    videoconf: videoconf
  });

  try {
    videoconf.setLogger(logger.ctilog);
    videoconf.config('/etc/nethcti/video_conf.json');
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
