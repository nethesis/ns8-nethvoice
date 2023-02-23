/**
 * Provides the authentication functions.
 *
 * @module authentication
 * @main authentication
 */

/**
 * Provides the authentication functions.
 *
 * @class authentication
 * @static
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var childProcess = require('child_process');
var Netmask = require('netmask').Netmask;

/**
 * True if the component has been started. Used to emit EVT_RELOADED
 * instead of EVT_READY
 *
 * @property ready
 * @type boolean
 * @private
 * @default false
 */
var ready = false;

/**
 * The identifier of the interval used to remove expired tokens.
 *
 * @property intervalRemoveExpiredTokens
 * @type number
 * @private
 */
var intervalRemoveExpiredTokens;

/**
 * Fired when the component is ready.
 *
 * @event ready
 */
/**
 * The name of the component ready event.
 *
 * @property EVT_COMP_READY
 * @type string
 * @default "ready"
 */
var EVT_COMP_READY = 'ready';

/**
 * Fired when the componente has been reloaded.
 *
 * @event reloaded
 */
/**
 * The name of the reloaded event.
 *
 * @property EVT_RELOADED
 * @type string
 * @default "reloaded"
 */
var EVT_RELOADED = 'reloaded';

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [authentication]
 */
var IDLOG = '[authentication]';

/**
 * The file path of the configuration file.
 *
 * @property CONFIG_FILEPATH
 * @type string
 * @private
 */
var CONFIG_FILEPATH;

/**
 * The status of the authentication.
 *
 * @property enabled
 * @type boolean
 * @private
 * @default true
 */
var enabled = true;

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * The database component.
 *
 * @property compDbconn
 * @type object
 * @private
 */
var compDbconn;

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
* The types of the authentication that can be used.
*
* @property AUTH_TYPE
* @type object
* @private
* @default {
    "pam": "pam"
};
*/
var AUTH_TYPE = {
  'pam': 'pam'
};

/**
 * The path of the ldap authentication script.
 *
 * @property LDAP_SCRIPT_PATH
 * @type string
 * @private
 */
var LDAP_SCRIPT_PATH = path.join(process.cwd(), 'scripts/ldap-authenticate.sh');

/**
 * The secret key of FreePBX admin user.
 *
 * @property fpbxAdminSecretKey
 * @type string
 * @private
 */
var fpbxAdminSecretKey;

/**
 * Asterisk call without user authentication and permissions. It is disabled by default
 * but can be enabled by the JSON configuration file in the _config_ method.
 *
 * @property unauthenticatedCall
 * @type string
 * @private
 * @default "disabled"
 */
var unauthenticatedCall = 'disabled';

/**
 * The list of enabled ips that can use the unauthenticated call.
 *
 * @property unauthenticatedCallAddress
 * @type array
 * @private
 * @default []
 */
var unauthenticatedCallAddress = [];

/**
 * The type of authentication chosen. It can be one of the
 * _AUTH\_TYPE_ properties. The authentication type is selected
 * with the configuration file. It's used to choose the correct
 * authentication method.
 *
 * @property authenticationType
 * @type string
 * @private
 */
var authenticationType;

/**
 * The credentials used by remote sites.
 *
 * @property authRemoteSites
 * @type object
 * @private
 * @default {}
 */
var authRemoteSites = {};

/**
 * Map of username with the corresponding shibboleth cookie id used
 * for authentication.
 *
 * @property mapShibbolethUser
 * @type object
 * @private
 * @default {}
 */
var mapShibbolethUser = {};

/**
 * The token expiration expressed in milliseconds. It can be customized
 * with the configuration file.
 *
 * @property expires
 * @type number
 * @private
 * @default 3600000 (1h)
 */
var expires = 3600000;

/**
 * If true, every authentication request also causes the update of the
 * token expiration value.
 *
 * @property autoUpdateTokenExpires
 * @type boolean
 * @private
 * @default true
 */
var autoUpdateTokenExpires = true;

/**
 * The temporary permissions assigned to the users. Associates each user
 * with a list of tokens. Each permission has an expiration date of _expires_
 * milliseconds. Each user can have more than one token because he can login
 * from more than one place.
 *
 * @property grants
 * @type {object}
 * @private
 */
