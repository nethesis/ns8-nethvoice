/**
 * The architect component that exposes _customer\_card_ module.
 *
 * @class arch_customer_card
 * @module customer_card
 */
var customerCard = require('./customer_card');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [arch_customer_card]
 */
var IDLOG = '[arch_customer_card]';

module.exports = function(options, imports, register) {

  var logger = console;
  if (imports.logger) {
    logger = imports.logger;
  }

  // public interface for other architect components
  register(null, {
    customerCard: {
      on: customerCard.on,
      start: customerCard.start,
      config: customerCard.config,
      setLogger: customerCard.setLogger,
      setDbconn: customerCard.setDbconn,
      setCompUser: customerCard.setCompUser,
      EVT_RELOADED: customerCard.EVT_RELOADED,
      configPrivacy: customerCard.configPrivacy,
      getAllCustomerCards: customerCard.getAllCustomerCards,
      getCustomerCardByNum: customerCard.getCustomerCardByNum,
      getCustomerCardsList: customerCard.getCustomerCardsList,
      setCompAuthorization: customerCard.setCompAuthorization,
      getCustomerCardPreview: customerCard.getCustomerCardPreview
    }
  });

  try {
    imports.dbconn.on(imports.dbconn.EVT_READY, function() {
      customerCard.setLogger(logger.ctilog);
      customerCard.config('/etc/nethcti/services.json');
      customerCard.configPrivacy('/etc/nethcti/nethcti.json');
      customerCard.setCompAuthorization(imports.authorization);
      customerCard.setCompUser(imports.user);
      customerCard.setDbconn(imports.dbconn);
      customerCard.start();
    });
    imports.dbconn.on(imports.dbconn.EVT_RELOADED, function() {
      customerCard.reload();
    });
  } catch (err) {
    logger.ctilog.log.error(IDLOG, err.stack);
  }
};
