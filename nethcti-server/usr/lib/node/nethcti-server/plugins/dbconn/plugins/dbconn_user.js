/**
 * Provides database functions.
 *
 * @module dbconn
 * @submodule plugins
 */
var fs = require('fs');
var path = require('path');
var async = require('async');
var moment = require('moment');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins/dbconn_user]
 */
var IDLOG = '[plugins/dbconn_user]';

/**
 * The logger.
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
 * The util component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

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
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    compDbconnMain = comp;
    logger.log.log(IDLOG, 'main dbconn component has been set');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the util architect component.
 *
 * @method setCompUtil
 * @param {object} comp The util component
 * @static
 */
function setCompUtil(comp) {
  try {
    if (typeof comp !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    compUtil = comp;
    logger.log.info(IDLOG, 'util component has been set');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object.
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
 * Store mobile phone number associated with the user.
 *
 * @method setUserMobilePhoneNumber
 * @param {string} username The username
 * @param {string} pnumber The mobile phone number
 * @param {funcion} cb The callback function
 */
function setUserMobilePhoneNumber(username, pnumber, cb) {
  try {
    if (typeof username !== 'string' ||
      typeof pnumber !== 'string' ||
      isNaN(pnumber) ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[compDbconnMain.JSON_KEYS.USERMAN_USERS].find({
      where: ['username=?', username]

    }).then(function(result) {
      if (result && result.dataValues && result.dataValues.id) {
        compDbconnMain.models[compDbconnMain.JSON_KEYS.REST_USERS].find({
          where: ['user_id=?', result.dataValues.id]
          
        }).then(function(task) {
          if (task && task.dataValues && task.dataValues.id) {
            task.updateAttributes({
              mobile: pnumber
            }, ['mobile']).then(function() {
              logger.log.info(IDLOG, 'associated user "' + username + '" with cellphone "' + pnumber + '"');
              compUtil.signalEventApplyChanges();
              cb();
            });
          } else {
            var str = 'associating user "' + username + '" with cellphone "' + pnumber + '" failed: ' +
              'no user present in ' + compDbconnMain.JSON_KEYS.REST_USERS;
            logger.log.warn(IDLOG, str);
            cb(str);
          }
        }, function(err1) { // manage the error
          logger.log.error(IDLOG, 'search id for user "' + username + '" failed: ' + err1.toString());
          cb(err1.toString());
        });
        compDbconnMain.incNumExecQueries();
      } else {
        var str = 'associating user "' + username + '" with cellphone "' + pnumber + '" failed: ' +
          'no user present in ' + compDbconnMain.JSON_KEYS.USERMAN_USERS;
        logger.log.warn(IDLOG, str);
        cb(str);
      }
    }, function(err1) { // manage the error
      logger.log.error(IDLOG, 'associating user "' + username + '" with cellphone "' + pnumber + '" failed: ' + err1.toString());
      cb(err1.toString());
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

apiList.setUserMobilePhoneNumber = setUserMobilePhoneNumber;

// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompUtil = setCompUtil;
exports.setCompDbconnMain = setCompDbconnMain;