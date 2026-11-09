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

// Linkedids per query when looking up the VoiceMail legs of a page of rows.
var VOICEMAIL_LOOKUP_CHUNK = 500;

function getLinkedVoicemailKey(linkedid, uniqueid) {
  return linkedid + '|' + uniqueid;
}

/**
 * Finds the VoiceMail leg of each row, the latest one when a leg reached the
 * mailbox more than once. One query per chunk of linkedids instead of one per
 * row: a history page used to cost as many queries as it had rows.
 *
 * @method findLinkedVoicemailRows
 * @param {array} rowsValues The plain history rows
 * @return {Promise} Resolved with the VoiceMail legs keyed by linkedid and uniqueid
 * @private
 */
function findLinkedVoicemailRows(rowsValues) {
  var historyModel = compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL];
  var linkedids = {};

  rowsValues.forEach(function(rowValues) {
    if (rowValues && rowValues.lastapp !== 'VoiceMail' && rowValues.linkedid && rowValues.uniqueid) {
      linkedids[rowValues.linkedid] = true;
    }
  });

  var ids = Object.keys(linkedids);
  if (!historyModel || ids.length === 0) {
    return Promise.resolve({});
  }

  var chunks = [];
  for (var i = 0; i < ids.length; i += VOICEMAIL_LOOKUP_CHUNK) {
    chunks.push(ids.slice(i, i + VOICEMAIL_LOOKUP_CHUNK));
  }

  return Promise.all(chunks.map(function(chunk) {
    compDbconnMain.incNumExecQueries();
    return historyModel.findAll({
      where: ['linkedid IN (?) AND lastapp = "VoiceMail"', chunk],
      order: 'calldate DESC'
    });
  })).then(function(chunkResults) {
    var voicemailRows = {};
    chunkResults.forEach(function(results) {
      results.forEach(function(result) {
        var values = getHistoryRowValues(result);
        var key = getLinkedVoicemailKey(values.linkedid, values.uniqueid);
        // Ordered by calldate DESC: the first one is the latest.
        if (!voicemailRows[key]) {
          voicemailRows[key] = values;
        }
      });
    });
    return voicemailRows;
  });
}

function enrichHistoryRowWithVoicemail(row, options, linkedVoicemailRows) {
  var rowValues = getHistoryRowValues(row);
  var enrichOptions = options || {};

  if (!rowValues) {
    return Promise.resolve(row);
  }

  rowValues.reached_voicemail = rowValues.lastapp === 'VoiceMail';
  rowValues.has_voicemail_message = false;
  rowValues.voicemail_message_id = '';
  rowValues.normalized_disposition = rowValues.disposition;

  var linkedVoicemailRow = linkedVoicemailRows[getLinkedVoicemailKey(rowValues.linkedid, rowValues.uniqueid)];
  var voicemailCandidate = rowValues.reached_voicemail === true ? rowValues : linkedVoicemailRow;

  if (!voicemailCandidate || voicemailCandidate.lastapp !== 'VoiceMail') {
    return Promise.resolve(row);
  }

  // VoiceMail means the call reached a mailbox, not that a person answered it.
  rowValues.reached_voicemail = true;
  rowValues.normalized_disposition = 'NO ANSWER';

  if (!isVoicemailMailboxAllowed(voicemailCandidate, enrichOptions.allowedMailboxes)) {
    return Promise.resolve(row);
  }

  return hasVoicemailMessage(voicemailCandidate).then(function(voicemailMatch) {
    rowValues.has_voicemail_message = voicemailMatch.hasMessage === true;
    rowValues.voicemail_message_id = voicemailMatch.messageId || '';
    return row;
  }, function(err) {
    logger.log.warn(IDLOG, 'checking voicemail message for history uniqueid "' + rowValues.uniqueid + '": ' + err.toString());
    return row;
  });
}

