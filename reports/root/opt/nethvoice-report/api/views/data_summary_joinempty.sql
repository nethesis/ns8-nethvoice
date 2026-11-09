DROP TABLE IF EXISTS data_summary_joinempty_year;

DROP TABLE IF EXISTS data_summary_joinempty_month;

DROP TABLE IF EXISTS data_summary_joinempty_week;

DROP TABLE IF EXISTS data_summary_joinempty_day;

CREATE TABLE data_summary_joinempty_year AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       qdescr,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
       report_queue
WHERE
       ACTION IN ('JOINEMPTY', 'JOINUNAVAIL')
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_joinempty_month AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       qdescr,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
       report_queue
WHERE
       ACTION IN ('JOINEMPTY', 'JOINUNAVAIL')
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_joinempty_week AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       qdescr,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
       report_queue
WHERE
       ACTION IN ('JOINEMPTY', 'JOINUNAVAIL')
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_joinempty_day AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       qdescr,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
       report_queue
WHERE
       ACTION IN ('JOINEMPTY', 'JOINUNAVAIL')
GROUP BY
       period,
       qname
ORDER BY
       period ASC;