/**
 * Provides the customer card functions.
 *
 * @module customer_card
 * @main customer_card
 */
var fs = require('fs');
var ejs = require('ejs');
var path = require('path');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

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
 * The event emitter.
 *
 * @property emitter
 * @type object
 * @private
 */
var emitter = new EventEmitter();

/**
 * Provides the customer card functionalities.
 *
 * @class customer_card
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
 * @default [customer_card]
 */
var IDLOG = '[customer_card]';

/**
 * The configuration file path of the privacy.
 *
 * @property CONFIG_PRIVACY_FILEPATH
 * @type string
 * @private
 */
var CONFIG_PRIVACY_FILEPATH;

/**
 * The configuration file path.
 *
 * @property CONFIG_FILEPATH
 * @type string
 * @private
 */
var CONFIG_FILEPATH;

/**
 * The default file extension of the customer cards templates.
 *
 * @property TEMPLATE_EXTENSION
 * @type string
 * @private
 * @final
 * @readOnly
 * @default ".ejs"
 */
var TEMPLATE_EXTENSION = '.ejs';

/**
 * The directory path of the templates used by the customer card component.
 *
 * @property templatesPath
 * @type string
 * @private
 */
var templatesPath;

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
 * The authorization architect component used for customer card functions.
 *
 * @property compAuthorization
 * @type object
 * @private
 */
var compAuthorization;

/**
 * The user architect component.
 *
 * @property compUser
 * @type object
 * @private
 */
var compUser;

/**
 * All the ejs templates used for the customer cards. The keys are the name of the
 * customer card and the values are objects. These objects have two keys:
 *
 * + _index:_ the sequence used to show the customer card in order
 * + _content:_ the content of the customer card
 *
 * @property ejsTemplates
 * @type object
 * @private
 */
var ejsTemplates = {};

/**
 * The string used to hide phone numbers in privacy mode.
 *
 * @property privacyStrReplace
 * @type {string}
 * @private
 * @final
 * @readOnly
 * @default "xxx"
 */
var privacyStrReplace = 'xxx';

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
 * Set the module to be used for database functionalities.
 *
 * @method setDbconn
 * @param {object} dbConnMod The dbconn module.
 */
