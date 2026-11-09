/**
 * Provides database functions.
 *
 * @module dbconn
 * @submodule plugins
 */
var mssql = require('mssql');
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins/dbconn_customer_card]
 */
var IDLOG = '[plugins/dbconn_customer_card]';

/**
 * The logger. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
var logger = console;

/**
 * The exported apis.
 *
 * @property apiList
 * @type object
 */
var apiList = {};

/**
 * The main architect dbconn component.
 *
 * @property compDbconnMain
 * @type object
 * @private
 */
var compDbconnMain;

/**
 * Set the main dbconn architect component.
 *
 * @method setCompDbconnMain
 * @param {object} comp The architect main dbconn component
 * @static
 */
function setCompDbconnMain(comp) {
  try {
    // check parameter
    if (typeof comp !== 'object') {
      throw new Error('wrong parameter');
    }

    compDbconnMain = comp;
    logger.log.info(IDLOG, 'main dbconn component has been set');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least
 * three methods: _info, warn and error_ as console object.
 * @static
 */
function setLogger(log) {
  try {
    if (typeof log === 'object' &&
      typeof log.log.info === 'function' &&
      typeof log.log.warn === 'function' &&
      typeof log.log.error === 'function') {

      logger = log;
      logger.log.info(IDLOG, 'new logger has been set');

    } else {
      throw new Error('wrong logger object');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Removes the international prefix from the phone number.
 *
 * @method removeInternationalPrefix
 * @param {string} num The phone number
 * @return {string} The cleaned phone number
 * @private
 */
function removeInternationalPrefix(num) {
  try {
    num = num.replace(/^00/, '+');
    if (num[0] === '+') {
      let tempnum = phoneUtil.parseAndKeepRawInput(num);
      let countryCode = tempnum.getCountryCode().toString();
      num = num.substring(countryCode.length + 1, num.length);
    }
    return num;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Removes empty spaces from the phone number.
 *
 * @method removeEmptySpaces
 * @param {string} num The phone number
 * @return {string} The cleaned phone number
 * @private
 */
function removeEmptySpaces(num) {
  try {
    return num.replace(/\s/g, '');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the customer card of the specified type.
 *
 * @method getCustomerCardByNum
 * @param {string} permissionId The permission identifier of the customer card in asterisk.rest_cti_permissions
 * @param {string} ccName The customer card name
 * @param {string} num The phone number used to search in _channel_ and _dstchannel_ mysql
 *                     fields. It is used to filter out. It is preceded by '%' character
 * @param {function} cb The callback function
 */
function getCustomerCardByNum(permissionId, ccName, num, cb) {
  try {
    // check parameters
    if (typeof permissionId !== 'string' ||
      typeof ccName !== 'string' ||
      typeof num !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var query;
    // get the db connection relative to customer card specified
    var dbConnId = compDbconnMain.getCustCardTemplatesData()[permissionId].dbconn_id;

    // check the connection presence
    if (compDbconnMain.dbConnCustCard[dbConnId] === undefined) {
      var strError = 'no db connection for customer card ' + ccName + ' (permission_id: ' + permissionId +
        ') for num ' + num + ' (dbConnId: ' + dbConnId + ')';
      logger.log.warn(IDLOG, strError);
      cb(strError);
      return;
    }

    if ((compDbconnMain.getDbConfigCustCardData())[dbConnId].type === 'mysql') {

      // escape of the number
      num = compDbconnMain.dbConnCustCard[dbConnId].getQueryInterface().escape(num); // e.g. num = '123456'
      num = num.substring(1, num.length - 1); // remove external quote e.g. num = 123456

      // if current customer card is a default one (identity or last_call), the phone number
      // is cleaned from the international prefix and empty spaces
      if (ccName === 'cc_identity' || ccName === 'cc_last_calls') {
        num = removeEmptySpaces(num);
        num = removeInternationalPrefix(num);
      }

      // replace the key of the query with parameter
      query = compDbconnMain.getCustCardTemplatesData()[permissionId].query.replace(/\$NUMBER/g, num);
      compDbconnMain.dbConnCustCard[dbConnId].query(query).then(function(results) {

        logger.log.info(IDLOG, results[0].length + ' results by searching cust card "' + ccName +
          '" (permission_id: ' + permissionId + ') by num ' + num);
        cb(null, results[0]);

      }, function(err1) { // manage the error

        logger.log.error(IDLOG, 'searching cust card "' + ccName + '" (permission_id: ' + permissionId + ') by num ' +
          num + ': ' + err1.toString());
        cb(err1.toString());
      });

    } else if ((compDbconnMain.getDbConfigCustCardData())[dbConnId].type === 'postgres') {

      query = compDbconnMain.getCustCardTemplatesData()[permissionId].query.replace(/\$NUMBER/g, num);
      compDbconnMain.dbConnCustCard[dbConnId].query(query, function(err2, results) {
        if (err2) {
          logger.log.error(IDLOG, 'searching cust card "' + ccName + '" (permission_id: ' + permissionId + ') by num ' +
            num + ': ' + err2.toString());
          cb(err2.toString());

        } else {
          logger.log.info(IDLOG, results.rows.length + ' results by searching cust card "' + ccName +
            '" (permission_id: ' + permissionId + ') by num ' + num);
          cb(null, results.rows);
        }
      });

    } else if (compDbconnMain.isMssqlType((compDbconnMain.getDbConfigCustCardData())[dbConnId].type)) {

      var request = new mssql.Request(compDbconnMain.dbConnCustCard[dbConnId]);
      query = compDbconnMain.getCustCardTemplatesData()[permissionId].query.replace(/\$NUMBER/g, num);
      request.query(query, function(err2, recordset) {
        try {
          if (err2) {
            logger.log.error(IDLOG, 'searching cust card "' + ccName + '" (permission_id: ' + permissionId +
              ') by num ' + num + ': ' + err2.toString());
            cb(err2.toString());

          } else {
            logger.log.info(IDLOG, recordset.length + ' results by searching cust card "' + ccName +
              '" (permission_id: ' + permissionId + ') by num ' + num);
            cb(null, recordset);
          }
        } catch (err3) {
          logger.log.error(IDLOG, err3.stack);
          cb(err3.toString());
        }
      });
    }
    compDbconnMain.incNumExecQueries();

  } catch (error) {
    logger.log.error(IDLOG, error.stack);
    cb(error.toString());
  }
}

/**
 * Return the name of the customer cards.
 *
 * @method getCustCardNames
 * @param {function} cb The callback function
 */
function getCustCardNames(cb) {
  try {
    compDbconnMain.readCustomerCard(function(err, results) {
      if (err) {
        logger.log.warn(IDLOG, 'getting customer card names');
        cb(err);
        return;
      }
      var i;
      var arr = [];
      for (i = 0; i < results.length; i++) {
        arr.push(results[i].template);
      }
      cb(null, arr);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Test if the database connection to specified customer card exists.
 *
 * @method checkDbconnCustCard
 * @param {string} permissionId The permission identifier of the customer card in asterisk.rest_cti_permissions
 * @return {boolean} True if the connection exists.
 */
function checkDbconnCustCard(permissionId) {
  try {
    if (typeof permissionId !== 'string') {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }

    var connid = compDbconnMain.getCustCardTemplatesData()[permissionId] ? compDbconnMain.getCustCardTemplatesData()[permissionId].dbconn_id : null;
    if (compDbconnMain.dbConnCustCard[connid]) {
      return true;
    }
    return false;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Test if the database connection to specified customer card exists.
 *
 * @method checkDbconnCustCard
 * @param {string} connid The pdatabase connection identifier
 * @return {boolean} True if the connection exists.
 */
function checkDbconnCustCardByConnId(connid) {
  try {
    if (typeof connid !== 'string') {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }
    if (compDbconnMain.dbConnCustCard[connid]) {
      return true;
    }
    return false;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Return the name of the template file.
 *
 * @method getCustCardTemplateName
 * @param {string} permissionId The permission identifier of the customer card in asterisk.rest_cti_permissions
 * @return {string} The name of the template file or undefined.
 */
function getCustCardTemplateName(permissionId) {
  try {
    if (typeof permissionId !== 'string') {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }
    if (compDbconnMain.getCustCardTemplatesData()[permissionId]) {
      return compDbconnMain.getCustCardTemplatesData()[permissionId].template;
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return the name of the customer card.
 *
 * @method getCustCardNameDescr
 * @param {string} permissionId The permission identifier of the customer card in asterisk.rest_cti_permissions
 * @return {string} The name of the customer card with the specified permission id.
 */
function getCustCardNameDescr(permissionId) {
  try {
    if (typeof permissionId !== 'string') {
      throw new Error('wrong parameter: ' + JSON.stringify(arguments));
    }
    if (compDbconnMain.getCustCardTemplatesData()[permissionId]) {
      return compDbconnMain.getCustCardTemplatesData()[permissionId].name;
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return the customer card preview.
 *
 * @method getCustomerCardPreview
 * @param {string} query The query
 * @param {string} dbConnId The db connection identifier
 * @param {string} templateName The template name
 * @param {function} cb The callback function
 */
function getCustomerCardPreview(query, dbConnId, templateName, cb) {
  try {
    // check parameters
    if (typeof query !== 'string' ||
      typeof dbConnId !== 'string' ||
      typeof templateName !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the connection presence
    if (compDbconnMain.dbConnCustCard[dbConnId] === undefined) {
      var strError = 'no db connection for customer card preview';
      logger.log.warn(IDLOG, strError);
      cb(strError);
      return;
    }

    if ((compDbconnMain.getDbConfigCustCardData())[dbConnId].type === 'mysql') {

      compDbconnMain.dbConnCustCard[dbConnId].query(query).then(function(results) {

        logger.log.info(IDLOG, results[0].length + ' results for cust card preview');
        cb(null, results[0]);

      }, function(err1) { // manage the error

        logger.log.error(IDLOG, 'searching cust card preview: ' + err1.toString());
        cb(err1.toString());
      });

    } else if ((compDbconnMain.getDbConfigCustCardData())[dbConnId].type === 'postgres') {

      compDbconnMain.dbConnCustCard[dbConnId].query(query, function(err2, results) {
        if (err2) {
          logger.log.error(IDLOG, 'searching cust card preview: ' + err2.toString());
          cb(err2.toString());

        } else {
          logger.log.info(IDLOG, results.rows.length + ' results by searching cust card preview');
          cb(null, results.rows);
        }
      });

    } else if (compDbconnMain.isMssqlType((compDbconnMain.getDbConfigCustCardData())[dbConnId].type)) {

      var request = new mssql.Request(compDbconnMain.dbConnCustCard[dbConnId]);
      request.query(query, function(err2, recordset) {
        try {
          if (err2) {
            logger.log.error(IDLOG, 'searching cust card preview: ' + err2.toString());
            cb(err2.toString());

          } else {
            logger.log.info(IDLOG, recordset.length + ' results by searching cust card preview');
            cb(null, recordset);
          }
        } catch (err3) {
          logger.log.error(IDLOG, err3.stack);
          cb(err3.toString());
        }
      });
    }
    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

apiList.getCustCardNames = getCustCardNames;
apiList.checkDbconnCustCard = checkDbconnCustCard;
apiList.getCustCardNameDescr = getCustCardNameDescr;
apiList.getCustomerCardByNum = getCustomerCardByNum;
apiList.getCustomerCardPreview = getCustomerCardPreview;
apiList.getCustCardTemplateName = getCustCardTemplateName;
apiList.checkDbconnCustCardByConnId = checkDbconnCustCardByConnId;

// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;
