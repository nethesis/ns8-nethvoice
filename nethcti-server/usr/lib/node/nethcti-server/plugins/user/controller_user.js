/**
 * Provides the user functions.
 *
 * @module user
 * @main controller_user
 */

/**
 * Provides the user functionalities.
 *
 * @class controller_user
 * @static
 */
var fs = require('fs');
var User = require('./user').User;
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var userPresence = require('./user_presence');
var userMainPresence = require('./user_main_presence');
var endpointTypes = require('./endpoint_types');
const endpointExtension = require('./endpointExtension');

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [controller_user]
 */
var IDLOG = '[controller_user]';

/**
 * The configuration file path of the users.
 *
 * @property USERS_CONF_FILEPATH
 * @type string
 * @private
 */
var USERS_CONF_FILEPATH;

/**
 * The configuration file path of the ROB users permissions.
 *
 * @property ROB_CONF_FILEPATH
 * @type string
 * @private
 */
 var ROB_CONF_FILEPATH;

/**
 * Fired when the creation of the _User_ objects is completed.
 *
 * @event usersReady
 */
/**
 * The name of the users ready event.
 *
 * @property EVT_USERS_READY
 * @type string
 * @default "usersReady"
 */
var EVT_USERS_READY = 'usersReady';

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
 * Fired when the client user has changed his own avatar picture.
 *
 * @event userProfileAvatarChanged
 */
/**
 * The name of the user profile avatar update event.
 *
 * @property EVT_USER_PROFILE_AVATAR_CHANGED
 * @type string
 * @default "userProfileAvatarUpdate"
 */
var EVT_USER_PROFILE_AVATAR_CHANGED = 'userProfileAvatarChanged';

/**
 * Fired when the user presence has changed.
 *
 * @event userPresenceChanged
 */
/**
 * The name of the user presence changed event.
 *
 * @property EVT_USER_PRESENCE_CHANGED
 * @type string
 * @default "userPresenceChanged"
 */
var EVT_USER_PRESENCE_CHANGED = 'userPresenceChanged';

/**
 * Fired when the main user presence has changed.
 *
 * @event userMainPresenceChanged
 */
/**
 * The name of the user presence changed event.
 *
 * @property EVT_USER_MAIN_PRESENCE_CHANGED
 * @type string
 * @default "userMainPresenceChanged"
 */
 var EVT_USER_MAIN_PRESENCE_CHANGED = 'userMainPresenceChanged';

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
 * True during component reloading.
 *
 * @property reloading
 * @type boolean
 * @private
 * @default false
 */
var reloading = false;

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
 * The dbconn architect component.
 *
 * @property compDbconn
 * @type object
 * @private
 */
var compDbconn;

/**
 * The asterisk proxy architect component.
 *
 * @property compAstProxy
 * @type object
 * @private
 */
var compAstProxy;

/**
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * The list of the user objects. The keys is the user identification
 * and the value is a _User_ object.
 *
 * @property users
 * @type {object}
 * @private
 * @default {}
 */
var users = {};

/**
 * The configuration status.
 *
 * @property configured
 * @type {boolean}
 * @private
 * @default false
 */
