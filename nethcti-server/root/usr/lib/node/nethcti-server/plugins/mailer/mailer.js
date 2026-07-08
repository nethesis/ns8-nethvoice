/**
 * Provides the mail functions.
 *
 * @module mailer
 * @main arch_mailer
 */
const fs = require('fs');
const nodemailer = require('nodemailer');
const async = require('async');

/**
 * Provides the mail functionalities.
 *
 * @class mailer
 * @static
 */

/**
 * The module identifier used by the logger.log.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [mailer]
 */
const IDLOG = '[mailer]';

/**
 * The configuration file path.
 *
 * @property CONF_FILEPATH
 * @type string
 * @private
 */
let CONF_FILEPATH;

/**
 * The logger.log. It must have at least three methods: _info, warn and error._
 *
 * @property logger
 * @type object
 * @private
 * @default console
 */
let logger = console;

/**
 * The mail server port. It can be customized by the
 * configuration file.
 *
 * @property port
 * @type string
 * @private
 * @default "25"
 */
let port = '25';

/**
 * The address of the mail server. It can be customized by the
 * configuration file.
 *
 * @property address
 * @type string
 * @private
 * @default "localhost"
 */
let address = 'localhost';

/**
 * The email address of the sender. It can be customized by the
 * configuration file.
 *
 * @property sender
 * @type string
 * @private
 * @default "unknown"
 */
let sender = 'unknown';

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
 * Configurates by a configuration file that must use the JSON syntax.
 *
 * @method config
 * @param {string} path The path of the configuration file
 */
function config(path) {
  try {
    if (typeof path !== 'string') {
      throw new TypeError('wrong parameter');
    }
    if (!fs.existsSync(path)) {
      logger.log.warn(IDLOG, path + ' doesn\'t exist: use default values "' + address + '" "' + port + '" from "' + sender + '"');
      return;
    }
    CONF_FILEPATH = path;
    var json = JSON.parse(fs.readFileSync(CONF_FILEPATH, 'utf8'));
    if (typeof json.sender !== 'string' || json.sender === '' ||
    typeof json.port !== 'string' || json.port === '' ||
    typeof json.address !== 'string' || json.address === '') {
      
      logger.log.warn(IDLOG, 'wrong configuration file ' + path);
      return;
    }
    port = json.port;
    sender = json.sender;
    address = json.address;
    logger.log.info(IDLOG, 'configuration by file ' + path + ' ended');
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Sends an email.
 *
 * @method send
 * @param {string} to The destination email address
 * @param {string} subject The subject of the email
 * @param {string} body The body of the email
 */
async function send(to, body, subject) {
  try {
    if (typeof to !== 'string' ||
      typeof subject !== 'string' || typeof body !== 'string') {

      throw new Error('wrong parameters');
    }
    let smtpOptions = {
      port: port,
      host: address
    };
    let smtpTransport = nodemailer.createTransport(smtpOptions);
    logger.log.info(IDLOG, 'smtp transport created to ' + address + ':' + port);
    let mailOptions = {
      to: to,
      from: sender,
      text: body,
      subject: subject
    };
    let info = await smtpTransport.sendMail(mailOptions);
    logger.log.info(IDLOG, 'smtp transport from ' + address + ':' + port + ' has been closed');
    smtpTransport.close();
    return info;
  } catch (err) {
    logger.log.error(err.stack);
    return;
  }
}

/**
 * Sends an email to a list of destinations.
 *
 * @method sendToList
 * @param {object} list The list of the email to be send. Example:
 *   {
 *     "a@a.it": {
 *       "subject": "subject text",
 *       "body": "body text"
 *     },
 *     ...
 *   }
 */
async function sendToList(list) {
  try {
    if (typeof list !== 'object') {
      throw new Error('wrong parameters');
    }
    let smtpOptions = { port: port, host: address };
    let smtpTransport = nodemailer.createTransport(smtpOptions);
    logger.log.info(IDLOG, 'smtp transport created to ' + address + ':' + port);
    let mailOptions = { from: sender };
    let tosend = [];
    let results = {};
    let tempRes;
    for (let address in list) {
      mailOptions.to = address;
      mailOptions.text = list[address].body;
      mailOptions.subject = list[address].subject;
      tempRes = await smtpTransport.sendMail(mailOptions);
      logger.log.info(IDLOG, `send vc invitation to ${address}: ${JSON.stringify(tempRes, null, 2)}`);
      results[address] = { success: tempRes.accepted[0] === address.toLowerCase() ? true : false };
    }
    logger.log.info(IDLOG, `sent ${Object.keys(results).length} vc email invitations - results: ${JSON.stringify(results, null, 2)}`);
    smtpTransport.close();
    logger.log.info(IDLOG, 'smtp transport from ' + address + ':' + port + ' has been closed');
    return results;
  } catch (err) {
    logger.log.error(err.stack);
    return;
  }
}
exports.send = send;
exports.config = config;
exports.setLogger = setLogger;
exports.sendToList = sendToList;
