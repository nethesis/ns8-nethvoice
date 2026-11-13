DROP TABLE IF EXISTS performance_processed_year;

DROP TABLE IF EXISTS performance_processed_month;

DROP TABLE IF EXISTS performance_processed_week;

DROP TABLE IF EXISTS performance_processed_day;

CREATE TABLE performance_processed_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'ANSWER'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_processed_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'ANSWER'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_processed_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'ANSWER'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_processed_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'ANSWER'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;