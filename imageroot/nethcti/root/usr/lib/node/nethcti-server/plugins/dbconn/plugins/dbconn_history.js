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
 * @default [plugins/dbconn_history]
 */
var IDLOG = '[plugins/dbconn_history]';

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
 * Gets all the history sms of all the users into the interval time.
 * It can be possible to filter out the results specifying the filter. It search
 * the results into the _sms\_history_ database.
 *
 * @method getAllUserHistorySmsInterval
 * @param {object} data
 *   @param {string} data.from       The starting date of the interval in the YYYYMMDD format (e.g. 20130521)
 *   @param {string} data.to         The ending date of the interval in the YYYYMMDD format (e.g. 20130528)
 *   @param {string} [data.filter]   The filter to be used in the _recipient_ field. If it is
 *                                   omitted the function treats it as '%' string
 * @param {function} cb The callback function
 */
function getAllUserHistorySmsInterval(data, cb) {
  try {
    getHistorySmsInterval(data, cb);
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Get the history call of the specified endpoints into the interval time.
 * If the endpoints information is omitted, the results contains the
 * history call of all endpoints. Moreover, it can be possible to filter
 * the results specifying the filter and hide the phone numbers specifying
 * the privacy sequence to be used. It search the results into the
 * _asteriskcdrdb.cdr_ database.
 *
 * @method getHistoryCallInterval
 * @param {object} data
 *   @param {array}   data.endpoints    The endpoints involved in the research, e.g. the extesion
 *                                      identifiers. It is used to filter out the _cnum_ and _dst_ fields.
 *                                      If it is omitted the function treats it as ['%'] string. The '%'
 *                                      matches any number of characters, even zero character
 *   @param {string}  data.from         The starting date of the interval in the YYYYMMDD format (e.g. 20130521)
 *   @param {string}  data.to           The ending date of the interval in the YYYYMMDD format (e.g. 20130528)
 *   @param {boolean} data.recording    True if the data about recording audio file must be returned
 *   @param {string}  [data.filter]     The filter to be used in the _cnum, clid_ and _dst_ fields. If it is
 *                                      omitted the function treats it as '%' string
 *   @param {string}  [data.privacyStr] The sequence to be used to hide the numbers to respect the privacy
 *   @param {integer} [data.offset]     The results offset
 *   @param {integer} [data.limit]      The results limit
 *   @param {string}  [data.sort]       The sort field
 *   @param {string}  [data.direction]  The call direction
 *   @param {boolean} [removeLostCalls] True if you want to remove lost calls from the results
 * @param {function} cb The callback function
 */
function getHistoryCallInterval(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof cb !== 'function' ||
      typeof data.recording !== 'boolean' ||
      typeof data.to !== 'string' ||
      typeof data.from !== 'string' ||
      !(data.endpoints instanceof Array) ||
      (typeof data.filter !== 'string' && data.filter !== undefined) ||
      (typeof data.privacyStr !== 'string' && data.privacyStr !== undefined) ||
      (data.direction && data.direction !== 'in' && data.direction !== 'out' && data.direction !== 'lost')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // define the mysql field to be returned. The "recordingfile" field
    // is returned only if the "data.recording" argument is true
    var attributes = [
      ['UNIX_TIMESTAMP(calldate)', 'time'],
      'channel', 'dstchannel', 'uniqueid', 'linkedid', 'userfield',
      ['MAX(duration)','duration'], ['IF (MIN(disposition) = "ANSWERED", MAX(billsec), MIN(billsec))','billsec'], 'disposition', 'dcontext'
    ];
    if (data.recording === true) {
      attributes.push('recordingfile');
    }

    // if the privacy string is present, than hide the numbers
    if (data.privacyStr) {
      // the numbers are hidden
      attributes.push(['CONCAT( SUBSTRING(cnum, 1, LENGTH(cnum) - ' + data.privacyStr.length + '), "' + data.privacyStr + '")', 'cnum']);
      attributes.push(['CONCAT( SUBSTRING(src, 1, LENGTH(src) - ' + data.privacyStr.length + '), "' + data.privacyStr + '")', 'src']);
      attributes.push(['CONCAT( SUBSTRING(dst, 1, LENGTH(dst) - ' + data.privacyStr.length + '), "' + data.privacyStr + '")', 'dst']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'cnam']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'clid']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'ccompany']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'dst_cnam']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'dst_ccompany']);

    } else {
      // the numbers are clear
      attributes.push('cnum');
      attributes.push('cnam');
      attributes.push('ccompany');
      attributes.push('src');
      attributes.push('dst');
      attributes.push('dst_cnam');
      attributes.push('dst_ccompany');
      attributes.push('clid');
    }

    // add "direction" ("in" | "out" | "lost" | "") based on data.endpoints presence on "src" and "dst"
    var extens = data.endpoints.map(function(el) {
      return '"' + el + '"';
    });
    attributes.push([compDbconnMain.Sequelize.literal(
        'IF ( (cnum IN (' + extens + ') AND dst NOT IN (' + extens + ')), "out", ' +
        '(IF ( (cnum NOT IN (' + extens + ') AND dst IN (' + extens + ')), "in", ""))' +
        ')'),
      'direction'
    ]);

    // check optional parameters
    if (data.filter === undefined) {
      data.filter = '%';
    }

    data.from = data.from.substring(0,4) + '-' + data.from.substring(4,6) + '-' + data.from.substring(6,8) + ' 00:00:00';
    data.to = data.to.substring(0,4) + '-' + data.to.substring(4,6) + '-' + data.to.substring(6,8) + ' 23:59:59';
    var whereClause;

    if (data.direction && data.direction === 'in') {

      whereClause = [
        '(cnum NOT IN (?) AND dst IN (?)) AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ?)' +
        (data.removeLostCalls ? ' AND disposition NOT IN ("NO ANSWER","BUSY","FAILED")' : ''),
        data.endpoints, data.endpoints,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else if (data.direction && data.direction === 'out') {

      whereClause = [
        '(cnum IN (?) AND dst NOT IN (?)) AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR dst_cnam LIKE ? OR dst_ccompany LIKE ?)' +
        'AND (disposition NOT IN ("NO ANSWER","BUSY","FAILED")' +
        'OR (disposition IN ("NO ANSWER","BUSY","FAILED")' +
        'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)))',
        data.endpoints, data.endpoints,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else if (data.direction && data.direction === 'lost') {

      whereClause = [
        '(cnum NOT IN (?) AND dst IN (?)) AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ?) AND ' +
        'disposition IN ("NO ANSWER","BUSY","FAILED")' +
        'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)',
        data.endpoints, data.endpoints,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else {

      whereClause = [
        '(cnum IN (?) OR dst IN (?)) AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR dst_cnam LIKE ? OR ccompany LIKE ? OR dst_ccompany LIKE ?)',
        data.endpoints, data.endpoints,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%",
        "%" + data.filter + "%", "%" + data.filter + "%"
      ];
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].findAll({
      where: whereClause,
      attributes: attributes,
      offset: (data.offset ? parseInt(data.offset) : 0),
      limit: (data.limit ? parseInt(data.limit) : null),
      group: ['uniqueid','linkedid','disposition'],
      order: (data.sort ? data.sort : 'time desc')

    }).then(function(results) {
      compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].count({
          where: whereClause,
          group: ['uniqueid','linkedid','disposition'],
          attributes: attributes
          }).then(function(count) {
              const res = {
                count: count.length,
                rows: results
              }
              logger.log.info(IDLOG, res.count + ' results searching switchboard history call interval between ' +
                  data.from + ' to ' + data.to + ' and filter ' + data.filter);
              cb(null, res);
          }, function(err) { // manage the error
              logger.log.error(IDLOG, 'counting switchboard history call interval between ' + data.from + ' to ' + data.to +
                  ' with filter ' + data.filter + ': ' + err.toString());
              cb(err.toString());
          });
      }, function(err) { // manage the error
      logger.log.error(IDLOG, 'searching switchboard history call interval between ' + data.from + ' to ' + data.to +
        ' with filter ' + data.filter + ': ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Get the all history calls into the interval time. It can be possible
 * to filter the results specifying the filter and hide the phone numbers
 * specifying the privacy sequence to be used. It search the results into
 * the _asteriskcdrdb.cdr_ database.
 *
 * @method getHistorySwitchCallInterval
 * @param {object} data
 *   @param {array}  [data.trunks]      The trunk identifiers list. It is used to filter out the _channel_
 *                                      and _dstchannel_ fields to get out the type "in" and "out".
 *                                      If it is omitted the function treats it as ['%'] string. The '%'
 *                                      matches any number of characters, even zero character
 *   @param {string}  data.from         The starting date of the interval in the YYYYMMDD format (e.g. 20130521)
 *   @param {string}  data.to           The ending date of the interval in the YYYYMMDD format (e.g. 20130528)
 *   @param {boolean} data.recording    True if the data about recording audio file must be returned
 *   @param {string}  [data.filter]     The filter to be used in the _cnum, clid_ and _dst_ fields. If it is
 *                                      omitted the function treats it as '%' string
 *   @param {string}  [data.privacyStr] The sequence to be used to hide the numbers to respect the privacy
 *   @param {integer} [data.offset]     The results offset
 *   @param {integer} [data.limit]      The results limit
 *   @param {string}  [data.sort]       The sort field
 *   @param {string}  [data.type]       The call type ("in" | "out" | "internal" | "lost")
 *   @param {boolean} [removeLostCalls] True if you want to remove lost calls from the results
 * @param {function} cb The callback function
 */
function getHistorySwitchCallInterval(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' ||
      typeof cb !== 'function' ||
      typeof data.recording !== 'boolean' ||
      typeof data.to !== 'string' ||
      typeof data.from !== 'string' ||
      (data.trunks && !(data.trunks instanceof Array)) ||
      (typeof data.filter !== 'string' && data.filter !== undefined) ||
      (typeof data.privacyStr !== 'string' && data.privacyStr !== undefined) ||
      (data.type && data.type !== 'in' && data.type !== 'out' && data.type !== 'internal' && data.type !== 'lost')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // define the mysql field to be returned. The "recordingfile" field
    // is returned only if the "data.recording" argument is true
    var attributes = [
      ['UNIX_TIMESTAMP(calldate)', 'time'],
      'channel', 'dstchannel', 'uniqueid', 'linkedid', 'userfield',
      ['MAX(duration)','duration'], ['IF (MIN(disposition) = "ANSWERED", MAX(billsec), MIN(billsec))','billsec'], 'disposition', 'dcontext'
    ];
    if (data.recording === true) {
      attributes.push('recordingfile');
    }

    attributes.push([compDbconnMain.Sequelize.literal('"cti"'), 'source']);

    // add "type" ("in" | "out" | "internal") based on trunks channel presence
    data.trunks = data.trunks.join('|');
    if (data.trunks.length === 0) {
      data.trunks = '%';
    }
    attributes.push([compDbconnMain.Sequelize.literal(
        'IF (dstchannel REGEXP "' + data.trunks + '", "out", ' +
        '(IF (channel REGEXP "' + data.trunks + '", "in", "internal"))' +
        ')'),
      'type'
    ]);

    // if the privacy string is present, than hide the numbers
    if (data.privacyStr) {
      // the numbers are hidden
      attributes.push(['CONCAT( SUBSTRING(cnum, 1, LENGTH(cnum) - ' + data.privacyStr.length + '), "' + data.privacyStr + '")', 'cnum']);
      attributes.push(['CONCAT( SUBSTRING(src, 1, LENGTH(src) - ' + data.privacyStr.length + '), "' + data.privacyStr + '")', 'src']);
      attributes.push(['CONCAT( SUBSTRING(dst, 1, LENGTH(dst) - ' + data.privacyStr.length + '), "' + data.privacyStr + '")', 'dst']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'clid']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'cnam']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'ccompany']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'dst_cnam']);
      attributes.push(['CONCAT( "", "\\"' + data.privacyStr + '\\"")', 'dst_ccompany']);

    } else {
      // the numbers are clear
      attributes.push('cnum');
      attributes.push('cnam');
      attributes.push('ccompany');
      attributes.push('dst_cnam');
      attributes.push('dst_ccompany');
      attributes.push('src');
      attributes.push('dst');
      attributes.push('clid');
    }

    // check optional parameters
    if (data.filter === undefined) {
      data.filter = '%';
    }

    data.extens = '("' + data.extens.join('","') + '")';
    data.from = data.from.substring(0,4) + '-' + data.from.substring(4,6) + '-' + data.from.substring(6,8) + ' 00:00:00';
    data.to = data.to.substring(0,4) + '-' + data.to.substring(4,6) + '-' + data.to.substring(6,8) + ' 23:59:59';

    var whereClause;
    if (data.type === 'in') {

      whereClause = [
        '(' +
          'channel REGEXP ? OR ' +
          // include attended transfered calls
          '(' +
            'channel LIKE "Local/%;2" AND ' + // "Local/207@from-internal-000001f5;1"
            'cnum IN ' + data.extens + ' AND ' +
            'dst IN ' + data.extens + ' AND ' +
            'src NOT IN ' + data.extens +
          ')' +
          // end include attended transfered calls
        ') AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ?)' +
        (data.removeLostCalls ? ' AND disposition NOT IN ("NO ANSWER","BUSY","FAILED")' : ''),
        data.trunks,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else if (data.type === 'out') {

      whereClause = [
        'dstchannel REGEXP ? AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR dst_cnam LIKE ? OR dst_ccompany LIKE ?)',
        data.trunks,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else if (data.type === 'internal') {

      whereClause = [
        'channel NOT REGEXP ? AND ' +
        'channel NOT LIKE "%@from-queue-%" AND ' +
        'dstchannel NOT REGEXP ? AND ' +
        'src IN ' + data.extens + ' AND ' +
        'cnum IN ' + data.extens + ' AND ' +
        'dst IN ' + data.extens + ' AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ? OR dst_cnam LIKE ? OR dst_ccompany LIKE ?) ' +
        'AND (disposition NOT IN ("NO ANSWER","BUSY","FAILED") OR (disposition IN ("NO ANSWER","BUSY","FAILED") AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)))',
        data.trunks, data.trunks,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%",
        "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    }  else if (data.type === 'lost') {

      whereClause = [
        '(' +
          'channel REGEXP ? OR ' +
          // include attended transfered calls
          '(' +
            'channel LIKE "Local/%;2" AND ' + // "Local/207@from-internal-000001f5;1"
            'cnum IN ' + data.extens + ' AND ' +
            'dst IN ' + data.extens + ' AND ' +
            'src NOT IN ' + data.extens +
          ')' +
          // end include attended transfered calls
        ') AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ?) AND ' +
        'disposition IN ("NO ANSWER","BUSY","FAILED")' +
        'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)',
        data.trunks,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else {
      whereClause = [
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ? OR dst_cnam LIKE ? OR dst_ccompany LIKE ?)',
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%",
        "%" + data.filter + "%", "%" + data.filter + "%"
      ];
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].findAll({
      where: whereClause,
      attributes: attributes,
      offset: (data.offset ? parseInt(data.offset) : 0),
      limit: (data.limit ? parseInt(data.limit) : null),
      group: ['uniqueid','linkedid','disposition'],
      order: (data.sort ? data.sort : 'time desc')

    }).then(function(results) {
      compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].count({
          where: whereClause,
          group: ['uniqueid','linkedid','disposition'],
          attributes: attributes
           }).then(function(count) {
              const res = {
                count: count.length,
                rows: results
              }
              logger.log.info(IDLOG, res.count + ' results searching switchboard history call interval between ' +
                  data.from + ' to ' + data.to + ' and filter ' + data.filter);
              cb(null, res);
          }, function(err) { // manage the error
              logger.log.error(IDLOG, 'counting switchboard history call interval between ' + data.from + ' to ' + data.to +
                  ' with filter ' + data.filter + ': ' + err.toString());
              cb(err.toString());
          });
      }, function(err) { // manage the error
      logger.log.error(IDLOG, 'searching switchboard history call interval between ' + data.from + ' to ' + data.to +
        ' with filter ' + data.filter + ': ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}


/**
 * Get the history sms sent by the specified user into the interval time.
 * If the username information is omitted, the results contains the
 * history sms of all users. Moreover, it can be possible to filter
 * the results specifying the filter. It search the results into the
 * _sms_history_ database.
 *
 * @method getHistorySmsInterval
 * @param {object} data
 *   @param {string} [data.username] The user involved in the research. It is used to filter
 *                                   out the _sender_. If it is omitted the function treats it as '%' string. The '%'
 *                                   matches any number of characters, even zero character.
 *   @param {string} data.from       The starting date of the interval in the YYYYMMDD format (e.g. 20130521)
 *   @param {string} data.to         The ending date of the interval in the YYYYMMDD format (e.g. 20130528)
 *   @param {string} [data.filter]   The filter to be used in the _destination_ field. If it is
 *                                   omitted the function treats it as '%' string
 * @param {function} cb              The callback function
 */
function getHistorySmsInterval(data, cb) {
  try {
    // check parameters
    if (typeof data !== 'object' || typeof cb !== 'function' || typeof data.to !== 'string' || typeof data.from !== 'string' || (typeof data.username !== 'string' && data.username !== undefined) || (typeof data.filter !== 'string' && data.filter !== undefined)) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // the mysql operator for the sender field
    var operator = '=';

    // check optional parameters
    if (data.filter === undefined) {
      data.filter = '%';
    }
    if (data.username === undefined) {
      data.username = '%';
      operator = ' LIKE ';
    }

    // define the mysql fields to be returned
    var attributes = [
      ['DATE_FORMAT(date, "%d/%m/%Y")', 'datesent'],
      ['DATE_FORMAT(date, "%H:%i:%S")', 'timesent'],
      'id', 'status'
    ];

    // if the privacy string is present, than hide the numbers and names
    if (data.privacyStr) {
      // the numbers and names are hidden
      attributes.push(['CONCAT( SUBSTRING(destination, 1, LENGTH(destination) - ' + data.privacyStr.length + '), "' + data.privacyStr + '")', 'destination']);
      attributes.push(['CONCAT( "", "' + data.privacyStr + '")', 'sender']);
      attributes.push(['CONCAT( "", "' + data.privacyStr + '")', 'text']);

    } else {
      // the numbers and names are clear
      attributes.push('destination');
      attributes.push('sender');
      attributes.push('text');
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.SMS_HISTORY].findAll({
      where: [
        'sender' + operator + '? AND ' +
        '(DATE(date)>=? AND DATE(date)<=?) AND ' +
        '(destination LIKE ?)',
        data.username,
        data.from, data.to,
        data.filter
      ],
      attributes: attributes

    }).then(function(results) {

      // extract results to return in the callback function
      var i;
      for (i = 0; i < results.length; i++) {
        results[i] = results[i].selectedValues;
      }

      logger.log.info(IDLOG, results.length + ' results searching history sms interval between ' +
        data.from + ' to ' + data.to + ' sent by username "' + data.username + '" and filter ' + data.filter);
      cb(null, results);

    }, function(err) { // manage the error

      logger.log.error(IDLOG, 'searching history sms interval between ' + data.from + ' to ' + data.to +
        ' sent by username "' + data.username + '" and filter ' + data.filter + ': ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Checks if at least one of the specified extension of the list is involved in the recorded call.
 *
 * @method isAtLeastExtenInCall
 * @param {string}   uniqueid   The call identifier: is the _uniqueid_ field of the _asteriskcdrdb.cdr_ database table
 * @param {array}    extensions The list of the extensions to check
 * @param {function} cb         The callback function. If none of the extensions is involved in the call, the callback
 *                              is called with a false boolean value. Otherwise it is called with the entry of the database
 */
function isAtLeastExtenInCall(uniqueid, extensions, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' || typeof uniqueid !== 'string' || !(extensions instanceof Array)) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].find({
      where: [
        'uniqueid=? AND ' +
        '(cnum IN (?) OR dst IN (?))',
        uniqueid, extensions, extensions
      ],
      attributes: [
        ['DATE_FORMAT(calldate, "%Y")', 'year'],
        ['DATE_FORMAT(calldate, "%m")', 'month'],
        ['DATE_FORMAT(calldate, "%d")', 'day'],
        ['recordingfile', 'filename']
      ]

    }).then(function(result) {

      // extract result to return in the callback function
      if (result && result.dataValues) {
        logger.log.info(IDLOG, 'at least one extensions ' + extensions.toString() + ' is involved in the call with uniqueid ' + uniqueid);
        cb(null, result.dataValues);

      } else {
        logger.log.info(IDLOG, 'none of the extensions ' + extensions.toString() + ' is involved in the call with uniqueid ' + uniqueid);
        cb(null, false);
      }

    }, function(err) { // manage the error

      logger.log.error(IDLOG, 'checking if at least one extension of ' + extensions.toString() + ' is involved in the call with uniqueid ' + uniqueid);
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

apiList.isAtLeastExtenInCall = isAtLeastExtenInCall;
apiList.getHistorySmsInterval = getHistorySmsInterval;
apiList.getHistoryCallInterval = getHistoryCallInterval;
apiList.getHistorySwitchCallInterval = getHistorySwitchCallInterval;
apiList.getAllUserHistorySmsInterval = getAllUserHistorySmsInterval;

// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;
