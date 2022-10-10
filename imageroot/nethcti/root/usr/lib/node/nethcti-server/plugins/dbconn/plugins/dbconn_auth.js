/**
 * Provides authentication functions.
 *
 * @module dbconn
 * @submodule plugins
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins/dbconn_auth]
 */
const IDLOG = '[plugins/dbconn_auth]';

/**
 * The logger. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
let logger = console;

/**
 * The exported apis.
 *
 * @property apiList
 * @type object
 */
let apiList = {};

/**
 * The main architect dbconn component.
 *
 * @property compDbconnMain
 * @type object
 * @private
 */
let compDbconnMain;

/**
 * Set the main dbconn architect component.
 *
 * @method setCompDbconnMain
 * @param {object} comp The architect main dbconn component
 * @static
 */
function setCompDbconnMain(comp) {
  try {
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
    if (typeof log === 'object' && typeof log.log.info === 'function' && typeof log.log.warn === 'function' && typeof log.log.error === 'function') {
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
 * Save an authentication token overwriting if it is already present.
 * The `id` of the database will be incremented.
 *
 * @method saveAuthToken
 * @param {object} data
 *   @param {string} data.user The username
 *   @param {string} data.token The authentication token
 * @return {Promise} The promise function.
 */
function saveAuthToken(data) {
  try {
    return new Promise((resolve, reject) => {
      let query = 'REPLACE INTO `auth` (`user`, `token`) VALUES (?,?)';
      compDbconnMain.dbConn['auth'].query(
        query,
        [data.user, data.token],
        (err, results, fields) => {
        try {
          if (err) {
            logger.log.error(IDLOG, `saving auth token: ${err.toString()}`);
            reject(err.toString());
            return;
          }
          logger.log.info(IDLOG, 'auth token saved successfully');
          resolve(results.insertId ? results.insertId : undefined);
        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          reject(error);
        }
      });
      compDbconnMain.incNumExecQueries();
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Delete an authentication token.
 *
 * @method deleteAuthToken
 * @param {object} data
 *   @param {string} data.user The username
 * @return {Promise} The promise function.
 */
function deleteAuthToken(data) {
  try {
    return new Promise((resolve, reject) => {
      let query = 'DELETE FROM `auth` WHERE user=?';
      compDbconnMain.dbConn['auth'].query(
        query,
        [data.user],
        (err, results, fields) => {
        try {
          if (err) {
            logger.log.error(IDLOG, `deleting auth token: ${err.toString()}`);
            reject(err.toString());
            return;
          }
          logger.log.info(IDLOG, 'auth token deleted successfully');
          resolve(results);
        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          reject(error);
        }
      });
      compDbconnMain.incNumExecQueries();
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns all the authentication tokens.
 *
 * @method getAllTokens
 * @return {Promise} The promise function.
 */
function getAllTokens() {
  try {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM `auth`';
      compDbconnMain.dbConn['auth'].query(
        query,
        (err, results, fields) => {
        try {
          if (err) {
            logger.log.error(IDLOG, `getting all auth tokens failed: ${err.toString()}`);
            reject(err.toString());
            return;
          }
          logger.log.info(IDLOG, `get #${results.length} auth tokens`);
          resolve(results);
        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          reject(error);
        }
      });
      compDbconnMain.incNumExecQueries();
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Return a token.
 *
 * @method getToken
 * @param {string} id The identifier of the token in the db
 * @return {Promise} The promise function.
 */
function getToken(id) {
  try {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM `auth` WHERE id=?';
      compDbconnMain.dbConn['auth'].query(
        query,
        [id],
        (err, results, fields) => {
        try {
          console.log(results);
          if (err) {
            logger.log.error(IDLOG, `getting token id "${id}" failed: ${err.toString()}`);
            reject(err.toString());
            return;
          }
          logger.log.info(IDLOG, `get token id "${id}"`);
          console.log(IDLOG, `get token id "${id}"`);
          resolve(results);
        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          reject(error);
        }
      });
      compDbconnMain.incNumExecQueries();
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

apiList.getToken = getToken;
apiList.getAllTokens = getAllTokens;
apiList.saveAuthToken = saveAuthToken;
apiList.deleteAuthToken = deleteAuthToken;
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;
