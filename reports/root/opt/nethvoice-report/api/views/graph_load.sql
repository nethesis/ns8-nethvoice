DROP TABLE IF EXISTS graph_load_total_year;

DROP TABLE IF EXISTS graph_load_total_month;

DROP TABLE IF EXISTS graph_load_total_week;

DROP TABLE IF EXISTS graph_load_total_day;

CREATE TABLE graph_load_total_year AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       Count(id) AS total
FROM
       report_queue
GROUP BY
       qdescr,
       period
ORDER BY
       period,
       total DESC;

CREATE TABLE graph_load_total_month AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       Count(id) AS total
FROM
       report_queue
GROUP BY
       qdescr,
       period
ORDER BY
       period,
       total DESC;

CREATE TABLE graph_load_total_week AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       Count(id) AS total
FROM
       report_queue
GROUP BY
       qdescr,
       period
ORDER BY
       period,
       total DESC;

CREATE TABLE graph_load_total_day AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Count(id) AS total
FROM
       report_queue
GROUP BY
       qdescr,
       period
ORDER BY
       period,
       total DESC;