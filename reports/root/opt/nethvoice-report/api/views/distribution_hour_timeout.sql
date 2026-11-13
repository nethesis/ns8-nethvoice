DROP TABLE IF EXISTS distribution_hour_timeout_year_10;

DROP TABLE IF EXISTS distribution_hour_timeout_year_15;

DROP TABLE IF EXISTS distribution_hour_timeout_year_30;

DROP TABLE IF EXISTS distribution_hour_timeout_year_60;

CREATE TABLE distribution_hour_timeout_year_10 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_10
ORDER BY
       period,
       qname,
       time_10;

CREATE TABLE distribution_hour_timeout_year_15 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_15
ORDER BY
       period,
       qname,
       time_15;

CREATE TABLE distribution_hour_timeout_year_30 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_30
ORDER BY
       period,
       qname,
       time_30;

CREATE TABLE distribution_hour_timeout_year_60 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_60
ORDER BY
       period,
       qname,
       time_60;

DROP TABLE IF EXISTS distribution_hour_timeout_month_10;

DROP TABLE IF EXISTS distribution_hour_timeout_month_15;

DROP TABLE IF EXISTS distribution_hour_timeout_month_30;

DROP TABLE IF EXISTS distribution_hour_timeout_month_60;

CREATE TABLE distribution_hour_timeout_month_10 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_10
ORDER BY
       period,
       qname,
       time_10;

CREATE TABLE distribution_hour_timeout_month_15 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_15
ORDER BY
       period,
       qname,
       time_15;

CREATE TABLE distribution_hour_timeout_month_30 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_30
ORDER BY
       period,
       qname,
       time_30;

CREATE TABLE distribution_hour_timeout_month_60 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_60
ORDER BY
       period,
       qname,
       time_60;

DROP TABLE IF EXISTS distribution_hour_timeout_week_10;

DROP TABLE IF EXISTS distribution_hour_timeout_week_15;

DROP TABLE IF EXISTS distribution_hour_timeout_week_30;

DROP TABLE IF EXISTS distribution_hour_timeout_week_60;

CREATE TABLE distribution_hour_timeout_week_10 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_10
ORDER BY
       period,
       qname,
       time_10;

CREATE TABLE distribution_hour_timeout_week_15 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_15
ORDER BY
       period,
       qname,
       time_15;

CREATE TABLE distribution_hour_timeout_week_30 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_30
ORDER BY
       period,
       qname,
       time_30;

CREATE TABLE distribution_hour_timeout_week_60 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_60
ORDER BY
       period,
       qname,
       time_60;

DROP TABLE IF EXISTS distribution_hour_timeout_day_10;

DROP TABLE IF EXISTS distribution_hour_timeout_day_15;

DROP TABLE IF EXISTS distribution_hour_timeout_day_30;

DROP TABLE IF EXISTS distribution_hour_timeout_day_60;

CREATE TABLE distribution_hour_timeout_day_10 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_10
ORDER BY
       period,
       qname,
       time_10;

CREATE TABLE distribution_hour_timeout_day_15 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_15
ORDER BY
       period,
       qname,
       time_15;

CREATE TABLE distribution_hour_timeout_day_30 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_30
ORDER BY
       period,
       qname,
       time_30;

CREATE TABLE distribution_hour_timeout_day_60 AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(
              Sec_to_time(
                     Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                            From_unixtime (
                                   timestamp_in
                            )
                     ) %(60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       Count(id) AS total
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHTIMEOUT'
GROUP BY
       period,
       qname,
       time_60
ORDER BY
       period,
       qname,
       time_60;