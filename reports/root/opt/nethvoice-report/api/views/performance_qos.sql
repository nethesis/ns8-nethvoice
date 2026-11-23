DROP TABLE IF EXISTS performance_qos_total;

DROP TABLE IF EXISTS performance_qos_total_5;

DROP TABLE IF EXISTS performance_qos_total_10;

DROP TABLE IF EXISTS performance_qos_total_15;

DROP TABLE IF EXISTS performance_qos_total_20;

DROP TABLE IF EXISTS performance_qos_total_25;

DROP TABLE IF EXISTS performance_qos_total_30;

DROP TABLE IF EXISTS performance_qos_total_45;

DROP TABLE IF EXISTS performance_qos_total_60;

DROP TABLE IF EXISTS performance_qos_total_75;

DROP TABLE IF EXISTS performance_qos_total_90;

CREATE TABLE performance_qos_total AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_5 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 5
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_10 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 10
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_15 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 15
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_20 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 20
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_25 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 25
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_30 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 30
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_45 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 45
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_60 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 60
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_75 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 75
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;

CREATE TABLE performance_qos_total_90 AS
SELECT
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d') AS timestamp_in,
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d') AS timestamp_out,
       qname,
       Count(*) AS count
FROM
       report_queue
WHERE
       ACTION = 'ANSWER'
       AND hold < 90
GROUP BY
       Date_format(From_unixtime(timestamp_in), '%Y-%m-%d'),
       Date_format(From_unixtime(timestamp_out), '%Y-%m-%d'),
       qname;