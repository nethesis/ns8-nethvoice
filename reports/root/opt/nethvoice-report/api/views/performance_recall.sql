DROP TABLE IF EXISTS performance_recall_year;

DROP TABLE IF EXISTS performance_recall_month;

DROP TABLE IF EXISTS performance_recall_week;

DROP TABLE IF EXISTS performance_recall_day;

CREATE TABLE performance_recall_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    Sum(IF(data4 > 0, 1, 0)) AS total_recall,
    (Sum(IF(data4 > 0, 1, 0)) / Count(*) * 100 ) AS recall_percentage,
    Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
    report_queue
WHERE
    action IN ("EXITEMPTY ", "EXITWITHKEY ", "EXITWITHTIMEOUT ", "FULL ", "JOINEMPTY ", "JOINUNAVAIL", "ABANDON ")
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_recall_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    Sum(IF(data4 > 0, 1, 0)) AS total_recall,
    (Sum(IF(data4 > 0, 1, 0)) / Count(*) * 100 ) AS recall_percentage,
    Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
    report_queue
WHERE
    action IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON")
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_recall_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    Sum(IF(data4 > 0, 1, 0)) AS total_recall,
    (Sum(IF(data4 > 0, 1, 0)) / Count(*) * 100 ) AS recall_percentage,
    Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
    report_queue
WHERE
    action IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON")
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_recall_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    Sum(IF(data4 > 0, 1, 0)) AS total_recall,
    (Sum(IF(data4 > 0, 1, 0)) / Count(*) * 100 ) AS recall_percentage,
    Avg(IF(data4 > 0, data4, null)) AS avg_recall
FROM
    report_queue
WHERE
    action IN ("EXITEMPTY", "EXITWITHKEY", "EXITWITHTIMEOUT", "FULL", "JOINEMPTY", "JOINUNAVAIL", "ABANDON")
GROUP BY
    period,
    qname
ORDER BY
    period ASC;