function enrichHistoryResultsWithVoicemail(results, options) {
  if (!(results instanceof Array) || results.length === 0) {
    return Promise.resolve(results);
  }

  return findLinkedVoicemailRows(results.map(getHistoryRowValues)).then(function(linkedVoicemailRows) {
    return linkedVoicemailRows;
  }, function(err) {
    logger.log.warn(IDLOG, 'searching linked voicemail CDR for history rows: ' + err.toString());
    return {};
  }).then(function(linkedVoicemailRows) {
    return Promise.all(results.map(function(row) {
      return enrichHistoryRowWithVoicemail(row, options, linkedVoicemailRows);
    }));
  }).then(function() {
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
 * Reads the queues whose "answered elsewhere" option is on: only the calls
 * through one of them are marked answered elsewhere, as the phones of their
 * members do. The option is in the FreePBX database, which the CDR connection
 * cannot read. On failure the CDR disposition is left as it is.
 *
 * @method getAnsweredElsewhereQueues
 * @param {function} cb Called with the queue numbers
 * @private
 */
// The option changes only when an administrator edits a queue: it is read again
// after this many milliseconds instead of on every history request.
var ANSWERED_ELSEWHERE_QUEUES_TTL = 60000;
var answeredElsewhereQueuesCache = null;

function getAnsweredElsewhereQueues(cb) {
  if (answeredElsewhereQueuesCache && Date.now() - answeredElsewhereQueuesCache.readAt < ANSWERED_ELSEWHERE_QUEUES_TTL) {
    cb(answeredElsewhereQueuesCache.queues);
    return;
  }
  var conn = compDbconnMain.dbConn && compDbconnMain.dbConn[compDbconnMain.JSON_KEYS.AMPUSERS];
  if (!conn) {
    logger.log.warn(IDLOG, 'no connection to read the queues that mark calls answered elsewhere');
    cb([]);
    return;
  }
  conn.query(
    'SELECT `id` FROM `queues_details` WHERE `keyword` = "answered_elsewhere" AND LOWER(`data`) IN ("1","yes")',
    function (err, results) {
      if (err) {
        logger.log.warn(IDLOG, 'reading the queues that mark calls answered elsewhere: ' + err.toString());
        cb([]);
        return;
      }
      var queues = results.map(function (row) {
        return String(row.id);
      }).filter(function (id) {
        return /^[0-9]+$/.test(id);
      });
      answeredElsewhereQueuesCache = { queues: queues, readAt: Date.now() };
      cb(queues);
    }
  );
}

/**
 * Runs a history query once the queues that mark calls answered elsewhere are
 * known. They are kept in data.answeredElsewhereQueues for the caller.
 *
 * @method withAnsweredElsewhereQueues
 * @param {function} query The history query
 * @return {function} The query, taking the same arguments
 * @private
 */
function withAnsweredElsewhereQueues(query) {
  return function (data, cb) {
    getAnsweredElsewhereQueues(function (queues) {
      if (data && typeof data === 'object') {
        data.answeredElsewhereQueues = queues;
      }
      query(data, cb);
    });
  };
}

// The call went through a queue whose "answered elsewhere" option is on.
function getAnsweredElsewhereQueueCondition(rowAlias, queues) {
  return 'EXISTS (' +
    'SELECT 1 FROM cdr AS queue_call ' +
    'WHERE queue_call.linkedid = ' + rowAlias + '.linkedid ' +
      'AND queue_call.lastapp = "Queue" ' +
      'AND queue_call.dst IN ("' + queues.join('","') + '")' +
  ')';
}

// A ring the member missed before answering a later one: he took the call himself.
function getOwnMissedRingCondition(rowAlias) {
  return '(' +
    rowAlias + '.disposition IN ("NO ANSWER","BUSY","FAILED") AND ' +
    rowAlias + '.channel LIKE "Local/%@from-queue-%;2" AND ' +
    'EXISTS (' +
      'SELECT 1 FROM cdr AS own_answer ' +
      'WHERE own_answer.linkedid = ' + rowAlias + '.linkedid ' +
        'AND own_answer.disposition = "ANSWERED" ' +
        'AND own_answer.channel LIKE "Local/%@from-queue-%;2" ' +
        'AND own_answer.dst = ' + rowAlias + '.dst ' +
        'AND own_answer.calldate >= ' + rowAlias + '.calldate' +
    ')' +
  ')';
}

function getAnsweredElsewhereCondition(rowAlias, queues) {
  if (!queues || queues.length === 0) {
    return 'FALSE';
  }
  return '(' +
    rowAlias + '.disposition IN ("NO ANSWER","BUSY","FAILED") AND ' +
    rowAlias + '.channel LIKE "Local/%@from-queue-%;2" AND ' +
    'EXISTS (' +
      'SELECT 1 FROM cdr AS answered ' +
      'WHERE answered.linkedid = ' + rowAlias + '.linkedid ' +
        'AND answered.uniqueid <> ' + rowAlias + '.uniqueid ' +
        'AND answered.disposition IN ("ANSWERED","ANSWERED_ELSEWHERE") ' +
        'AND (' +
          'answered.lastapp = "Queue" OR ' +
          'answered.channel LIKE "Local/%@from-queue-%;2"' +
        ')' +
    ') AND ' +
    getAnsweredElsewhereQueueCondition(rowAlias, queues) + ' AND ' +
    'NOT ' + getOwnMissedRingCondition(rowAlias) +
  ')';
}

function getEffectiveDisposition(rowAlias, queues) {
  return 'CASE WHEN ' + getAnsweredElsewhereCondition(rowAlias, queues) +
    ' THEN "ANSWERED_ELSEWHERE" ELSE ' + rowAlias + '.disposition END';
}

function getAnsweredByNumber(rowAlias) {
  return '(SELECT answered.dst FROM cdr AS answered ' +
    'WHERE answered.linkedid = ' + rowAlias + '.linkedid ' +
      'AND answered.uniqueid <> ' + rowAlias + '.uniqueid ' +
      'AND answered.disposition = "ANSWERED" ' +
      'AND answered.channel LIKE "Local/%@from-queue-%;2" ' +
    'ORDER BY answered.calldate DESC, answered.billsec DESC ' +
    'LIMIT 1)';
}

function getQueueNumber(rowAlias) {
  return '(SELECT queue_call.dst FROM cdr AS queue_call ' +
    'WHERE queue_call.linkedid = ' + rowAlias + '.linkedid ' +
      'AND queue_call.lastapp = "Queue" ' +
      'AND queue_call.dst <> ' + rowAlias + '.dst ' +
    'ORDER BY queue_call.calldate ASC ' +
    'LIMIT 1)';
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
 *   @param {string}  data.from         The starting date of the interval in the YYYYMMDD[HHmm[ss]] format (e.g. 20130521 or 201305210930)
 *   @param {string}  data.to           The ending date of the interval in the YYYYMMDD[HHmm[ss]] format (e.g. 20130528 or 201305280930)
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
/**
 * Returns the GROUP BY used by the history queries.
 *
 * Rows are normally aggregated per (uniqueid, linkedid, disposition). A ring
 * group dials all its members from the SAME channel, so their legs share one
 * uniqueid, and the ones that ended the same way collapse into a single row
 * before the caller ever sees them — the ringing members are lost, and the
 * non-aggregated columns of the survivor (dst, dstchannel, ...) come from an
 * arbitrary leg of the group. Adding the destination channel, which is the
 * member that was rung, keeps one row per leg for a caller that asked to
 * expand them.
 *
 * @param {object} data The query parameters, as received by the caller.
 * @return {array} The columns to group by.
 * @private
 */
function historyGroupBy(data) {
  var group = ['uniqueid', 'linkedid', 'disposition'];
  if (data.expandLegs) {
    group.push('dstchannel');
  }
  return group;
}

/**
 * Returns the order of the calls when a page is made of calls, not legs, or
 * null when the requested sort cannot be applied to whole calls.
 *
 * @param {object} data The query parameters, as received by the caller.
 * @return {string|null} "ASC", "DESC" or null.
 * @private
 */
function getCallPageOrder(data) {
  var match = /^\s*time\s+(asc|desc)\s*$/i.exec(data.sort || 'time desc');
  return match ? match[1].toUpperCase() : null;
}

/**
 * Whether the caller asked for a page of calls (groupByCall): limit and offset
 * count calls, every leg of the calls in the page is returned, and count is the
 * number of calls. Without it a caller that groups the legs by linkedid has to
 * read the whole interval to build a single page.
 *
 * @param {object} data The query parameters, as received by the caller.
 * @return {boolean}
 * @private
 */
function isCallPageRequest(data) {
  return (data.groupByCall === true || data.groupByCall === 'true') &&
    parseInt(data.limit, 10) > 0 &&
    getCallPageOrder(data) !== null;
}

/**
 * Appends to the where clause the condition that leaves out the audio test
 * (echo) legs, as the middleware does on the rows it receives. In SQL a call
 * made only of such legs is not counted and does not take a place in a page.
 *
 * @param {array} whereClause The where clause and its replacements, changed in place.
 * @param {string} [audioTest] The audio test feature code, e.g. "*41".
 * @private
 */
function excludeAudioTestLegs(whereClause, audioTest) {
  var code = typeof audioTest === 'string' ? audioTest.trim() : '';
  if (code === '') {
    return;
  }
  var pattern = '%' + code.replace(/[\\%_]/g, '\\$&') + '%';
  whereClause[0] += ' AND NOT (src LIKE ? OR dst LIKE ?)';
  whereClause.push(pattern, pattern);
}

// Legs read per call wanted in the first attempt to fill a page of calls: a
// call has about three legs, queue calls more.
var CALL_PAGE_LEGS_PER_CALL = 4;

/**
 * Returns the linkedids of a page of calls, in the order their first leg comes
 * when the legs are sorted by time: the order in which the middleware lists the
 * calls it groups. The legs are read along the calldate index and the reading
 * stops as soon as the page is full, instead of grouping every call of the
 * interval to sort them.
 *
 * @param {object} conn The CDR connection.
 * @param {array} whereClause The where clause selecting the legs that match the filters.
 * @param {string} order "ASC" or "DESC".
 * @param {number} offset The calls to skip.
 * @param {number} limit The calls of the page.
 * @return {Promise} Resolved with the linkedids of the page.
 * @private
 */
function readCallPage(conn, whereClause, order, offset, limit) {
  var wanted = offset + limit;

  function read(batch) {
    compDbconnMain.incNumExecQueries();
    return conn.query(
      'SELECT linkedid FROM cdr WHERE ' + whereClause[0] + ' ORDER BY calldate ' + order + ' LIMIT ' + batch,
      { replacements: whereClause.slice(1), type: compDbconnMain.Sequelize.QueryTypes.SELECT }
    ).then(function(legs) {
      var seen = {};
      var linkedids = [];
      legs.forEach(function(leg) {
        if (!seen[leg.linkedid]) {
          seen[leg.linkedid] = true;
          linkedids.push(leg.linkedid);
        }
      });
      // Calls with many legs: read further until the page is full or the legs end.
      if (linkedids.length < wanted && legs.length === batch) {
        return read(batch * CALL_PAGE_LEGS_PER_CALL);
      }
      return linkedids.slice(offset, wanted);
    });
  }

  return read(Math.max(wanted * CALL_PAGE_LEGS_PER_CALL, 100));
}

// On a long interval counting the calls takes longer than reading a page, and
// moving to another page asks for the same total again: it is kept for this
// many milliseconds, for the last searches only.
var CALL_COUNT_TTL = 60000;
var CALL_COUNT_CACHE_SIZE = 100;
var callCountCache = new Map();

/**
 * Returns the number of calls (distinct linkedids) of the legs that match the
 * where clause, reusing a count of the same search made in the last minute.
 *
 * @param {object} conn The CDR connection.
 * @param {array} whereClause The where clause selecting the legs that match the filters.
 * @return {Promise} Resolved with the number of calls.
 * @private
 */
function countCalls(conn, whereClause) {
  var key = JSON.stringify(whereClause);
  var cached = callCountCache.get(key);
  if (cached && Date.now() - cached.countedAt < CALL_COUNT_TTL) {
    return cached.count;
  }
  callCountCache.delete(key);
  if (callCountCache.size >= CALL_COUNT_CACHE_SIZE) {
    callCountCache.delete(callCountCache.keys().next().value);
  }

  compDbconnMain.incNumExecQueries();
  var count = conn.query(
    'SELECT COUNT(DISTINCT linkedid) AS count FROM cdr WHERE ' + whereClause[0],
    { replacements: whereClause.slice(1), type: compDbconnMain.Sequelize.QueryTypes.SELECT }
  ).then(function(results) {
    return results && results[0] ? parseInt(results[0].count, 10) : 0;
  });
  // Requests of the same search that arrive while counting wait for this count.
  callCountCache.set(key, { count: count, countedAt: Date.now() });
  count.catch(function() {
    if (callCountCache.get(key) && callCountCache.get(key).count === count) {
      callCountCache.delete(key);
    }
  });
  return count;
}

/**
 * Reads a page of calls: first the linkedids of the calls in the page (see
 * readCallPage) and their total, then the legs of those calls only. The cost
 * of a page depends on its size, not on the interval.
 *
 * @param {object} data The query parameters, as received by the caller.
 * @param {array} whereClause The where clause selecting the legs that match the filters.
 * @param {boolean} wholeCalls True to return every leg of the calls in the page,
 *                             false to return only the legs that match.
 * @param {array} attributes The columns of a leg.
 * @param {object} [voicemailOptions] The options of the voicemail enrichment.
 * @param {function} cb Called with {count, rows}.
 * @private
 */
function getHistoryCallPage(data, whereClause, wholeCalls, attributes, voicemailOptions, cb) {
  var order = getCallPageOrder(data);
  var limit = parseInt(data.limit, 10);
  var offset = parseInt(data.offset, 10) > 0 ? parseInt(data.offset, 10) : 0;
  var conn = compDbconnMain.dbConn[compDbconnMain.JSON_KEYS.HISTORY_CALL];
  var done = false;
  var reply = function(err, res) {
    if (!done) {
      done = true;
      cb(err, res);
    }
  };

  var pageQuery = readCallPage(conn, whereClause, order, offset, limit);
  var countQuery = countCalls(conn, whereClause);

  Promise.all([pageQuery, countQuery]).then(function(results) {
    var linkedids = results[0];
    var count = results[1];
    if (linkedids.length === 0) {
      reply(null, { count: count, rows: [] });
      return;
    }

    var position = {};
    linkedids.forEach(function(linkedid, i) {
      position[linkedid] = i;
    });
    var legsWhere = wholeCalls ?
      ['linkedid IN (?)', linkedids] :
      ['(' + whereClause[0] + ') AND linkedid IN (?)'].concat(whereClause.slice(1), [linkedids]);

    compDbconnMain.incNumExecQueries();
    return compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].findAll({
      where: legsWhere,
      attributes: attributes,
      group: historyGroupBy(data)
    }).then(function(legs) {
      // The calls in page order, the legs of a call by time in the same direction.
      legs.sort(function(a, b) {
        var left = getHistoryRowValues(a);
        var right = getHistoryRowValues(b);
        var byCall = position[left.linkedid] - position[right.linkedid];
        if (byCall !== 0) {
          return byCall;
        }
        return order === 'ASC' ? left.time - right.time : right.time - left.time;
      });
      return enrichHistoryResultsWithVoicemail(legs, voicemailOptions);
    }).then(function(enrichedLegs) {
      reply(null, { count: count, rows: enrichedLegs });
    });
  }).catch(function(err) {
    logger.log.error(IDLOG, 'searching history call page between ' + data.from + ' to ' + data.to +
      ' with filter ' + data.filter + ': ' + err.toString());
    reply(err.toString());
  });
}

/**
 * Counts the rows of a history query. When the query was not paginated its
 * rows are all there is, and they are not read a second time to count them.
 *
 * @param {object} data The query parameters, as received by the caller.
 * @param {array} rows The rows of the query.
 * @param {object} countOptions The options of the count query.
 * @return {Promise} Resolved with the number of rows.
 * @private
 */
function countHistoryRows(data, rows, countOptions) {
  if (!data.limit && !(parseInt(data.offset, 10) > 0)) {
    return Promise.resolve(rows.length);
  }
  compDbconnMain.incNumExecQueries();
  return compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].count(countOptions).then(function(count) {
    return count.length;
  });
}

/**
 * Converts a bound of a history interval into a calldate. The bound is a day
 * in the YYYYMMDD format, optionally followed by the time in the HHmm or
 * HHmmss format (e.g. 20130521 or 201305210930). A day alone stands for all
 * of it, and an ending time without seconds includes its whole minute.
 * It throws an error if the bound is malformed or is not a real date and time.
 *
 * @param {string} value The bound of the interval
 * @param {boolean} isEnd True if it is the ending bound of the interval
 * @return {string} The calldate in the "YYYY-MM-DD HH:mm:ss" format.
 * @private
 */
function toCallDate(value, isEnd) {
  var bound = /^([0-9]{4})([0-9]{2})([0-9]{2})(?:([0-9]{2})([0-9]{2})([0-9]{2})?)?$/.exec(value);
  if (typeof value !== 'string' || bound === null) {
    throw new Error('wrong bound of the history interval: ' + value);
  }
  var year = parseInt(bound[1], 10);
  var month = parseInt(bound[2], 10);
  var day = parseInt(bound[3], 10);
  var date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('wrong day in the history interval: ' + value);
  }
  var hours = bound[4] || (isEnd ? '23' : '00');
  var minutes = bound[5] || (isEnd ? '59' : '00');
  var seconds = bound[6] || (isEnd ? '59' : '00');
  if (parseInt(hours, 10) > 23 || parseInt(minutes, 10) > 59 || parseInt(seconds, 10) > 59) {
    throw new Error('wrong time in the history interval: ' + value);
  }
  return bound[1] + '-' + bound[2] + '-' + bound[3] + ' ' + hours + ':' + minutes + ':' + seconds;
}

function toCallDateInterval(from, to) {
  var interval = {
    from: from === undefined ? undefined : toCallDate(from, false),
    to: to === undefined ? undefined : toCallDate(to, true)
  };
  if (interval.from !== undefined && interval.to !== undefined && interval.from > interval.to) {
    throw new Error('the history interval starts after its end: ' + from + ' - ' + to);
  }
  return interval;
}

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
      (typeof data.queue !== 'string' && data.queue !== undefined) ||
      (data.direction && data.direction !== 'in' && data.direction !== 'out' && data.direction !== 'lost')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // define the mysql field to be returned. The "recordingfile" field
    // is returned only if the "data.recording" argument is true
    var effectiveDisposition = getEffectiveDisposition('cdr', data.answeredElsewhereQueues);
    var attributes = [
      ['UNIX_TIMESTAMP(calldate)', 'time'],
      'channel', 'dstchannel', 'uniqueid', 'linkedid', 'userfield',
      ['MAX(duration)','duration'], ['IF (MIN(disposition) = "ANSWERED", MAX(billsec), MIN(billsec))','billsec'],
      [compDbconnMain.Sequelize.literal(effectiveDisposition), 'disposition'], 'dcontext', 'lastapp', 'lastdata'
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
      compDbconnMain.Sequelize.literal(getQueueNumber('cdr')),
      'queue'
    ]);
    attributes.push([
      compDbconnMain.Sequelize.literal(getAnsweredByNumber('cdr')),
      'answered_by_num'
    ]);

    // check optional parameters
    if (data.filter === undefined) {
      data.filter = '%';
    }

    var interval = toCallDateInterval(data.from, data.to);
    data.from = interval.from;
    data.to = interval.to;
    var whereClause;

    if (data.direction && data.direction === 'in') {

      whereClause = [
        '(cnum NOT IN (?) AND dst IN (?)) AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ?)' +
        (data.removeLostCalls ? ' AND ' + effectiveDisposition + ' NOT IN ("NO ANSWER","BUSY","FAILED")' : '') +
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
        // Same opt-in as the "all directions" branch: this clause hides the
        // unanswered legs of a call that someone did answer, which for a queue or
        // ring group are the very legs the caller asked to expand. It stays on for
        // every other caller.
        (data.expandLegs ? '' :
          'AND (' + effectiveDisposition + ' NOT IN ("NO ANSWER","BUSY","FAILED")' +
          'OR (' + effectiveDisposition + ' IN ("NO ANSWER","BUSY","FAILED")' +
          'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE b.disposition IN ("ANSWERED","ANSWERED_ELSEWHERE") AND b.uniqueid = cdr.linkedid)))') +
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
        effectiveDisposition + ' IN ("NO ANSWER","BUSY","FAILED")' +
        'AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE b.disposition IN ("ANSWERED","ANSWERED_ELSEWHERE") AND b.uniqueid = cdr.linkedid)' +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
        data.endpoints, data.endpoints,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%"
      ];

    } else {

      whereClause = [
        '(cnum IN (?) OR dst IN (?)) AND ' +
        '(calldate>=? AND calldate<=?) AND ' +
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR dst_cnam LIKE ? OR ccompany LIKE ? OR dst_ccompany LIKE ?)' +
        // Unanswered legs are kept out unless the caller asks for them. They are
        // duplicates for anyone who lists calls as they come: a queue writes one
        // row per member it rang, and a ring group dials all its members from the
        // SAME channel, so all those legs share one uniqueid. Only a caller that
        // groups them back into one call per linkedid wants them, and it says so
        // with expandLegs.
        (data.expandLegs ? '' :
          ' AND (uniqueid,linkedid,disposition) NOT IN (SELECT uniqueid,linkedid,"NO ANSWER" disposition FROM cdr AS b WHERE b.disposition IN ("ANSWERED","ANSWERED_ELSEWHERE") AND b.uniqueid = cdr.uniqueid)' +
          ' AND ((uniqueid,linkedid,channel,dstchannel) IN (SELECT uniqueid,linkedid,MAX(channel),MAX(dstchannel) FROM cdr AS b WHERE b.uniqueid = cdr.uniqueid AND b.linkedid = cdr.linkedid AND disposition = "NO ANSWER" ) OR ' + effectiveDisposition + ' != "NO ANSWER")') +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
        data.endpoints, data.endpoints,
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%",
        "%" + data.filter + "%", "%" + data.filter + "%"
      ];
    }

    // Without expandLegs the legs are listed as they come, not grouped into calls,
    // so the ring a member missed before answering a later one would read as a
    // call he lost (NethLink notifies it as one). Like the other unanswered legs
    // of an answered call, it is left out.
    if (!data.expandLegs && data.direction !== 'lost' &&
      data.answeredElsewhereQueues && data.answeredElsewhereQueues.length > 0) {
      whereClause[0] += ' AND NOT (' + getOwnMissedRingCondition('cdr') + ' AND ' +
        getAnsweredElsewhereQueueCondition('cdr', data.answeredElsewhereQueues) + ')';
    }

    if (data.queue) {
      whereClause[0] += ' AND ' + getQueueNumber('cdr') + ' = ?';
      whereClause.push(data.queue);
    }

    excludeAudioTestLegs(whereClause, data.audioTest);

    // NOTE: the personal history is deliberately NOT widened to whole calls the way
    // the switchboard one is (see getHistorySwitchCallInterval). Its clauses match
    // the legs the user is a party to, and selecting by linkedid instead would
    // return the legs between their colleagues as well — the detail the switchboard
    // view exists for, and which is gated there by the "switchboard cdr"
    // authorization that this endpoint does not require. For the same reason a
    // page of calls returns only the legs that match.
    if (isCallPageRequest(data)) {
      getHistoryCallPage(data, whereClause, false, attributes, { allowedMailboxes: data.endpoints }, cb);
      return;
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].findAll({
      where: whereClause,
      attributes: attributes,
      offset: (data.offset ? parseInt(data.offset) : 0),
      limit: (data.limit ? parseInt(data.limit) : null),
      group: historyGroupBy(data),
      order: (data.sort ? data.sort : 'time desc')

    }).then(function(results) {
      enrichHistoryResultsWithVoicemail(results, {
        allowedMailboxes: data.endpoints
      }).then(function(enrichedResults) {
        countHistoryRows(data, enrichedResults, {
            where: whereClause,
            group: historyGroupBy(data),
            attributes: attributes
            }).then(function(count) {
                const res = {
                  count: count,
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
 *   @param {string}  data.from         The starting date of the interval in the YYYYMMDD[HHmm[ss]] format (e.g. 20130521 or 201305210930)
 *   @param {string}  data.to           The ending date of the interval in the YYYYMMDD[HHmm[ss]] format (e.g. 20130528 or 201305280930)
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
      (typeof data.queue !== 'string' && data.queue !== undefined) ||
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

    attributes.push([
      compDbconnMain.Sequelize.literal(getQueueNumber('cdr')),
      'queue'
    ]);

    // check optional parameters
    if (data.filter === undefined) {
      data.filter = '%';
    }

    data.extens = '("' + data.extens.join('","') + '")';
    var interval = toCallDateInterval(data.from, data.to);
    data.from = interval.from;
    data.to = interval.to;

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
        // Same opt-in as the "all directions" branch: this clause hides the
        // unanswered legs of a call that someone did answer, which for a queue or
        // ring group are the very legs the caller asked to expand. It stays on for
        // every other caller.
        (data.expandLegs ? '' :
          'AND (disposition NOT IN ("NO ANSWER","BUSY","FAILED") OR (disposition IN ("NO ANSWER","BUSY","FAILED") AND linkedid NOT IN (SELECT uniqueid FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.linkedid)))') +
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
        '(cnum LIKE ? OR clid LIKE ? OR dst LIKE ? OR cnam LIKE ? OR ccompany LIKE ? OR dst_cnam LIKE ? OR dst_ccompany LIKE ?)' +
        // Unanswered legs are kept out unless the caller asks for them. They are
        // duplicates for anyone who lists calls as they come: a queue writes one
        // row per member it rang, and a ring group dials all its members from the
        // SAME channel, so all those legs share one uniqueid. Only a caller that
        // groups them back into one call per linkedid wants them, and it says so
        // with expandLegs.
        (data.expandLegs ? '' :
          ' AND (uniqueid,linkedid,disposition) NOT IN (SELECT uniqueid,linkedid,"NO ANSWER" disposition FROM cdr AS b WHERE disposition = "ANSWERED" AND b.uniqueid = cdr.uniqueid)' +
          ' AND ((uniqueid,linkedid,channel,dstchannel) IN (SELECT uniqueid,linkedid,MAX(channel),MAX(dstchannel) FROM cdr AS b WHERE b.uniqueid = cdr.uniqueid AND b.linkedid = cdr.linkedid AND disposition = "NO ANSWER" ) OR disposition != "NO ANSWER")') +
        ' AND NOT (lastapp = "Stasis" AND lastdata = "satellite")',
        data.from, data.to,
        "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%", "%" + data.filter + "%",
        "%" + data.filter + "%", "%" + data.filter + "%"
      ];
    }

    if (data.queue) {
      whereClause[0] += ' AND ' + getQueueNumber('cdr') + ' = ?';
      whereClause.push(data.queue);
    }

    excludeAudioTestLegs(whereClause, data.audioTest);

    // A page of calls is selected by the clauses above and returns every leg of
    // those calls when the caller asked for them, like the query below.
    if (isCallPageRequest(data)) {
      getHistoryCallPage(data, whereClause, !!data.expandLegs, attributes, undefined, cb);
      return;
    }

    // With expandLegs the caller groups a call's legs back into one row, so the
    // filter has to select CALLS, not legs. Every clause above matches leg by
    // leg — a direction filter keeps only the leg carrying the trunk — so a queue
    // or ring-group call came back as a single row with nothing left to expand.
    //
    // It wraps the clauses built above, the queue filter included, so a call is
    // returned whole whenever any of its legs matches.
    if (data.expandLegs && whereClause && whereClause.length) {
      whereClause = ['linkedid IN (SELECT linkedid FROM cdr WHERE ' + whereClause[0] + ')']
        .concat(whereClause.slice(1));
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].findAll({
      where: whereClause,
      attributes: attributes,
      offset: (data.offset ? parseInt(data.offset) : 0),
      limit: (data.limit ? parseInt(data.limit) : null),
      group: historyGroupBy(data),
      order: (data.sort ? data.sort : 'time desc')

    }).then(function(results) {
      enrichHistoryResultsWithVoicemail(results).then(function(enrichedResults) {
        countHistoryRows(data, enrichedResults, {
            where: whereClause,
            group: historyGroupBy(data),
            attributes: attributes
             }).then(function(count) {
                const res = {
                  count: count,
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

// Days of history searched for the queues of a user when no interval is given.
var HISTORY_QUEUES_DEFAULT_DAYS = 30;

function formatHistoryDay(date) {
  return date.getFullYear() +
    ('0' + (date.getMonth() + 1)).slice(-2) +
    ('0' + date.getDate()).slice(-2);
}

/**
 * Returns the queues the calls of the endpoints went through in the interval.
 * Without an interval it searched the whole history of the user, which took
 * tens of seconds on a large CDR.
 *
 * @method getHistoryQueues
 * @param {object} data
 *   @param {array}  data.endpoints The endpoints of the user
 *   @param {string} [data.from]    The starting date of the interval in the YYYYMMDD[HHmm[ss]] format,
 *                                  by default HISTORY_QUEUES_DEFAULT_DAYS days ago
 *   @param {string} [data.to]      The ending date of the interval in the YYYYMMDD[HHmm[ss]] format, by default today
 * @param {function} cb The callback function
 */
function getHistoryQueues(data, cb) {
  try {
    if (typeof data !== 'object' ||
      typeof cb !== 'function' ||
      !(data.endpoints instanceof Array) ||
      (data.from !== undefined && typeof data.from !== 'string') ||
      (data.to !== undefined && typeof data.to !== 'string')) {

      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    var to = toCallDate(data.to || formatHistoryDay(new Date()), true);
    var from = toCallDate(data.from || formatHistoryDay(new Date(Date.now() - HISTORY_QUEUES_DEFAULT_DAYS * 86400000)), false);

    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].findAll({
      where: [
        'linkedid IN (' +
          'SELECT linkedid FROM cdr AS history_filter ' +
          'WHERE (history_filter.cnum IN (?) OR history_filter.dst IN (?)) ' +
            'AND history_filter.calldate >= ? AND history_filter.calldate <= ?' +
        ') AND ' +
        'calldate >= ? AND calldate <= ? AND ' +
        'lastapp = "Queue" AND dst <> ""',
        data.endpoints, data.endpoints, from, to, from, to
      ],
      attributes: [
        ['DISTINCT(dst)', 'queue']
      ],
      raw: true
    }).then(function(results) {
      cb(null, results);
    }, function(err) {
      logger.log.error(IDLOG, 'searching history queues for endpoints ' + data.endpoints +
        ': ' + err.toString());
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
apiList.getHistoryCallInterval = withAnsweredElsewhereQueues(getHistoryCallInterval);
apiList.getHistorySwitchCallInterval = getHistorySwitchCallInterval;
apiList.getHistoryQueues = getHistoryQueues;
apiList.toCallDateInterval = toCallDateInterval;
apiList.getAllUserHistorySmsInterval = getAllUserHistorySmsInterval;

// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;