var configured = false;

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
    if (typeof log === 'object') {
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
 * Set the dbconn architect component.
 *
 * @method setCompDbconn
 * @param {object} comp The dbconn architect component.
 */
function setCompDbconn(comp) {
  try {
    compDbconn = comp;
    logger.log.info(IDLOG, 'set dbconn architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the asterisk proxy architect component.
 *
 * @method setCompAstProxy
 * @param {object} comp The asterisk proxy architect component.
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
 * Initialize the users by file. The file must use the JSON syntax and
 * must report user/endpoint associations and authorization data.
 *
 * **Emits _"users\_ready"_ event when the user creation is completed.**
 *
 * @method config
 * @param {string} path The path of the JSON file with the user/endpoints associations and the authorization data
 * @param {string} ROBPath The path of the JSON file with the user/recallonbusy permissions
 * @private
 */
function config(path, ROBPath) {
  try {
    if (typeof path !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }
    USERS_CONF_FILEPATH = path;
    ROB_CONF_FILEPATH = ROBPath;

    // read JSON file with the user/endpoint associations
    var json = JSON.parse(fs.readFileSync(USERS_CONF_FILEPATH, 'utf8'));
    // lower case all usernames used as keys
    var tmp, userid;
    for (userid in json) {
      tmp = json[userid];
      delete json[userid];
      json[userid.toLowerCase()] = tmp;
    }
    // initialize user objects
    var newuser;
    for (userid in json) { // cycle users
      // add new user in memory
      newuser = new User(userid, json[userid].name);
      users[userid] = newuser;
      logger.log.info(IDLOG, 'new user "' + newuser.getUsername() + '" has been created');
    }
    logger.log.info(IDLOG, Object.keys(users).length + ' users has been created');

    // set endpoints to the users
    initializeEndpointsUsersByJSON(json);
    // set user presence
    initializeUsersPresence();
    // set users mainPresence
    initializeUsersMainPresence();
    // set users's ROB permission status
    initializeUsersRecallOnBusy(ROBPath);
    // set the association between extensions and usernames
    setExtensionsUsernameAssociation();

    if (!ready) {
      // initialize asterisk proxy listeners
      initializeAstProxyListeners();
      // emit the event for tell to other modules that the user objects are ready
      logger.log.info(IDLOG, 'emit event "' + EVT_USERS_READY + '"');
      emitter.emit(EVT_USERS_READY);
      ready = true;
    } else {
      logger.log.info(IDLOG, 'emit event "' + EVT_RELOADED + '"');
      emitter.emit(EVT_RELOADED);
      reloading = false;
    }
    configured = true;
    logger.log.info(IDLOG, 'configuration done by ' + USERS_CONF_FILEPATH);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the association between extensions and usernames.
 *
 * @method setExtensionsUsernameAssociation
 * @private
 */
function setExtensionsUsernameAssociation() {
  try {
    let userExtens;
    let assoc = {};
    for (let u in users) {
      userExtens = getAllEndpointsExtension(u);
      for (let e in userExtens) {
        assoc[e] = u;
      }
    }
    compAstProxy.setAllExtensionsUsername(assoc);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reset the component.
 *
 * @method reset
 * @private
 */
function reset() {
  try {
    for (let u in users) {
      delete users[u];
    }
    users = undefined;
    users = {};
    logger.log.info(IDLOG, 'reset');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reload
 * @private
 */
function reload() {
  try {
    reloading = true;
    reset();
    config(USERS_CONF_FILEPATH, ROB_CONF_FILEPATH);
    logger.log.warn(IDLOG, 'reloaded');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenDndChanged_ event emitted by _astproxy_ component.
 * This event is generated from asterisk and so it could be generated from physical
 * phone dnd setting using freepbx features code (*78 to enable and *79 to disable).
 * If the event is dnd off, it check for all extensions of the user and disable dnd
 * for each of them. If the event is dnd on and it does not involve the main extension,
 * it enbales dnd for the main extension of the user.
 *
 * @method evtExtenDndChanged
 * @param {object} data The data received by the event
 * @private
 */
function evtExtenDndChanged(data) {
  try {
    if (typeof data !== 'object' || typeof data.exten !== 'string' || typeof data.enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received "' + compAstProxy.EVT_EXTEN_DND_CHANGED + '" event for exten "' + data.exten + '"');

    var i, e;
    var username = getUserFromExten(data.exten);
    var allext = getAllUserExtensions(username);
    var mainExtId = getEndpointMainExtension(username).getId();

    // dnd off
    if (data.enabled === false) {

      // dnd has been removed, so check if it is disabled from all extensions of the user.
      // If it is not, it disable dnd on all extensions of the user
      for (i = 0; i < allext.length; i++) {

        if (compAstProxy.isExtenDnd(allext[i])) {

          compAstProxy.setDnd(allext[i], false, function(err) {
            if (err) {
              logger.log.error(IDLOG, 'disabling dnd of extension "' + allext[i] + '"');
            } else {
              logger.log.info(IDLOG, 'disabled dnd of extension "' + allext[i] + '"');
            }
            updateUserPresence(username);
          });

        }
      }
    } else if (data.enabled === true && !isMainExtension(data.exten)) {

      // dnd has been activated in a seconday extension of a user, so enable it on main extension
      if (!compAstProxy.isExtenDnd(mainExtId)) {

        compAstProxy.setDnd(mainExtId, true, function(err) {
          if (err) {
            logger.log.error(IDLOG, 'enabling dnd of main extension "' + e + '"');
          } else {
            logger.log.info(IDLOG, 'enabled dnd of main extension "' + e + '"');
          }
          updateUserPresence(username);
        });

      }
    }
    updateUserPresence(username);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenCfChanged_ event emitted by _astproxy_ component.
 * This event is generated from asterisk and so it could be generated from physical
 * phone dnd setting using freepbx features code (*72<DEST> to enable and *73 to disable).
 * If the event is cf off, it check for all extensions of the user and disable cf
 * for each of them. If the event is cf on and it does not involve the main extension,
 * it enbales cf for the main extension of the user.
 *
 * @method evtExtenCfChanged
 * @param {object} data The data received by the event
 * @private
 */
function evtExtenCfChanged(data) {
  try {
    if (typeof data !== 'object' || typeof data.exten !== 'string' || typeof data.enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received "' + compAstProxy.EVT_EXTEN_CF_CHANGED + '" event for exten "' + data.exten + '"');

    var i, e;
    var username = getUserFromExten(data.exten);
    var allext = getAllUserExtensions(username);
    var mainExtId = getEndpointMainExtension(username).getId();

    // cf off
    if (data.enabled === false) {

      // cf has been removed, so check if it is disabled from all extensions of the user.
      // If it is not, it disable cf on all extensions of the user
      for (i = 0; i < allext.length; i++) {

        if (compAstProxy.isExtenCf(allext[i])) {

          compAstProxy.setUnconditionalCf(allext[i], false, null, function(err) {
            if (err) {
              logger.log.error(IDLOG, 'disabling cf of extension "' + allext[i] + '"');
            } else {
              logger.log.info(IDLOG, 'disabled cf of extension "' + allext[i] + '"');
            }
            updateUserPresence(username);
          });

        }
      }
    } else if (data.enabled === true && !isMainExtension(data.exten)) {

      // cf has been activated in a seconday extension of a user, so enable it on main extension
      if (!compAstProxy.isExtenCf(mainExtId)) {

        compAstProxy.setUnconditionalCf(mainExtId, true, data.to, function(err) {
          if (err) {
            logger.log.error(IDLOG, 'enabling cf of main extension "' + e + '" to "' + data.to + '"');
          } else {
            logger.log.info(IDLOG, 'enabled cf of main extension "' + e + '" to "' + data.to + '"');
          }
          updateUserPresence(username);
        });

      }
    }
    updateUserPresence(username);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenCfbChanged_ event emitted by _astproxy_ component.
 * This event is generated from asterisk and so it could be generated from physical
 * phone using freepbx features code (*90<DEST> to enable and *91 to disable).
 * If the event is cfb off, it check for all extensions of the user and disable cfb
 * for each of them. If the event is cfb on and it does not involve the main extension,
 * it enbales cfb for the main extension of the user.
 *
 * @method evtExtenCfbChanged
 * @param {object} data The data received by the event
 * @private
 */
function evtExtenCfbChanged(data) {
  try {
    if (typeof data !== 'object' ||
      typeof data.exten !== 'string' ||
      typeof data.enabled !== 'boolean') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received "' + compAstProxy.EVT_EXTEN_CFB_CHANGED + '" event for exten "' + data.exten + '"');

    var i, e;
    var username = getUserFromExten(data.exten);
    var allext = getAllUserExtensions(username);
    var mainExtId = getEndpointMainExtension(username).getId();

    // cfb off
    if (data.enabled === false) {

      // cfb has been removed, so check if it is disabled from all extensions of the user.
      // If it is not, it disable cfb on all extensions of the user
      for (i = 0; i < allext.length; i++) {

        if (compAstProxy.isExtenCfb(allext[i])) {

          compAstProxy.setCfb(allext[i], false, null, function(err) {
            if (err) {
              logger.log.error(IDLOG, 'disabling cfb of extension "' + allext[i] + '"');
            } else {
              logger.log.info(IDLOG, 'disabled cfb of extension "' + allext[i] + '"');
            }
            updateCondUserPresence(username);
          });
        }
      }
    } else if (data.enabled === true && !isMainExtension(data.exten)) {

      // cfb has been activated in a seconday extension of a user, so enable it on main extension
      if (!compAstProxy.isExtenCfb(mainExtId)) {

        compAstProxy.setCfb(mainExtId, true, data.to, function(err) {
          if (err) {
            logger.log.error(IDLOG, 'enabling cfb of main extension "' + e + '" to "' + data.to + '"');
          } else {
            logger.log.info(IDLOG, 'enabled cfb of main extension "' + e + '" to "' + data.to + '"');
          }
          updateCondUserPresence(username);
        });
      }
    }
    updateCondUserPresence(username);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenCfuChanged_ event emitted by _astproxy_ component.
 * This event is generated from asterisk and so it could be generated from physical
 * phone using freepbx features code (*52<DEST> to enable and *53 to disable).
 * If the event is cfu off, it check for all extensions of the user and disable cfu
 * for each of them. If the event is cfu on and it does not involve the main extension,
 * it enbales cfu for the main extension of the user.
 *
 * @method evtExtenCfuChanged
 * @param {object} data The data received by the event
 * @private
 */
function evtExtenCfuChanged(data) {
  try {
    if (typeof data !== 'object' ||
      typeof data.exten !== 'string' ||
      typeof data.enabled !== 'boolean') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received "' + compAstProxy.EVT_EXTEN_CFU_CHANGED + '" event for exten "' + data.exten + '"');

    var i, e;
    var username = getUserFromExten(data.exten);
    var allext = getAllUserExtensions(username);
    var mainExtId = getEndpointMainExtension(username).getId();

    // cfu off
    if (data.enabled === false) {

      // cfu has been removed, so check if it is disabled from all extensions of the user.
      // If it is not, it disable cfu on all extensions of the user
      for (i = 0; i < allext.length; i++) {

        if (compAstProxy.isExtenCfu(allext[i])) {

          compAstProxy.setCfu(allext[i], false, null, function(err) {
            if (err) {
              logger.log.error(IDLOG, 'disabling cfu of extension "' + allext[i] + '"');
            } else {
              logger.log.info(IDLOG, 'disabled cfu of extension "' + allext[i] + '"');
            }
            updateCondUserPresence(username);
          });
        }
      }
    } else if (data.enabled === true && !isMainExtension(data.exten)) {

      // cfu has been activated in a seconday extension of a user, so enable it on main extension
      if (!compAstProxy.isExtenCfu(mainExtId)) {

        compAstProxy.setCfu(mainExtId, true, data.to, function(err) {
          if (err) {
            logger.log.error(IDLOG, 'enabling cfu of main extension "' + e + '" to "' + data.to + '"');
          } else {
            logger.log.info(IDLOG, 'enabled cfu of main extension "' + e + '" to "' + data.to + '"');
          }
          updateCondUserPresence(username);
        });
      }
    }
    updateCondUserPresence(username);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Handler for the _extenCfVmChanged_ event emitted by _astproxy_ component.
 * This event is generated from asterisk and so it could be generated from physical
 * phone dnd setting using freepbx features code (*72vmu<DEST> to enable and *73 to disable).
 * If the event is cfvm off, it check for all extensions of the user and disable cfvm
 * for each of them. If the event is cfvm on and it does not involve the main extension,
 * it enbales cfvm for the main extension of the user.
 *
 * @method evtExtenCfVmChanged
 * @param {object} data The data received by the event
 * @private
 */
function evtExtenCfVmChanged(data) {
  try {
    if (typeof data !== 'object' || typeof data.exten !== 'string' || typeof data.enabled !== 'boolean') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'received "' + compAstProxy.EVT_EXTEN_CFVM_CHANGED + '" event for exten "' + data.exten + '"');

    var i, e;
    var username = getUserFromExten(data.exten);
    var allext = getAllUserExtensions(username);
    var mainExtId = getEndpointMainExtension(username).getId();

    // cfvm off
    if (data.enabled === false) {

      // cfvm has been removed, so check if it is disabled from all extensions of the user.
      // If it is not, it disable cfvm on all extensions of the user
      for (i = 0; i < allext.length; i++) {

        if (compAstProxy.isExtenCfVm(allext[i])) {

          compAstProxy.setUnconditionalCfVm(allext[i], false, null, function(err) {
            if (err) {
              logger.log.error(IDLOG, 'disabling cfvm of extension "' + allext[i] + '"');
            } else {
              logger.log.info(IDLOG, 'disabled cfvm of extension "' + allext[i] + '"');
            }
            updateUserPresence(username);
          });

        }
      }
    } else if (data.enabled === true && !isMainExtension(data.exten)) {

      // cf has been activated in a seconday extension of a user, so enable it on main extension
      if (!compAstProxy.isExtenCfVm(mainExtId)) {

        compAstProxy.setUnconditionalCfVm(mainExtId, true, data.vm, function(err) {
          if (err) {
            logger.log.error(IDLOG, 'enabling cfvm of main extension "' + e + '" to "' + data.vm + '"');
          } else {
            logger.log.info(IDLOG, 'enabled cfvm of main extension "' + e + '" to "' + data.vm + '"');
          }
          updateUserPresence(username);
        });

      }
    }
    updateUserPresence(username);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check if the extension is a main extension.
 *
 * @method isMainExtension
 * @param {string} extenId The identifier of the extension to be checked
 * @return {boolean} True if the extension is a main extension of a user
 * @private
 */
function isMainExtension(extenId) {
  try {
    var u, mainExtId;
    for (u in users) {
      mainExtId = getEndpointMainExtension(u).getId();
      if (mainExtId === extenId) {
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
 * Returns the username that has the extension associated.
 *
 * @method getUserFromExten
 * @param {string} extenId The identifier of the extension
 * @return {string} The name of the user that has the extension.
 * @private
 */
function getUserFromExten(extenId) {
  try {
    var u, i, allext;
    for (u in users) {
      allext = getAllUserExtensions(u);
      for (i = 0; i < allext.length; i++) {
        if (allext[i] === extenId) {
          return u;
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Initialize the listeners for asterisk proxy component.
 *
 * @method initializeAstProxyListeners
 * @private
 */
function initializeAstProxyListeners() {
  try {
    compAstProxy.on(compAstProxy.EVT_EXTEN_CF_CHANGED, evtExtenCfChanged);
    compAstProxy.on(compAstProxy.EVT_EXTEN_CFB_CHANGED, evtExtenCfbChanged);
    compAstProxy.on(compAstProxy.EVT_EXTEN_CFU_CHANGED, evtExtenCfuChanged);
    compAstProxy.on(compAstProxy.EVT_EXTEN_CFVM_CHANGED, evtExtenCfVmChanged);
    compAstProxy.on(compAstProxy.EVT_EXTEN_DND_CHANGED, evtExtenDndChanged);
    logger.log.info(IDLOG, 'set asterisk proxy listeners done');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Enable DND for the extension.
 *
 * @method enableDndExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresence_.
 */
function enableDndExten(ext) {
  return function(callback) {
    compAstProxy.setDnd(ext, true, callback);
  };
}

/**
 * Disable DND for the extension.
 *
 * @method disableDndExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresence_.
 */
function disableDndExten(ext) {
  return function(callback) {
    compAstProxy.setDnd(ext, false, callback);
  };
}

/**
 * Disable CF for the extension.
 *
 * @method disableCfExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresence_.
 */
function disableCfExten(ext) {
  return function(callback) {
    compAstProxy.setUnconditionalCf(ext, false, null, callback);
  };
}

/**
 * Disable CFB for the extension.
 *
 * @method disableCfbExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresenceOnBusy_.
 */
function disableCfbExten(ext) {
  return function(callback) {
    compAstProxy.setCfb(ext, false, null, callback);
  };
}

/**
 * Disable CFU vm for the extension.
 *
 * @method disableCfuVmExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresenceOnUnavailable_.
 */
function disableCfuVmExten(ext) {
  return function(callback) {
    compAstProxy.setCfuVm(ext, false, null, callback);
  };
}

/**
 * Disable CFB vm for the extension.
 *
 * @method disableCfbVmExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresenceOnBusy_.
 */
function disableCfbVmExten(ext) {
  return function(callback) {
    compAstProxy.setCfbVm(ext, false, null, callback);
  };
}

/**
 * Enable CFB to a destination number for the extension.
 *
 * @method enableCfbExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @param {string} destination The destination number of call forward busy
 * @return {function} The function to be called by _setPresenceOnBusy_.
 */
function enableCfbExten(ext, destination, username) {
  return function(callback) {
    if (destination) {
      compAstProxy.setCfb(ext, true, destination, callback);
    } else {
      var str = 'setting "' + userPresence.COND_STATUS.cf_busy + '" presence to user "' + username + '": no destination passed "' + destination + '"';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Disable CFU for the extension.
 *
 * @method disableCfuExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresenceOnUnavailable_.
 */
function disableCfuExten(ext) {
  return function(callback) {
    compAstProxy.setCfu(ext, false, null, callback);
  };
}

/**
 * Enable CFU to a destination number for the extension.
 *
 * @method enableCfuExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @param {string} destination The destination number of call forward unavailable
 * @return {function} The function to be called by _setPresenceOnUnavailable_.
 */
function enableCfuExten(ext, destination, username) {
  return function(callback) {
    if (destination) {
      compAstProxy.setCfu(ext, true, destination, callback);
    } else {
      var str = 'setting "' + userPresence.COND_STATUS.cf_unavailable + '" presence to user "' + username + '": no destination passed "' + destination + '"';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Disable CFVM for the extension.
 *
 * @method disableCfVmExten
 * @param {string} ext The extension identifier
 * @return {function} The function to be called by _setPresence_.
 */
function disableCfVmExten(ext) {
  return function(callback) {
    compAstProxy.setUnconditionalCfVm(ext, false, null, callback);
  };
}

/**
 * Enable CFVM for the extension.
 *
 * @method enableCfVmExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @return {function} The function to be called by _setPresence_.
 */
function enableCfVmExten(ext, username) {
  return function(callback) {
    var vmId = getAllEndpointsVoicemail(username)[
      Object.keys(getAllEndpointsVoicemail(username))[0]
    ];
    if (vmId) {
      vmId = vmId.getId();
      compAstProxy.setUnconditionalCfVm(ext, true, vmId, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS.voicemail + '" presence to user "' + username + '": no voicemail associated';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CFB VM for the extension.
 *
 * @method enableCfbVmExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @return {function} The function to be called by _setPresenceOnBusy_.
 */
function enableCfbVmExten(ext, username) {
  return function(callback) {
    var vmId = getAllEndpointsVoicemail(username)[
      Object.keys(getAllEndpointsVoicemail(username))[0]
    ];
    if (vmId) {
      vmId = vmId.getId();
      compAstProxy.setCfbVm(ext, true, vmId, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS_ONBUSY.voicemail + '" presence on busy to user "' + username + '": no voicemail associated';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CFU VM for the extension.
 *
 * @method enableCfuVmExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @return {function} The function to be called by _setPresenceOnUnavailable_.
 */
function enableCfuVmExten(ext, username) {
  return function(callback) {
    var vmId = getAllEndpointsVoicemail(username)[
      Object.keys(getAllEndpointsVoicemail(username))[0]
    ];
    if (vmId) {
      vmId = vmId.getId();
      compAstProxy.setCfuVm(ext, true, vmId, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS_ONUNAVAILABLE.voicemail + '" presence on unavailable to user "' + username + '": no voicemail associated';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CF to cellphone for the extension.
 *
 * @method enableCfCellphoneExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @return {function} The function to be called by _setPresence_.
 */
function enableCfCellphoneExten(ext, username) {
  return function(callback) {
    var cellphoneId = getAllEndpointsCellphone(username)[
      Object.keys(getAllEndpointsCellphone(username))[0]
    ];
    if (cellphoneId) {
      cellphoneId = cellphoneId.getId();
      compAstProxy.setUnconditionalCf(ext, true, cellphoneId, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS.cellphone + '" presence to user "' + username + '": no cellphone associated';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CFB to cellphone for the extension.
 *
 * @method enableCfbCellphoneExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @return {function} The function to be called by _setPresenceOnBusy_.
 */
function enableCfbCellphoneExten(ext, username) {
  return function(callback) {
    var cellphoneId = getAllEndpointsCellphone(username)[
      Object.keys(getAllEndpointsCellphone(username))[0]
    ];
    if (cellphoneId) {
      cellphoneId = cellphoneId.getId();
      compAstProxy.setCfb(ext, true, cellphoneId, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS_ONBUSY.cellphone + '" presence on busy to user "' + username + '": no cellphone associated';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CFU to cellphone for the extension.
 *
 * @method enableCfuCellphoneExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @return {function} The function to be called by _setPresenceOnUnavailable_.
 */
function enableCfuCellphoneExten(ext, username) {
  return function(callback) {
    var cellphoneId = getAllEndpointsCellphone(username)[
      Object.keys(getAllEndpointsCellphone(username))[0]
    ];
    if (cellphoneId) {
      cellphoneId = cellphoneId.getId();
      compAstProxy.setCfu(ext, true, cellphoneId, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS_ONUNAVAILABLE.cellphone + '" presence on unavailable to user "' + username + '": no cellphone associated';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CFB to a destination number for the extension.
 *
 * @method enableCfbNumberExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @param {string} destination The destination number of call forward on busy
 * @return {function} The function to be called by _setPresenceOnBusy_.
 */
function enableCfbNumberExten(ext, destination, username) {
  return function(callback) {
    if (destination) {
      compAstProxy.setCfb(ext, true, destination, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS_ONBUSY.callforward + '" presence on busy to user "' + username + '": no destination passed "' + destination + '"';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CFU to a destination number for the extension.
 *
 * @method enableCfuNumberExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @param {string} destination The destination number of call forward on unavailable
 * @return {function} The function to be called by _setPresenceOnUnavailable_.
 */
function enableCfuNumberExten(ext, destination, username) {
  return function(callback) {
    if (destination) {
      compAstProxy.setCfu(ext, true, destination, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS_ONUNAVAILABLE.callforward + '" presence on unavailable to user "' + username + '": no destination passed "' + destination + '"';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Enable CF to a destination number for the extension.
 *
 * @method enableCfNumberExten
 * @param {string} ext The extension identifier
 * @param {string} username The username
 * @param {string} destination The destination number of call forward
 * @return {function} The function to be called by _setPresence_.
 */
function enableCfNumberExten(ext, destination, username) {
  return function(callback) {
    if (destination) {
      compAstProxy.setUnconditionalCf(ext, true, destination, callback);
    } else {
      var str = 'setting "' + userPresence.STATUS.callforward + '" presence to user "' + username + '": no destination passed "' + destination + '"';
      logger.log.warn(IDLOG, str);
      callback(str);
    }
  };
}

/**
 * Returns all extension of a user.
 *
 * @method getAllUserExtensions
 * @param {string} username The username of the user to be set
 * @return {array} All the extensions of a user.
 */
function getAllUserExtensions(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameter: username "' + username + '"');
    }
    if (users[username]) {
      var endpoints = users[username].getAllEndpoints();
      return Object.keys(endpoints[endpointTypes.TYPES.extension])
        .concat(Object.keys(endpoints[endpointTypes.TYPES.mainextension]));

    } else {
      logger.log.warn(IDLOG, 'getting all user extensions: user "' + username + '" not exists');
      return [];
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Set the user presence status on busy.
 *
 * @method setPresenceOnBusy
 * @param {object} param
 *  @param {string} param.username The username of the user to be set
 *  @param {string} param.status The presence status on busy
 *  @param {string} [param.destination] The destination of "callforward" status on busy
 * @param {function} cb The callback function
 */
function setPresenceOnBusy(param, cb) {
  try {
    if (typeof param !== 'object' ||
      typeof param.username !== 'string' ||
      typeof param.status !== 'string' ||
      (param.status === userPresence.STATUS_ONBUSY.callforward && !param.destination) ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[param.username] && userPresence.isValidUserPresenceOnBusy(param.status)) {
      var i;
      var arr = [];
      var allext = getAllUserExtensions(param.username);

      // set presence to online
      if (param.status === userPresence.STATUS_ONBUSY.online) {

        for (i = 0; i < allext.length; i++) {
          arr.push(disableCfbExten(allext[i]));
          arr.push(disableCfbVmExten(allext[i]));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on busy of user "' + param.username + '" to "' + userPresence.STATUS_ONBUSY.online + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on busy "' + userPresence.STATUS_ONBUSY.online + '" to user "' + param.username + '"');
            }
          }
        );
      }
      // set presence to cellphone
      else if (param.status === userPresence.STATUS_ONBUSY.cellphone) {

        for (i = 0; i < allext.length; i++) {
          arr.push(enableCfbCellphoneExten(allext[i], param.username));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on busy of user "' + param.username + '" to "' + userPresence.STATUS_ONBUSY.cellphone + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on busy "' + userPresence.STATUS_ONBUSY.cellphone + '" to user "' + param.username + '"');
            }
          }
        );
      }
      // set presence to voicemail
      else if (param.status === userPresence.STATUS_ONBUSY.voicemail) {

        for (i = 0; i < allext.length; i++) {
          arr.push(enableCfbVmExten(allext[i], param.username));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on busy of user "' + param.username + '" to "' + userPresence.STATUS_ONBUSY.voicemail + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on busy "' + userPresence.STATUS_ONBUSY.voicemail + '" to user "' + param.username + '"');
            }
          }
        );
      }
      // set presence to callforward to a specific number
      else if (param.status === userPresence.STATUS_ONBUSY.callforward) {

        for (i = 0; i < allext.length; i++) {
          arr.push(enableCfbNumberExten(allext[i], param.destination, param.username));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on busy of user "' + param.username + '" to "' + userPresence.STATUS_ONBUSY.callforward + '" to "' + param.destination + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on busy "' + userPresence.STATUS_ONBUSY.callforward + '" to "' + param.destination + '" to user "' + param.username + '"');
            }
          }
        );
      } else {
        var str = 'unknown status presence on busy "' + param.status + '" to be set';
        logger.log.warn(IDLOG, str);
        cb(str);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Associate the mobile phone number to the user.
 *
 * @method setMobilePhoneNumber
 * @param {string} username The username of the user to be set
 * @param {string} pnumber The mobile phone number
 * @param {function} cb The callback function
 */
function setMobilePhoneNumber(username, pnumber, cb) {
  try {
    if (typeof username !== 'string' ||
      typeof pnumber !== 'string' ||
      isNaN(pnumber) ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username]) {
      compDbconn.setUserMobilePhoneNumber(username, pnumber, cb);
    } else {
      logger.log.warn(IDLOG, 'setting mobile phone number of not existent user "' + username + '"');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Set the user presence status on unavailable.
 *
 * @method setPresenceOnUnavailable
 * @param {object} param
 *  @param {string} param.username The username of the user to be set
 *  @param {string} param.status The presence status on unavailable
 *  @param {string} [param.destination] The destination of "callforward" status on unavailable
 * @param {function} cb The callback function
 */
function setPresenceOnUnavailable(param, cb) {
  try {
    if (typeof param !== 'object' ||
      typeof param.username !== 'string' ||
      typeof param.status !== 'string' ||
      (param.status === userPresence.STATUS_ONUNAVAILABLE.callforward && !param.destination) ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[param.username] && userPresence.isValidUserPresenceOnUnavailable(param.status)) {
      var i;
      var arr = [];
      var allext = getAllUserExtensions(param.username);

      // set presence to online
      if (param.status === userPresence.STATUS_ONUNAVAILABLE.online) {

        for (i = 0; i < allext.length; i++) {
          arr.push(disableCfuExten(allext[i]));
          arr.push(disableCfuVmExten(allext[i]));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on unavailable of user "' + param.username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.online + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on unavailable "' + userPresence.STATUS_ONUNAVAILABLE.online + '" to user "' + param.username + '"');
            }
          }
        );
      }
      // set presence to cellphone
      else if (param.status === userPresence.STATUS_ONUNAVAILABLE.cellphone) {

        for (i = 0; i < allext.length; i++) {
          arr.push(enableCfuCellphoneExten(allext[i], param.username));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on unavailable of user "' + param.username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.cellphone + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on unavailable "' + userPresence.STATUS_ONUNAVAILABLE.cellphone + '" to user "' + param.username + '"');
            }
          }
        );
      }
      // set presence to voicemail
      else if (param.status === userPresence.STATUS_ONUNAVAILABLE.voicemail) {

        for (i = 0; i < allext.length; i++) {
          arr.push(enableCfuVmExten(allext[i], param.username));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on unavailable of user "' + param.username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.voicemail + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on unavailable "' + userPresence.STATUS_ONUNAVAILABLE.voicemail + '" to user "' + param.username + '"');
            }
          }
        );
      }
      // set presence to callforward to a specific number
      else if (param.status === userPresence.STATUS_ONUNAVAILABLE.callforward) {

        for (i = 0; i < allext.length; i++) {
          arr.push(enableCfuNumberExten(allext[i], param.destination, param.username));
        }
        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence on unavailable of user "' + param.username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.callforward + '" to "' + param.destination + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence on unavailable "' + userPresence.STATUS_ONUNAVAILABLE.callforward + '" to "' + param.destination + '" to user "' + param.username + '"');
            }
          }
        );
      } else {
        var str = 'unknown status presence on unavailable "' + param.status + '" to be set';
        logger.log.warn(IDLOG, str);
        cb(str);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Set the user presence status.
 *
 * @method setPresence
 * @param {object} param
 *  @param {string} param.username The username of the user to be set
 *  @param {string} param.status The presence status
 *  @param {string} [param.destination] The destination of "callforward" status
 * @param {function} cb The callback function
 */
function setPresence(param, cb) {
  try {
    if (typeof param !== 'object' ||
      typeof param.username !== 'string' ||
      typeof param.status !== 'string' ||
      (param.status === userPresence.STATUS.callforward && !param.destination) ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[param.username] && userPresence.isValidUserPresence(param.status)) {

      var i;
      var arr = [];
      var mainExtId = getEndpointMainExtension(param.username).getId();
      var allext = getAllUserExtensions(param.username);
      let allextObj = {};
      allext.forEach(el => {
        allextObj[el] = '';
      });
      // set presence to online
      if (param.status === userPresence.STATUS.online) {

        // disable "dnd", "call forward" and "call forward to voicemail" for all extensions of the user
        for (i = 0; i < allext.length; i++) {
          arr.push(disableDndExten(allext[i]));
          arr.push(disableCfExten(allext[i]));
          arr.push(disableCfVmExten(allext[i]));
        }
        arr.push( // set presence in Asterisk
          function(callback) {
            compAstProxy.setAsteriskPresence(mainExtId, 'AVAILABLE', callback);
          }
        );

        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence of user "' + param.username + '" to "' + userPresence.STATUS.online + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence "' + userPresence.STATUS.online + '" to user "' + param.username + '"');
              compAstProxy.reloadPhysicalPhoneConfig(allextObj);
            }
          }
        );
      }
      // set presence to dnd
      else if (param.status === userPresence.STATUS.dnd) {

        for (i = 0; i < allext.length; i++) {
          arr.push(enableDndExten(allext[i]));
          arr.push(disableCfExten(allext[i]));
          arr.push(disableCfVmExten(allext[i]));
        }
        arr.push( // set presence in Asterisk
          function(callback) {
            compAstProxy.setAsteriskPresence(mainExtId, 'DND', callback);
          }
        );

        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence of user "' + param.username + '" to "' + userPresence.STATUS.dnd + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence "' + userPresence.STATUS.dnd + '" to user "' + param.username + '"');
              compAstProxy.reloadPhysicalPhoneConfig(allextObj);
            }
          }
        );
      }
      // set presence to cellphone
      else if (param.status === userPresence.STATUS.cellphone) {

        for (i = 0; i < allext.length; i++) {
          arr.push(disableDndExten(allext[i]));
          arr.push(enableCfCellphoneExten(allext[i], param.username));
        }
        arr.push( // set presence in Asterisk
          function(callback) {
            compAstProxy.setAsteriskPresence(mainExtId, 'AWAY,CELLPHONE', callback);
          }
        );

        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence of user "' + param.username + '" to "' + userPresence.STATUS.cellphone + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence "' + userPresence.STATUS.cellphone + '" to user "' + param.username + '"');
              compAstProxy.reloadPhysicalPhoneConfig(allextObj);
            }
          }
        );
      }
      // set presence to voicemail
      else if (param.status === userPresence.STATUS.voicemail) {

        for (i = 0; i < allext.length; i++) {
          arr.push(disableDndExten(allext[i]));
          arr.push(enableCfVmExten(allext[i], param.username));
        }
        arr.push( // set presence in Asterisk
          function(callback) {
            compAstProxy.setAsteriskPresence(mainExtId, 'XA,VOICEMAIL', callback);
          }
        );

        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence of user "' + param.username + '" to "' + userPresence.STATUS.voicemail + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence "' + userPresence.STATUS.voicemail + '" to user "' + param.username + '"');
              compAstProxy.reloadPhysicalPhoneConfig(allextObj);
            }
          }
        );
      }
      // set presence to callforward to a specific number
      else if (param.status === userPresence.STATUS.callforward) {

        for (i = 0; i < allext.length; i++) {
          arr.push(disableDndExten(allext[i]));
          arr.push(enableCfNumberExten(allext[i], param.destination, param.username));
        }
        arr.push( // set presence in Asterisk
          function(callback) {
            compAstProxy.setAsteriskPresence(mainExtId, 'AWAY,NUMBER', callback);
          }
        );

        async.parallel(arr,
          function(err) {
            cb(err);
            if (err) {
              logger.log.error(IDLOG, 'setting presence of user "' + param.username + '" to "' + userPresence.STATUS.callforward + '" to "' + param.destination + '"');
              logger.log.error(IDLOG, err);
            } else {
              logger.log.info(IDLOG, 'set presence "' + userPresence.STATUS.callforward + '" to "' + param.destination + '" to user "' + param.username + '"');
              compAstProxy.reloadPhysicalPhoneConfig(allextObj);
            }
          }
        );
      } else {
        var str = 'unknown status presence "' + param.status + '"';
        logger.log.warn(IDLOG, str);
        cb(str);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Get the conditional user presence status on busy.
 *
 * @method getPresenceOnBusy
 * @param {string} username The username
 * @return {string} The conditional presence status on busy.
 */
function getPresenceOnBusy(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username]) {
      return users[username].getPresenceOnBusy();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the conditional user presence status on unavailable.
 *
 * @method getPresenceOnUnavailable
 * @param {string} username The username
 * @return {string} The conditional presence status on unavailable.
 */
function getPresenceOnUnavailable(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username]) {
      return users[username].getPresenceOnUnavailable();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the destination of the call forward user presence status.
 *
 * @method getPresenceCallforwardTo
 * @param {string} username The username
 * @return {string} The destination number.
 */
function getPresenceCallforwardTo(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username]) {
      return users[username].getPresenceCallforwardTo();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the destination of the call forward on busy user presence status.
 *
 * @method getPresenceOnBusyCallforwardTo
 * @param {string} username The username
 * @return {string} The destination number.
 */
function getPresenceOnBusyCallforwardTo(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username]) {
      return users[username].getPresenceOnBusyCallforwardTo();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the destination of the call forward on unavailable user presence status.
 *
 * @method getPresenceOnUnavailableCallforwardTo
 * @param {string} username The username
 * @return {string} The destination number.
 */
function getPresenceOnUnavailableCallforwardTo(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username]) {
      return users[username].getPresenceOnUnavailableCallforwardTo();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the user presence status.
 *
 * @method getPresence
 * @param {string} username The username
 * @return {string} The presence status.
 */
function getPresence(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username]) {
      return users[username].getPresence();
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return the list of all possible user presence.
 *
 * @method getPresenceList
 * @param {string} username The username
 * @return {array} All the possible presence of the user.
 */
function getPresenceList(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var result = [
      userPresence.STATUS.online,
      userPresence.STATUS.dnd,
      userPresence.STATUS.callforward
    ];
    var allendpoints = users[username].getAllEndpoints();
    if (allendpoints && Object.keys(allendpoints[endpointTypes.TYPES.cellphone]).length > 0) {
      result.push(endpointTypes.TYPES.cellphone);
    }
    if (allendpoints && Object.keys(allendpoints[endpointTypes.TYPES.voicemail]).length > 0) {
      result.push(endpointTypes.TYPES.voicemail);
    }
    return result;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return the list of all possible conditional user presence on unavailable.
 *
 * @method getPresenceListOnUnavailable
 * @param {string} username The username
 * @return {array} All the possible conditional presence of the user on unavailable.
 */
function getPresenceListOnUnavailable(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return Object.keys(userPresence.STATUS_ONUNAVAILABLE);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Return the list of all possible conditional user presence on busy.
 *
 * @method getPresenceListOnBusy
 * @param {string} username The username
 * @return {array} All the possible conditional presence of the user on busy.
 */
function getPresenceListOnBusy(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return Object.keys(userPresence.STATUS_ONBUSY);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Get the user information in JSON format.
 *
 * @method getUserInfoJSON
 * @param {string} username The username
 * @return {string} The user information in JSON format.
 */
function getUserInfoJSON(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var i, result;
    if (users[username]) {
      result = users[username].toJSON();
    }
    // add model and type for extension endpoints
    for (i = 0; i < result.endpoints[endpointTypes.TYPES.mainextension].length; i++) {
      result.endpoints[endpointTypes.TYPES.mainextension][i].description = compAstProxy.getExtensionAgent(result.endpoints[endpointTypes.TYPES.mainextension][i].id);
    }
    for (i = 0; i < result.endpoints[endpointTypes.TYPES.extension].length; i++) {
      result.endpoints[endpointTypes.TYPES.extension][i].description = compAstProxy.getExtensionAgent(result.endpoints[endpointTypes.TYPES.extension][i].id);
    }
    return result;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Adds the endpoint objects to the user by json configuration.
 *
 * @method initializeEndpointsUsersByJSON
 * @param {object} json The JSON configuration
 * @private
 */
function initializeEndpointsUsersByJSON(json) {
  try {
    if (typeof json !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    for (let userid in json) {
      // set the endpoints to the user
      for (let endpoType in json[userid].endpoints) {

        // check the validity of the endpoint type
        if (endpointTypes.isValidEndpointType(endpoType) === false) {
          logger.log.error(IDLOG, 'wrong users config file: invalid endpoint type "' + endpoType + '" for user "' + userid + '"');
        } else {
          // add all endpoints of the current type to the user
          addEndpointsToUser(userid, endpoType, json[userid].endpoints[endpoType]);
        }
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get the main extension endpoint of the user.
 *
 * @method getEndpointMainExtension
 * @param {string} username The name of the user
 * @return {object} The main extension endpoint.
 */
function getEndpointMainExtension(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check the user existence
    if (typeof users[username] !== 'object') {
      logger.log.warn(IDLOG, 'getting main extension endpoint: user "' + username + '" does not exist');
      return {};
    }
    // gets all endpoints, extracts the main extension endpoint
    var endpoints = users[username].getAllEndpoints();
    return endpoints[endpointTypes.TYPES.mainextension][
      Object.keys(endpoints[endpointTypes.TYPES.mainextension])[0]
    ];
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Get the voicemail endpoint of the user.
 *
 * @method getEndpointVoicemail
 * @param {string} username The name of the user
 * @return {object} The voicemail endpoint.
 */
function getEndpointVoicemail(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check the user existence
    if (typeof users[username] !== 'object') {
      logger.log.warn(IDLOG, 'getting voicemail endpoint: user "' + username + '" does not exist');
      return {};
    }
    // gets all endpoints, extracts the voicemail endpoint
    var endpoints = users[username].getAllEndpoints();
    return endpoints[endpointTypes.TYPES.voicemail][
      Object.keys(endpoints[endpointTypes.TYPES.voicemail])[0]
    ];
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns the identifiers of the queues to which the user belongs.
 *
 * @method getQueueIds
 * @param {string} username The username
 * @return {array} The queue identifiers of the user.
 * @private
 */
function getQueueIds(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var exts = Object.keys(getAllEndpointsExtension(username));
    var queues = [];
    var arr;
    for (var i = 0; i < exts.length; i++) {
      arr = Object.keys(compAstProxy.getQueueIdsOfExten(exts[i]));
      for (var k = 0; k < arr.length; k++) {
        if (queues.indexOf() === -1) {
          queues.push(arr[k]);
        }
      }
    }
    return queues;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Update the user presence.
 *
 * @method updateUserPresence
 * @param {string} username The username to be updated
 * @private
 */
function updateUserPresence(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var mainExtId = getEndpointMainExtension(username).getId();
    var cellphone = (getAllEndpointsCellphone(username))[
      Object.keys(getAllEndpointsCellphone(username))[0]
    ];
    if (cellphone) {
      cellphone = cellphone.getId();
    }
    var dnd = compAstProxy.isExtenDnd(mainExtId);
    var cf = compAstProxy.isExtenCf(mainExtId);
    var cfvm = compAstProxy.isExtenCfVm(mainExtId);
    var cfval;
    if (cf) {
      cfval = compAstProxy.getExtenCfValue(mainExtId);
    }
    // set presence
    if (dnd) {
      logger.log.info(IDLOG, 'set user presence of "' + username + '" to "' + userPresence.STATUS.dnd + '"');
      users[username].setPresence(userPresence.STATUS.dnd);
    } else if (cf && cfval === cellphone) {
      logger.log.info(IDLOG, 'set user presence of "' + username + '" to "' + userPresence.STATUS.cellphone + '"');
      users[username].setPresence(userPresence.STATUS.cellphone);
    } else if (cf && cfval !== cellphone) {
      logger.log.info(IDLOG, 'set user presence of "' + username + '" to "' + userPresence.STATUS.callforward + '"');
      users[username].setPresence(userPresence.STATUS.callforward);
      users[username].setPresenceCallforwardTo(cfval);
    } else if (cfvm) {
      logger.log.info(IDLOG, 'set user presence of "' + username + '" to "' + userPresence.STATUS.voicemail + '"');
      users[username].setPresence(userPresence.STATUS.voicemail);
    } else {
      logger.log.info(IDLOG, 'set user presence of "' + username + '" to "' + userPresence.STATUS.online + '"');
      users[username].setPresence(userPresence.STATUS.online);
    }
    if (!reloading) {
      logger.log.info(IDLOG, 'emit event "' + EVT_USER_PRESENCE_CHANGED + '"');
      emitter.emit(EVT_USER_PRESENCE_CHANGED, {
        presence: {
          username: username,
          status: users[username].getPresence(),
          to: (cf && cfval !== cellphone) ? cfval : undefined
        }
      });
    }
    // retrieve the mainPresence and emit the associated event
    if (mainExtId) {
      updateUserMainPresence(mainExtId)
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the final telephonic presence checking all extensions
 *
 * @method retrieveExtensionsPresence
 * @param {object} extensions
 * @private
 */
function retrieveExtensionsPresence(extensions) {
  const extenStatusList = new Set()
  try {
    if (typeof extensions !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    const staticExtStatusList = compAstProxy.EXTEN_STATUS_ENUM
    for (let [_, value] of extensions) {
      extenStatusList.add(value.status)
    }
    // apply logic on extensions status
    if (extenStatusList.has(staticExtStatusList.BUSY)) {
      // when at least one extension is busy the thelephonic status is busy
      return staticExtStatusList.BUSY
    } else if (extenStatusList.has(staticExtStatusList.BUSY_RINGING)) {
      // when the previous is not present and at least one extension is busy_ringing
      // the thelephonic status is busy busy_ringing
      return staticExtStatusList.BUSY_RINGING;
    } else if (extenStatusList.has(staticExtStatusList.RINGING)) {
      // when the previous are not present and at least one extension is busy_ringing
      // the telephonic status is busy_ringing
      return staticExtStatusList.RINGING;
    } else if (extenStatusList.has(staticExtStatusList.ONHOLD)) {
      // when the previous are not present and at least one extension is busy_ringing
      // the telephonic status is busy_ringing
      return staticExtStatusList.ONHOLD;
    } else if (extenStatusList.has(staticExtStatusList.ONLINE)) {
      // when the previous are not present and at least one extension is online
      // the telephonic status is online
      return staticExtStatusList.ONLINE;
    } else {
      return staticExtStatusList.OFFLINE;
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return ""
  }
}

/**
 * Returns the final mainPresence of the user
 *
 * @method retrieveMainPresence
 * @param {string} userPresence
 * @param {string} extensionsPresence
 * @private
 */
function retrieveMainPresence(customPresence, extensionsPresence) {
  try {
    if (typeof customPresence !== 'string' && typeof extensionsPresence !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    const staticExtStatusList = compAstProxy.EXTEN_STATUS_ENUM
    const customPresenceOnline = customPresence === userPresence.STATUS.online
    var mainPresence
    switch (true) {
      case customPresence === userPresence.STATUS.dnd:
        // the main presence is set to "dnd" when the custom presence is dnd
        mainPresence = userMainPresence.STATUS.dnd
        break
      case customPresence === userPresence.STATUS.voicemail:
        // the main presence is set to "voicemail" when the custom presence is voicemail
        mainPresence = userMainPresence.STATUS.voicemail
        break
      case customPresence === userPresence.STATUS.cellphone:
        // the main presence is set to "cellphone" when the custom presence is cellphone
        mainPresence = userMainPresence.STATUS.cellphone
        break
      case customPresence === userPresence.STATUS.callforward:
        // the main presence is set to "callforward" when the custom presence is callforward
        mainPresence = userMainPresence.STATUS.callforward
        break
      case customPresenceOnline && (extensionsPresence === staticExtStatusList.ONLINE):
        // the main presence is set to "online" when the custom presence is online
        // and the extensions presence is ONLINE
        mainPresence = userMainPresence.STATUS.online
        break
      case customPresenceOnline && (extensionsPresence === staticExtStatusList.BUSY):
        // the main presence is set to "busy" when the custom presence is online
        // and the extensions presence is BUSY
        mainPresence = userMainPresence.STATUS.busy
        break
      case customPresenceOnline && (extensionsPresence === staticExtStatusList.BUSY_RINGING):
        // the main presence is set to "busy" when the custom presence is online
        // and the extensions presence is BUSY_RINGING
        mainPresence = userMainPresence.STATUS.busy
        break
      case customPresenceOnline && (extensionsPresence === staticExtStatusList.ONHOLD):
        // the main presence is set to "busy" when the custom presence is online
        // and the extensions presence is ONHOLD
        mainPresence = userMainPresence.STATUS.busy
        break
      case customPresenceOnline && (extensionsPresence === staticExtStatusList.RINGING):
        // the main presence is set to "ringing" when the custom presence is online
        // and the extensions presence is RINGING
        mainPresence = userMainPresence.STATUS.ringing
        break
      case customPresenceOnline && (extensionsPresence === staticExtStatusList.OFFLINE):
        // the main presence is set to "offline" when the custom presence is online
        // and the extensions presence is OFFLINE
        mainPresence = userMainPresence.STATUS.offline
        break
      default:
        // otherwise the main presence is set to offline
        mainPresence = userMainPresence.STATUS.offline
        break
    }
    return mainPresence
  } catch (err) {
    logger.log.error(IDLOG, err.stack)
    return ""
  }
}

/**
 * Update the user mainPresence.
 *
 * @method updateUserMainPresence
 * @param {string} exten The extension of the user to be updated.
 * @public
 */
function updateUserMainPresence(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    const username = getUserFromExten(exten)
    const userExtensions = getAllEndpointsExtension(username)
    const customPresence = users[username].getPresence()
    const astExtensions = new Map()
    for (const ext in userExtensions) {
      const astExtension = compAstProxy.getJSONExtension(ext)
      astExtensions.set(ext, astExtension)
    }
    const extensionsPresence = retrieveExtensionsPresence(astExtensions)
    const newMainPresence = retrieveMainPresence(customPresence, extensionsPresence)

    // set the main presence
    logger.log.info(IDLOG, 'set user main presence of "' + username + '" to "' + newMainPresence + '"');
    users[username].setMainPresence(newMainPresence);

    if (!reloading) {
      const mainPresence = users[username].getMainPresence()
      const mainExtId = getEndpointMainExtension(username).getId()
      const cfval = compAstProxy.getExtenCfValue(mainExtId)

      // emit the ws main presence update event
      logger.log.info(IDLOG, 'emit event "' + EVT_USER_MAIN_PRESENCE_CHANGED + '"')
      emitter.emit(EVT_USER_MAIN_PRESENCE_CHANGED, {
        mainPresence: {
          username: username,
          status: mainPresence,
          to: (mainPresence ===  userMainPresence.STATUS.callforward && cfval) ? cfval : undefined
        }
      })
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Update the conditional user presence.
 *
 * @method updateCondUserPresence
 * @param {string} username The username to be updated
 * @private
 */
function updateCondUserPresence(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    updateUserPresenceOnBusy(username);
    updateUserPresenceOnUnavailable(username);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Update the conditional user presence on unavailable.
 *
 * @method updateUserPresenceOnUnavailable
 * @param {string} username The username to be updated
 * @private
 */
function updateUserPresenceOnUnavailable(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var mainExtId = getEndpointMainExtension(username).getId();
    var cellphone = (getAllEndpointsCellphone(username))[
      Object.keys(getAllEndpointsCellphone(username))[0]
    ];
    if (cellphone) {
      cellphone = cellphone.getId();
    }
    var cfu = compAstProxy.isExtenCfu(mainExtId);
    var cfuvm = compAstProxy.isExtenCfuVm(mainExtId);
    var cfuval;
    if (cfu) {
      cfuval = compAstProxy.getExtenCfuValue(mainExtId);
    }

    // set presence
    if (cfu && cfuval === cellphone) {
      logger.log.info(IDLOG, 'set user presence on unavailable of "' + username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.cellphone + '"');
      users[username].setPresenceOnUnavailable(userPresence.STATUS_ONUNAVAILABLE.cellphone);
    } else if (cfu && cfuval !== cellphone) {
      logger.log.info(IDLOG, 'set user presence on unavailable of "' + username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.callforward + '" to "' + cfuval + '"');
      users[username].setPresenceOnUnavailable(userPresence.STATUS_ONUNAVAILABLE.callforward);
      users[username].setPresenceOnUnavailableCallforwardTo(cfuval);
    } else if (cfuvm) {
      logger.log.info(IDLOG, 'set user presence on unavailable of "' + username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.voicemail + '"');
      users[username].setPresenceOnUnavailable(userPresence.STATUS_ONUNAVAILABLE.voicemail);
    } else {
      logger.log.info(IDLOG, 'set user presence on unavailable of "' + username + '" to "' + userPresence.STATUS_ONUNAVAILABLE.online + '"');
      users[username].setPresenceOnUnavailable(userPresence.STATUS_ONUNAVAILABLE.online);
    }

    if (!reloading) {
      logger.log.info(IDLOG, 'emit event "' + EVT_USER_PRESENCE_CHANGED + '"');
      emitter.emit(EVT_USER_PRESENCE_CHANGED, {
        presence_onunavailable: {
          username: username,
          status: users[username].getPresenceOnUnavailable(),
          to: (cfu && cfuval !== cellphone) ? cfuval : undefined
        }
      });
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Update the conditional user presence on busy.
 *
 * @method updateUserPresenceOnBusy
 * @param {string} username The username to be updated
 * @private
 */
function updateUserPresenceOnBusy(username) {
  try {
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var mainExtId = getEndpointMainExtension(username).getId();
    var cellphone = (getAllEndpointsCellphone(username))[
      Object.keys(getAllEndpointsCellphone(username))[0]
    ];
    if (cellphone) {
      cellphone = cellphone.getId();
    }
    var cfb = compAstProxy.isExtenCfb(mainExtId);
    var cfbvm = compAstProxy.isExtenCfbVm(mainExtId);
    var cfbval;
    if (cfb) {
      cfbval = compAstProxy.getExtenCfbValue(mainExtId);
    }

    // set presence
    if (cfb && cfbval === cellphone) {
      logger.log.info(IDLOG, 'set user presence on busy of "' + username + '" to "' + userPresence.STATUS_ONBUSY.cellphone + '"');
      users[username].setPresenceOnBusy(userPresence.STATUS_ONBUSY.cellphone);
    } else if (cfb && cfbval !== cellphone) {
      logger.log.info(IDLOG, 'set user presence on busy of "' + username + '" to "' + userPresence.STATUS_ONBUSY.callforward + '" to "' + cfbval + '"');
      users[username].setPresenceOnBusy(userPresence.STATUS_ONBUSY.callforward);
      users[username].setPresenceOnBusyCallforwardTo(cfbval);
    } else if (cfbvm) {
      logger.log.info(IDLOG, 'set user presence on busy of "' + username + '" to "' + userPresence.STATUS_ONBUSY.voicemail + '"');
      users[username].setPresenceOnBusy(userPresence.STATUS_ONBUSY.voicemail);
    } else {
      logger.log.info(IDLOG, 'set user presence on busy of "' + username + '" to "' + userPresence.STATUS_ONBUSY.online + '"');
      users[username].setPresenceOnBusy(userPresence.STATUS_ONBUSY.online);
    }

    if (!reloading) {
      logger.log.info(IDLOG, 'emit event "' + EVT_USER_PRESENCE_CHANGED + '"');
      emitter.emit(EVT_USER_PRESENCE_CHANGED, {
        presence_onbusy: {
          username: username,
          status: users[username].getPresenceOnBusy(),
          to: (cfb && cfbval !== cellphone) ? cfbval : undefined
        }
      });
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Initialize the "recall on busy" permission status of all users.
 *
 * @method initializeUsersRecallOnBusy
 * @private
 */
 function initializeUsersRecallOnBusy(path) {
  try {
    // read JSON file with the user/recallonbusy permissions
    var robJson = JSON.parse(fs.readFileSync(path, 'utf8'));
    for (let username in users) {
      users[username].setRecallOnBusy(
        robJson[username] && robJson[username].recallonbusy ? (
          robJson[username].recallonbusy
        ) : (
          'disabled'
        )
      )
    }
    logger.log.info(IDLOG, 'set of recall on busy permissions done');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Initialize the mainPresence of all users.
 *
 * @method initializeUsersMainPresence
 * @private
 */
 function initializeUsersMainPresence() {
  try {
    for (let username in users) {
      const userExtension = users[username].getAllEndpoints().mainextension
      if (userExtension) {
        updateUserMainPresence(Object.keys(userExtension)[0]);
      }
    }
    logger.log.info(IDLOG, 'set all users mainPresence done');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Initialize the presence of all users.
 *
 * @method initializeUsersPresence
 * @private
 */
function initializeUsersPresence() {
  try {
    for (let username in users) {
      updateUserPresence(username);
      updateCondUserPresence(username);
    }
    logger.log.info(IDLOG, 'set all users presence done');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Adds all endpoints to the user.
 *
 * @method addEndpointsToUser
 * @param {object} user The user object
 * @param {string} endpoType The type of the endpoint
 * @param {object} obj Contains the list of the endpoints with their relative object
 * @private
 */
function addEndpointsToUser(userid, endpoType, obj) {
  try {
    if (typeof userid !== 'string' || typeof endpoType !== 'string' || typeof obj !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // adds all endpoints of the specified type to the user
    for (let id in obj) { // cycle endpoints
      if (endpoType === endpointTypes.TYPES.extension && !endpointExtension.isValidExtensionType(obj[id].type)) {
        logger.log.warn(IDLOG,  `not valid exten type "${obj[id].type}": adding exten ${id} to user "${users[userid].getUsername()}"`);
        continue;
      }
      users[userid].addEndpoint(endpoType, id, obj[id]);
      logger.log.info(IDLOG, 'added endpoint "' + endpoType + ' ' + id + '" to user "' + users[userid].getUsername() + '"');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sets the configurations to the specified user.
 *
 * **It can throw an Exception.**
 *
 * @method setConfigurations
 * @param {string} userid The user identifier
 * @param {object} config The user configurations
 */
function setConfigurations(userid, config) {
  try {
    if (typeof userid !== 'string' || typeof config !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (users[userid] !== undefined) { // the user exists
      users[userid].setConfigurations(config);
      logger.log.info(IDLOG, 'configurations has been set for user "' + userid + '"');
    } else {
      throw new Error('setting configurations of unknown user "' + userid + '"');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    throw err;
  }
}

/**
 * Gets the user configurations.
 *
 * @method getConfigurations
 * @param {string} userid The user identifier
 * @return {object} The configurations of the user or an empty object if some errors occurs.
 */
function getConfigurations(userid) {
  try {
    // check parameter
    if (typeof userid !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[userid] !== undefined) { // the user exits
      logger.log.info(IDLOG, 'return configurations of user "' + userid + '"');
      return users[userid].getConfigurations();
    } else {
      throw new Error('getting configurations of unknown user "' + userid + '"');
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Emit an event. It's the same of nodejs _events.EventEmitter.emit_ method.
 *
 * @method emit
 * @param {string} ev The name of the event
 * @param {object} data The object to be emitted
 */
function emit(ev, data) {
  try {
    emitter.emit(ev, data);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Subscribe a callback function to a custom event fired by this object.
 * It's the same of nodejs _events.EventEmitter.on_ method.
 *
 * @method on
 * @param {string} type The name of the event
 * @param {function} cb The callback to execute in response to the event
 * @return {object} A subscription handle capable of detaching that subscription.
 */
function on(type, cb) {
  try {
    return emitter.on(type, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check if the user has an extension endpoint.
 *
 * @method hasExtensionEndpoint
 * @param {string} username The name of the user to check
 * @param {string} exten The extension identifier
 * @return True if the user has the extension endpoint, false otherwise.
 */
function hasExtensionEndpoint(username, exten) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (users[username] === undefined) { // the user is not present
      logger.log.warn(IDLOG, 'checking the user-extension endpoint association: no user "' + username + '" is present');
      return false;
    }
    var i;
    var endpoints = users[username].getAllEndpoints();
    if (endpoints[endpointTypes.TYPES.extension][exten] ||
      endpoints[endpointTypes.TYPES.mainextension][exten]) {

      return true;
    }
    return false;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Check if the user has the cellphone endpoint.
 *
 * @method hasCellphoneEndpoint
 * @param {string} username The name of the user to check
 * @param {string} exten The cellphone identifier
 * @return True if the user has the cellphone endpoint, false otherwise.
 */
function hasCellphoneEndpoint(username, cellphone) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cellphone !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (users[username] === undefined) { // the user is not present
      logger.log.warn(IDLOG, 'checking the user-cellphone endpoint association: no user "' + username + '" is present');
      return false;
    }
    var cel;
    var endpoints = getAllEndpointsCellphone(username);
    for (cel in endpoints) {
      if (cel === cellphone) {
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
 * Check if the user has the specified voicemail endpoint.
 *
 * @method hasVoicemailEndpoint
 * @param {string} username  The name of the user to check
 * @param {string} voicemail The voicemail endpoint identifier
 * @return {boolean} True if the user has the voicemail endpoint, false otherwise.
 */
function hasVoicemailEndpoint(username, voicemail) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof voicemail !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    if (users[username] === undefined) { // the user is not present
      throw new Error('checking the user-voicemail endpoint association: no user "' + username + '" is present');
    }
    var vm;
    var obj = users[username].getAllEndpoints();
    obj = obj[endpointTypes.TYPES.voicemail];
    for (vm in obj) {
      if (vm === voicemail) {
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
 * Returns the voicemail list of the user.
 *
 * @method getVoicemailList
 * @param {string} username The name of the user to check
 * @return {array} The voicemail list of the user.
 */
function getVoicemailList(username) {
  try {
    // check parameter
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user presence
    if (users[username] === undefined) {
      throw new Error('no user "' + username + '" is present');
    }

    // get voicemail endpoints object
    var evms = users[username].getAllEndpoints();
    evms = evms[endpointTypes.TYPES.voicemail];

    if (typeof evms !== 'object') {
      throw new Error('wrong voicemail endpoint result for user "' + username + '"');
    }
    return Object.keys(evms);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    throw err;
  }
}

/**
 * Returns the endpoints of the user.
 *
 * @method getEndpointsJSON
 * @param {string} userid The user identifier
 * @return {object} The endpoints of the user in JSON format.
 */
function getEndpointsJSON(userid) {
  try { // check parameter
    if (typeof userid !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check the user presence
    if (users[userid] === undefined) {
      throw new Error('no user "' + userid + '" is present');
    }

    // get all endpoints of the user
    return users[userid].getAllEndpointsJSON();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    throw err;
  }
}

/**
 * Returns the endpoints of all users.
 *
 * @method getAllUsersEndpointsJSON
 * @return {object} The endpoints of all users in JSON format.
 */
function getAllUsersEndpointsJSON() {
  try {
    var obj = {};

    var keyusername;
    for (keyusername in users) {
      // get all endpoints of the user
      obj[keyusername] = users[keyusername].getAllEndpointsJSON();
    }
    return obj;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    throw err;
  }
}

/**
 * Returns the list of all the usernames.
 *
 * @method getUsernames
 * @return {array} The list of all the usernames.
 */
function getUsernames() {
  try {
    return Object.keys(users);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Return the parameterized URL for the use profile.
 *
 * @method getParamUrl
 * @param {string} username The username
 * @param {string} profileId The id of the user profile
 * @param {function} cb The callback
 */
function getParamUrl(username, profileId, cb) {
  try {
    if (typeof username !== 'string' || typeof profileId !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    compDbconn.getParamUrl(profileId, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Checks if the user exists. To be present, it must be configured.
 * It is case-insensitive.
 *
 * @method isUserPresent
 * @param  {string}  username  The name of the user to be checked.
 * @return {boolean} True if the user exists.
 */
function isUserPresent(username) {
  try {
    // check parameter
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (users[username.toLowerCase()]) {
      return true;
    }
    return false;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Checks if the extension is of webrtc type.
 *
 * @method isExtenWebrtc
 * @param {string} exten The extension identifier
 * @return {boolean} True if the extension is of webrtc type.
 */
function isExtenWebrtc(exten) {
  try {
    if (typeof exten !== 'string') {
      throw new Error('wrong parameter: ' + exten);
    }
    var u, e, extensions;
    for (u in users) {
      extensions = (users[u].getAllEndpoints())[endpointTypes.TYPES.extension];
      for (e in extensions) {
        if (e === exten && extensions[e].isWebrtc()) {
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return false;
  }
}

/**
 * Returns the list of all the usernames with their names.
 *
 * @method getUsernamesWithData
 * @return {object} The list of all the usernames with their names.
 */
function getUsernamesWithData() {
  try {
    var username;
    var obj = {};
    for (username in users) {
      obj[username] = {
        name: users[username].getName()
      };
    }
    return obj;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns all the email endpoints of the user.
 *
 * @method getAllEndpointsEmail
 * @param  {string} username The username
 * @return {object} Returns all the email endpoints of the user.
 */
function getAllEndpointsEmail(username) {
  try {
    // check parameter
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      logger.log.warn(IDLOG, 'gettings all the email endpoints: the user "' + username + '" doesn\'t exist');
      return {};
    }

    // gets all endpoints, extracts the email endpoints
    var endpoints = users[username].getAllEndpoints();
    return endpoints[endpointTypes.TYPES.email];

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns all the cellphone endpoints of the user.
 *
 * @method getAllEndpointsCellphone
 * @param  {string} username The username
 * @return {object} Returns all the cellphone endpoints of the user.
 */
function getAllEndpointsCellphone(username) {
  try {
    // check parameter
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      logger.log.warn(IDLOG, 'gettings all the cellphone endpoints: the user "' + username + '" does not exist');
      return {};
    }

    // gets all endpoints, extracts the cellphone endpoints
    var endpoints = users[username].getAllEndpoints();
    return endpoints[endpointTypes.TYPES.cellphone];

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns all the voicemail endpoints of the user.
 *
 * @method getAllEndpointsVoicemail
 * @param  {string} username The username
 * @return {object} Returns all the voicemail endpoints of the user.
 */
function getAllEndpointsVoicemail(username) {
  try {
    // check parameter
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      logger.log.warn(IDLOG, 'gettings all the voicemail endpoints: the user "' + username + '" does not exist');
      return {};
    }
    // gets all endpoints, extracts the voicemail endpoints
    var endpoints = users[username].getAllEndpoints();
    return endpoints[endpointTypes.TYPES.voicemail];

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns all the extension endpoints of the user.
 *
 * @method getAllEndpointsExtension
 * @param  {string} username The username
 * @return {object} Returns all the extension endpoints of the user.
 */
function getAllEndpointsExtension(username) {
  try {
    // check parameter
    if (typeof username !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      return {};
    }

    // gets all endpoints, extracts the extension endpoints
    var endpoints = users[username].getAllEndpoints();
    var result = {};
    var e;
    for (e in endpoints[endpointTypes.TYPES.mainextension]) {
      result[e] = endpoints[endpointTypes.TYPES.mainextension][e];
    }
    for (e in endpoints[endpointTypes.TYPES.extension]) {
      result[e] = endpoints[endpointTypes.TYPES.extension][e];
    }
    return result;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns all the extension endpoints of all users.
 *
 * @method getAllUsersEndpointsExtension
 * @return {object} Returns all the extension endpoints of all users.
 */
function getAllUsersEndpointsExtension() {
  try {
    var res = {};
    var username, endpoints;

    for (username in users) {
      res[username] = getAllEndpointsExtension(username);
    }
    return res;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return {};
  }
}

/**
 * Returns the user associated with the specified extension endpoint.
 *
 * @method getUserUsingEndpointExtension
 * @param {string} exten The extension endpoint identifier
 * @return {string} The username associated with the specified extension endpoint.
 */
function getUserUsingEndpointExtension(exten) {
  try {
    return compAstProxy.getUsernameByExtension(exten);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns all users associated with the specified voicemail endpoint.
 *
 * @method getUsersUsingEndpointVoicemail
 * @param  {string} voicemail The voicemail endpoint identifier
 * @return {array}  Returns all the users associated with the specified voicemail endpoint.
 */
function getUsersUsingEndpointVoicemail(voicemail) {
  try {
    // check parameter
    if (typeof voicemail !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var result = [];
    var vmKey, userVms, username, endpoints;
    for (username in users) {
      // get all the voicemail endpoints of the user
      endpoints = users[username].getAllEndpoints();
      userVms = endpoints[endpointTypes.TYPES.voicemail];

      for (vmKey in userVms) {
        if (vmKey === voicemail) {
          // the user have the specified voicemail endpoint
          result.push(username);
        }
      }
    }
    return result;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return [];
  }
}

/**
 * Returns the phone password to be used to invoce HTTP apis.
 *
 * @method getPhoneWebPass
 * @param  {string} username The username
 * @param  {string} exten The extension identifier
 * @return {object} The phone web password used to invoke HTTP apis.
 */
function getPhoneWebPass(username, exten) {
  try {
    if (typeof username !== 'string' || typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      logger.log.warn(IDLOG, 'getting the phone web username: the user "' + username + '" does not exist');
      return {};
    }

    // gets all endpoints, extracts the extension endpoints
    var extens = (users[username].getAllEndpoints())[endpointTypes.TYPES.extension];
    var e;
    for (e in extens) {
      if (e === exten) {
        return extens[e].getWebApiPassword();
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the phone username to be used to invoce HTTP apis.
 *
 * @method getPhoneWebUser
 * @param  {string} username The username
 * @param  {string} exten The extension identifier
 * @return {object} The phone web username used to invoke HTTP apis.
 */
function getPhoneWebUser(username, exten) {
  try {
    if (typeof username !== 'string' || typeof exten !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      logger.log.warn(IDLOG, 'getting the phone web username: the user "' + username + '" does not exist');
      return {};
    }

    // gets all endpoints, extracts the extension endpoints
    var extens = (users[username].getAllEndpoints())[endpointTypes.TYPES.extension];
    var e;
    for (e in extens) {
      if (e === exten) {
        return extens[e].getWebApiUser();
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Delete all the user settings from the database.
 *
 * @method deleteSettings
 * @param {string} username The username
 * @param {function} cb The callback function
 */
function deleteSettings(username, cb) {
  try {
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      var msg = 'deleting user settings: user "' + username + '" does not exist';
      logger.log.warn(IDLOG, msg);
      cb(msg);
      return;
    }
    compDbconn.deleteUserSettings(username, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Delete a single user setting from the database.
 *
 * @method deleteSetting
 * @param {string} username The username
 * @param {string} prop The property to be deleted
 * @param {function} cb The callback function
 */
function deleteSetting(username, prop, cb) {
  try {
    if (typeof username !== 'string' || typeof prop !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (typeof users[username] !== 'object') {
      var msg = 'deleting user setting "' + prop + '": user "' + username + '" does not exist';
      logger.log.warn(IDLOG, msg);
      cb(msg);
      return;
    }
    compDbconn.deleteUserSetting(username, prop, function (err) {
      cb(err);
      // if deleted prop is "avatar" an event is emitted
      if (!err && prop === 'avatar') {
        logger.log.info(IDLOG, 'emit event "' + EVT_USER_PROFILE_AVATAR_CHANGED + '"');
        emitter.emit(EVT_USER_PROFILE_AVATAR_CHANGED, { username: username });
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Save the user settings into the database.
 *
 * @method saveSettings
 * @param {string} username The username
 * @param {object} data The JSON data object
 * @param {function} cb The callback function
 */
function saveSettings(username, data, cb) {
  try {
    if (typeof username !== 'string' ||
      typeof data !== 'object' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // check the user existence
    if (typeof users[username] !== 'object') {
      var msg = 'saving user settings: user "' + username + '" does not exist';
      logger.log.warn(IDLOG, msg);
      cb(msg);
      return;
    }
    compDbconn.saveUserSettings(username, data, function(err) {
      cb(err);
      // if the key saved is "avatar" it launches an event
      if (!err && (Object.keys(data)).indexOf('avatar') !== -1) {
        // emit the event for tell to other modules that the user profile avatar has changed
        logger.log.info(IDLOG, 'emit event "' + EVT_USER_PROFILE_AVATAR_CHANGED + '"');
        emitter.emit(EVT_USER_PROFILE_AVATAR_CHANGED, {
          username: username,
          avatar: data.avatar
        });
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Returns the user settings from the database.
 *
 * @method getUserSettings
 * @param {string} username The username
 * @param {function} cb The callback function
 */
function getUserSettings(username, cb) {
  try {
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check the user existence
    if (typeof users[username] !== 'object') {
      var msg = 'gettings user settings: user "' + username + '" does not exist';
      logger.log.warn(IDLOG, msg);
      cb(msg);
      return;
    }
    compDbconn.getUserSettings(username, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Check the configuration status.
 *
 * @method isConfigured
 * @return {boolean} True if the component has been configured.
 */
function isConfigured() {
  try {
    return configured;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

// public interface
exports.on = on;
exports.config = config;
exports.reload = reload;
exports.setLogger = setLogger;
exports.setPresence = setPresence;
exports.getPresence = getPresence;
exports.getQueueIds = getQueueIds;
exports.EVT_RELOADED = EVT_RELOADED;
exports.isConfigured = isConfigured;
exports.saveSettings = saveSettings;
exports.getUsernames = getUsernames;
exports.isUserPresent = isUserPresent;
exports.isExtenWebrtc = isExtenWebrtc;
exports.setCompDbconn = setCompDbconn;
exports.deleteSetting = deleteSetting;
exports.deleteSettings = deleteSettings;
exports.getUserSettings = getUserSettings;
exports.getUserInfoJSON = getUserInfoJSON;
exports.EVT_USERS_READY = EVT_USERS_READY;
exports.getPhoneWebUser = getPhoneWebUser;
exports.setCompAstProxy = setCompAstProxy;
exports.getPresenceList = getPresenceList;
exports.getPhoneWebPass = getPhoneWebPass;
exports.getEndpointsJSON = getEndpointsJSON;
exports.getVoicemailList = getVoicemailList;
exports.setPresenceOnBusy = setPresenceOnBusy;
exports.getPresenceOnBusy = getPresenceOnBusy;
exports.getConfigurations = getConfigurations;
exports.setConfigurations = setConfigurations;
exports.getAllEndpointsEmail = getAllEndpointsEmail;
exports.hasExtensionEndpoint = hasExtensionEndpoint;
exports.hasCellphoneEndpoint = hasCellphoneEndpoint;
exports.getEndpointVoicemail = getEndpointVoicemail;
exports.hasVoicemailEndpoint = hasVoicemailEndpoint;
exports.getUsernamesWithData = getUsernamesWithData;
exports.setMobilePhoneNumber = setMobilePhoneNumber;
exports.getPresenceListOnBusy = getPresenceListOnBusy;
exports.updateUserMainPresence = updateUserMainPresence;
exports.getPresenceOnUnavailable = getPresenceOnUnavailable;
exports.setPresenceOnUnavailable = setPresenceOnUnavailable;
exports.getPresenceCallforwardTo = getPresenceCallforwardTo;
exports.getAllEndpointsExtension = getAllEndpointsExtension;
exports.getAllEndpointsCellphone = getAllEndpointsCellphone;
exports.getEndpointMainExtension = getEndpointMainExtension;
exports.getAllUsersEndpointsJSON = getAllUsersEndpointsJSON;
exports.EVT_USER_PRESENCE_CHANGED = EVT_USER_PRESENCE_CHANGED;
exports.getPresenceListOnUnavailable = getPresenceListOnUnavailable;
exports.getAllUsersEndpointsExtension = getAllUsersEndpointsExtension;
exports.getUserUsingEndpointExtension = getUserUsingEndpointExtension;
exports.getUsersUsingEndpointVoicemail = getUsersUsingEndpointVoicemail;
exports.getPresenceOnBusyCallforwardTo = getPresenceOnBusyCallforwardTo;
exports.EVT_USER_MAIN_PRESENCE_CHANGED = EVT_USER_MAIN_PRESENCE_CHANGED;
exports.EVT_USER_PROFILE_AVATAR_CHANGED = EVT_USER_PROFILE_AVATAR_CHANGED;
exports.getPresenceOnUnavailableCallforwardTo = getPresenceOnUnavailableCallforwardTo;
exports.getParamUrl = getParamUrl;
exports.getAllUserExtensions = getAllUserExtensions;