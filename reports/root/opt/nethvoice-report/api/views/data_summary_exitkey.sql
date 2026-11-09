DROP TABLE IF EXISTS data_summary_exitkey_year;

DROP TABLE IF EXISTS data_summary_exitkey_month;

DROP TABLE IF EXISTS data_summary_exitkey_week;

DROP TABLE IF EXISTS data_summary_exitkey_day;

CREATE TABLE data_summary_exitkey_year AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall,
       Max(hold) AS max_hold,
       Min(hold) AS min_hold,
       Avg(hold) AS avg_hold,
       Max(duration) AS max_in_pos,
       Avg(duration) AS avg_in_pos,
       Max(position) AS max_out_pos,
       Avg(position) AS avg_out_pos,
       qdescr
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHKEY'
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_exitkey_month AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall,
       Max(hold) AS max_hold,
       Min(hold) AS min_hold,
       Avg(hold) AS avg_hold,
       Max(duration) AS max_in_pos,
       Avg(duration) AS avg_in_pos,
       Max(position) AS max_out_pos,
       Avg(position) AS avg_out_pos,
       qdescr
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHKEY'
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_exitkey_week AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall,
       Max(hold) AS max_hold,
       Min(hold) AS min_hold,
       Avg(hold) AS avg_hold,
       Max(duration) AS max_in_pos,
       Avg(duration) AS avg_in_pos,
       Max(position) AS max_out_pos,
       Avg(position) AS avg_out_pos,
       qdescr
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHKEY'
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_exitkey_day AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       Count(DISTINCT cid) AS uniqCid,
       Count(id) AS num,
       Sum(IF(data4 > 0, 1, 0)) AS total_recall,
       Avg(IF(data4 > 0, data4, null)) AS avg_recall,
       Max(hold) AS max_hold,
       Min(hold) AS min_hold,
       Avg(hold) AS avg_hold,
       Max(duration) AS max_in_pos,
       Avg(duration) AS avg_in_pos,
       Max(position) AS max_out_pos,
       Avg(position) AS avg_out_pos,
       qdescr
FROM
       report_queue
WHERE
       ACTION = 'EXITWITHKEY'
GROUP BY
       period,
       qname
ORDER BY
       period ASC;