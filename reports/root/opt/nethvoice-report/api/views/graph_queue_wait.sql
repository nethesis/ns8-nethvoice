DROP TABLE IF EXISTS graph_queue_hold_10;

DROP TABLE IF EXISTS graph_queue_hold_15;

DROP TABLE IF EXISTS graph_queue_hold_30;

DROP TABLE IF EXISTS graph_queue_hold_60;

CREATE TABLE graph_queue_hold_10 AS
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
       Avg(hold) AS avg_hold
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

CREATE TABLE graph_queue_hold_15 AS
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
       Avg(hold) AS avg_hold
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

CREATE TABLE graph_queue_hold_30 AS
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
       Avg(hold) AS avg_hold
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

CREATE TABLE graph_queue_hold_60 AS
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
       Avg(hold) AS avg_hold
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