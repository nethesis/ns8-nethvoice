DROP TABLE IF EXISTS graph_queue_duration_10;

DROP TABLE IF EXISTS graph_queue_duration_15;

DROP TABLE IF EXISTS graph_queue_duration_30;

DROP TABLE IF EXISTS graph_queue_duration_60;

CREATE TABLE graph_queue_duration_10 AS
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
       Avg(duration) AS avg_duration
FROM
       report_queue
WHERE
       NOT ACTION = "exitwithkey"
       AND NOT ACTION = "FULL"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_10
ORDER BY
       period,
       time_10;

CREATE TABLE graph_queue_duration_15 AS
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
       Avg(duration) AS avg_duration
FROM
       report_queue
WHERE
       NOT ACTION = "exitwithkey"
       AND NOT ACTION = "FULL"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_15
ORDER BY
       period,
       time_15;

CREATE TABLE graph_queue_duration_30 AS
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
       Avg(duration) AS avg_duration
FROM
       report_queue
WHERE
       NOT ACTION = "exitwithkey"
       AND NOT ACTION = "FULL"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_30
ORDER BY
       period,
       time_30;

CREATE TABLE graph_queue_duration_60 AS
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
       Avg(duration) AS avg_duration
FROM
       report_queue
WHERE
       NOT ACTION = "exitwithkey"
       AND NOT ACTION = "FULL"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_60
ORDER BY
       period,
       time_60;