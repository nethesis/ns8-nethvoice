DROP TABLE IF EXISTS dashboard_call_uniqcid_year;

DROP TABLE IF EXISTS dashboard_call_uniqcid_month;

DROP TABLE IF EXISTS dashboard_call_uniqcid_week;

DROP TABLE IF EXISTS dashboard_call_uniqcid_day;

CREATE TABLE dashboard_call_uniqcid_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    qdescr,
    Count(DISTINCT cid) AS total
FROM
    report_queue
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE dashboard_call_uniqcid_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    qdescr,
    Count(DISTINCT cid) AS total
FROM
    report_queue
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE dashboard_call_uniqcid_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    qdescr,
    Count(DISTINCT cid) AS total
FROM
    report_queue
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE dashboard_call_uniqcid_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    qdescr,
    Count(DISTINCT cid) AS total
FROM
    report_queue
GROUP BY
    period,
    qname
ORDER BY
    period ASC;