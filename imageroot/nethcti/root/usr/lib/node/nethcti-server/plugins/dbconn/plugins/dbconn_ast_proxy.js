/**
 * Provides database functions.
 *
 * @module dbconn
 * @submodule plugins
 */
var async = require('async');
var moment = require('moment');
const SQL = require('sql-template-strings')

/**
 * The module identifier used by the logger.
 *
 * @property IDLOG
 * @type string
 * @private
 * @final
 * @readOnly
 * @default [plugins/dbconn_ast_proxy]
 */
var IDLOG = '[plugins/dbconn_ast_proxy]';

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
 * Enable/disable cache.
 *
 * @property CACHE_ENABLED
 * @type boolean
 * @private
 */
var CACHE_ENABLED = true;

/**
 * Cache period time for some data.
 *
 * @property CACHE_TIMEOUT
 * @type number
 * @private
 */
var CACHE_TIMEOUT = 20000;

/**
 * The data cache.
 *
 * @property cache
 * @type object
 * @private
 */
var cache = {};

/**
 * The data cache timestamps.
 *
 * @property cacheTimestamps
 * @type object
 * @private
 */
var cacheTimestamps = {};

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
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
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
 * Return the sha1 password of the FreePBX admin user or
 * boolean false if it is not found.
 *
 * @method getFpbxAdminSha1Pwd
 * @param {function} cb The callback function
 */
