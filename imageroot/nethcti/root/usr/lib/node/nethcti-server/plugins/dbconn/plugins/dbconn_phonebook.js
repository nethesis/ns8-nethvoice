/**
 * Provides database functions.
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
 * @default [plugins/dbconn_phonebook]
 */
var IDLOG = '[plugins/dbconn_phonebook]';

/**
 * The type name of the cti contacts imported into the centralized phonebook.
 *
 * @property NETHCTI_CENTRAL_TYPE
 * @type {string}
 * @private
 * @default "nethcti"
 */
var NETHCTI_CENTRAL_TYPE = 'nethcti';

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
 * Saves the new contact in the NethCTI phonebook that is in the
 * _cti\_phonebook_ database table.
 *
 * @method saveCtiPbContact
 * @param {object} data All the contact information to save in the database
 *   @param {string} data.owner_id    The owner of the contact
 *   @param {string} data.type        The type
 *   @param {string} data.name        The name
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
    if (typeof data !== 'object' || typeof cb !== 'function' ||
      typeof data.type !== 'string' || data.type === '' ||
      typeof data.owner_id !== 'string' || data.owner_id === '') {

      throw new Error('wrong parameter');
    }
    let column = ['owner_id','type','name','homeemail','workemail','homephone','workphone','cellphone','fax','title','company','notes','homestreet','homepob','homecity','homeprovince','homepostalcode','homecountry','workstreet','workpob','workcity','workprovince','workpostalcode','workcountry','url','extension','speeddial_num'];
    let attributes = '';
    let valuesPlaceholder = '';
    let values = [];
    for (let i = 0; i < column.length; i++) {
      if (data[column[i]]) {
        attributes += '`' + column[i] + '`,';
        valuesPlaceholder += '?,';
        values.push(data[column[i]]);
      }
    }
    attributes = attributes.substring(0, attributes.length - 1);
    valuesPlaceholder = valuesPlaceholder.substring(0, valuesPlaceholder.length - 1);
    let query = 'INSERT INTO `cti_phonebook` (' + attributes + ') VALUES (' + valuesPlaceholder + ')';
    compDbconnMain.dbConn['cti_phonebook'].query(
      query,
      values,
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, 'saving cti phonebook contact: ' + err.toString());
          cb(err.toString());
          return;
        }
        logger.log.info(IDLOG, 'cti phonebook contact saved successfully');
        cb();
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Delete the specified phonebook contact from the _cti\_phonebook_ database table.
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
    let query = 'DELETE FROM `cti_phonebook` WHERE owner_id=? AND type="speeddial"';
    compDbconnMain.dbConn['cti_phonebook'].query(
      query,
      [username],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, 'deleting cti phonebook speeddial contacts of the user "' + username + '": ' + err.toString());
          cb(err.toString());
          return;
        }
        logger.log.info(IDLOG, ' deleted all speed dial (#' + results.affectedRows + ') of user "' + username + '"');
        cb(null, results.affectedRows);
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Deletes the specified phonebook contact from the _cti\_phonebook_ database table.
 *
 * @method deleteCtiPbContact
 * @param {string}   id The cti database contact identifier
 * @param {function} cb The callback function
 */