function setDbconn(dbconnMod) {
  try {
    // check parameter
    if (typeof dbconnMod !== 'object') {
      throw new Error('wrong dbconn object');
    }
    dbconn = dbconnMod;
    logger.log.info(IDLOG, 'set dbconn module');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get a customer card.
 *
 * @method getCustomerCardPreview
 * @param {string} query The query
 * @param {string} dbconnId The db connection identifier
 * @param {string} templateName The template name
 * @param {function} cb The callback function
 */
function getCustomerCardPreview(query, dbconnId, templateName, cb) {
  try {
    // check parameters
    if (typeof query !== 'string' ||
      typeof dbconnId !== 'string' ||
      typeof templateName !== 'string' ||
      typeof cb !== 'function') {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    logger.log.info(IDLOG, 'get customer card preview with template name "' + templateName + '"');

    if (!dbconn.checkDbconnCustCardByConnId(dbconnId)) {
      logger.log.warn(IDLOG, 'no db connection for customer card preview (dbconnId: "' + dbconnId + '")');
      cb('no db connection for customer card preview (dbconnId: "' + dbconnId + '")');

    } else if (!ejsTemplates[templateName]) {
      logger.log.warn(IDLOG, 'no template ejs ("' + templateName + '") for customer card preview');
      cb('no template ejs ("' + templateName + '") for customer card preview');

    } else {

      dbconn.getCustomerCardPreview(query, dbconnId, templateName, function(err, results) {
        try {
          if (err) { // some error in the query
            logger.log.error(IDLOG, err);
            cb(err);

          } else { // add the result

            var html = getCustomerCardHTML(templateName, '', results);
            var obj = {
              html: new Buffer(html).toString('base64')
            };
            cb(null, obj);
          }
        } catch (error) {
          logger.log.error(IDLOG, error.stack);
          cb(error);
        }
      });
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Get a customer card.
 *
 * @method getCustomerCardByNum
 * @param {string} permissionId The permission identifier of the customer card in asterisk.rest_cti_permissions
 * @param {string} ccName The customer card name
 * @param {string} num The number used to search the customer card
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

    logger.log.info(IDLOG, 'search customer card "' + ccName + '" (permission_id: ' + permissionId +
      ') by number ' + num + ' by means dbconn module');

    dbconn.getCustomerCardByNum(permissionId, ccName, num, function(err1, results) {
      try {
        if (err1) {
          logger.log.error(IDLOG, 'getting customer card "' + ccName + '" (permission_id: ' + permissionId + ') by num "' + num + '"');
          cb(err1);
          return;
        }
        cb(null, results);

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
 * Return the list of the customer cards.
 *
 * @method getCustomerCardsList
 * @param {string} username The identifier of the user
 * @param {function} cb The callback function
 */
function getCustomerCardsList(username, cb) {
  try {
    if (typeof username !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // get the list of the authorized customer cards. It is an array with
    // the identifiers of customer cards as strings
    var allowedCC = compAuthorization.authorizedCustomerCards(username);
    logger.log.info(IDLOG, 'user "' + username + '" is authorized to view customer cards: "' + JSON.stringify(allowedCC) + '"');
    var obj = {}; // object with all results
    var i;
    for (i = 0; i < allowedCC.length; i++) {
      obj[allowedCC[i].name] = {
        descr: dbconn.getCustCardNameDescr(allowedCC[i].permissionId)
      };
    }
    logger.log.info(IDLOG, Object.keys(obj).length + ' customer cards obtained for user "' + username + '"');
    cb(null, obj);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Set the authorization architect component used by customer card functions.
 *
 * @method setCompAuthorization
 * @param {object} ca The authorization architect component.
 */
function setCompAuthorization(ca) {
  try {
    compAuthorization = ca;
    logger.log.info(IDLOG, 'set authorization architect component');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Set the user architect component.
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

/**
 * Return the customer card in HTML format.
 *
 * @method getCustomerCardHTML
 * @param  {string} templateName The name of the template file
 * @param  {string} nameDescr The customer card description name
 * @param  {array}  data The customer card data
 * @return {string} The customer card in HTML format or an empty string in error case.
 * @private
 */
function getCustomerCardHTML(templateName, nameDescr, data) {
  try {
    // check parameters
    if (typeof templateName !== 'string' || typeof nameDescr !== 'string' || !(data instanceof Array)) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return ejs.render(ejsTemplates[templateName].content, {
      name: nameDescr,
      results: data
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return '';
  }
}

/**
 * Gets all authorized customer cards of the user and returns them in the specified format.
 *
 * @method getAllCustomerCards
 * @param {string} username The identifier of the user
 * @param {string} num The number used to search the customer cards
 * @param {string} format The format of the customer card data to be returned. It is contained in the data key of the returned object
 * @param {function} cb The callback function
 */
function getAllCustomerCards(username, num, format, cb) {
  try {
    // check parameters
    if (typeof username !== 'string' ||
      typeof num !== 'string' ||
      typeof cb !== 'function' ||
      (format !== 'json' && format !== 'html')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // get the list of the authorized customer cards. It is an array with
    // the identifiers of customer cards as strings
    var allowedCC = compAuthorization.authorizedCustomerCards(username);
    logger.log.info(IDLOG, 'user "' + username + '" is authorized to view customer cards: "' + JSON.stringify(allowedCC) + '"');

    var obj = {}; // object with all results

    // parallel execution
    async.each(allowedCC, function(cc, callback) {

      var templateName = dbconn.getCustCardTemplateName(cc.permissionId);
      var ccNameDescr = dbconn.getCustCardNameDescr(cc.permissionId);

      if (!dbconn.checkDbconnCustCard(cc.permissionId)) {
        logger.log.warn(IDLOG, 'no db connection for customer card "' + cc.name + '"');
        callback();

      } else if (!ejsTemplates[templateName]) {
        logger.log.warn(IDLOG, 'no template ejs for customer card "' + cc.name + '"');
        callback();

      } else {

        getCustomerCardByNum(cc.permissionId, cc.name, num, function(err, result) { // get one customer card
          try {
            if (err) { // some error in the query
              logger.log.error(IDLOG, err);

            } else { // add the result

              var formattedData;
              if (format === 'html') {
                formattedData = getCustomerCardHTML(templateName, ccNameDescr, result);

              } else if (format === 'json') {
                formattedData = result.data;
              }

              obj[cc.name] = {
                data: (format === 'html' ? (new Buffer(formattedData).toString('base64')) : formattedData),
                number: num,
                descr: ccNameDescr
              };
            }
            callback();

          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            callback();
          }
        });
      }

    }, function(err) {

      logger.log.info(IDLOG, Object.keys(obj).length + ' customer cards "' + Object.keys(obj).join(',') + '" obtained for user "' + username + '" searching num ' + num);
      cb(null, obj);
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Filter customer card "calls" obscuring phone numbers that do not involve the user.
 *
 * @method filterPrivacyCcCalls
 * @param  {string} username The identifier of the user
 * @param  {string} num      The number used to search the customer cards
 * @param  {array}  calls    The list of the calls
 * @return {array}  The received call list with hides numbers.
 */
function filterPrivacyCcCalls(username, num, calls) {
  try {
    if (typeof username !== 'string' ||
      typeof num !== 'string' ||
      (calls instanceof Array) !== true) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var extens = compUser.getAllEndpointsExtension(username);

    var i;
    for (i = 0; i < calls.length; i++) {
      if (!extens[calls[i].src] && !extens[calls[i].dst]) {
        calls[i].src = privacyStrReplace;
        calls[i].dst = privacyStrReplace;
        calls[i].clid = privacyStrReplace;
      }
    }
    return calls;

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Initialize the ejs templates used to render the customer cards.
 *
 * @method start
 */
function start() {
  try {
    initEjsTemplates();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Initializes the ejs templates used to render the customer cards.
 *
 * @method initEjsTemplates
 * @private
 */
function initEjsTemplates() {
  try {
    var i, ccname, content, filename, filepath;
    var customFilenames = fs.readdirSync(templatesPath);

    // template files to read. The keys are the name of the files
    // and the values are the path of the files
    var filesToRead = {};
    // load all the template files into the filesToRead
    for (i = 0; i < customFilenames.length; i++) {

      filename = customFilenames[i];
      filepath = path.join(templatesPath, filename);

      // add file to read only if the file extension is correct
      if (path.extname(filepath) === TEMPLATE_EXTENSION) {
        filesToRead[filename] = filepath;
      }
    }

    // read the content of all the ejs templates
    for (filename in filesToRead) {

      filepath = filesToRead[filename];
      content = fs.readFileSync(filepath, 'utf8');
      ccname = filename.slice(0, -4);

      ejsTemplates[ccname] = {
        content: content
      };
      logger.log.info(IDLOG, 'ejs template ' + filepath + ' has been read');
    }
    logger.log.info(IDLOG, 'initialized ejs customer cards templates');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Configures the module by using the specified JSON configuration file.
 *
 * @method config
 * @param {string} path The path of the JSON configuration file
 */
function config(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new Error('wrong parameter: ' + path);
    }

    // check the file existence
    if (!fs.existsSync(path)) {
      logger.log.error(IDLOG, path + ' does not exist');
      return;
    }
    CONFIG_FILEPATH = path;

    var json = JSON.parse(fs.readFileSync(CONFIG_FILEPATH, 'utf8'));

    // check the configuration file
    if (typeof json !== 'object' ||
      typeof json.rest !== 'object' ||
      typeof json.rest.customer_card !== 'object' ||
      typeof json.rest.customer_card.templates_customercards !== 'string') {

      logger.log.warn(IDLOG, CONFIG_FILEPATH + ': wrong "customer_card" key in rest section');
      return;
    }

    templatesPath = json.rest.customer_card.templates_customercards;
    logger.log.info(IDLOG, 'configuration done by ' + CONFIG_FILEPATH);

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Customize the privacy used to hide phone numbers by a configuration file.
 * The file must use the JSON syntax.
 *
 * @method configPrivacy
 * @param {string} path The path of the configuration file
 */
function configPrivacy(path) {
  try {
    // check parameter
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter: ' + path);
    }

    // check file presence
    if (!fs.existsSync(path)) {
      throw new Error(path + ' does not exist');
    }
    CONFIG_PRIVACY_FILEPATH = path;

    // read configuration file
    var json = JSON.parse(fs.readFileSync(CONFIG_PRIVACY_FILEPATH, 'utf8'));

    // initialize the string used to hide last digits of phone numbers
    if (json.privacy_numbers) {
      privacyStrReplace = json.privacy_numbers;
    } else {
      logger.log.warn(IDLOG, 'no privacy string has been specified in JSON file ' + CONFIG_PRIVACY_FILEPATH);
    }
    logger.log.info(IDLOG, 'privacy configuration by file ' + CONFIG_PRIVACY_FILEPATH + ' ended');

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Reload the component.
 *
 * @method reset
 * @private
 */
function reset() {
  try {
    var k;
    for (k in ejsTemplates) {
      delete ejsTemplates[k];
    }
    ejsTemplates = {};

    templatesPath = null;
    privacyStrReplace = 'xxx';
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
    reset();
    config(CONFIG_FILEPATH);
    configPrivacy(CONFIG_PRIVACY_FILEPATH);
    start();
    logger.log.info(IDLOG, 'emit event "' + EVT_RELOADED + '"');
    emitter.emit(EVT_RELOADED);
    logger.log.warn(IDLOG, 'reloaded');
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

exports.on = on;
exports.start = start;
exports.reload = reload;
exports.config = config;
exports.setLogger = setLogger;
exports.setDbconn = setDbconn;
exports.setCompUser = setCompUser;
exports.EVT_RELOADED = EVT_RELOADED;
exports.configPrivacy = configPrivacy;
exports.getAllCustomerCards = getAllCustomerCards;
exports.getCustomerCardByNum = getCustomerCardByNum;
exports.getCustomerCardsList = getCustomerCardsList;
exports.setCompAuthorization = setCompAuthorization;
exports.getCustomerCardPreview = getCustomerCardPreview;
