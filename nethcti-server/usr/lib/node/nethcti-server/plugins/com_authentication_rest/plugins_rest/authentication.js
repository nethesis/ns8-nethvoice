/**
 * Provides authentication functions through REST API.
 *
 * @module com_authentication_rest
 * @submodule plugins_rest
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins_rest/authentication]
 */
var IDLOG = '[plugins_rest/authentication]';

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
 * The authentication architect component used for authentication.
 *
 * @property compAuthe
 * @type object
 * @private
 */
var compAuthe;

/**
 * The authorization architect component used for authentication.
 *
 * @property compAutho
 * @type object
 * @private
 */
var compAutho;

/**
 * The utility architect component.
 *
 * @property compUtil
 * @type object
 * @private
 */
var compUtil;

/**
 * The user architect component.
 *
 * @property compUser
 * @type object
 * @private
 */
var compUser;

/**
 * The asterisk proxy component used for asterisk functions.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * Set the logger to be used.
 *
 * @method setLogger
 * @param {object} log The logger object. It must have at least
 *                     three methods: _info, warn and error_ as console object.
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
 * Set the authentication architect component used by authentication.
 *
 * @method setCompAuthentication
 * @param {object} ca The authentication architect component _arch\_authentication_.
 */
function setCompAuthentication(ca) {
  try {
    compAuthe = ca;
    logger.log.info(IDLOG, 'set authentication architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the authorization architect component used by authentication.
 *
 * @method setCompAuthorization
 * @param {object} comp The authorization architect component _arch\_authentication_.
 */
function setCompAuthorization(comp) {
  try {
    compAutho = comp;
    logger.log.info(IDLOG, 'set authorization architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the asterisk proxy component used for asterisk functions.
 *
 * @method setCompAstProxy
 * @param {object} comp The asterisk proxy component.
 */
function setCompAstProxy(comp) {
  try {
    compAstProxy = comp;
    logger.log.info(IDLOG, 'set asterisk proxy architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the utility architect component.
 *
 * @method setCompUtil
 * @param {object} comp The utility architect component.
 */
function setCompUtil(comp) {
  try {
    compUtil = comp;
    logger.log.info(IDLOG, 'set util architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the user architect component.
 *
 * @method setCompUser
 * @param {object} comp The user architect component.
 */
function setCompUser(comp) {
  try {
    compUser = comp;
    logger.log.info(IDLOG, 'set user architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

(function() {
  try {
    /**
     * REST plugin that provides authentication functions through the following REST API:
     *
     * # POST requests
     *
     * 1. [`authentication/login`](#loginpost)
     * 1. [`authentication/logout`](#logoutpost)
     *
     * ---
     *
     * ### <a id="loginpost">**`authentication/login`**</a>
     *
     * Authenticates a local client. If the user is successfully authenticated, he receives
     * an HTTP 401 response with an _nonce_ in the WWW-Authenticate header. The _nonce_ is a
     * string and it is used by the client to construct the token for the next authentications.
     * The request must contains the following parameters:
     *
     * * `username`
     * * `password`
     *
     * Example JSON request parameters:
     *
     *     { "username": "alessandro", "password": "somepwd" }
     *
     * Example of a response of a successful login:
     *
     *     Connection:close
     Content-Length:0
     Content-Type:text/plain; charset=UTF-8
     Date:Wed, 11 Jun 2014 14:14:18 GMT
     www-authenticate:Digest a4b888b2d096249ce5b5ad63413842d5df335f17
     *
     * where the nonce is the string _a4b888b2d096249ce5b5ad63413842d5df335f17_.
     *
     * ---
     *
     * ### <a id="logoutpost">**`authentication/logout`**</a>
     *
     * Logout the user.
     *
     * @class plugin_rest_authentication
     * @static
     */
    var authentication = {

      // the REST api
      api: {
        'root': 'authentication',
        'get': [
          'phone_island_token_check'
        ],

        /**
         * REST API to be requested using HTTP POST request.
         *
         * @property post
         * @type {array}
         *
         * @param {string} login Authenticate a local client with username and password and if it goes well
         *                       the client receive an HTTP 401 response with _nonce_ in
         *                       WWW-Authenticate header. The nonce is used to construct the
         *                       token used in the next authentications.
         *
         * @param {string} remotelogin Authenticate a remote site with username and password and if it goes well
         *                             the client receive an HTTP 401 response with _nonce_ in
         *                             WWW-Authenticate header. The nonce is used to construct the
         *                             token used in the next authentications.
         *
         * @param {string} logout Logout
         */
        'post': [
          'login',
          'remotelogin',
          'logout',
          'phone_island_token_login',
          'persistent_token_remove'
        ],
        'head': [],
        'del': []
      },

      /**
       * Provides the login function with the following REST API:
       *
       *     login
       *
       * @method login
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      login: function(req, res, next) {
        try {
          var useShibboleth = false;
          // check if shibboleth headers are present
          if (req.headers.shibrealm &&
            req.headers.shibuid &&
            req.headers.shibsn &&
            req.headers.shibcn &&
            req.headers.shibo &&
            req.headers.shibmail &&
            req.headers.cookie && req.headers.cookie.indexOf('_shibsession_') !== -1 &&
            req.headers.shibdisplayname) {

            req.params.username = req.headers.shibuid;
            useShibboleth = true;
            logger.log.info(IDLOG, 'user supplied shibboleth headers to login: corresponding username is "' + req.params.username + '"');
          }
          // username can be a real username or an extension number. This is because
          // the user can do the login with his username or with the main extension number
          var username = req.params.username;
          var password = req.params.password;

          if (!username || !password) {
            logger.log.warn(IDLOG, 'username or password has not been specified');
            compUtil.net.sendHttp401(IDLOG, res);
            return;
          }
          // check if the user component has been configured (after asterisk ready status)
          if (compUser.isConfigured() === false) {
            var errmsg = 'service not ready: user component not configured - possible asterisk delay';
            logger.log.warn(IDLOG, errmsg);
            compUtil.net.sendHttp503(IDLOG, res, errmsg);
            return;
          }
          // check if user tryed to login using main extension instead of username
          var extension;
          if (!compUser.isUserPresent(username) && compAstProxy.isExten(username)) {
            extension = username;
            username = compUser.getUserUsingEndpointExtension(username);
            logger.log.info(IDLOG, 'user supplied an extension number to login: "' + extension + '". Corresponding username is "' + username + '"');
          }

          // get username without "@domain" if it is present
          var clUser = username.indexOf('@') !== -1 ? username.substring(0, username.lastIndexOf('@')) : username;

          if (!compUser.isUserPresent(clUser) || compAutho.userHasProfile(clUser) === false) {
            var errmsg = 'user ' + clUser + ' is not configured';
            logger.log.warn(IDLOG, errmsg);
            compUtil.net.sendHttp401(IDLOG, res, errmsg, '1');
            return;
          }
          compAuthe.authenticate(username, password, function(err) {
            try {
              if (err) {
                logger.log.warn(IDLOG, 'authentication failed for user "' + username + '"');
                compUtil.net.sendHttp401(IDLOG, res);
                return;
              } else {
                if (useShibboleth === true) {
                  res.header('shibcookie', req.headers.cookie);
                  compAuthe.addShibbolethMap(req.headers.cookie, username);
                }
                logger.log.info(IDLOG, 'user "' + username + '" successfully authenticated');
                var authExpiration = req.headers["auth-exp"];
                if (authExpiration === "no-exp") {
                  var nonce = compAuthe.getNonceForPersistentToken((extension ? extension : username), password);
                } else {
                  var nonce = compAuthe.getNonce((useShibboleth ? req.headers.cookie : extension ? extension : username), password, false);
                }
                compUtil.net.sendHttp401Nonce(IDLOG, res, nonce);
              }
            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              compUtil.net.sendHttp401(IDLOG, res);
            }
          });
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp401(IDLOG, res);
        }
      },

      /**
       * Provides the login function for the phone island with the following REST API:
       *
       *     phone_island_token_login
       *
       * Every user with a valid token can invoke it and receive an API token without expiration
       * There is only a persistent phone island token for each user
       *
       * @method phone_island_token_login
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @return The token without expiration and the username
       */
       phone_island_token_login: async function(req, res) {
        try {

          // Get the username from the headers
          const username = req.headers.authorization_user;
          // Get the valid token from the request
          // The token validity is checked inside the authorization proxy
          const authToken = req.headers.authorization_token;

          // Add _phone-island to the end of api username tokens
          const apiUsername = `${username}_phone-island`;

          // Create the persistent token using username and a valid authentication token
          const apiToken = await compAuthe.getPersistentToken(apiUsername, authToken);
          // Return the token ready to be used by api's and ws
          res.send(200, {
            token: apiToken,
            username: username
          });

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp401(IDLOG, err);
        }
      },

      /**
       * Checks if the phone island token was already created REST API:
       *
       *     phone_island_token_check
       *
       * @method phone_island_token_check
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @return An object containing a boolean exists property
       */
       phone_island_token_check: async function(req, res) {
        try {

          // Get the username from the headers
          const username = req.headers.authorization_user;

          // Add _phone-island to the end of api username tokens
          const islandUsername = `${username}_phone-island`;

          // Check if the persistent token exists
          const exists = await compAuthe.persistentTokenExists(islandUsername);
          // Return the true if exists or false
          res.send(200, {
            exists: exists,
          });

        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp401(IDLOG, err);
        }
      },

      /**
       * Provides the api to revoke a persistent token
       * 
       *    persistent_token_remove
       * 
       * @param {object} req The client request
       * @param {object} res The client response
       */
      persistent_token_remove: async function(req, res) {
        try {
          // Check parameters
          if (req.params.type !== 'phone-island' && req.params.type !== 'no-exp') {
            throw new Error('wrong parameters: ' + JSON.stringify(arguments));
          }

          // Get the username from the headers
          const username = req.headers.authorization_user;
          // Get the token from the headers
          const token = req.headers.authorization_token;

          // Init target username to be revoked
          let userToRevoke = '';

          // Set target username to be revoked
          if (req.params.type === 'phone-island') {
            userToRevoke = `${username}_phone-island`;
          } else if (req.params.type === 'no-exp') {
            userToRevoke = username;
          }
          // Remove the persistent token using the username
          const removed = await compAuthe.removePersistentToken(userToRevoke, token, req.params.type);

          if (removed) {
            // Return the token ready to be used by api's and ws
            res.send(200, {});
          } else {
            throw new Error(`persistent token of type ${req.params.type} not removed for user: ${username}`);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp401(IDLOG, err);
        }
      },

      /**
       * Provides the logout function with the following REST API:
       *
       *     logout
       *
       * @method logout
       * @param {object}   req  The client request
       * @param {object}   res  The client response
       * @param {function} next Function to run the next handler in the chain
       */
      logout: async function(req, res, next) {
        try {
          var token = req.headers.authorization_token;
          var username = req.headers.authorization_user;
          var authExpiration = req.headers["auth-exp"];
          var isLoggedOut = (authExpiration === "no-exp") ? (await compAuthe.removePersistentToken(username, token, 'no-exp') === true) : (compAuthe.removeToken(username, token) === true);
          if (isLoggedOut) {
            logger.log.info(IDLOG, 'user "' + username + '" successfully logged out');
            compUtil.net.sendHttp200(IDLOG, res);
          } else {
            var str = 'during logout user "' + username + '": removing grant';
            logger.log.warn(IDLOG, str);
            compUtil.net.sendHttp500(IDLOG, res, str);
          }
        } catch (err) {
          logger.log.error(IDLOG, err.stack);
          compUtil.net.sendHttp500(IDLOG, res, err.toString());
        }
      }
    };

    exports.api = authentication.api;
    exports.login = authentication.login;
    exports.logout = authentication.logout;
    exports.phone_island_token_login = authentication.phone_island_token_login;
    exports.persistent_token_remove = authentication.persistent_token_remove;
    exports.phone_island_token_check = authentication.phone_island_token_check;
    exports.setLogger = setLogger;
    exports.setCompUtil = setCompUtil;
    exports.setCompUser = setCompUser;
    exports.setCompAstProxy = setCompAstProxy;
    exports.setCompAuthorization = setCompAuthorization;
    exports.setCompAuthentication = setCompAuthentication;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
})();
