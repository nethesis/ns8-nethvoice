DROP TABLE IF EXISTS graph_queue_position_10;

DROP TABLE IF EXISTS graph_queue_position_15;

DROP TABLE IF EXISTS graph_queue_position_30;

DROP TABLE IF EXISTS graph_queue_position_60;

CREATE TABLE graph_queue_position_10 AS
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
       Avg(position) AS avg_position
FROM
       report_queue
WHERE
       NOT ACTION = "full"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_10
ORDER BY
       period,
       time_10;

CREATE TABLE graph_queue_position_15 AS
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
       Avg(position) AS avg_position
FROM
       report_queue
WHERE
       NOT ACTION = "full"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_15
ORDER BY
       period,
       time_15;

CREATE TABLE graph_queue_position_30 AS
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
       Avg(position) AS avg_position
FROM
       report_queue
WHERE
       NOT ACTION = "full"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_30
ORDER BY
       period,
       time_30;

CREATE TABLE graph_queue_position_60 AS
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
       Avg(position) AS avg_position
FROM
       report_queue
WHERE
       NOT ACTION = "full"
       AND NOT ACTION = "JOINEMPTY"
GROUP BY
       qdescr,
       period,
       time_60
ORDER BY
       period,
       time_60;