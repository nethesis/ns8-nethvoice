/* total */
DROP TABLE IF EXISTS graph_hour_total;

CREATE TABLE graph_hour_total AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end total */
/* good */
DROP TABLE IF EXISTS graph_hour_good;

CREATE TABLE graph_hour_good AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end good */
/* failed */
DROP TABLE IF EXISTS graph_hour_failed;

CREATE TABLE graph_hour_failed AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       (
              ACTION = 'ABANDON'
              AND hold > {{ ExtractSettings "NullCallTime" }}
       )
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end failed */
/* timeout */
DROP TABLE IF EXISTS graph_hour_timeout;

CREATE TABLE graph_hour_timeout AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end timeout */
/* exitempty */
DROP TABLE IF EXISTS graph_hour_exitempty;

CREATE TABLE graph_hour_exitempty AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       ACTION = 'EXITEMPTY'
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end exitempty */
/* exitkey */
DROP TABLE IF EXISTS graph_hour_exitkey;

CREATE TABLE graph_hour_exitkey AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHKEY'
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end exitkey */
/* full */
DROP TABLE IF EXISTS graph_hour_full;

CREATE TABLE graph_hour_full AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       ACTION = 'FULL'
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end full */
/* joinempty */
DROP TABLE IF EXISTS graph_hour_joinempty;

CREATE TABLE graph_hour_joinempty AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       ACTION IN ('JOINEMPTY', 'JOINUNAVAIL')
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end joinempty */
/* null */
DROP TABLE IF EXISTS graph_hour_null;

CREATE TABLE graph_hour_null AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
WHERE
       (
              ACTION = 'ABANDON'
              AND hold <= {{ ExtractSettings "NullCallTime" }}
       )
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;

/* end null */
/* agents */
DROP TABLE IF EXISTS graph_hour_agents;

CREATE TABLE graph_hour_agents AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       agent,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num
FROM
       report_queue
GROUP BY
       agent,
       period,
       HOUR
ORDER BY
       agent,
       period,
       HOUR;

/* end agents */
/* ivr */
DROP TABLE IF EXISTS graph_hour_ivr;

CREATE TABLE graph_hour_ivr AS
SELECT
       Date_format(time, "%Y-%m-%d") AS period,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Date_format(time, "%H:00") AS HOUR,
       Count(id) AS num
FROM
       queue_log_history
WHERE
       queuename = 'NONE'
       AND agent = 'NONE'
       AND event = 'INFO'
       AND data1 = 'IVRAPPEND'
GROUP BY
       ivr_id,
       choice,
       period,
       HOUR
ORDER BY
       ivr_id,
       choice,
       period,
       HOUR;

/* end ivr */