var grants = {};

/**
 * Persistent storage for authentication tokens.
 *
 * @constant persistentTokens
 * @type {Map}
 * @private
 */
const persistentTokens = new Map();

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
 * Sets the database architect component.
 *
 * @method setCompDbconn
 * @param {object} comp The database architect component.
 */
function setCompDbconn(comp) {
  try {
    compDbconn = comp;
    logger.log.info(IDLOG, 'set database architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * It reads the authentication configuration file for remote
 * sites. The file must use the JSON syntax.
 *
 * **The method can throw an Exception.**
 *
 * @method configRemoteAuthentications
 * @param {string} path The path of the configuration file
 */
function configRemoteAuthentications(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter');
    }

    // check file presence
    if (!fs.existsSync(path)) {
      logger.log.error(IDLOG, path + ' does not exist');
      return;
    }

    logger.log.info(IDLOG, 'configure remote sites authentication by ' + path);
    var json = JSON.parse(fs.readFileSync(path, 'utf8'));

    if (typeof json !== 'object') {
      logger.log.error(IDLOG, 'wrong ' + path);
      return;
    }

    var user;
    for (user in json) {
      if (typeof json[user].username !== 'string' ||
        typeof json[user].password !== 'string' ||
        (json[user].allowed_ip instanceof Array) !== true) {

        logger.log.error(IDLOG, 'wrong ' + path + ': authentication content for "' + user + '"');
      } else {
        authRemoteSites[user] = {
          username: json[user].username,
          password: json[user].password,
          allowed_ip: json[user].allowed_ip
        };
      }
    }
    logger.log.info(IDLOG, 'configuration done for remote sites by ' + path);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * It reads the authentication configuration file.
 *
 * **The method can throw an Exception.**
 *
 * @method config
 * @param {string} path The path of the configuration file
 */
function config(path) {
  // check parameter
  if (typeof path !== 'string') {
    throw new TypeError('wrong parameter');
  }

  // check file presence
  if (!fs.existsSync(path)) {
    throw new Error(path + ' does not exist');
  }
  CONFIG_FILEPATH = path;

  // read configuration file
  var json = JSON.parse(fs.readFileSync(CONFIG_FILEPATH, 'utf8'));

  logger.log.info(IDLOG, 'configuring authentication by ' + CONFIG_FILEPATH);

  if (typeof json.enabled !== 'boolean') {
    logger.log.warn(IDLOG, 'wrong "' + path + '": bad "enabled" key: use the default value "' + enabled + '"');
  } else {
    enabled = json.enabled;
    if (enabled === false) {
      logger.log.warn(IDLOG, 'WARNING: authentication is disabled !');
    }
  }

  // set the authentication type
  authenticationType = json.type;

  // set the expiration timeout of the token
  expires = parseInt(json.expiration_timeout, 10) * 1000;

  if (json.type === AUTH_TYPE.pam) {
    // configure authentication with PAM
    logger.log.info(IDLOG, 'configure authentication with pam');
  }

  if (typeof json.unauthe_call !== 'object' ||
    (json.unauthe_call.status !== 'disabled' && json.unauthe_call.status !== 'enabled') ||
    typeof json.unauthe_call.allowed_ip !== 'string') {

      logger.log.warn(IDLOG, 'wrong "' + path + '": bad "unauthe_call" key: use default value "' + unauthenticatedCall + '"');
  } else {
    unauthenticatedCall = json.unauthe_call.status;
    var temp = json.unauthe_call.allowed_ip.split(' ');
    temp.forEach(function (addr) {
      unauthenticatedCallAddress.push(new Netmask(addr));
    });
  }

  startIntervalRemoveExpiredTokens();

  if (!ready) {
    // emit the event to tell other modules that the component is ready to be used
    logger.log.info(IDLOG, 'emit "' + EVT_COMP_READY + '" event');
    emitter.emit(EVT_COMP_READY);
    ready = true;
  } else {
    logger.log.info(IDLOG, 'emit event "' + EVT_RELOADED + '"');
    emitter.emit(EVT_RELOADED);
  }
  logger.log.info(IDLOG, 'configuration done by ' + CONFIG_FILEPATH);
}

/**
 * Starts the component.
 *
 * @method start
 */
async function start() {
  try {
    const list = await compDbconn.getAllTokens();
    list.forEach(token => {
      persistentTokens.set(token.user, token);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reset the component.
 *
 * @method reset
 * @static
 */
function reset() {
  try {
    clearInterval(intervalRemoveExpiredTokens);
    intervalRemoveExpiredTokens = null;
    persistentTokens.clear();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reload
 */
function reload() {
  try {
    reset();
    config(CONFIG_FILEPATH);
    initFreepbxAdminAuthentication();
    start();
    logger.log.warn(IDLOG, 'reloaded');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Initialize data used for freepbx admin authentication.
 *
 * @method initFreepbxAdminAuthentication
 */
function initFreepbxAdminAuthentication() {
  try {
    var SECRET_FILE_PATH = '/var/www/html/freepbx/wizard/scripts/custom.js';

    // get sha1 password of freepbx admin user from db
    compDbconn.getFpbxAdminSha1Pwd(function(err, resp) {
      try {
        if (err) {
          logger.log.warn(IDLOG, 'getting sha1 password of freepbx admin user for authentication');
          return;
        }
        if (resp === false) {
          logger.log.warn(IDLOG, 'sha1 password of freepbx admin user for authentication not found');
          return;
        }

        var sha1pwd = resp;
        var secret = '';

        // get admin secret from file
        if (!fs.existsSync(SECRET_FILE_PATH)) {
          logger.log.warn(IDLOG, 'getting admin secret for authentication: ' + SECRET_FILE_PATH + ' does not exist');
          return;
        }
        var data = fs.readFileSync(SECRET_FILE_PATH, 'utf8');
        data = data.split('\n');
        var i;
        for (i = 0; i < data.length; i++) {
          if (data[i].indexOf('SECRET_KEY:') !== -1) {
            data = data[i].trim();
            data = data.replace(/\s/g, '');
            data = data.split(':')[1];
            secret = data.substring(1, data.length - 1);
          }
        }

        // calculate the secret key
        fpbxAdminSecretKey = calculateAdminSecretKey('admin', sha1pwd, secret);
        logger.log.info(IDLOG, 'initialization of freepbx admin user authentication done');

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        return false;
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Checks if the unauthenticated asterisk call has been enabled by the JSON configuration file.
 *
 * @method isUnautheCallEnabled
 * @return {boolean} True if the unauthenticated asterisk call has been enabled.
 */
function isUnautheCallEnabled() {
  try {
    if (unauthenticatedCall === 'enabled') {
      return true;
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Checks if the source ip address is enabled for unauthenticated asterisk call.
 *
 * @method isUnautheCallIPEnabled
 * @param {string} sourceIp The source ip address to be tested
 * @return {boolean} True if the ip address is enabled for unauthenticated asterisk call.
 */
function isUnautheCallIPEnabled(sourceIp) {
  try {
    var i;
    for (i = 0; i < unauthenticatedCallAddress.length; i++) {
      if (unauthenticatedCallAddress[i].contains(sourceIp) === true) {
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Starts the removing of expired authentication tokens each interval of time. The interval time
 * is equal to the expiration time, because the tokens are updated each half of expiration time.
 *
 * @method startIntervalRemoveExpiredTokens
 * @private
 */
function startIntervalRemoveExpiredTokens() {
  try {
    logger.log.info(IDLOG, 'start remove expired tokens interval each ' + expires + ' msec');

    intervalRemoveExpiredTokens = setInterval(function() {
      try {
        var username, userTokens, tokenid;
        var currentTimestamp = (new Date()).getTime();

        // cycle in all users
        for (username in grants) {

          userTokens = grants[username]; // all user tokens

          // cycle in all tokens of the user
          for (tokenid in userTokens) {

            // check the token expiration
            if (currentTimestamp > userTokens[tokenid].expires) {

              logger.log.info(IDLOG, 'the token "' + tokenid + '" of user "' + username + '" has expired: remove it');
              removeToken(username, tokenid); // remove the token
            }
          }
        }
      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
      }
    }, expires);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Calculates the SHA1 secret key for freepbx admin user authentication.
 *
 * @method calculateAdminSecretKey
 * @param {string} username The username
 * @param {string} sha1Pwd The sha1 admin password
 * @param {string} secret The admin secret
 */
function calculateAdminSecretKey(username, sha1Pwd, secret) {
  try {
    if (typeof username !== 'string' ||
      typeof secret !== 'string' ||
      typeof sha1Pwd !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var tohash = username + sha1Pwd + secret;
    return crypto.createHash('sha1').update(tohash).digest('hex');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Calculates the HMAC-SHA1 token to be used in the authentication.
 *
 * @method calculateToken
 * @param {string} username The access key identifier, e.g. the username
 * @param {string} password The password of the account
 * @param {string} nonce    It is used to create the HMAC-SHA1 token
 */
function calculateToken(username, password, nonce) {
  try {
    // check parameters
    if (typeof username !== 'string' ||
      typeof nonce !== 'string' ||
      typeof password !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // generate token HMAC-SHA1
    var tohash = username + ':' + password + ':' + nonce;
    return crypto.createHmac('sha1', password).update(tohash).digest('hex');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the remote site name.
 *
 * @method getRemoteSiteName
 * @param  {string} username The access key identifier, e.g. the username
 * @param  {string} token       The authentication token
 * @return {string} The name of the remote site
 */
function getRemoteSiteName(username, token) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof token !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (grants[username] &&
      grants[username][token] &&
      grants[username][token].remoteSite === true &&
      typeof grants[username][token].siteName === 'string') {

      return grants[username][token].siteName;
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Creates an HMAC-SHA1 token to be used in the authentication and store it
 * into the private _grants_ object.
 *
 * @method newToken
 * @param {string}  username  The access key identifier, e.g. the username
 * @param {string}  password     The password of the account
 * @param {string}  nonce        It is used to create the HMAC-SHA1 token
 * @param {boolean} isRemoteSite True if the request is for a remote site
 * @private
 */
function newToken(username, password, nonce, isRemoteSite) {
  try {
    isRemoteSite = false;
    // check parameters
    if (typeof username !== 'string' || typeof nonce !== 'string' ||
      typeof password !== 'string' || typeof isRemoteSite !== 'boolean') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // generate token HMAC-SHA1
    var token = calculateToken(username, password, nonce);

    // store token
    if (!grants[username]) {
      grants[username] = {};
    }

    var newTokenObj = {
      nonce: nonce,
      token: token,
      expires: (new Date()).getTime() + expires,
      remoteSite: isRemoteSite
    };

    if (isRemoteSite) {
      var siteName;
      for (siteName in authRemoteSites) {
        if (authRemoteSites[siteName].username === username &&
          authRemoteSites[siteName].password === password) {

          newTokenObj.siteName = siteName;
          break;
        }
      }
    }
    grants[username][token] = newTokenObj;
    logger.log.info(IDLOG, 'new token has been generated for username ' + username);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Create the hash value of the token using SHA256 function.
 *
 * @method getHashToken
 * @param {string} token The token
 * @return {string} The SHA256 value of the token.
 * @private
 */
function getHashToken(token) {
  try {
    return crypto.createHash('sha256').update(token).digest('base64');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Creates a new persistent token.
 *
 * @method newPersistentToken
 * @param {string} username The username
 * @param {string} password The password of the account or a valid authentication token
 * @param {string} nonce It is used to create the HMAC-SHA1 token
 * @private
 */
async function newPersistentToken(username, password, nonce) {
  try {
    const token = calculateToken(username, password, nonce);
    const hashToken = getHashToken(token);
    const id = await compDbconn.saveAuthToken({ user: username, token: hashToken });
    const insToken = await compDbconn.getToken(id);
    persistentTokens.set(username, insToken[0]);
    logger.log.info(IDLOG, `created persistent token for user "${username}"`);
    return token
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Remove the persistent token of the user.
 *
 * @method removePersistentToken
 * @param  {string} username The access key
 * @param  {string} token The token
 * @param  {string} type The type of the persistent token
 * @return {boolean} True if the grant removing has been successful.
 */
async function removePersistentToken(username, token, type) {
  try {
    // check the parameters
    if (typeof username !== 'string' || typeof token !== 'string' || typeof type !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // delete the persistent token
    await compDbconn.deleteAuthToken({ user: username });
    persistentTokens.delete(username);
    logger.log.info(IDLOG, 'removed persistent token of type "' + type + '" for user ' + username);
    if (!persistentTokens.has(username)) {
      return true;
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Checks if the remote username has already been logged in.
 *
 * @method isRemoteSiteAlreadyLoggedIn
 * @param  {string}  username  The access key identifier, e.g. the username
 * @return {boolean} True if the remote username has been already logged in
 * @private
 */
function isRemoteSiteAlreadyLoggedIn(username) {
  try {
    // check parameter
    if (typeof username !== 'string') {
      throw new Error('wrong parameter');
    }

    var tk, user, tokens;
    for (user in grants) { // cycle all users
      if (user === username) {
        tokens = grants[user]; // all tokens of the user

        for (tk in tokens) { // cycle in all tokens
          if (tokens[tk].remoteSite === true) {
            // an authentication token for the specified user has been found,
            // so the remote site has already been logged in
            return true;
          }
        }
      }
    }
    // no token has been found, so the remote site has not been logged in
    return false;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Creates an SHA1 nonce to be used in the authentication.
 *
 * @method getNonce
 * @param  {string}  username The access key identifier used to create the token.
 * @param  {string}  password The password of the account
 * @param  {boolean} isRemoteSite True if the request is for a remote site
 * @return {string}  The SHA1 nonce.
 */
function getNonce(username, password, isRemoteSite) {
  try {
    isRemoteSite = false;
    // check parameters
    if (typeof username !== 'string' || typeof password !== 'string' || typeof isRemoteSite !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // generate SHA1 nonce
    var random = crypto.randomBytes(256) + (new Date()).getTime();
    var shasum = crypto.createHash('sha1');
    var nonce = shasum.update(random).digest('hex');

    // create new token
    newToken(username, password, nonce, isRemoteSite);

    logger.log.info(IDLOG, 'nonce has been generated for username ' + username);
    return nonce;

  } catch (err) {
    logger.log.error(err.stack);
  }
}

/**
 * Creates a nonce string
 *
 * @return A new nonce string
 */
function createNonce () {
  const random = crypto.randomBytes(256) + (new Date()).getTime();
  const shasum = crypto.createHash('sha1');
  return shasum.update(random).digest('hex');
}

/**
 * Creates an SHA1 nonce to be used in the authentication with persistent tokens.
 *
 * @method getNonceForPersistentToken
 * @param {string} username The username used to create the token.
 * @param {string} password The password of the account
 * @return {string} The SHA1 nonce.
 */
function getNonceForPersistentToken(username, password) {
  try {
    const nonce = createNonce();
    newPersistentToken(username, password, nonce);
    logger.log.info(IDLOG, `nonce for persistent token has been generated for user "${username}"`);
    return nonce;
  } catch (err) {
    logger.log.error(err.stack);
  }
}

/**
 * Creates a token valid for the authentication with persistent tokens.
 *
 * @method getPersistentToken
 * @param {string} username The username used to create the token.
 * @param {string} token A valid authentication token
 * @return {string} The SHA1 nonce.
 */
 async function getPersistentToken(username, token) {
  try {
    const nonce = createNonce();
    // Create the persistent token and save it's encrypted version to the db
    const newToken = await newPersistentToken(username, token, nonce);
    if (newToken) {
      logger.log.info(IDLOG, `nonce for persistent token has been generated for user "${username}"`);
      return newToken;
    } else {
      throw new Error('Error during persistent token creation');
    }
  } catch (err) {
    logger.log.error(err.stack);
  }
}

/**
 * Authenticate remote site using the credentials specified in the configuration file.
 *
 * @method authenticateRemoteSite
 * @param {string}   username The access key used to authenticate, e.g. the username
 * @param {string}   password    The password of the account
 * @param {string}   remoteIp    The remote ip address
 * @param {function} cb          The callback function
 */
function authenticateRemoteSite(username, password, remoteIp, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof remoteIp !== 'string' ||
      typeof password !== 'string' ||
      typeof username !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // authenticate remote site by credentials read from the file
    logger.log.info(IDLOG, 'authenticate remote site "' + username + '" "' + remoteIp + '" by credentials file');
    authRemoteSiteByFile(username, password, remoteIp, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Authenticate the "admin" user of FreePBX.
 *
 * @method authenticateFreepbxAdmin
 * @param {string} secretkey The secret key to be authenticated
 * @return {boolean} True if the authentication was successful
 */
function authenticateFreepbxAdmin(secretkey) {
  try {
    if (typeof secretkey !== 'string') {
      throw new Error('wrong parameter');
    }

    if (secretkey === fpbxAdminSecretKey) {
      return true;
    }
    return false;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Return admin secret key.
 *
 * @method getAdminSecretKey
 * @return {string} Return admin secret key.
 */
function getAdminSecretKey() {
  return fpbxAdminSecretKey;
}

/**
 * Authenticate the user using the choosen method in the configuration step.
 *
 * **It can throw an exception.**
 *
 * @method authenticate
 * @param {string}   username The access key used to authenticate, e.g. the username
 * @param {string}   password The password of the account
 * @param {function} cb       The callback function
 */
function authenticate(username, password, cb) {
  try {
    if (enabled === false) {
      cb();
      return;
    }
    if (typeof cb !== 'function' ||
      typeof password !== 'string' ||
      typeof username !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (authenticationType === AUTH_TYPE.pam) {
      logger.log.info(IDLOG, 'authenticating user "' + username + '" by pam');
      authByPam(username, password, cb);
    } else {
      logger.log.error(IDLOG, 'unknown authentication type "' + authenticationType + '"');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    throw err;
  }
}

/**
 * Authenticate the user by pam.
 *
 * @method authByPam
 * @param {string} username The access key used to authenticate, e.g. the username
 * @param {string} password The password of the account
 * @param {function} cb The callback function
 * @private
 */
function authByPam(username, password, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof password !== 'string' ||
      typeof username !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var child = childProcess.spawn(LDAP_SCRIPT_PATH, [username, password]);
    child.on('close', function(code, signal) {
      if (code !== 0) {
        cb({
          exitCode: code
        });
      } else {
        cb();
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb('pam authentication failed for user "' + username + '"');
  }
}

/**
 * Authenticate the remote site user by the credentials read from the file.
 *
 * @method authRemoteSiteByFile
 * @param {string}   username The access key used to authenticate, e.g. the username
 * @param {string}   password The password of the account
 * @param {string}   remoteIp The remote ip address
 * @param {function} cb       The callback function
 * @private
 */
function authRemoteSiteByFile(username, password, remoteIp, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' ||
      typeof remoteIp !== 'string' ||
      typeof password !== 'string' ||
      typeof username !== 'string') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var site;
    var authenticated = false;
    for (site in authRemoteSites) {
      if (authRemoteSites[site].username === username &&
        authRemoteSites[site].password === password &&
        authRemoteSites[site].allowed_ip.indexOf(remoteIp) > -1) {

        authenticated = true;
        break;
      }
    }
    if (authenticated) {
      logger.log.info(IDLOG, 'remote site "' + username + '" ' + remoteIp + ' has been authenticated successfully with file');
      cb(null);
    } else {
      var strerr = 'file authentication failed for remote site "' + username + '"';
      logger.log.warn(IDLOG, strerr);
      cb(strerr);
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb('file authentication failed for remote site "' + username + '"');
  }
}

/**
 * Removes the grant for an access key.
 *
 * @method removeToken
 * @param  {string} username The access key
 * @param  {string} token The token
 * @return {boolean} True if the grant removing has been successful.
 */
function removeToken(username, token) {
  try {
    // check the parameters
    if (typeof username !== 'string' || typeof token !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check the grant presence
    var key;
    for (key in grants) {
      if (key === username) {
        delete grants[key][token];
        logger.log.info(IDLOG, 'removed token "' + token + '" for username ' + key);
      }
      if (Object.keys(grants[key]).length === 0) {
        delete grants[key];
      }
    }

    if (grants[username] === undefined || grants[username][token] === undefined) {
      return true;
    }
    return false;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Update the expiration of the token relative to the access key.
 *
 * @method updateTokenExpires
 * @param {string} username The access key relative to the token to be updated
 * @param {string} token       The access token
 */
function updateTokenExpires(username, token) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof token !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check grants presence
    if (!grants[username]) {
      logger.log.warn(IDLOG, 'update token expiration "' + token + '" failed: no grants for username ' + username);
      return;
    }

    // check token presence
    if (!grants[username][token]) {
      logger.log.warn(IDLOG, 'update token expiration "' + token + '" failed: token is not present for username ' + username);
      return;
    }

    grants[username][token].expires = (new Date()).getTime() + expires;
    logger.log.info(IDLOG, 'token expiration "' + token + '" has been updated for username ' + username);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check if the automatic update of token expiration is active for each
 * authentication request.
 *
 * @method isAutoUpdateTokenExpires
 * @return {boolean} True if the automatic update is active.
 */
function isAutoUpdateTokenExpires() {
  try {
    return autoUpdateTokenExpires;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check token inside persistent tokens.
 *
 * @method inPersistentTokens
 * @param {string} username The username used to retrieve the token
 * @param {string} token The token to be checked
 * @return {boolean} True if the token is present inside persistent tokens.
 * @private
 */
 function inPersistentTokens(username, token) {
  try {
    const hashToken = getHashToken(token);
    // Check the base persistent token
    if (persistentTokens.has(username)) {
      const pToken = persistentTokens.get(username).token;
      // Compare the given encrypted token with the persistent token
      if (pToken === hashToken) {
        return true;
      }
    }
    // Check the api persistent token
    if (persistentTokens.has(`${username}_phone-island`)) {
      const pTokenApi = persistentTokens.get(`${username}_phone-island`).token;
      // Compare the given encrypted token with the api persistent token
      if (pTokenApi === hashToken) {
        return true;
      }
    }
    // Return false if there aren't matching tokens
    return false
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Check if persistent token exists.
 *
 * @method persistentTokenExists
 * @param {string} username The username used to retrieve the token
 * @return {boolean} True if the token is present inside persistent tokens.
 * @private
 */
function persistentTokenExists(username) {
  try {
    if (persistentTokens.has(username)) {
      return true;
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Authenticates the user through checking the token with the one
 * that must be present in the _grants_ object. The _getNonce_ method
 * must be used before this.
 *
 * @method verifyToken
 * @param  {string}  username The access key used to retrieve the token
 * @param  {string}  token    The token to be checked
 * @param  {boolean} isRemote True if the token belongs to a remote site
 * @return {boolean} True if the user has been authenticated succesfully.
 */
function verifyToken(username, token, isRemote) {
  try {
    if (enabled === false) {
      return true;
    }
    isRemote = false;
    // check parameters
    if (typeof username !== 'string' || typeof token !== 'string' || typeof isRemote !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the grant presence
    if (!grants[username] && !persistentTokens.has(username) && !persistentTokens.has(`${username}_phone-island`)) {
      logger.log.warn(IDLOG, 'authentication failed for ' + (isRemote ? 'remote site ' : 'local ') + 'username: "' + username + '": no grant is present');
      return false;
    }

    // check if the user has the token
    const userTokens = grants[username] || []; // all token of the user
    if ((!userTokens[token] || (userTokens[token] && userTokens[token].remoteSite !== isRemote)) &&
      !inPersistentTokens(username, token)) {

      logger.log.warn(IDLOG, 'authentication failed for ' + (isRemote ? 'remote site ' : 'local ') + 'username "' + username + '": wrong token');
      return false;
    }

    // check the token expiration when not persistent token
    if (userTokens[token] && (new Date()).getTime() > userTokens[token].expires) {
      removeToken(username, token); // remove the token
      logger.log.info(IDLOG, 'the token "' + token + '" has expired for ' + (isRemote ? 'remote site ' : 'local ') + 'username ' + username);
      return false;
    }

    // check whether update token expiration value when not persistent token
    if (userTokens[token] && autoUpdateTokenExpires) {
      updateTokenExpires(username, token);
    }

    // authentication successfull
    logger.log.info(IDLOG, (isRemote ? 'remote site ' : 'local ') + 'username "' + username + '" has been successfully authenticated with token "' + token + '"');
    return true;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Returns the token expiration timeout.
 *
 * @method getTokenExpirationTimeout
 * @return {number} The token expiration timeout in milliseconds.
 */
function getTokenExpirationTimeout() {
  try {
    return expires;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Subscribe a callback function to a custom event fired by this object.
 * It's the same of nodejs _events.EventEmitter.on._
 *
 * @method on
 * @param  {string}   type The name of the event
 * @param  {function} cb   The callback to execute in response to the event
 * @return {object}   A subscription handle capable of detaching that subscription.
 */
function on(type, cb) {
  try {
    return emitter.on(type, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Add a map between shibboleth username and the corresponding
 * cookie id used for authentication.
 *
 * @method addShibbolethMap
 * @param {string} cookieId The cookie identifier
 * @param {string} username The username
 */
function addShibbolethMap(cookieId, username) {
  try {
    mapShibbolethUser[cookieId] = username;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Remove a map between shibboleth username and the corresponding
 * cookie id used for authentication.
 *
 * @method removeShibbolethMap
 * @param {string} cookieId The cookie identifier
 */
function removeShibbolethMap(cookieId) {
  try {
    if (mapShibbolethUser[cookieId]) {
      delete mapShibbolethUser[cookieId];
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return the username corresponding to a cookie identifier.
 *
 * @method getShibbolethUsername
 * @param {string} cookieId The cookie identifier
 * @return {string} The username.
 */
function getShibbolethUsername(cookieId) {
  try {
    return mapShibbolethUser[cookieId];
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check if the provided username corresponding to a shibboleth user.
 *
 * @method isShibbolethUser
 * @param {string} username The username
 * @return {boolean} True if the username is a shibboleth user.
 */
function isShibbolethUser(username) {
  try {
    if (typeof mapShibbolethUser[username] === 'string' && mapShibbolethUser[username] !== '') {
      return true;
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

// public interface
exports.on = on;
exports.start = start;
exports.config = config;
exports.reload = reload;
exports.getNonce = getNonce;
exports.setLogger = setLogger;
exports.verifyToken = verifyToken;
exports.removeToken = removeToken;
exports.authenticate = authenticate;
exports.EVT_RELOADED = EVT_RELOADED;
exports.setCompDbconn = setCompDbconn;
exports.EVT_COMP_READY = EVT_COMP_READY;
exports.calculateToken = calculateToken;
exports.addShibbolethMap = addShibbolethMap;
exports.isShibbolethUser = isShibbolethUser;
exports.getRemoteSiteName = getRemoteSiteName;
exports.getAdminSecretKey = getAdminSecretKey;
exports.getPersistentToken = getPersistentToken;
exports.updateTokenExpires = updateTokenExpires;
exports.removeShibbolethMap = removeShibbolethMap;
exports.isUnautheCallEnabled = isUnautheCallEnabled;
exports.removePersistentToken = removePersistentToken;
exports.persistentTokenExists = persistentTokenExists;
exports.getShibbolethUsername = getShibbolethUsername;
exports.isUnautheCallIPEnabled = isUnautheCallIPEnabled;
exports.authenticateRemoteSite = authenticateRemoteSite;
exports.isAutoUpdateTokenExpires = isAutoUpdateTokenExpires;
exports.authenticateFreepbxAdmin = authenticateFreepbxAdmin;
exports.getTokenExpirationTimeout = getTokenExpirationTimeout;
exports.getNonceForPersistentToken = getNonceForPersistentToken;
exports.configRemoteAuthentications = configRemoteAuthentications;
exports.isRemoteSiteAlreadyLoggedIn = isRemoteSiteAlreadyLoggedIn;
exports.initFreepbxAdminAuthentication = initFreepbxAdminAuthentication;
