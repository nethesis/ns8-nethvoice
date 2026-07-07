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

function getHistoryRowValues(row) {
  if (row && row.dataValues) {
    return row.dataValues;
  }
  return row;
}

function extractVoicemailMailbox(lastdata, fallbackMailbox) {
  if (typeof lastdata === 'string' && lastdata !== '') {
    var mailboxMatch = lastdata.match(/([A-Za-z0-9*#+._-]+)@/);
    if (mailboxMatch && mailboxMatch[1]) {
      return mailboxMatch[1];
    }

    var firstToken = lastdata.split(',')[0];
    if (typeof firstToken === 'string' && firstToken !== '') {
      return firstToken.trim();
    }
  }

  if (typeof fallbackMailbox === 'string' && fallbackMailbox !== '') {
    return fallbackMailbox;
  }

  return '';
}

function normalizeMailboxValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function isVoicemailMailboxAllowed(rowValues, allowedMailboxes) {
  if (!(allowedMailboxes instanceof Array) || allowedMailboxes.length === 0) {
    return true;
  }

  var mailbox = normalizeMailboxValue(extractVoicemailMailbox(rowValues.lastdata, rowValues.dst));
  if (mailbox === '') {
    return false;
  }

  return allowedMailboxes.some(function(allowedMailbox) {
    return normalizeMailboxValue(String(allowedMailbox || '')) === mailbox;
  });
}

function normalizeCallerValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  var trimmedValue = value.trim();
  if (trimmedValue === '') {
    return '';
  }

  var calleridMatch = trimmedValue.match(/<([^>]+)>/);
  if (calleridMatch && calleridMatch[1]) {
    trimmedValue = calleridMatch[1].trim();
  }

  return trimmedValue.replace(/[^0-9A-Za-z*#+]/g, '').toLowerCase();
}

function areCallerValuesCompatible(leftValue, rightValue) {
  var normalizedLeft = normalizeCallerValue(leftValue);
  var normalizedRight = normalizeCallerValue(rightValue);

  if (normalizedLeft === '' || normalizedRight === '') {
    return false;
  }

  var numericRegexp = /^[0-9]+$/;
  if (numericRegexp.test(normalizedLeft) && numericRegexp.test(normalizedRight)) {
    return normalizedLeft === normalizedRight ||
      normalizedLeft.slice(-normalizedRight.length) === normalizedRight ||
      normalizedRight.slice(-normalizedLeft.length) === normalizedLeft;
  }

  return normalizedLeft === normalizedRight;
}

function buildCallerCandidates(rowValues) {
  var candidates = [rowValues.src, rowValues.cnum, rowValues.clid];
  var uniqueCandidates = [];

  candidates.forEach(function(candidate) {
    var normalizedCandidate = normalizeCallerValue(candidate);
    if (normalizedCandidate !== '' && uniqueCandidates.indexOf(normalizedCandidate) === -1) {
      uniqueCandidates.push(normalizedCandidate);
    }
  });

  return uniqueCandidates;
}

function getCallAnchorTimestamp(rowValues) {
  var candidates = [rowValues.linkedid, rowValues.uniqueid, rowValues.time];

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var timestamp = null;

    if (typeof candidate === 'string' && candidate !== '') {
      var match = candidate.match(/^(\d{10})/);
      if (match && match[1]) {
        timestamp = parseInt(match[1], 10);
      }
    } else if (typeof candidate === 'number') {
      timestamp = parseInt(candidate, 10);
    }

    if (!isNaN(timestamp) && timestamp > 0) {
      return timestamp;
    }
  }

  return null;
}

function getVoicemailTimeBounds(rowValues) {
  var callStart = getCallAnchorTimestamp(rowValues);
  var duration = parseInt(rowValues.duration, 10);

  if (callStart === null) {
    return null;
  }

  if (isNaN(duration) || duration < 0) {
    duration = 0;
  }

  return {
    from: Math.max(callStart - 300, 0),
    to: callStart + duration + 900
  };
}

function getCallEndTimestamp(rowValues) {
  var callStart = getCallAnchorTimestamp(rowValues);
  var duration = parseInt(rowValues.duration, 10);

  if (callStart === null) {
    return null;
  }

  if (isNaN(duration) || duration < 0) {
    duration = 0;
  }

  return callStart + duration;
}

function hasCloseVoicemailTimestamp(rowValues, matches, thresholdSeconds) {
  var callEndTimestamp = getCallEndTimestamp(rowValues);

  if (callEndTimestamp === null || !(matches instanceof Array) || matches.length === 0) {
    return false;
  }

  return matches.some(function(match) {
    var voicemailValues = getHistoryRowValues(match);
    var voicemailTimestamp = parseInt(voicemailValues.origtime, 10);

    if (isNaN(voicemailTimestamp)) {
      return false;
    }

    return Math.abs(voicemailTimestamp - callEndTimestamp) <= thresholdSeconds;
  });
}

function buildVoicemailMatchResult(hasMessage, messageId) {
  return {
    hasMessage: hasMessage === true,
    messageId: (hasMessage === true && messageId !== undefined && messageId !== null) ? String(messageId) : ''
  };
}

function findClosestVoicemailMatch(rowValues, matches, thresholdSeconds) {
  var callEndTimestamp = getCallEndTimestamp(rowValues);
  var closestMatch = null;
  var closestDistance = null;

  if (callEndTimestamp === null || !(matches instanceof Array) || matches.length === 0) {
    return null;
  }

  matches.forEach(function(match) {
    var voicemailValues = getHistoryRowValues(match);
    var voicemailTimestamp = parseInt(voicemailValues.origtime, 10);

    if (isNaN(voicemailTimestamp)) {
      return;
    }

    var distance = Math.abs(voicemailTimestamp - callEndTimestamp);
    if (distance > thresholdSeconds) {
      return;
    }

    if (closestDistance === null || distance < closestDistance) {
      closestDistance = distance;
      closestMatch = voicemailValues;
    }
  });

  return closestMatch;
}

function hasVoicemailMessage(rowValues) {
  var voicemailModel = compDbconnMain.models[compDbconnMain.JSON_KEYS.VOICEMAIL];
  var mailbox = extractVoicemailMailbox(rowValues.lastdata, rowValues.dst);
  var timeBounds = getVoicemailTimeBounds(rowValues);
  var callerCandidates = buildCallerCandidates(rowValues);

  if (!voicemailModel || mailbox === '' || timeBounds === null) {
    return hasVoicemailMessageByCallerAndTime(voicemailModel, timeBounds, callerCandidates);
  }

  compDbconnMain.incNumExecQueries();

  return voicemailModel.findAll({
    where: [
      'mailboxuser = ? AND origtime >= ? AND origtime <= ?',
      mailbox, String(timeBounds.from), String(timeBounds.to)
    ],
    attributes: ['callerid', 'origtime', 'id'],
    limit: 25
  }).then(function(matches) {
    if (!matches || matches.length === 0) {
      return hasVoicemailMessageByCallerAndTime(voicemailModel, timeBounds, callerCandidates);
    }

    var callerMatchedMatches = matches.filter(function(match) {
      var voicemailValues = getHistoryRowValues(match);

      if (callerCandidates.length === 0) {
        return false;
      }

      return callerCandidates.some(function(candidate) {
        return areCallerValuesCompatible(candidate, voicemailValues.callerid);
      });
    });

    if (callerMatchedMatches.length > 0) {
      var closestMailboxMatch = findClosestVoicemailMatch(rowValues, callerMatchedMatches, 10);
      if (closestMailboxMatch) {
        return buildVoicemailMatchResult(true, closestMailboxMatch.id);
      }
    }

    return buildVoicemailMatchResult(false, '');
  });
}

function hasVoicemailMessageByCallerAndTime(voicemailModel, timeBounds, callerCandidates) {
  if (!voicemailModel || timeBounds === null || callerCandidates.length === 0) {
    return Promise.resolve(buildVoicemailMatchResult(false, ''));
  }

  compDbconnMain.incNumExecQueries();

  return voicemailModel.findAll({
    where: [
      'origtime >= ? AND origtime <= ?',
      String(timeBounds.from), String(timeBounds.to)
    ],
    attributes: ['callerid', 'origtime', 'id', 'mailboxuser'],
    limit: 50
  }).then(function(matches) {
    if (!matches || matches.length === 0) {
      return buildVoicemailMatchResult(false, '');
    }

    var compatibleMatches = matches.filter(function(match) {
      var voicemailValues = getHistoryRowValues(match);

      return callerCandidates.some(function(candidate) {
        return areCallerValuesCompatible(candidate, voicemailValues.callerid);
      });
    });

    if (compatibleMatches.length !== 1) {
      return buildVoicemailMatchResult(false, '');
    }

    return buildVoicemailMatchResult(true, getHistoryRowValues(compatibleMatches[0]).id);
  });
}

function findLinkedVoicemailRow(rowValues) {
  var historyModel = compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL];

  if (!historyModel || typeof rowValues !== 'object' || !rowValues.linkedid || !rowValues.uniqueid) {
    return Promise.resolve(null);
  }

  compDbconnMain.incNumExecQueries();

  return historyModel.find({
    where: [
      'linkedid = ? AND uniqueid = ? AND lastapp = "VoiceMail"',
      rowValues.linkedid, rowValues.uniqueid
    ],
    order: 'calldate DESC'
  }).then(function(result) {
    return getHistoryRowValues(result);
  });
}

function enrichHistoryRowWithVoicemail(row, options) {
  var rowValues = getHistoryRowValues(row);
  var enrichOptions = options || {};

  if (!rowValues) {
    return Promise.resolve(row);
  }

  rowValues.reached_voicemail = rowValues.lastapp === 'VoiceMail';
  rowValues.has_voicemail_message = false;
  rowValues.voicemail_message_id = '';
  rowValues.normalized_disposition = rowValues.disposition;

  return findLinkedVoicemailRow(rowValues).then(function(linkedVoicemailRow) {
    var voicemailCandidate = rowValues.reached_voicemail === true ? rowValues : linkedVoicemailRow;

    if (!voicemailCandidate || voicemailCandidate.lastapp !== 'VoiceMail') {
      return row;
    }

    // VoiceMail means the call reached a mailbox, not that a person answered it.
    rowValues.reached_voicemail = true;
    rowValues.normalized_disposition = 'NO ANSWER';

    if (!isVoicemailMailboxAllowed(voicemailCandidate, enrichOptions.allowedMailboxes)) {
      return row;
    }

    return hasVoicemailMessage(voicemailCandidate).then(function(voicemailMatch) {
      rowValues.has_voicemail_message = voicemailMatch.hasMessage === true;
      rowValues.voicemail_message_id = voicemailMatch.messageId || '';
      return row;
    }, function(err) {
      logger.log.warn(IDLOG, 'checking voicemail message for history uniqueid "' + rowValues.uniqueid + '": ' + err.toString());
      return row;
    });
  }, function(err) {
    logger.log.warn(IDLOG, 'searching linked voicemail CDR for history uniqueid "' + rowValues.uniqueid + '": ' + err.toString());
    return row;
  });
}

function enrichHistoryResultsWithVoicemail(results, options) {
  if (!(results instanceof Array) || results.length === 0) {
    return Promise.resolve(results);
  }

  return Promise.all(results.map(function(row) {
    return enrichHistoryRowWithVoicemail(row, options);
  })).then(function() {
    return results;
  });
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
      ['MAX(duration)','duration'], ['IF (MIN(disposition) = "ANSWERED", MAX(billsec), MIN(billsec))','billsec'],
      'disposition', 'dcontext', 'lastapp', 'lastdata'
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

    // add queue value if the call is through queue
    attributes.push([
      '(select c.dst from cdr as c where c.uniqueid = cdr.linkedid and c.dst != cdr.dst and c.lastapp="Queue" limit 1)',
      'queue'
    ])

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
        (data.removeLostCalls ? ' AND disposition NOT IN ("NO ANSWER","BUSY","FAILED")' : '') +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
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
        'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)))' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
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
        'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
        data.endpoints, data.endpoints,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else {

      whereClause = [
        '(cnum IN (?) OR dst IN (?)) AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR dst_cnam LIKE ? OR ccompany LIKE ? OR dst_ccompany LIKE ?) AND ' +
        '(uniqueid,linkedid,disposition) NOT IN (SELECT uniqueid,linkedid,"NO ANSWER" disposition FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.uniqueid) AND ' +
        '((uniqueid,linkedid,channel,dstchannel) IN (SELECT uniqueid,linkedid,MAX(channel),MAX(dstchannel) FROM cdr AS b WHERE b.uniqueid = cdr.uniqueid AND b.linkedid = cdr.linkedid AND disposition = "NO ANSWER" ) OR disposition != "NO ANSWER")' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
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
      enrichHistoryResultsWithVoicemail(results, {
        allowedMailboxes: data.endpoints
      }).then(function(enrichedResults) {
        compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].count({
            where: whereClause,
            group: ['uniqueid','linkedid','disposition'],
            attributes: attributes
            }).then(function(count) {
                const res = {
                  count: count.length,
                  rows: enrichedResults
                }
                logger.log.info(IDLOG, res.count + ' results searching switchboard history call interval between ' + 
                    data.from + ' to ' + data.to + ' and filter ' + data.filter);
                cb(null, res);
            }, function(err) { // manage the error
                logger.log.error(IDLOG, 'counting switchboard history call interval between ' + data.from + ' to ' + data.to +
                    ' with filter ' + data.filter + ': ' + err.toString());
                cb(err.toString());
            });
      }, function(err) {
        logger.log.error(IDLOG, 'enriching history call interval with voicemail data between ' + data.from + ' to ' + data.to +
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
      ['MAX(duration)','duration'], ['IF (MIN(disposition) = "ANSWERED", MAX(billsec), MIN(billsec))','billsec'], 'disposition', 'dcontext', 'lastapp', 'lastdata'
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
        (data.removeLostCalls ? ' AND disposition NOT IN ("NO ANSWER","BUSY","FAILED")' : '') +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
        data.trunks,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else if (data.type === 'out') {

      whereClause = [
        'dstchannel REGEXP ? AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR dst_cnam LIKE ? OR dst_ccompany LIKE ?)' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
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
        'AND (disposition NOT IN ("NO ANSWER","BUSY","FAILED") OR (disposition IN ("NO ANSWER","BUSY","FAILED") AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)))' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
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
        'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
        data.trunks,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else {
      whereClause = [
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ? OR dst_cnam LIKE ? OR dst_ccompany LIKE ?) AND ' +
        '(uniqueid,linkedid,disposition) NOT IN (SELECT uniqueid,linkedid,"NO ANSWER" disposition FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.uniqueid) AND ' +
        '((uniqueid,linkedid,channel,dstchannel) IN (SELECT uniqueid,linkedid,MAX(channel),MAX(dstchannel) FROM cdr AS b WHERE b.uniqueid = cdr.uniqueid AND b.linkedid = cdr.linkedid AND disposition = "NO ANSWER" ) OR disposition != "NO ANSWER")' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
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
      enrichHistoryResultsWithVoicemail(results).then(function(enrichedResults) {
        compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].count({
            where: whereClause,
            group: ['uniqueid','linkedid','disposition'],
            attributes: attributes
             }).then(function(count) {
                const res = {
                  count: count.length,
                  rows: enrichedResults
                }
                logger.log.info(IDLOG, res.count + ' results searching switchboard history call interval between ' +
                    data.from + ' to ' + data.to + ' and filter ' + data.filter);
                cb(null, res);
            }, function(err) { // manage the error
                logger.log.error(IDLOG, 'counting switchboard history call interval between ' + data.from + ' to ' + data.to +
                    ' with filter ' + data.filter + ': ' + err.toString());
                cb(err.toString());
            });
      }, function(err) {
        logger.log.error(IDLOG, 'enriching switchboard history call interval with voicemail data between ' + data.from + ' to ' + data.to +
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
