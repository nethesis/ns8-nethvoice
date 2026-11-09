DROP TABLE IF EXISTS data_summary_recall_year;

DROP TABLE IF EXISTS data_summary_recall_month;

DROP TABLE IF EXISTS data_summary_recall_week;

DROP TABLE IF EXISTS data_summary_recall_day;

CREATE TABLE data_summary_recall_year AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       Min(data4) AS min_recall,
       Avg(data4) AS avg_recall,
       Max(data4) AS max_recall
FROM
       report_queue
WHERE
       action IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON")
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_recall_month AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       Min(data4) AS min_recall,
       Avg(data4) AS avg_recall,
       Max(data4) AS max_recall
FROM
       report_queue
WHERE
       action IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON")
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_recall_week AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       Min(data4) AS min_recall,
       Avg(data4) AS avg_recall,
       Max(data4) AS max_recall
FROM
       report_queue
WHERE
       action IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON")
GROUP BY
       period,
       qname
ORDER BY
       period ASC;

CREATE TABLE data_summary_recall_day AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Min(data4) AS min_recall,
       Avg(data4) AS avg_recall,
       Max(data4) AS max_recall
FROM
       report_queue
WHERE
       action IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON")
GROUP BY
       period,
       qname
ORDER BY
       period ASC;
