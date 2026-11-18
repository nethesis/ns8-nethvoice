/**
 * Provides the phonebook functions.
 *
 * @module phonebook
 * @main phonebook
 */
var async = require('async');

/**
 * Provides the phonebook functionalities.
 *
 * @class phonebook
 * @static
 */

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [phonebook]
 */
var IDLOG = '[phonebook]';

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
 * The dbconn module.
 *
 * @property dbconn
 * @type object
 * @private
 */
var dbconn;

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
 * Gets the phonebook contacts searching in the centralized and
 * NethCTI phonebook databases.
 *
 * @method getPbContactsContains
 * @param {string} term The term to search. It can be a name or a number
 * @param {string} username The name of the user used to search contacts in the cti phonebook
 * @param {string} [view] The view by which serve results
 * @param {integer} [offset] The results offset
 * @param {integer} [limit] The results limit
 * @param {function} cb The callback function
 */
function getPbContactsContains(term, username, view, offset, limit, cb) {
  try {
    // check parameters
    if (typeof term !== 'string' || typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    dbconn.getAllContactsContains(term, username, view, offset, limit, function(err, results) {
      try {
        if (err) { // some error in the query
          logger.log.error(IDLOG, err);
        } else { // add the result
          logger.log.info(IDLOG, 'found ' + results.length + ' contacts in centralized and cti phonebooks ' +
            ' that contains the term ' + term);
        }
        cb(err, results);

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Gets the phonebook contacts searching in the centralized and
 * NethCTI phonebook databases that contain at least one email address.
 *
 * @method getEmailPbContactsContains
 * @param {string} term The term to search. It can be a name or a number
 * @param {string} username The name of the user used to search contacts in the cti phonebook
 * @param {function} cb The callback function
 */
function getEmailPbContactsContains(term, username, cb) {
  try {
    if (typeof term !== 'string' || typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    dbconn.getEmailAllContactsContains(term, username, function(err, results) {
      try {
        if (err) {
          logger.log.error(IDLOG, err);
        } else {
          logger.log.info(IDLOG, 'found ' + results.length + ' email contacts in centralized and cti phonebooks that contains the term ' + term);
        }
        cb(err, results);
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Gets the phonebook contacts from the centralized and
 * NethCTI phonebook databases.
 *
 * @method getAllPbContacts
 * @param {string} username The name of the user used to search contacts in the cti phonebook
 * @param {integer} [offset] The results offset
 * @param {integer} [limit] The results limit
 * @param {function} cb The callback function
 */
function getAllPbContacts(username, offset, limit, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    dbconn.getAllContactsAlphabetically(username, offset, limit, function(err, results) {
      try {
        if (err) { // some error in the query
          logger.log.error(IDLOG, err);
        } else { // add the result
          logger.log.info(IDLOG, 'found ' + results.length + ' contacts in centralized and cti phonebooks ordered alphabetically');
        }
        cb(err, results);

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Returns the cti phonebook contact.
 *
 * @method getCtiPbContact
 * @param {string}   id The contact identifier in the cti phonebook database
 * @param {function} cb The callback function
 */
function getCtiPbContact(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.log.info(IDLOG, 'search cti phonebook contact using db contact id "' + id + '" by means dbconn module');
    dbconn.getCtiPbContact(id, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Returns the centralized phonebook contact.
 *
 * @method getPbContact
 * @param {string}   id The contact identifier in the centralized phonebook database
 * @param {function} cb The callback function
 */
function getPbContact(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.log.info(IDLOG, 'search centralized phonebook contact using db contact id "' + id + '" by means dbconn module');
    dbconn.getPbContact(id, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Returns all the speeddial contacts of the specified user.
 *
 * @method getPbSpeeddialContacts
 * @param {string}   username The name of the user
 * @param {function} cb       The callback function
 */
function getPbSpeeddialContacts(username, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.log.info(IDLOG, 'search all speeddial contacts of the user "' + username + '" in the cti phonebook by means dbconn module');
    dbconn.getCtiPbSpeeddialContacts(username, function(err, result) {
      try {
        if (err) { // some error in the query
          logger.log.error(IDLOG, err);
          cb(err);
          return;
        }
        cb(null, result);

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Deletes all speed dials of the user.
 *
 * @method deleteAllUserSpeeddials
 * @param {string} username The username
 * @param {function} cb The callback function
 */
function deleteAllUserSpeeddials(username, cb) {
  try {
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    logger.log.info(IDLOG, 'delete all speed dials of user "' + username + '"');
    dbconn.deleteAllUserSpeeddials(username, function(err, result) {
      try {
        if (err) {
          logger.log.error(IDLOG, err);
          cb(err);
          return;
        }
        cb(null, { num: result });
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Deletes the cti phonebook contact.
 *
 * @method deleteCtiPbContact
 * @param {string}   id The contact identifier in the cti phonebook database
 * @param {function} cb The callback function
 */
function deleteCtiPbContact(id, cb) {
  try {
    // check parameters
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.log.info(IDLOG, 'delete cti phonebook contact using db contact id "' + id + '" by means dbconn module');
    dbconn.deleteCtiPbContact(id, function(err, result) {
      try {
        if (err) { // some error in the query
          logger.log.error(IDLOG, err);
          cb(err);
          return;
        }
        cb(null, result);

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Modify the cti phonebook contact.
 *
 * @method modifyCtiPbContact
 * @param {object} data
 *   @param {string} data.id     The unique identifier of the contact
 *   @param {string} [data.type] The type of the contact
 *   @param {string} [data.name] The name of the contact
 *   @param {string} [data.homeemail]
 *   @param {string} [data.workemail]
 *   @param {string} [data.homephone]
 *   @param {string} [data.workphone]
 *   @param {string} [data.cellphone]
 *   @param {string} [data.fax]
 *   @param {string} [data.title]
 *   @param {string} [data.company]
 *   @param {string} [data.notes]
 *   @param {string} [data.homestreet]
 *   @param {string} [data.homepob]
 *   @param {string} [data.homecity]
 *   @param {string} [data.homeprovince]
 *   @param {string} [data.homepostalcode]
 *   @param {string} [data.homecountry]
 *   @param {string} [data.workstreet]
 *   @param {string} [data.workpob]
 *   @param {string} [data.workcity]
 *   @param {string} [data.workprovince]
 *   @param {string} [data.workpostalcode]
 *   @param {string} [data.workcountry]
 *   @param {string} [data.url]
 *   @param {string} [data.extension]
 *   @param {string} [data.speeddial_num]
 * @param {function} cb The callback function
 */
function modifyCtiPbContact(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof data.id !== 'string' || typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.log.info(IDLOG, 'modify cti phonebook contact using db contact id "' + data.id + '" by means dbconn module');
    dbconn.modifyCtiPbContact(data, function(err, result) {
      try {
        if (err) { // some error in the query
          logger.log.error(IDLOG, err);
          cb(err);
          return;
        }
        cb(null);

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Gets the phonebook contacts whose name starts with the specified term,
 * searching in the centralized or NethCTI phonebook databases.
 *
 * @method getPbContactsStartsWith
 * @param {string}   term     The term to search. It can be a name or a number
 * @param {string}   username The name of the user used to search contacts in the cti phonebook
 * @param {string}   [view]   The view by which serve results
 * @param {integer}  [offset]   The results offset
 * @param {integer}  [limit]    The results limit
 * @param {function} cb       The callback function
 */
function getPbContactsStartsWith(term, username, view, offset, limit, cb) {
  try {
    // check parameters
    if (typeof term !== 'string' || typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    dbconn.getAllContactsStartsWith(term, username, view, offset, limit, function(err, results) {
      try {
        if (err) { // some error in the query
          logger.log.error(IDLOG, err);
        } else { // add the result
          logger.log.info(IDLOG, 'found ' + results.length + ' contacts in centralized and cti phonebook ' +
            'searching contacts "starts with" ' + 'the term ' + term);
        }
        cb(err, results);

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Gets the phonebook contacts whose name starts with a digit, searching in
 * the centralized or NethCTI phonebook databases.
 *
 * @method getPbContactsStartsWithDigit
 * @param {string}   username The name of the user used to search contacts in the cti phonebook
 * @param {string}   [view]   The view by which serve the results
 * @param {integer}  [offset]   The results offset
 * @param {integer}  [limit]    The results limit
 * @param {function} cb       The callback function
 */
function getPbContactsStartsWithDigit(username, view, offset, limit, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    dbconn.getAllContactsStartsWithDigit(username, view, offset, limit, function(err, results) {
      try {
        if (err) { // some error in the query
          logger.log.error(IDLOG, err);
        } else { // add the result
          logger.log.info(IDLOG, 'found ' + results.length + ' contacts in centralized and cti phonebook ' +
            'searching contacts "starts with digit"');
        }
        cb(err, results);

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Set the module to be used for database functionalities.
 *
 * @method setDbconn
 * @param {object} dbConnMod The dbconn module.
 */
function setDbconn(dbconnMod) {
  try {
    // check parameter
    if (typeof dbconnMod !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    dbconn = dbconnMod;
    logger.log.info(IDLOG, 'set dbconn module');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Save the contact in the NethCTI phonebook database using dbconn module.
 *
 * @method saveCtiPbContact
 * @param {object} data
 *   @param {string} data.creator The creator identifier of the contact
 *   @param {string} data.type    The type of the contact
 *   @param {string} data.name    The name of the contact
 *   @param {string} [data.homeemail]
 *   @param {string} [data.workemail]
 *   @param {string} [data.homephone]
 *   @param {string} [data.workphone]
 *   @param {string} [data.cellphone]
 *   @param {string} [data.fax]
 *   @param {string} [data.title]
 *   @param {string} [data.company]
 *   @param {string} [data.notes]
 *   @param {string} [data.homestreet]
 *   @param {string} [data.homepob]
 *   @param {string} [data.homecity]
 *   @param {string} [data.homeprovince]
 *   @param {string} [data.homepostalcode]
 *   @param {string} [data.homecountry]
 *   @param {string} [data.workstreet]
 *   @param {string} [data.workpob]
 *   @param {string} [data.workcity]
 *   @param {string} [data.workprovince]
 *   @param {string} [data.workpostalcode]
 *   @param {string} [data.workcountry]
 *   @param {string} [data.url]
 *   @param {string} [data.extension]
 *   @param {string} [data.speeddial_num]
 * @param {function} cb The callback function
 */
function saveCtiPbContact(data, cb) {
  try {
    // check parameter
    if (typeof data  !== 'object'   || typeof data.type    !== 'string' ||
        typeof cb    !== 'function' || typeof data.creator !== 'string' ||
        data.creator === ''         || typeof data.name    !== 'string' ||
        (data.type   !== 'private'  && data.type           !== 'public' && data.type !== 'speeddial')) {

          throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // adapt data to the database
    data.owner_id = data.creator;
    delete data.creator;

    logger.log.info(IDLOG, 'save cti phonebook contact by means dbconn module');
    dbconn.saveCtiPbContact(data, cb);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Save the contact in the NethCTI phonebook database using dbconn module.
 *
 * @method importCsvSpeedDial
 * @param {string} file64 The csv file content base64 encoded
 * @param {string} username The user who imports
 * @param {function} cb The callback function
 */
function importCsvSpeedDial(file64, username, cb) {
  try {
    if (typeof file64 !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    var str = new Buffer(file64.split(',')[1], 'base64').toString();
    var arr = str.split('\r\n');
    var headers = arr[0].split(',');
    arr.shift();
    arr.splice(-1, 1);
    var sparr, i;
    var functs = arr.map(function (spstr) {
      sparr = spstr.split(',');
      var data = {};
      for (i = 0; i < headers.length; i++) {
        data[headers[i]] = sparr[i];
      }
      data.type = 'speeddial';
      data.creator = username;
      delete data.owner_id;
      return function(callback) {
        saveCtiPbContact(data, function (err) {
          callback();
        });
      }
    });
    async.parallel(functs,
      function (err) {
        if (err) {
          logger.log.error(IDLOG, err);
        }
        cb(null, { num: functs.length });
        logger.log.info(IDLOG, 'imported # ' + functs.length + ' speed dial from csv by user "' + username + '"');
      }
    );
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

// public interface
exports.setLogger = setLogger;
exports.setDbconn = setDbconn;
exports.getPbContact = getPbContact;
exports.getCtiPbContact = getCtiPbContact;
exports.saveCtiPbContact = saveCtiPbContact;
exports.deleteCtiPbContact = deleteCtiPbContact;
exports.modifyCtiPbContact = modifyCtiPbContact;
exports.getPbContactsContains = getPbContactsContains;
exports.getEmailPbContactsContains = getEmailPbContactsContains;
exports.getPbSpeeddialContacts = getPbSpeeddialContacts;
exports.getPbContactsStartsWith = getPbContactsStartsWith;
exports.getPbContactsStartsWithDigit = getPbContactsStartsWithDigit;
exports.importCsvSpeedDial = importCsvSpeedDial;
exports.deleteAllUserSpeeddials = deleteAllUserSpeeddials;
exports.getAllPbContacts = getAllPbContacts;