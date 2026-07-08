DROP TABLE IF EXISTS performance_talk_time_total;

DROP TABLE IF EXISTS performance_talk_time_total_5;

DROP TABLE IF EXISTS performance_talk_time_total_10;

DROP TABLE IF EXISTS performance_talk_time_total_15;

DROP TABLE IF EXISTS performance_talk_time_total_20;

DROP TABLE IF EXISTS performance_talk_time_total_25;

DROP TABLE IF EXISTS performance_talk_time_total_30;

DROP TABLE IF EXISTS performance_talk_time_total_45;

DROP TABLE IF EXISTS performance_talk_time_total_60;

DROP TABLE IF EXISTS performance_talk_time_total_75;

DROP TABLE IF EXISTS performance_talk_time_total_90;

DROP TABLE IF EXISTS performance_talk_time_total_105;

DROP TABLE IF EXISTS performance_talk_time_total_120;

DROP TABLE IF EXISTS performance_talk_time_total_180;

DROP TABLE IF EXISTS performance_talk_time_total_240;

DROP TABLE IF EXISTS performance_talk_time_total_300;

DROP TABLE IF EXISTS performance_talk_time_total_450;

DROP TABLE IF EXISTS performance_talk_time_total_600;

DROP TABLE IF EXISTS performance_talk_time_total_600p;

CREATE TABLE performance_talk_time_total AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_5 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 5
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_10 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 10
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_15 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 15
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_20 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 20
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_25 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 25
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_30 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 30
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_45 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 45
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_60 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 60
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_75 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 75
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_90 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 90
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_105 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 105
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_120 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 120
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_180 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 180
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_240 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 240
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_300 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 300
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_450 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 450
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_600 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 0
       AND asteriskcdrdb.report_queue.duration <= 600
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_talk_time_total_600p AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       asteriskcdrdb.report_queue
WHERE
       asteriskcdrdb.report_queue.action = 'ANSWER'
       AND asteriskcdrdb.report_queue.duration > 600
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;