function getFpbxAdminSha1Pwd(cb) {
  try {
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    compDbconnMain.dbConn['ampusers'].query('SELECT `password_sha1` FROM `ampusers` WHERE username = "admin"', (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, err.stack);
          cb(err);
          return;
        }
        if (results[0] && results[0].password_sha1) {
          logger.log.info(IDLOG, 'found sha1 password of freepbx admin user');
          cb(null, results[0].password_sha1);
        } else {
          logger.log.info(IDLOG, 'no sha1 password of freepbx admin user has been found');
          cb(null, false);
        }
      } catch (error) {
        logger.log.error(IDLOG, 'getting sha1 password of freepbx admin user');
        cb(error.toString());
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Gets the details about caller id from queue_recall db table.
 *
 * @method getQueueRecallInfo
 * @param {object} data
 *   @param {string} data.hours The value of the hours of the current day to be searched
 *   @param {string} data.cid The caller identifier
 *   @param {string} data.qid The queue identifier
 *   @param {string} data.agents The agents of the queue
 * @param {function} cb The callback function
 */
function getQueueRecallInfo(data, cb) {
  try {
    if (typeof data !== 'object' ||
      typeof cb !== 'function' ||
      typeof data.hours !== 'string' ||
      typeof data.qid !== 'string' ||
      typeof data.cid !== 'string' || !data.agents) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    const query = `
SELECT
  queuename,
  direction,
  action,
  UNIX_TIMESTAMP(time) AS time,
  position,
  duration,
  hold,
  cid,
  agent,
  IF (event = "", action, event) AS event
FROM ${getAllQueueRecallQueryTable(data.hours, [data.qid], data.agents)}
WHERE cid=? AND queuename=?
  ORDER BY time ASC`;
    compDbconnMain.dbConn['queue_log'].query(
      query,
      [ data.cid, data.qid ],
      (err, results, fields) => {
      try {
        logger.log.info(IDLOG, results.length + ' results searching details about queue recall on cid "' + data.cid + '"');
        cb(null, results);
      } catch (error) {
        logger.log.error(IDLOG, 'searching details about queue recall on cid "' + data.cid + '"');
        cb(error.toString(), {});
      }
    });
    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

const queryLostCalls = '\
  SELECT time,\
    queuename,\
    "IN" AS direction,\
    "TIMEOUT" AS action,\
    CAST(data1 AS UNSIGNED) AS position,\
    CAST(data2 AS UNSIGNED) AS duration,\
    CAST(data3 AS UNSIGNED) AS hold,\
    (\
      SELECT DISTINCT(data2)\
      FROM asteriskcdrdb.queue_log z\
      WHERE z.event = "ENTERQUEUE" AND z.callid=a.callid\
    ) AS cid,\
    (\
      SELECT DISTINCT(daily_cdr.cnam)\
      FROM asteriskcdrdb.daily_cdr daily_cdr\
      WHERE daily_cdr.uniqueid = a.callid GROUP BY daily_cdr.uniqueid\
    ) AS name,\
    (\
      SELECT DISTINCT(daily_cdr.ccompany)\
      FROM asteriskcdrdb.daily_cdr daily_cdr\
      WHERE daily_cdr.uniqueid = a.callid GROUP BY daily_cdr.uniqueid\
    ) AS company,\
    agent,\
    event \
  FROM asteriskcdrdb.queue_log a \
  WHERE event IN ("ABANDON", "EXITWITHTIMEOUT", "EXITWITHKEY", "EXITEMPTY", "FULL", "JOINEMPTY", "JOINUNAVAIL")\
    AND <REPLACE_LOST_TIME_CONDITION_QL>\
    AND a.queuename IN (<REPLACE_LOST_QUEUES>)';

const queryDoneCalls = '\
  SELECT time,\
    queuename,\
    "IN" AS direction,\
    "DONE" AS action,\
    CAST(data3 AS UNSIGNED) AS position,\
    CAST(data2 AS UNSIGNED) AS duration,\
    CAST(data1 AS UNSIGNED) AS hold,\
    (\
      SELECT DISTINCT(data2)\
      FROM asteriskcdrdb.queue_log z\
      WHERE z.event="ENTERQUEUE" AND z.callid=a.callid\
    ) AS cid,\
    (\
      SELECT DISTINCT(daily_cdr.cnam)\
      FROM asteriskcdrdb.daily_cdr daily_cdr\
      WHERE daily_cdr.uniqueid = a.callid GROUP BY daily_cdr.uniqueid\
    ) AS name,\
    (\
      SELECT DISTINCT(daily_cdr.ccompany)\
      FROM asteriskcdrdb.daily_cdr daily_cdr\
      WHERE daily_cdr.uniqueid = a.callid GROUP BY daily_cdr.uniqueid\
    ) AS company,\
    agent,\
    event \
  FROM asteriskcdrdb.queue_log a \
  WHERE event IN ("COMPLETEAGENT", "COMPLETECALLER")\
    AND <REPLACE_LOST_TIME_CONDITION_QL>\
    AND a.queuename IN (<REPLACE_LOST_QUEUES>)';

const queryCdrCalls = '\
  SELECT DISTINCT calldate AS time,\
    l.queuename as queuename,\
    "OUT" AS direction,\
    IF (disposition="ANSWERED", "DONE", disposition) AS action,\
    0 AS position,\
    duration,\
    0 AS hold,\
    dst AS cid,\
    dst_cnam AS name,\
    dst_ccompany AS company,\
    cnam AS agent,\
    "" \
  FROM daily_cdr c\
    INNER JOIN asteriskcdrdb.queue_log l ON c.dst=l.data2\
      AND c.accountcode IN (<REPLACE_LOST_AGENTS>)\
  WHERE l.event="ENTERQUEUE"\
    AND <REPLACE_LOST_TIME_CONDITION_CDR>\
    AND <REPLACE_LOST_TIME_CONDITION_QL>\
    AND l.queuename IN (<REPLACE_LOST_QUEUES>)';

/**
 * Gets the query that returns the entries corresponding to queue recalls table.
 *
 * @method getAllQueueRecallQueryTable
 * @param {string} hours The value of the interval time to be searched
 * @param {array} queues The queues
 * @param {array} agents The agents of the queues
 * @return {string} The query to obtain the entries about queue recall table
 * @private
 */
function getAllQueueRecallQueryTable(hours, queues, agents) {
  try {
    if (typeof hours !== 'string' || !queues || !agents) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    queues = '"' + queues.join('","') + '"';
    agents = '"' + agents.join('","') + '"';
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    const starting = moment().subtract({ hours: hours }).format('YYYY-MM-DD HH:mm:ss');
    const timeConditionQl = '(time BETWEEN "' + starting + '" AND "' + now + '")'; // time condition on queue_log
    const timeConditionCdr = '(calldate BETWEEN "' + starting + '" AND "' + now + '")'; // time condition on cdr
    let query = [
      '(',
        queryLostCalls,
        ' UNION ALL ',
        queryDoneCalls,
        ' UNION ALL ',
        queryCdrCalls.replace('<REPLACE_LOST_AGENTS>', agents).replace('<REPLACE_LOST_TIME_CONDITION_CDR>', timeConditionCdr),
        ' ORDER BY time DESC) queue_recall'
    ].join('');
    query = query.replace(/<REPLACE_LOST_TIME_CONDITION_QL>/g, timeConditionQl)
      .replace(/<REPLACE_LOST_QUEUES>/g, queues);
    return query;
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    return '';
  }
}

/**
 * Gets the last calls from queue_log db table basing the search
 * with the last X hours of the current day.
 *
 * @method getRecall
 * @param {object} obj
 *   @param {string} obj.hours The amount of hours of the current day to be searched
 *   @param {array} obj.queues The queue identifiers
 *   @param {array} obj.agents The agents of the queues
 *   @param {type} obj.type It can be ("lost"|"done"|"all"). The type of call to be retrieved
 *   @param {integer} [obj.offset] The results offset
 *   @param {integer} [obj.limit] The results limit
 * @param {function} cb The callback function
 */
function getRecall(obj, cb) {
  try {
    if (typeof obj !== 'object' || !obj.queues || !obj.agents || !obj.type || !obj.hours) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (obj.queues.length === 0) {
      return cb(null, []);
    }
    const query = `
SELECT
  cid, name, company, action, MIN(UNIX_TIMESTAMP(time)) as time, direction, queuename,
  IF (event = "", action, event) AS event
FROM ${getAllQueueRecallQueryTable(obj.hours, obj.queues, obj.agents)}
GROUP BY cid, queuename
ORDER BY time ASC`;
    compDbconnMain.dbConn['queue_log'].query(
      query,
      (err, results, fields) => {
      try {
        logger.log.info(IDLOG, 'get queues ' + obj.queues + ' recall of last ' + obj.hours +
          ' hours has been successful: ' + results.length + ' results');
        if (obj.type === 'all') {
          if (obj.offset && obj.limit) {
            cb(null, { count: results.length, rows: results.slice(parseInt(obj.offset), (parseInt(obj.offset) + parseInt(obj.limit))) });
          } else {
            cb(null, { count: results.length, rows: results });
          }
        }
        else if (obj.type === 'done') {
          let i;
          let done = [];
          for (i = 0; i < results.length; i++) {
            if (results[i].action === 'DONE') {
              done.push(results[i]);
            }
          }
          if (obj.offset && obj.limit) {
            cb(null, { count: done.length, rows: done.slice(parseInt(obj.offset), (parseInt(obj.offset) + parseInt(obj.limit))) });
          } else {
            cb(null, { count: done.length, rows: done });
          }
        }
        else if (obj.type === 'lost') {
          let i;
          let lost = [];
          for (i = 0; i < results.length; i++) {
            if (results[i].action !== 'DONE') {
              lost.push(results[i]);
            }
          }
          if (obj.offset && obj.limit) {
            cb(null, { count: lost.length, rows: lost.slice(parseInt(obj.offset), (parseInt(obj.offset) + parseInt(obj.limit))) });
          } else {
            cb(null, { count: lost.length, rows: lost });
          }
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
 * Gets statistic about the queue.
 *
 * @method getQueueStats
 * @param {string} qid The queue identifier
 * @param {number} nullCallPeriod The period of time to consider a call as null
 * @param {string} sla The service level of the queue
 * @param {function} cb The callback function
 */
function getQueueStats(qid, nullCallPeriod, sla, cb) {
  try {
    if (typeof cb !== 'function' ||
      typeof qid !== 'string' ||
      typeof sla !== 'string' ||
      typeof nullCallPeriod !== 'number') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    let query = `
SELECT
  IFNULL(queuename, ${qid}) AS \`queueman\`,
  COUNT(IF(event="DID", 1, NULL)) AS \`tot\`,
  COUNT(IF(event IN ("COMPLETEAGENT","COMPLETECALLER"), 1, NULL)) AS \`tot_processed\`,
  COUNT(IF(event IN ("COMPLETEAGENT","COMPLETECALLER") AND data1<${sla}, 1, NULL)) AS \`processed_less_sla\`,
  COUNT(IF(event IN ("COMPLETEAGENT","COMPLETECALLER") AND data1>=${sla}, 1, NULL)) AS \`processed_greater_sla\`,
  COUNT(IF(event="ABANDON" AND data3<${nullCallPeriod}, 1, NULL)) AS \`tot_null\`,
  COUNT(IF((event IN ("EXITEMPTY","EXITWITHKEY","EXITWITHTIMEOUT","FULL","JOINEMPTY","JOINUNAVAIL")) OR (event="ABANDON" AND data3>=${nullCallPeriod}), 1, NULL)) AS \`tot_failed\`,
  COUNT(IF(event="EXITEMPTY", 1, NULL)) AS \`failed_inqueue_noagents\`,
  COUNT(IF(event="EXITWITHKEY", 1, NULL)) AS \`failed_withkey\`,
  COUNT(IF(event="EXITWITHTIMEOUT", 1, NULL)) AS \`failed_timeout\`,
  COUNT(IF((event="ABANDON" AND data3>=${nullCallPeriod}), 1, NULL)) AS \`failed_abandon\`,
  COUNT(IF(event="FULL", 1, NULL)) AS \`failed_full\`,
  COUNT(IF(event IN ("JOINEMPTY","JOINUNAVAIL"), 1, NULL)) AS \`failed_outqueue_noagents\`,
  IFNULL(MIN(IF(event IN ("COMPLETECALLER","COMPLETEAGENT"), CAST(data2 AS UNSIGNED), NULL)), 0) AS \`min_duration\`,
  IFNULL(MAX(IF(event IN ("COMPLETECALLER","COMPLETEAGENT"), CAST(data2 AS UNSIGNED), NULL)), 0) AS \`max_duration\`,
  IFNULL(ROUND(AVG(IF(event IN ("COMPLETECALLER","COMPLETEAGENT"), CAST(data2 AS UNSIGNED), NULL)), 0), 0) AS \`avg_duration\`,
  IFNULL(MIN(IF(event IN ("COMPLETECALLER","COMPLETEAGENT"), CAST(data1 AS UNSIGNED),
    IF(event="ABANDON" AND data3>=${nullCallPeriod}, CAST(data3 AS UNSIGNED),
    IF(event IN ("EXITWITHTIMEOUT","EXITEMPTY","EXITWITHKEY"), CAST(data3 AS UNSIGNED), NULL)))), 0) AS \`min_wait\`,
  IFNULL(MAX(IF(event IN ("COMPLETECALLER","COMPLETEAGENT"), CAST(data1 AS UNSIGNED),
    IF(event="ABANDON" AND data3>=${nullCallPeriod}, CAST(data3 AS UNSIGNED),
    IF(event IN ("EXITWITHTIMEOUT","EXITEMPTY","EXITWITHKEY"), CAST(data3 AS UNSIGNED), NULL)))), 0) AS \`max_wait\`,
  IFNULL(ROUND(AVG(IF(event IN ("COMPLETECALLER","COMPLETEAGENT"), CAST(data1 AS UNSIGNED),
    IF(event="ABANDON" AND data3>=${nullCallPeriod}, CAST(data3 AS UNSIGNED),
    IF(event IN ("EXITWITHTIMEOUT","EXITEMPTY","EXITWITHKEY"), CAST(data3 AS UNSIGNED), NULL)))), 0), 0) AS \`avg_wait\`
FROM \`queue_log\`
WHERE event IN ("DID","ENTERQUEUE","COMPLETEAGENT","COMPLETECALLER","ABANDON","EXITEMPTY","EXITWITHKEY","EXITWITHTIMEOUT","FULL","JOINEMPTY","JOINUNAVAIL") AND queuename=?`;
    compDbconnMain.dbConn['queue_log'].query(
      query,
      [qid],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.info(IDLOG, 'get stats of queue "' + qid + '": not found');
          cb(null, {});
          return;
        }
        if (results && results[0]) {
          logger.log.info(IDLOG, 'get stats of queue "' + qid + '" has been successful');
          results = results[0];
          results.sla = parseInt(sla);
          results.nullCallPeriod = parseInt(nullCallPeriod);
          cb(null, results);
        } else {
          logger.log.info(IDLOG, 'get stats of queue "' + qid + '": not found');
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
 * Gets hourly statistics about queues calls.
 *
 * @method getQCallsStatsHist
 * @param {number} nullCallPeriod The period of time to consider a call as null
 * @param {function} cb The callback function
 */
function getQCallsStatsHist(nullCallPeriod, cb) {
  try {
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    const period = [
      '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30',
      '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
      '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
      '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '00:00'
    ];
    const day = moment();
    const currday = day.format('DD-MMMM-YY');
    let caseClause = 'CASE ';
    for (var i = 0; i < period.length - 1; i++) {
      caseClause += 'WHEN TIME(time) >= "' + period[i] + ':00" AND TIME(time) < "' + period[i+1] + ':00" THEN DATE_FORMAT(time, "' + currday + '-' + period[i+1] + '") ';
    }
    caseClause += 'END';
    let query = `
SELECT queuename,
  ${caseClause} AS date,
  COUNT(IF(event="DID", 1, NULL)) AS \`total\`,
  COUNT(IF(event IN ("COMPLETEAGENT","COMPLETECALLER"), 1, NULL)) AS \`answered\`,
  COUNT(IF((event IN ("EXITEMPTY","EXITWITHKEY","EXITWITHTIMEOUT","FULL","JOINEMPTY","JOINUNAVAIL")) OR (event="ABANDON" AND data3>=${nullCallPeriod}), 1, NULL)) AS \`failed\`,
  COUNT(IF(event="ABANDON" AND data3<${nullCallPeriod}, 1, NULL)) AS \`invalid\`
FROM \`queue_log\`
WHERE event IN ("DID","ENTERQUEUE","COMPLETEAGENT","COMPLETECALLER","ABANDON","EXITEMPTY","EXITWITHKEY","EXITWITHTIMEOUT","FULL","JOINEMPTY","JOINUNAVAIL") GROUP BY \`queuename\`, \`date\``;
    compDbconnMain.dbConn['queue_log'].query(
      query,
      (err, results, fields) => {
      try {
        let tempdate, i, tempval,
            min = Math.floor(day.minutes()/30)*30,
            currDatetime = currday + '-' + ('0' + day.hours()).slice(-2) + ':' + (min === 0 ? '00' : min),
            basevalues = {},
            emptyValues = {};
        for (i = 0; i < period.length - 1; i++) {
          tempdate = currday + '-' + period[i+1];
          tempval = {
            value: 0,
            date: tempdate,
            fullDate: new Date(tempdate).toISOString()
          };
          basevalues[tempdate] = tempval;
          if (new Date(tempdate).getTime() <= new Date(currDatetime).getTime()) {
            emptyValues[tempdate] = tempval;
          }
        }
        if (results && results.length > 0) {
          logger.log.info(IDLOG, 'get hist queues calls stats has been successful');
          let values = {};
          for (i = 0; i < results.length; i++) {
            if (!values[results[i].queuename]) {
              values[results[i].queuename] = {
                totalTemp: JSON.parse(JSON.stringify(basevalues)),
                answeredTemp: JSON.parse(JSON.stringify(basevalues)),
                failedTemp: JSON.parse(JSON.stringify(basevalues)),
                invalidTemp: JSON.parse(JSON.stringify(basevalues))
              };
            }
            values[results[i].queuename].totalTemp[results[i].date].value = results[i].total;
            values[results[i].queuename].answeredTemp[results[i].date].value = results[i].answered;
            values[results[i].queuename].failedTemp[results[i].date].value = results[i].failed;
            values[results[i].queuename].invalidTemp[results[i].date].value = results[i].invalid;
          }
          let q, entry;
          for (q in values) {
            values[q].total = [];
            for (entry in values[q].totalTemp) {
              values[q].total.push(values[q].totalTemp[entry]);
              if (entry === currDatetime) { break; }
            }
            delete values[q].totalTemp;
            values[q].answered = [];
            for (entry in values[q].answeredTemp) {
              values[q].answered.push(values[q].answeredTemp[entry]);
              if (entry === currDatetime) { break; }
            }
            delete values[q].answeredTemp;
            values[q].failed = [];
            for (entry in values[q].failedTemp) {
              values[q].failed.push(values[q].failedTemp[entry]);
              if (entry === currDatetime) { break; }
            }
            delete values[q].failedTemp;
            values[q].invalid = [];
            for (entry in values[q].invalidTemp) {
              values[q].invalid.push(values[q].invalidTemp[entry]);
              if (entry === currDatetime) { break; }
            }
            delete values[q].invalidTemp;
          }
          cb(null, values, results.length);
        } else {
          logger.log.info(IDLOG, 'get hist queues calls stats: no results');
          cb(null, emptyValues, results.length);
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
 * Return function to have the time spent into pause queues.
 *
 * @method getAgentsPauseDurations
 * @param {array} agents The list of the agents
 * @return {function} The function to be executed
 */
function getAgentsPauseDurations(agents) {
  try {
    if (Array.isArray(agents) !== true) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return function (callback) {
      try {
        var query = `
SELECT a.agent AS agent,
  a.queuename AS queue,
  UNIX_TIMESTAMP(MIN(b.time)) - UNIX_TIMESTAMP(a.time) AS secs
FROM asteriskcdrdb.queue_log a LEFT JOIN asteriskcdrdb.queue_log b
  ON b.agent = a.agent
  AND b.queuename = a.queuename
  AND b.time > a.time
  AND b.event = "UNPAUSE"
  AND b.callid = "NONE"
WHERE a.event = "PAUSE"
  AND a.callid = "NONE"
  AND a.agent IN ("${agents.join('","')}")
GROUP BY agent, queue, a.time`;
        compDbconnMain.dbConn['queue_log'].query(
          query,
          (err, results, fields) => {
          try {
            if (results && results.length !== 0) {
              logger.log.info(IDLOG, 'get pause duration of queue agents "' + agents + '" has been successful');
              let resdata = {};
              for (let i = 0; i < results.length; i++) {
                if (!resdata[results[i].agent]) {
                  resdata[results[i].agent] = {};
                }
                if (!resdata[results[i].agent][results[i].queue]) {
                  resdata[results[i].agent][results[i].queue] = results[i].secs;
                } else {
                  resdata[results[i].agent][results[i].queue] += results[i].secs;
                }
              }
              for (let u in resdata) {
                for (let q in resdata[u]) {
                  resdata[u][q] = Math.round(resdata[u][q]);
                }
              }
              callback(null, resdata);
            } else {
              logger.log.info(IDLOG, 'get pause duration of agents "' + agents + '": not found');
              callback(null, {});
            }
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            callback(error);
          }
        });
        compDbconnMain.incNumExecQueries();
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        callback(err);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Return function to have the time spent into the queues.
 *
 * @method getAgentsLogonDurations
 * @param {array} agents The list of the agents
 * @return {function} The function to be executed
 */
function getAgentsLogonDurations(agents) {
  try {
    if (Array.isArray(agents) !== true) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return function (callback) {
      try {
        let query = `
SELECT
  a.agent AS agent,
  a.queuename AS queue,
  UNIX_TIMESTAMP(MIN(b.time)) - UNIX_TIMESTAMP(a.time) AS secs
FROM asteriskcdrdb.queue_log a LEFT JOIN asteriskcdrdb.queue_log b
  ON b.agent = a.agent
  AND b.queuename = a.queuename
  AND b.time > a.time
  AND b.event = "REMOVEMEMBER"
WHERE a.event = "ADDMEMBER"
  AND a.agent IN ("${agents.join('","')}")
GROUP BY agent, queue, a.time`;
        compDbconnMain.dbConn['queue_log'].query(
          query,
          (err, results, fields) => {
          try {
            if (results && results.length !== 0) {
              logger.log.info(IDLOG, 'get logon duration of queue agents "' + agents + '" has been successful');
              let resdata = {};
              for (let i = 0; i < results.length; i++) {
                if (!resdata[results[i].agent]) {
                  resdata[results[i].agent] = {};
                }
                if (!resdata[results[i].agent][results[i].queue]) {
                  resdata[results[i].agent][results[i].queue] = results[i].secs;
                } else {
                  resdata[results[i].agent][results[i].queue] += results[i].secs;
                }
              }
              for (let u in resdata) {
                for (let q in resdata[u]) {
                  resdata[u][q] = Math.round(resdata[u][q]);
                }
              }
              callback(null, resdata);
            } else {
              logger.log.info(IDLOG, 'get logon duration of agents "' + agents + '": not found');
              callback(null, {});
            }
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            callback(error);
          }
        });
        compDbconnMain.incNumExecQueries();
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        callback(err);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return function to have pause, unpause stats of queue agents.
 *
 * @method getAgentsStatsPauseUnpause
 * @param {array} agents The list of the agents
 * @return {function} The function to be executed
 */
function getAgentsStatsPauseUnpause(agents) {
  try {
    if (Array.isArray(agents) !== true) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return function (callback) {
      try {
        let query = `
SELECT
  MAX(time) AS \`last_time\`,\`id\`,\`callid\`,\`queuename\`,\`agent\`,\`event\`
FROM \`queue_log\`
WHERE \`event\` IN ("PAUSE","UNPAUSE") AND agent IN ("${agents.join('","')}") AND callid="NONE" GROUP BY \`queuename\`, \`agent\`, \`event\` ORDER BY \`time\``;
        compDbconnMain.dbConn['queue_log'].query(
          query,
          (err, results, fields) => {
            try {
              if (results) {
                logger.log.info(IDLOG, 'get pause/unpause stats of queue agents "' + agents + '" has been successful');
                var values = {};
                var i;
                for (i = 0; i < results.length; i++) {
                  results[i].last_time = Math.round(new Date(results[i].last_time).getTime() / 1000);
                  if (!values[results[i].agent]) {
                    values[results[i].agent] = {};
                  }
                  if (!values[results[i].agent][results[i].queuename]) {
                    values[results[i].agent][results[i].queuename] = {};
                  }
                  if (results[i].event === 'PAUSE') {
                    values[results[i].agent][results[i].queuename].last_paused_time = Math.floor(results[i].last_time);
                  } else if (results[i].event === 'UNPAUSE') {
                    values[results[i].agent][results[i].queuename].last_unpaused_time = Math.floor(results[i].last_time);
                  }
                }
                callback(null, values);
              } else {
                logger.log.info(IDLOG, 'get pause/unpause stats of agents "' + agents + '": not found');
                callback(null, {});
              }
            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              callback(error);
            }
        });
        compDbconnMain.incNumExecQueries();
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        callback(err);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Provides data to calculate recall_time for queues and agents
 *
 * @method getRecallTimeStats
 * @return {function} The cb function to be executed
 */
function getRecallTimeStats() {
  try {
    return function (callback) {
      try {

        // prepare the query
        const query = SQL`
          SELECT t1.queue, t.cnam AS agent, TIMESTAMPDIFF(SECOND, time1, t.calldate) AS recall_time
          FROM daily_cdr t
            RIGHT JOIN
            (
              SELECT b.callid, b.data2 AS caller, CAST(b.TIME AS DATETIME) AS time1, b.queuename AS queue
              FROM queue_log a
                LEFT JOIN queue_log b
                ON b.callid = a.callid
              WHERE a.event IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON") AND b.event = "ENTERQUEUE"
            ) t1
            ON t.dst LIKE CONCAT('%', t1.caller ,'%')
          WHERE t.disposition = "ANSWERED"
            AND t.cnam IN (
              SELECT DISTINCT(t.cnam) FROM queue_log WHERE t.cnam IS NOT NULL AND t.cnam!="NONE" AND queuename=t1.queue
            )
            AND t.calldate > t1.time1 AND t.billsec > 0
          GROUP BY t1.callid, t1.queue
          ORDER BY t.calldate
        `

        // execute the query
        compDbconnMain.dbConn['queue_log'].query(
          query,
          (err, results) => {
            try {
              if (err) {
                // catch the query error
                throw new Error(err)
              }

              // manage results
              if (results.length > 0) {
                logger.log.info(IDLOG, 'get recall time stats of queues and agents has been successful')

                // results is an array of objects, there's an object for each recall
                // the object keys are queue: string, agent: string, recall_time: int
                callback(null, results)

              } else {
                logger.log.info(IDLOG, 'recall time stats of queues and agents: not found')
                callback(null, {})
              }
            } catch (error) {
              logger.log.error(IDLOG, error.stack)
              callback(error)
            }
          }
        )
        compDbconnMain.incNumExecQueries()
      } catch (err) {
        logger.log.error(IDLOG, err.stack)
        callback(err)
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack)
  }
}

/**
 * Provides recall_time for agents
 *
 * @method agentsRecallTime
 * @return {function} The object containing recall_time stats for each agent and his queues
 */
function agentsRecallTime(stats) {
  try {
    if (!stats) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments))
    }
    if (stats.length > 0) {
      // calculate min, max, avg recall_time for allCalls
      const agentsStats = {}
      // find agents
      const agents = [...new Set(stats.map(el => el.agent))]
      agents.forEach(agent => {
        agentsStats[agent] = {}
        const agentStats = stats.filter(el => el.agent == agent)

        // find recall_time for all queues
        const recallTime = agentStats.map(el => el.recall_time)
        agentsStats[agent].min_recall_time = Math.min(...recallTime) || 0,
        agentsStats[agent].max_recall_time = Math.max(...recallTime) || 0,
        agentsStats[agent].avg_recall_time = Math.round(recallTime.reduce((a, b) => a + b) / recallTime.length) || 0

        // find agent's queues
        const queues = [...new Set(agentStats.map(el => el.queue))]
        // find recall_time for each queue
        queues.forEach(queue => {
          const queueStats = agentStats.filter(el => el.queue == queue)
          const queueRecallTime = queueStats.map(el => el.recall_time)
          agentsStats[agent][queue] = {
            min_recall_time: Math.min(...queueRecallTime) || 0,
            max_recall_time: Math.max(...queueRecallTime) || 0,
            avg_recall_time: Math.round(queueRecallTime.reduce((a, b) => a + b) / queueRecallTime.length) || 0
          }
        })
      })
      return agentsStats
    }
    return null
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return function to have calls taken counter of queue agents and their
 * time of last call.
 *
 * @method getAgentsStatsCalls
 * @return {function} The function to be executed
 */
function getAgentsStatsCalls(agents) {
  try {
    if (Array.isArray(agents) !== true) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return function (callback) {
      try {
        let query = `
SELECT
  MAX(time) AS \`last_call_time\`,
  COUNT(queuename) AS \`calls_taken\`,
  SUM(data2) AS \`duration_incoming\`,
  MAX(data2) AS \`max_duration_incoming\`,
  MIN(data2) AS \`min_duration_incoming\`,
  AVG(data2) AS \`avg_duration_incoming\`,
  \`queuename\`, \`agent\`
FROM \`queue_log\`
WHERE \`event\` IN ("COMPLETEAGENT","COMPLETECALLER") AND agent IN ("${agents.join('","')}") GROUP BY \`agent\`, \`queuename\``;
        compDbconnMain.dbConn['queue_log'].query(
          query,
          (err, results, fields) => {
          try {
            if (results) {
              logger.log.info(IDLOG, 'get calls taken count stats of queue agents "' + agents + '" has been successful');
              var values = {};
              var i;
              for (i = 0; i < results.length; i++) {
                results[i].last_call_time = Math.round(new Date(results[i].last_call_time).getTime() / 1000);
                if (!values[results[i].agent]) {
                  values[results[i].agent] = {};
                }
                if (!values[results[i].agent][results[i].queuename]) {
                  values[results[i].agent][results[i].queuename] = {};
                }
                values[results[i].agent][results[i].queuename].duration_incoming = results[i].duration_incoming;
                values[results[i].agent][results[i].queuename].calls_taken = results[i].calls_taken;
                values[results[i].agent][results[i].queuename].last_call_time = Math.floor(results[i].last_call_time);
                values[results[i].agent][results[i].queuename].max_duration_incoming = parseInt(results[i].max_duration_incoming);
                values[results[i].agent][results[i].queuename].min_duration_incoming = parseInt(results[i].min_duration_incoming);
                values[results[i].agent][results[i].queuename].avg_duration_incoming = Math.floor(results[i].avg_duration_incoming);
              }
              callback(null, values);
            } else {
              logger.log.info(IDLOG, 'get calls taken count stats of agents "' + agents + '": not found');
              callback(null, {});
            }
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            callback(error);
          }
        });
        compDbconnMain.incNumExecQueries();
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        callback(err);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return function to have missed calls counter of queue agents.
 *
 * @method getAgentsMissedCalls
 * @param {array} agents The list of the agents
 * @return {function} The function to be executed
 */
function getAgentsMissedCalls(agents) {
  try {
    if (Array.isArray(agents) !== true) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return function (callback) {
      try {
        let query = `
SELECT
  COUNT(event) AS \`noanswercalls\`,
  agent, queuename
FROM \`queue_log\`
WHERE event="RINGNOANSWER" AND agent IN ("${agents.join('","')}") GROUP BY queuename, agent ORDER BY agent`;
        compDbconnMain.dbConn['queue_log'].query(
          query,
          (err, results, fields) => {
          try {
            try {
              if (results) {
                logger.log.info(IDLOG, 'get missed calls count of queue agents "' + agents + '" has been successful');
                var values = {};
                for (var i = 0; i < results.length; i++) {
                  if (!values[results[i].agent]) {
                    values[results[i].agent] = {};
                  }
                  if (!values[results[i].agent][results[i].queuename]) {
                    values[results[i].agent][results[i].queuename] = {};
                  }
                  values[results[i].agent][results[i].queuename].noanswercalls = results[i].noanswercalls;
                }
                callback(null, values);
              } else {
                logger.log.info(IDLOG, 'get missed calls of agents "' + agents + '": not found');
                callback(null, {});
              }
            } catch (error) {
              logger.log.error(IDLOG, error.stack);
              callback(error);
            }
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            callback(error);
          }
        });
        compDbconnMain.incNumExecQueries();
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        callback(err);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Return function to have outgoing calls counter of queue agents.
 *
 * @method getAgentsOutgoingCalls
 * @param {array} agents The list of the agents
 * @return {function} The function to be executed
 */
function getAgentsOutgoingCalls(agents) {
  try {
    if (Array.isArray(agents) !== true) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return function (callback) {
      try {
        const now = moment().format('YYYY-MM-DD');
        compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].findAll({
          where: [
            'disposition="ANSWERED" AND cnam IN ("' + agents.join('","') + '") AND ' +
            '(calldate BETWEEN "' + (now + ' 00:00:00"') + ' AND "' + (now + ' 23:59:59') + '") GROUP BY cnam'
          ],
          attributes: [
            ['MAX(duration)', 'max_duration_outgoing'],
            ['MIN(duration)', 'min_duration_outgoing'],
            ['AVG(duration)', 'avg_duration_outgoing'],
            ['SUM(duration)', 'tot_duration_outgoing'],
            ['COUNT(cnam)', 'outgoing_calls'],
            ['cnam', 'agent']
          ]
        }).then(function (results) {
          try {
            if (results) {
              logger.log.info(IDLOG, 'get outgoing calls of queue agents "' + agents + '" has been successful');
              var values = {};
              for (var i = 0; i < results.length; i++) {
                values[results[i].dataValues.agent] = {
                  outgoing_calls: results[i].dataValues.outgoing_calls,
                  duration_outgoing: results[i].dataValues.tot_duration_outgoing,
                  max_duration_outgoing: results[i].dataValues.max_duration_outgoing,
                  min_duration_outgoing: results[i].dataValues.min_duration_outgoing,
                  avg_duration_outgoing: Math.floor(results[i].dataValues.avg_duration_outgoing)
                }
              }
              callback(null, values);
            } else {
              logger.log.info(IDLOG, 'get outgoing calls of queue agents "' + agents + '": not found');
              callback(null, {});
            }
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            callback(error);
          }
        }, function (err) {
          logger.log.error(IDLOG, 'get outgoing calls of queue agents "' + agents + '": ' + err.toString());
          callback(err.toString());
        });
        compDbconnMain.incNumExecQueries();
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        callback(err);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Return function to have logint, logout stats of queue agents.
 *
 * @method getAgentsStatsLoginLogout
 * @param {array} agents The list of the agents
 * @return {function} The function to be executed
 */
function getAgentsStatsLoginLogout(agents) {
  try {
    if (Array.isArray(agents) !== true) {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    return function (callback) {
      try {
        let query = `
SELECT
  MAX(time) AS \`last_time\`,
  id, callid, queuename, agent, event
FROM queue_log
WHERE event IN ("REMOVEMEMBER","ADDMEMBER")
  AND ( (agent IN ("${agents.join('","')}")
  AND data1="") || (agent IN ("${agents.join('","')}") AND data1!="") )
  GROUP BY queuename, agent, event ORDER BY time`;
        compDbconnMain.dbConn['queue_log'].query(
          query,
          (err, results, fields) => {
          try {
            if (results) {
              logger.log.info(IDLOG, 'get login/logout stats of queue agents "' + agents + '" has been successful');
              var values = {};
              var i;
              for (i = 0; i < results.length; i++) {
                results[i].last_time = Math.round(new Date(results[i].last_time).getTime() / 1000);
                if (!values[results[i].agent]) {
                  values[results[i].agent] = {};
                }
                if (!values[results[i].agent][results[i].queuename]) {
                  values[results[i].agent][results[i].queuename] = {};
                }
                if (results[i].event === 'ADDMEMBER') {
                  values[results[i].agent][results[i].queuename].last_login_time = Math.floor(results[i].last_time);
                } else if (results[i].event === 'REMOVEMEMBER') {
                  values[results[i].agent][results[i].queuename].last_logout_time = Math.floor(results[i].last_time);
                }
              }
              callback(null, values);
            } else {
              logger.log.info(IDLOG, 'get login/logout stats of agents "' + agents + '": not found');
              callback(null, {});
            }
          } catch (error) {
            logger.log.error(IDLOG, error.stack);
            callback(error);
          }
        });
        compDbconnMain.incNumExecQueries();
      } catch (err) {
        logger.log.error(IDLOG, err.stack);
        callback(err);
      }
    }
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
  }
}

/**
 * Get agents statistics.
 *
 * @method getAgentsStatsByList
 * @param {object} members The list of all agents of all queues with logged-in and pause status
 * @param {function} cb The callback function
 * @param {array} qlist The list of permitted queues for qmanager
 */
function getAgentsStatsByList(members, cb, qlist) {
  try {
    if (typeof cb !== 'function' || typeof members !== 'object') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    // check if the cache is enabled and result is into the cache
    if (CACHE_ENABLED &&
      cache.getAgentsStatsByList &&
      (new Date().getTime() - cacheTimestamps.getAgentsStatsByList) < CACHE_TIMEOUT) {

      logger.log.info(IDLOG, 'getAgentsStatsByList CACHE HIT for queue agent stats');
      cb(null, cache.getAgentsStatsByList);
      return;
    }
    var agents = Object.keys(members);
    var functs = {
      calls_stats: getAgentsStatsCalls(agents),
      pause_unpause: getAgentsStatsPauseUnpause(agents),
      login_logout: getAgentsStatsLoginLogout(agents),
      calls_missed: getAgentsMissedCalls(agents),
      calls_outgoing: getAgentsOutgoingCalls(agents),
      pause_durations: getAgentsPauseDurations(agents),
      logon_durations: getAgentsLogonDurations(agents),
      recall_time_stats: getRecallTimeStats()
    };
    async.parallel(functs, function (err, data) {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting stats about qmanager agents:', err);
          cb(err);
        } else {
          var u, q;
          var ret = {};
          // calls stats
          for (u in data.calls_stats) {
            if (!ret[u]) {
              ret[u] = {
                incomingCalls: {
                  duration_incoming: 0,
                  avg_duration_incoming: 0,
                  min_duration_incoming: 99999,
                  max_duration_incoming: 0
                }
              };
            }
            for (q in data.calls_stats[u]) {
              if (!ret[u][q]) {
                ret[u][q] = {};
              }
              ret[u][q].calls_taken = data.calls_stats[u][q].calls_taken;
              ret[u][q].last_call_time = data.calls_stats[u][q].last_call_time;
              ret[u][q].duration_incoming = data.calls_stats[u][q].duration_incoming;
              ret[u][q].max_duration_incoming = data.calls_stats[u][q].max_duration_incoming;
              ret[u][q].min_duration_incoming = data.calls_stats[u][q].min_duration_incoming;
              ret[u][q].avg_duration_incoming = data.calls_stats[u][q].avg_duration_incoming;
              ret[u].incomingCalls.duration_incoming += data.calls_stats[u][q].duration_incoming;
              ret[u].incomingCalls.avg_duration_incoming += data.calls_stats[u][q].avg_duration_incoming;
              ret[u].incomingCalls.min_duration_incoming = data.calls_stats[u][q].min_duration_incoming < ret[u].incomingCalls.min_duration_incoming ? data.calls_stats[u][q].min_duration_incoming : ret[u].incomingCalls.min_duration_incoming;
              ret[u].incomingCalls.max_duration_incoming = data.calls_stats[u][q].max_duration_incoming > ret[u].incomingCalls.max_duration_incoming ? data.calls_stats[u][q].max_duration_incoming : ret[u].incomingCalls.max_duration_incoming;
            }
            ret[u].incomingCalls.avg_duration_incoming = Math.floor(ret[u].incomingCalls.avg_duration_incoming / Object.keys(data.calls_stats[u]).length);
          }
          // pause unpause
          for (u in data.pause_unpause) {
            if (!ret[u]) {
              ret[u] = {};
            }
            for (q in data.pause_unpause[u]) {
              if (!ret[u][q]) {
                ret[u][q] = {};
              }
              ret[u][q].last_paused_time = data.pause_unpause[u][q].last_paused_time;
              ret[u][q].last_unpaused_time = data.pause_unpause[u][q].last_unpaused_time;
            }
          }
          // login logout
          for (u in data.login_logout) {
            if (!ret[u]) {
              ret[u] = {};
            }
            for (q in data.login_logout[u]) {
              if (!ret[u][q]) {
                ret[u][q] = {};
              }
              ret[u][q].last_login_time = data.login_logout[u][q].last_login_time;
              ret[u][q].last_logout_time = data.login_logout[u][q].last_logout_time;
            }
          }
          // missed calls
          for (u in data.calls_missed) {
            if (!ret[u]) {
              ret[u] = {};
            }
            for (q in data.calls_missed[u]) {
              if (!ret[u][q]) {
                ret[u][q] = {};
              }
              ret[u][q].no_answer_calls = data.calls_missed[u][q].noanswercalls;
            }
          }
          // outgoing calls
          for (u in data.calls_outgoing) {
            if (!ret[u]) {
              ret[u] = {};
            }
            ret[u].outgoingCalls = data.calls_outgoing[u];
          }
          // pause durations
          var nowtime = Math.round(new Date().getTime() / 1000);
          for (u in data.pause_durations) {
            if (!ret[u]) {
              ret[u] = {};
            }
            for (q in data.pause_durations[u]){
              if (!ret[u][q]) {
                ret[u][q] = {};
              }
              ret[u][q].time_in_pause = data.pause_durations[u][q];
              // check if the agent is currently in pause: in this case add
              // current time passed from the last pause
              if (members[u] && members[u][q] && members[u][q].isInPause === true) {
                ret[u][q].time_in_pause += nowtime - data.pause_unpause[u][q].last_paused_time;
              }
            }
          }
          // logon durations
          for (u in data.logon_durations) {
            if (!ret[u]) {
              ret[u] = {};
            }
            for (q in data.logon_durations[u]){
              if (!ret[u][q]) {
                ret[u][q] = {};
              }
              ret[u][q].time_in_logon = data.logon_durations[u][q];
              // check if the agent is currently logged-in: in this case add
              // current time passed from the last logon
              if (members[u] && members[u][q] && members[u][q].isLoggedIn === true) {
                ret[u][q].time_in_logon += nowtime - data.login_logout[u][q].last_login_time;
              }
              // pause percentage of logon time
              if (ret[u][q].time_in_pause && ret[u][q].time_in_logon) {
                var cp = (ret[u][q].time_in_pause * 100) / ret[u][q].time_in_logon;
                ret[u][q].pause_percent = Math.round(cp) > 0 ? Math.round(cp) : cp.toFixed(2);
              }
              // in conversation percentage of logon time
              if (ret[u][q].duration_incoming && ret[u][q].time_in_logon && ret[u][q].time_in_logon > ret[u][q].duration_incoming) {
                var cp = (ret[u][q].duration_incoming * 100) / ret[u][q].time_in_logon;
                ret[u][q].conversation_percent = Math.round(cp) > 0 ? Math.round(cp) : cp.toFixed(2);
              }
            }
          }
          // all calls: incoming & outgoing
          for (u in ret) {
            ret[u].allCalls = {};
            // total avg duration
            if (ret[u].incomingCalls && ret[u].incomingCalls.avg_duration_incoming && ret[u].outgoingCalls && ret[u].outgoingCalls.avg_duration_outgoing) {
              ret[u].allCalls.avg_duration = Math.floor((ret[u].incomingCalls.avg_duration_incoming + ret[u].outgoingCalls.avg_duration_outgoing) / 2);
            } else if (ret[u].incomingCalls && ret[u].incomingCalls.avg_duration_incoming) {
              ret[u].allCalls.avg_duration = ret[u].incomingCalls.avg_duration_incoming;
            } else if (ret[u].outgoingCalls && ret[u].outgoingCalls.avg_duration_outgoing) {
              ret[u].allCalls.avg_duration = ret[u].outgoingCalls.avg_duration_outgoing;
            }
            // total min duration
            if (ret[u].incomingCalls && ret[u].incomingCalls.min_duration_incoming && ret[u].outgoingCalls && ret[u].outgoingCalls.min_duration_outgoing) {
              ret[u].allCalls.min_duration = ret[u].incomingCalls.min_duration_incoming < ret[u].outgoingCalls.min_duration_outgoing ? ret[u].incomingCalls.min_duration_incoming : ret[u].outgoingCalls.min_duration_outgoing;
            } else if (ret[u].incomingCalls && ret[u].incomingCalls.min_duration_incoming) {
              ret[u].allCalls.min_duration = ret[u].incomingCalls.min_duration_incoming;
            } else if (ret[u].outgoingCalls && ret[u].outgoingCalls.min_duration_outgoing) {
              ret[u].allCalls.min_duration = ret[u].outgoingCalls.min_duration_outgoing;
            }
            // total max duration
            if (ret[u].incomingCalls && ret[u].incomingCalls.max_duration_incoming && ret[u].outgoingCalls && ret[u].outgoingCalls.max_duration_outgoing) {
              ret[u].allCalls.max_duration = ret[u].incomingCalls.max_duration_incoming > ret[u].outgoingCalls.max_duration_outgoing ? ret[u].incomingCalls.max_duration_incoming : ret[u].outgoingCalls.max_duration_outgoing;
            } else if (ret[u].incomingCalls && ret[u].incomingCalls.max_duration_incoming) {
              ret[u].allCalls.max_duration = ret[u].incomingCalls.max_duration_incoming;
            } else if (ret[u].outgoingCalls && ret[u].outgoingCalls.max_duration_outgoing) {
              ret[u].allCalls.max_duration = ret[u].outgoingCalls.max_duration_outgoing;
            }
          }
          // remove not permitted queues from recall stats data
          for (let i in data.recall_time_stats) {
            if (!qlist.includes(data.recall_time_stats[i].queue)) {
              data.recall_time_stats.splice(i, 1)
            }
          }
          // art = agent's recall_time
          const art = agentsRecallTime(data.recall_time_stats)
          if (art && Object.keys(art).length > 0) {
            for (u in ret) {
              // set recall_time for agent
              ret[u].allQueues = {}
              if (art[u] && art[u].min_recall_time) ret[u].allQueues.min_recall_time = art[u].min_recall_time
              if (art[u] && art[u].max_recall_time) ret[u].allQueues.max_recall_time = art[u].max_recall_time
              if (art[u] && art[u].avg_recall_time) ret[u].allQueues.avg_recall_time = art[u].avg_recall_time
              for (q in art[u]) {
                if (!ret[u][q]) ret[u][q] = {}
                // set recall_time for each queue of the agent
                if (art[u] && art[u][q] && art[u][q].min_recall_time) ret[u][q].min_recall_time = art[u][q].min_recall_time
                if (art[u] && art[u][q] && art[u][q].max_recall_time) ret[u][q].max_recall_time = art[u][q].max_recall_time
                if (art[u] && art[u][q] && art[u][q].avg_recall_time) ret[u][q].avg_recall_time = art[u][q].avg_recall_time
              }
            }
          }
          if (CACHE_ENABLED) {
            cache.getAgentsStatsByList = ret;
            cacheTimestamps.getAgentsStatsByList = new Date().getTime();
            logger.log.info(IDLOG, 'getAgentsStatsByList CACHE MISS for queue agent stats');
          }
          cb(null, ret);
        }
      } catch (err1) {
        logger.log.error(IDLOG, err1.stack);
        cb(err1);
      }
    });
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Deletes a call recording from the database. It updates the entry of the specified call emptying
 * the content of the _recordingfile_ field of the _asteriskcdrdb.cdr_ database table.
 *
 * @method deleteCallRecording
 * @param {string}   uniqueid The database identifier of the call
 * @param {function} cb       The callback function
 */
function deleteCallRecording(uniqueid, cb) {
  try {
    // check parameters
    if (typeof uniqueid !== 'string' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].find({
      where: ['uniqueid=?', uniqueid]

    }).then(function (task) {
      try {

        if (task) {

          // empty the content of the "recordingfile" field
          task.updateAttributes({
            recordingfile: ''
          }, ['recordingfile']).then(function () {

            logger.log.info(IDLOG, '"recordingfile" field of the call with uniqueid "' + uniqueid + '" has been emptied successfully from asteriskcdrdb.cdr table');
            cb();
          });

        } else {
          var str = 'emptying "recordingfile" of the call with uniqueid "' + uniqueid + '" from asteriskcdrdb.cdr table: entry not found';
          logger.log.warn(IDLOG, str);
          cb(str);
        }

      } catch (error) {
        logger.log.error(IDLOG, error.stack);
        cb(error);
      }

    }, function (err) { // manage the error

      logger.log.error(IDLOG, 'emptying "recordingfile" of the call with uniqueid "' + uniqueid + '" from asteriskcdrdb.cdr table: not found: ' + err.toString());
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();

  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err);
  }
}

/**
 * Returns the data about the call recording audio file as an object, or
 * a false value if no data has been found.
 *
 * @method getCallRecordingFileData
 * @param {string}   uniqueid The call identifier in the database
 * @param {function} cb       The callback function
 */
function getCallRecordingFileData(uniqueid, cb) {
  try {
    // check parameters
    if (typeof cb !== 'function' || typeof uniqueid !== 'string') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }

    // search
    compDbconnMain.models[compDbconnMain.JSON_KEYS.HISTORY_CALL].find({
      where: [
        'uniqueid=? AND recordingfile!=""', uniqueid
      ],
      attributes: [
        ['DATE_FORMAT(calldate, "%Y")', 'year'],
        ['DATE_FORMAT(calldate, "%m")', 'month'],
        ['DATE_FORMAT(calldate, "%d")', 'day'],
        ['recordingfile', 'filename']
      ]

    }).then(function (result) {
      // extract result to return in the callback function
      if (result) {
        logger.log.info(IDLOG, 'found data information about recording call with uniqueid ' + uniqueid);
        cb(null, result.dataValues);

      } else {
        logger.log.info(IDLOG, 'no data information about recording call with uniqueid ' + uniqueid);
        cb(null, false);
      }
    }, function (err) { // manage the error
      logger.log.error(IDLOG, 'getting data information about recording call with uniqueid ' + uniqueid);
      cb(err.toString());
    });

    compDbconnMain.incNumExecQueries();
  } catch (err) {
    logger.log.error(IDLOG, err.stack);
    cb(err.toString());
  }
}

/**
 * Get pin of extensions.
 *
 * @method getPinExtens
 * @param {array} extens The extension list
 * @param {function} cb The callback
 */
function getPinExtens(extens, cb) {
  try {
    if (!Array.isArray(extens) || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    if (extens.length === 0) {
      cb(null, {});
      return;
    }
    compDbconnMain.dbConn['pin'].query(
      'SELECT `extension`, `pin`, `enabled` FROM `pin` WHERE `extension` IN (?)',
      [extens],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, 'getting pin of extens ' + extens.toString());
          logger.log.error(IDLOG, err.stack);
          cb(err);
          return;
        }
        let retval = {};
        if (results && results.length > 0) {
          for (let i = 0; i < results.length; i++) {
            retval[results[i].extension] = results[i];
            retval[results[i].extension].enabled = retval[results[i].extension].enabled === 1;
          }
          logger.log.info(IDLOG, 'found pin of extens ' + extens);
          cb(null, retval);
        } else {
          logger.log.info(IDLOG, `no pin found for extens ${extens}`);
          cb(null, []);
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
 * Set pin for the extension.
 *
 * @method setPinExten
 * @param {string} extension The extension identifier
 * @param {string} pin The pin number to be set
 * @param {boolean} enabled True if the pin has to be enabled on the phone
 * @param {function} cb The callback
 * @private
 */
function setPinExten(extension, pin, enabled, cb) {
  try {
    if (typeof extension !== 'string' || typeof pin !== 'string' || typeof enabled !== 'boolean' || typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    compDbconnMain.dbConn['pin'].execute(
      'INSERT INTO `pin` (`extension`,`pin`,`enabled`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `extension`=?, `pin`=?, `enabled`=?', 
      [extension, pin, enabled,extension, pin, enabled],
      (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, `setting pin ${pin} for exten ${extension} with status enabled "${enabled}"`);
          logger.log.error(IDLOG, err.stack);
          cb(err);
          return;
        }
        logger.log.info(IDLOG, `set pin ${pin} for exten ${extension} with status enabled "${enabled}"`);
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
 * Return true if the PIN has been enabled on at least one outbound route.
 *
 * @method isPinEnabledAtLeastOneRoute
 * @param {function} cb The callback function
 */
function isPinEnabledAtLeastOneRoute(cb) {
  try {
    if (typeof cb !== 'function') {
      throw new Error('wrong parameters: ' + JSON.stringify(arguments));
    }
    compDbconnMain.dbConn['pin_protected_routes'].query(
      'SELECT COUNT(*) AS `count` FROM `pin_protected_routes` WHERE enabled=1', (err, results, fields) => {
      try {
        if (err) {
          logger.log.error(IDLOG, err.stack);
          cb(err);
          return;
        }
        cb(null, results[0].count > 0 ? true : false);
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

apiList.setPinExten = setPinExten;
apiList.getPinExtens = getPinExtens;
apiList.getQueueStats = getQueueStats;
apiList.getRecall = getRecall;
apiList.getQueueRecallInfo = getQueueRecallInfo;
apiList.getFpbxAdminSha1Pwd = getFpbxAdminSha1Pwd;
apiList.deleteCallRecording = deleteCallRecording;
apiList.getAgentsStatsByList = getAgentsStatsByList;
apiList.getCallRecordingFileData = getCallRecordingFileData;
apiList.getQCallsStatsHist = getQCallsStatsHist;
apiList.isPinEnabledAtLeastOneRoute = isPinEnabledAtLeastOneRoute;
// public interface
exports.apiList = apiList;
exports.setLogger = setLogger;
exports.setCompDbconnMain = setCompDbconnMain;