function deleteCtiPbContact(id, cb) {
  try {
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let query = 'DELETE FROM `cti_phonebook` WHERE id=?';
    compDbconnMain.dbConn['cti_phonebook'].query(
      query,
      [id],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, 'searching cti phonebook contact with db id "' + id + '" to delete: ' + err.toString());
          cb(err.toString());
          return;
        }
        logger.log.info(IDLOG, 'cti phonebook contact with db id "' + id + '" has been deleted successfully');
        cb();
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Modify the specified phonebook contact in the _cti\_phonebook_ database table.
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
    if (typeof data !== 'object' || typeof data.id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let columns = ['type','name','homeemail','workemail','homephone','workphone','cellphone','fax','title','company','notes','homestreet','homepob','homecity','homeprovince','homepostalcode','homecountry','workstreet','workpob','workcity','workprovince','workpostalcode','workcountry','url','extension','speeddial_num'];
    let set = '';
    let values = [];
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] in data) {
        set += columns[i] + '=?,';
        values.push(data[columns[i]]);
      } else {
        values.push("");
      }
    }
    set = set.substring(0, set.length - 1);
    values.push(data.id);
    let query = 'UPDATE `cti_phonebook` SET ' + set + ' WHERE id=?';
    compDbconnMain.dbConn['cti_phonebook'].query(
      query,
      values,
      (err, results, fields) => {
      try {
        if (err) {
          var str = 'modify cti phonebook contact with db id "' + data.id + '": entry not found';
          logger.log.warn(IDLOG, str);
          cb(err);
          return;
        }
        logger.log.info(IDLOG, 'cti phonebook contact with db id "' + data.id + '" has been modified successfully');
        cb();
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Gets the phonebook contacts searching in the NethCTI and centralized phonebook databases.
 * The specified term is wrapped with '%' characters, so it searches
 * any occurrences of the term in the following fields: _name, company, workphone,
 * homephone, cellphone and extension_. It orders the results by _name_ and _company_
 * ascending. The NethCTI phonebook is the mysql _cti\_phonebook_.
 *
 * @method getAllContactsContains
 * @param {string}   term     The term to search. It can be a name or a number
 * @param {string}   username The name of the user used to search contacts
 * @param {string}   [view]   The view by which serve results
 * @param {integer}  [offset] The offset results start from
 * @param {integer}  [limit]  The results limit
 * @param {function} cb       The callback function
 */
function getAllContactsContains(term, username, view, offset, limit, cb) {
  try {
    // check parameters
    if (typeof term !== 'string' || typeof username !== 'string' || typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // add '%' to search all terms with any number of characters, even zero characters
    term = '%' + term + '%';

    if (view === 'person') {
      var sview = 'name LIKE ? ';
    } else if (view === 'company') {
      var sview = 'company LIKE ? ';
    } else {
      var sview = 'name LIKE ? OR company LIKE ? ';
    }

    var ctiPbBounds = '(owner_id=? OR type="public") ' +
      'AND ' +
      '(' + sview +
      'OR workphone LIKE ? ' +
      'OR homephone LIKE ? ' +
      'OR cellphone LIKE ? ' +
      'OR extension LIKE ? ' +
      'OR notes LIKE ?' +
      ')';

    var pbBounds = '(' + sview +
      'OR workphone LIKE ? ' +
      'OR homephone LIKE ? ' +
      'OR cellphone LIKE ? ' +
      'OR notes LIKE ?' +
      ') AND (' +
      'type != "' + NETHCTI_CENTRAL_TYPE + '"' +
      ')';

    getAllContacts(
      ctiPbBounds,
      pbBounds, [username, term, term, term, term, term, term, term, term, term, term, term, term, term],
      view,
      offset, limit,
      function(err, res) {
        if (err) {
          logger.log.error(IDLOG, 'searching cti and centralized phonebooks contacts that contains "' + term + '": ' + err.toString());
          cb(err.toString());
        } else {
          logger.log.info(IDLOG, res.count + ' results by searching cti and centralized phonebooks contacts that contains "' + term + '"');
          cb(null, res);
        }
      });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Gets the phonebook contacts searching in the NethCTI and centralized phonebook databases that
 * contain at least one email address.
 * The specified term is wrapped with '%' characters, so it searches
 * any occurrences of the term in the following fields: _name, company, workphone,
 * homephone, cellphone and extension_. It orders the results by _name_ and _company_
 * ascending. The NethCTI phonebook is the mysql _cti\_phonebook_.
 *
 * @method getEmailAllContactsContains
 * @param {string}   term     The term to search. It can be a name or a number
 * @param {string}   username The name of the user used to search contacts
 * @param {function} cb       The callback function
 */
function getEmailAllContactsContains(term, username, cb) {
  try {
    if (typeof term !== 'string' || typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    term = '%' + term + '%';

    // if (view === 'person') {
    //   var sview = 'name LIKE ? ';
    // } else if (view === 'company') {
    //   var sview = 'company LIKE ? ';
    // } else {
    //   var sview = 'name LIKE ? OR company LIKE ? ';
    // }

    var ctiPbBounds = '(owner_id=? OR type="public") ' +
      'AND ' +
      // '(' + sview +
      '(' +
        'name LIKE ? OR company LIKE ? ' +
        'OR workemail LIKE ? ' +
        'OR homeemail LIKE ? ' +
        'OR workphone LIKE ? ' +
        'OR homephone LIKE ? ' +
        'OR cellphone LIKE ? ' +
        'OR extension LIKE ? ' +
        'OR notes LIKE ?' +
      ') AND ' +
      '(workemail > "" OR homeemail > "")';

    // var pbBounds = '(' + sview +
    var pbBounds = '(name LIKE ? OR company LIKE ? ' +
      'OR workemail LIKE ? ' +
      'OR homeemail LIKE ? ' +
      'OR workphone LIKE ? ' +
      'OR homephone LIKE ? ' +
      'OR cellphone LIKE ? ' +
      'OR notes LIKE ?' +
    ') AND (' +
      'type != "' + NETHCTI_CENTRAL_TYPE + '"' +
    ') AND ' +
    '(workemail > "" OR homeemail > "")';

    getEmailAllContacts(
      ctiPbBounds,
      pbBounds,
      [username, term, term, term, term, term, term, term, term, term, term, term, term, term, term, term, term, term],
      // view,
      // offset, limit,
      function(err, res) {
        if (err) {
          logger.log.error(IDLOG, 'searching cti and centralized phonebooks email contacts that contains "' + term + '": ' + err.toString());
          cb(err.toString());
        } else {
          logger.log.info(IDLOG, res.count + ' results by searching cti and centralized phonebooks email contacts that contains "' + term + '"');
          cb(null, res);
        }
      });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Gets the phonebook contacts from the NethCTI and centralized phonebook databases.
 * It orders the results alphabetically.
 * The NethCTI phonebook is the mysql _cti\_phonebook_.
 *
 * @method getAllContactsAlphabetically
 * @param {string}   username The name of the user used to search contacts
 * @param {integer}  [offset] The offset results start from
 * @param {integer}  [limit]  The results limit
 * @param {function} cb       The callback function
 */
function getAllContactsAlphabetically(username, offset, limit, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var fields = [
      'id',
      'owner_id',
      'type',
      'homeemail',
      'workemail',
      'homephone',
      'workphone',
      'cellphone',
      'company',
      'fax',
      'title',
      'notes',
      'name',
      'homestreet',
      'homepob',
      'homecity',
      'homeprovince',
      'homepostalcode',
      'homecountry',
      'workstreet',
      'workpob',
      'workcity',
      'workprovince',
      'workpostalcode',
      'workcountry',
      'url'
    ].join(',');

    var query = [
      '(SELECT ', fields, ', extension, speeddial_num, name AS n',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE (name IS NOT NULL AND name != "") AND (owner_id=? OR type="public") AND (type!="speeddial"))',
      ' UNION ',
      '(SELECT ', fields, ', "" AS extension, "" AS speeddial_num, name AS n',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE (name IS NOT NULL AND name != "") AND (type != "nethcti"))',
      ' UNION ',
      '(SELECT ', fields, ', extension, speeddial_num, company AS n',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE (name IS NULL OR name = "") AND (company IS NOT NULL AND company != "") AND (owner_id=? OR type="public") AND (type != "speeddial"))',
      ' UNION ',
      '(SELECT ', fields, ', "" AS extension, "" AS speeddial_num, company AS n',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE (name IS NULL OR name = "") AND (company IS NOT NULL AND company != "") AND (type != "nethcti"))',
      ' ORDER BY n',
      (offset && limit ? ' LIMIT ?,?' : '')
    ].join('');

    // ensure limit and offset to be int
    offset = parseInt(offset)
    limit = parseInt(limit)

    compDbconnMain.dbConn['cti_phonebook'].query(
      query,
      [username, username, offset, limit],
      (err, results) => {
      try {
        compDbconnMain.incNumExecQueries();
        if (err) {
          cb(err, null);
          return;
        }
        var rows = results.map((row) => {
          delete row.n;
          return row;
        });
        cb(null, {
          rows: rows
        });
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }

}

/**
 * Gets the phonebook contacts from the centralized and nethcti address book.
 * At the end of the specified term is added the '%' character,
 * so it searches the entries whose fields _name_ and _company_
 * starts with the term. It orders the results by _name_ and _company_ ascending.
 * The centralized address book is the mysql _phonebook.phonebook_.
 *
 * @method getAllContactsStartsWith
 * @param {string} term The term to search. It can be a name or a number. It will ended with '%'
 *                      character to search any contacts with names that starts with the term.
 * @param {string} username The username
 * @param {string} [view] The view by which serve results
 * @param {integer} [offset] The offset results start from
 * @param {integer} [limit] The results limit
 * @param {function} cb The callback function
 */
function getAllContactsStartsWith(term, username, view, offset, limit, cb) {
  try {
    // check parameters
    if (typeof term !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // add '%' to search all terms with any number of characters, even zero characters
    term = term + '%';

    if (view === 'person') {
      var sview = 'name LIKE ? ';
    } else if (view === 'company') {
      var sview = 'company LIKE ? ';
    } else {
      var sview = 'name LIKE ? OR company LIKE ? ';
    }

    var ctiPbBounds = '(owner_id=? OR type="public") AND (' + sview + ')';
    var pbBounds = '(' + sview + ') AND (type != "' + NETHCTI_CENTRAL_TYPE + '")';

    getAllContacts(
      ctiPbBounds,
      pbBounds, [username, term, term, term, term],
      view,
      offset, limit,
      function(err, res) {
        if (err) {
          logger.log.error(IDLOG, 'searching cti and centralized phonebook contacts whose names starts with "' + term + '": ' + err.toString());
          cb(err.toString());
        } else {
          logger.log.info(IDLOG, res.count + ' results by searching cti and centralized phonebook contacts with names starts with "' + term + '"');
          cb(null, res);
        }
      });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Gets all the speeddial contacts of the specified user searching in
 * the NethCTI phonebook database. It searches all entries of he user
 * where _type_ field is equal to "speeddial". It orders the results by
 * _name_ and _company_ ascending. The NethCTI phonebook is the mysql
 * _cti\_phonebook_.
 *
 * @method getCtiPbSpeeddialContacts
 * @param {string}   username The name of the user used to search speeddial contacts
 * @param {function} cb       The callback function
 */
function getCtiPbSpeeddialContacts(username, cb) {
  try {
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let query = 'SELECT `id`, `owner_id`, `type`, `homeemail`, `workemail`, `homephone`, `workphone`, `cellphone`, `fax`, `title`, `company`, `notes`, `name`, `homestreet`, `homepob`, `homecity`, `homeprovince`, `homepostalcode`, `homecountry`, `workstreet`, `workpob`, `workcity`, `workprovince`, `workpostalcode`, `workcountry`, `url`, `extension`, `speeddial_num` FROM `cti_phonebook` WHERE owner_id=? AND type="speeddial" ORDER BY name ASC, company ASC';
    compDbconnMain.dbConn['cti_phonebook'].query(
      query,
      [username],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, 'searching cti phonebook speeddial contacts of the user "' + username + '": ' + err.toString());
          cb(err.toString());
          return;
        }
        logger.log.info(IDLOG, results.length + ' results by searching cti phonebook speeddial contacts of the user "' + username + '"');
        cb(null, results);
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Gets the phonebook and nethcti contacts searching in the NethCTI phonebook database.
 * Tt searches the entries whose fields _name_ and _company_ starts with a digit.
 * It orders the results by _name_ and _company_ ascending. The NethCTI
 * phonebook is the mysql _cti\_phonebook_.
 *
 * @method getAllContactsStartsWithDigit
 * @param {string}   username The name of the user used to search contacts
 * @param {string}   [view]   The view which by serve results
 * @param {integer}  [offset] The offset results start from
 * @param {integer}  [limit]  The results limit
 * @param {function} cb       The callback function
 */
function getAllContactsStartsWithDigit(username, view, offset, limit, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var ctiPbBounds = '(owner_id=? OR type="public") AND (name REGEXP "^[0-9]" OR company REGEXP "^[0-9]")';
    var pbBounds = '(name REGEXP "^[0-9]" OR company REGEXP "^[0-9]") AND (type != "' + NETHCTI_CENTRAL_TYPE + '")';

    getAllContacts(
      ctiPbBounds,
      pbBounds, [username],
      view,
      offset, limit,
      function(err, res) {
        if (err) {
          logger.log.error(IDLOG, 'searching cti phonebook contacts whose names starts with a digit: ' + err.toString());
          cb(err.toString());
        } else {
          logger.log.info(IDLOG, res.count + ' results by searching cti phonebook contacts whose names starts with a digit');
          cb(null, res);
        }
      });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the cti phonebook contact. It searches the _id_ field in the
 * _cti\_phonebook_ database table.
 *
 * @method getCtiPbContact
 * @param {string}   id The cti database contact identifier
 * @param {function} cb The callback function
 */
function getCtiPbContact(id, cb) {
  try {
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let query = 'SELECT `id`, `owner_id`, `type`, `homeemail`, `workemail`, `homephone`, `workphone`, `cellphone`, `fax`, `title`, `company`, `notes`, `name`, `homestreet`, `homepob`, `homecity`, `homeprovince`, `homepostalcode`, `homecountry`, `workstreet`, `workpob`, `workcity`, `workprovince`, `workpostalcode`, `workcountry`, `url`, `extension`, `speeddial_num`, "cti" AS `source` FROM `cti_phonebook` WHERE id=?';
    compDbconnMain.dbConn['cti_phonebook'].query(
      query,
      [id],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, 'search cti phonebook contact with db id "' + id + '" failed: ' + err.toString());
          cb(err.toString());
          return;
        }
        if (results && results.length > 0) {
          logger.log.info(IDLOG, 'search cti phonebook contact with db id "' + id + '" has been successful');
          cb(null, results[0]);
        } else {
          logger.log.info(IDLOG, 'search cti phonebook contact with db id "' + id + '": not found');
          cb(null, {});
        }
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the centralized phonebook contact. It searches the _id_ field in the
 * _phonebook_ database table.
 *
 * @method getPbContact
 * @param {string}   id The cti database contact identifier
 * @param {function} cb The callback function
 */
function getPbContact(id, cb) {
  try {
    if (typeof id !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let query = 'SELECT `id`, `owner_id`, `type`, `homeemail`, `workemail`, `homephone`, `workphone`, `cellphone`, `fax`, `title`, `company`, `notes`, `name`, `homestreet`, `homepob`, `homecity`, `homeprovince`, `homepostalcode`, `homecountry`, `workstreet`, `workpob`, `workcity`, `workprovince`, `workpostalcode`, `workcountry`, `url`, "centralized" AS `source` FROM `phonebook`WHERE id=?';
    compDbconnMain.dbConn['phonebook'].query(
      query,
      [id],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, 'search centralized phonebook contact with db id "' + id + '" failed: ' + err.toString());
          cb(err.toString());
          return;
        }
        if (results && results.length > 0) {
          logger.log.info(IDLOG, 'search centralized phonebook contact with id "' + id + '" has been successful');
          cb(null, results[0]);
        } else {
          logger.log.info(IDLOG, 'search centralized phonebook contact with id "' + id + '": not found');
          cb(null, {});
        }
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Utility private function
 * Executes the specified query asynchronously inside nethcti3 and phonebook db.
 *
 * @method pbQueryAsync
 * @param {string}   query The query to be executed
 * @param {object} replacements Values to be replaced inside the query
 * @private
 */
function pbQueryAsync (query, replacements) {
  try {
    return new Promise((resolve, reject) => {
      compDbconnMain.dbConn['cti_phonebook'].query(
        query,
        replacements,
        (err, results) => {
          try {
            compDbconnMain.incNumExecQueries();
            if (err) {
              reject(err.toString())
            }
            resolve(results);
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            reject(err.toString())
          }
        }
      );
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    reject(err.toString())
  }
}

/**
 * Utility private function
 * Executes the specified query asynchronously inside nethcti3 and phonebook db.
 *
 * @method pbQueryAsync
 * @param {string} query The query to be executed
 * @param {object} replacements Values to be replaced inside the query
 * @param {string} tag A tag identify the promise
 * @private
 */
 function pbQueryAsyncTag (query, replacements, company, tag) {
  try {
    return new Promise((resolve, reject) => {
      compDbconnMain.dbConn['cti_phonebook'].query(
        query,
        replacements,
        (err, results) => {
          try {
            compDbconnMain.incNumExecQueries();
            if (err) {
              reject(err.toString())
            }
            resolve({
              company: company,
              tag: tag,
              data: results
            });
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            reject(err.toString())
          }
        }
      );
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    reject(err.toString())
  }
}

/**
 * Utility private function
 * Execute a query (with count) on both cti and centralize phonebooks
 * through a union.
 *
 * @method getAllContacts
 * @param {string}   ctiPbBounds Cti phonebook query of union bounds
 * @param {string}   pbBounds Centralized phonebook query of union bounds
 * @param {array}    replacements Replacements for queries
 * @param {string}   [view] The view by which serve results
 * @param {integer}  [offset] The offset of results
 * @param {integer}  [limit] The limit of results
 * @param {function} cb The callback function
 * @private
 */
function getAllContacts(ctiPbBounds, pbBounds, replacements, view, offset, limit, cb) {
  try {
    var fields = [
      'id,',
      'owner_id,',
      'type,',
      'homeemail,',
      'workemail,',
      'homephone,',
      'workphone,',
      'cellphone,',
      'fax,',
      'title,',
      'company,',
      'notes,',
      'name,',
      'homestreet,',
      'homepob,',
      'homecity,',
      'homeprovince,',
      'homepostalcode,',
      'homecountry,',
      'workstreet,',
      'workpob,',
      'workcity,',
      'workprovince,',
      'workpostalcode,',
      'workcountry,',
      'url'
    ].join('');

    var query = [
      '(SELECT ', fields, ', extension, speeddial_num, \'cti\' AS source',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE ', ctiPbBounds,
      ' AND (type != \'speeddial\'))',
      ' UNION ',
      '(SELECT ', fields, ', \'\' AS extension, \'\' AS speeddial_num, \'centralized\' AS source',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE ', pbBounds, ')',
      ' ORDER BY company ASC, name ASC',
      (offset && limit ? ' LIMIT ' + offset + ',' + limit : '')
    ].join('');

    var companyXFields = [
      'owner_id,',
      'workstreet,',
      'workcity,',
      'workprovince,',
      'workcountry,',
      'workphone,',
      'homephone,',
      'cellphone,',
      'fax,',
      'workemail,',
      'url,',
      'type,',
      'title,',
      'notes'
    ].join('');

    var queryCompany = [
      'SELECT company',
      ' FROM (',
      '(SELECT company',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE ', ctiPbBounds,
      ' AND type != \'speeddial\')',
      ' UNION ',
      '(SELECT company',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE ', pbBounds, ')',
      ' ) t',
      ' ORDER BY company ASC',
      (offset && limit ? ' LIMIT ' + offset + ',' + limit : '')
    ].join('');

    var queryInfo = [
      'SELECT id, company, ', companyXFields, ', source',
      ' FROM (',
      '(SELECT id, name, company, ', companyXFields, ', \'cti\' AS source',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE (owner_id = ? OR type = "public") AND (company = ?)',
      ' AND (name IS NULL OR name = "")',
      ' AND (type != "speeddial"))',
      ' UNION ',
      '(SELECT id, name, company, ', companyXFields, ', \'centralized\' AS source',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE (company = ?) AND (type != "nethcti")',
      ' AND (name IS NULL OR name = ""))',
      ' ) t'
    ].join('');

    var contactsXFields = [
      'id,',
      'name'
    ].join('');

    var queryContacts = [
      'SELECT ', contactsXFields, ', source',
      ' FROM (',
      '(SELECT ', contactsXFields, ', \'cti\' AS source',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE (owner_id = ? OR type = "public") AND (company = ?)',
      ' AND (name IS NOT NULL AND name != "")',
      ' AND (type != \'speeddial\'))',
      ' UNION ',
      '(SELECT ', contactsXFields, ', \'centralized\' AS source',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE (company = ?) AND (type != "nethcti")',
      ' AND (name IS NOT NULL AND name != ""))',
      ' ) t',
      ' ORDER BY name ASC'
    ].join('');

    var queryCount = [
      'SELECT COUNT(*) AS total FROM (',
      '(SELECT id FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE ', ctiPbBounds,
      ' AND (type != \'speeddial\'))',
      ' UNION ALL',
      ' (SELECT id FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK, ' WHERE ', pbBounds, ')) s'
    ].join('');

    var queryCompanyCount = [
      'SELECT COUNT(company) AS total',
      ' FROM (',
      '(SELECT company',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE ', ctiPbBounds,
      ' AND (type != \'speeddial\'))',
      ' UNION ',
      '(SELECT company',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE ', pbBounds, ')',
      ') t'
    ].join('');

    // exec queries async
    Promise.all([
      pbQueryAsync(
        view === 'company' ? queryCompany : query,
        replacements
      ),
      pbQueryAsync(
        view === 'company' ? queryCompanyCount : queryCount,
        replacements
      )
    ]).then((values) => {
      let results = values[0]
      let totalCount = values[1][0].total

      // manage company results
      if (view === 'company' && results.length > 0)  {
        let promises = []
        results.forEach((result) => {
          let companyReplacements = [
            replacements[0],
            result.company,
            result.company
          ]
          // prepare company info query
          promises.push(
            pbQueryAsyncTag(
              queryInfo,
              companyReplacements,
              result.company,
              "info"
            )
          )
          // prepare company contacts query
          promises.push(
            pbQueryAsyncTag(
              queryContacts,
              companyReplacements,
              result.company,
              "contacts"
            )
          )
        })
        // manage results informations and contacts
        Promise.all(promises).then((values) => {
          // cicle results
          results.forEach((result) => {
            let companyValues = values.filter(value => value.company == result.company)
            companyValues.forEach((value) => {
              // add informations to result
              if (value.tag === "info") {
                result.id = value.data[0] ? value.data[0].id : null
                result.owner_id = value.data[0] ? value.data[0].owner_id : null
                result.workstreet = value.data[0] ? value.data[0].workstreet : null
                result.workcity = value.data[0] ? value.data[0].workcity : null
                result.workprovince = value.data[0] ? value.data[0].workprovince : null
                result.workcountry = value.data[0] ? value.data[0].workcountry : null
                result.workphone = value.data[0] ? value.data[0].workphone : null
                result.homephone = value.data[0] ? value.data[0].homephone : null
                result.cellphone = value.data[0] ? value.data[0].cellphone : null
                result.fax = value.data[0] ? value.data[0].fax : null
                result.workemail = value.data[0] ? value.data[0].workemail : null
                result.url = value.data[0] ? value.data[0].url : null
                result.type = value.data[0] ? value.data[0].type : null
                result.title = value.data[0] ? value.data[0].title : null
                result.notes = value.data[0] ? value.data[0].notes : null
                result.source = value.data[0] ? value.data[0].source : null
              }
              // add contacts to result
              if (value.tag === "contacts") {
                // stringify for backward compatibility
                result.contacts = JSON.stringify(value.data)
              }
            })
          })
          // return results in callback for company
          cb(null, {
            count: totalCount,
            rows: results
          });
        }).catch((error) => {
          console.error(error.message)
        });
      } else {
        // return results in callback for person and all
        cb(null, {
          count: totalCount,
          rows: results
        });
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Utility private function
 * Execute a query (with count) on both cti and centralize phonebooks
 * through a union searching for contacts that contain at least one email address.
 *
 * @method getEmailAllContacts
 * @param {string}   ctiPbBounds Cti phonebook query of union bounds
 * @param {string}   pbBounds Centralized phonebook query of union bounds
 * @param {array}    replacements Replacements for queries
 * @param {function} cb The callback function
 * @private
 */
function getEmailAllContacts(ctiPbBounds, pbBounds, replacements, cb) {
  try {
    var fields = [
      'id,',
      'owner_id,',
      'type,',
      'homeemail,',
      'workemail,',
      'homephone,',
      'workphone,',
      'cellphone,',
      'fax,',
      'title,',
      'company,',
      'notes,',
      'name,',
      'homestreet,',
      'homepob,',
      'homecity,',
      'homeprovince,',
      'homepostalcode,',
      'homecountry,',
      'workstreet,',
      'workpob,',
      'workcity,',
      'workprovince,',
      'workpostalcode,',
      'workcountry,',
      'url'
    ].join('');

    var query = [
      '(SELECT ', fields, ', extension, speeddial_num, \'cti\' AS source',
      ' FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK,
      ' WHERE ', ctiPbBounds, ')',
      ' UNION ',
      '(SELECT ', fields, ', \'\' AS extension, \'\' AS speeddial_num, \'centralized\' AS source',
      ' FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK,
      ' WHERE ', pbBounds,
      ' AND (type != \'speeddial\'))',
      ' ORDER BY company ASC, name ASC'
    ].join('');

    var queryCount = [
      'SELECT COUNT(*) AS total FROM (',
      '(SELECT id FROM nethcti3.', compDbconnMain.JSON_KEYS.CTI_PHONEBOOK, ' WHERE ', ctiPbBounds,
      ' AND (type != \'speeddial\'))',
      ' UNION ALL',
      ' (SELECT id FROM phonebook.', compDbconnMain.JSON_KEYS.PHONEBOOK, ' WHERE ', pbBounds, ')) s'
    ].join('');

    compDbconnMain.dbConn['cti_phonebook'].query(
      'SET @@group_concat_max_len = 65535',
      (err, results, fields) => {
      try {
        compDbconnMain.incNumExecQueries();
        if (err) {
          cb(err, null);
          return;
        }
        //
        compDbconnMain.dbConn['cti_phonebook'].query(
          // view === 'company' ? queryCompany : query,
          query,
          replacements,
          (err1, results1, fields1) => {
          try {
            compDbconnMain.incNumExecQueries();
            if (err1) {
              cb(err1, null);
              return;
            }
            //
            compDbconnMain.dbConn['cti_phonebook'].query(
              queryCount,
              // view === 'company' ? queryCompanyCount : queryCount,
              replacements,
              (err2, resultsCount, fields2) => {
              try {
                compDbconnMain.incNumExecQueries();
                if (err2) {
                  cb(err2, null);
                  return;
                }
                cb(null, {
                  count: resultsCount[0].total,
                  rows: results1
                });
                
              } catch (error) {
                logger.log.error(IDLOG, error.stack);
                cb(error);
              }
            });

          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            cb(error);
          }
        });
        
      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

apiList.getPbContact = getPbContact;
apiList.getCtiPbContact = getCtiPbContact;
apiList.saveCtiPbContact = saveCtiPbContact;
apiList.deleteCtiPbContact = deleteCtiPbContact;
apiList.modifyCtiPbContact = modifyCtiPbContact;
apiList.getAllContactsContains = getAllContactsContains;
apiList.getEmailAllContactsContains = getEmailAllContactsContains;
apiList.getCtiPbSpeeddialContacts = getCtiPbSpeeddialContacts;
apiList.getAllContactsStartsWith = getAllContactsStartsWith;
apiList.getAllContactsStartsWithDigit = getAllContactsStartsWithDigit;
apiList.deleteAllUserSpeeddials = deleteAllUserSpeeddials;
apiList.getAllContactsAlphabetically = getAllContactsAlphabetically;

// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;
