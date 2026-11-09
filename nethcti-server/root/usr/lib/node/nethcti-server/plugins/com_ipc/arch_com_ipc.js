'use strict';
/**
 * The architect component that starts _server\_com\_ipc_ module.
 *
 * @class arch_com_ipc
 * @module com_ipc
 */
const server = require('./server_com_ipc.js');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_com_ipc]
 */
let IDLOG = '[arch_com_ipc]';

module.exports = function(options, imports, register) {
  register(null, {
    comIpc: server
  });
  let logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }
  try {
    server.setLogger(logger.ctilog);
    server.setCompComNethctiWs(imports.com_nethcti_ws);
    server.setCompComNethctiTcp(imports.com_nethcti_tcp);
    server.start();
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
}