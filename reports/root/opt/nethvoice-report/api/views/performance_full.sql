DROP TABLE IF EXISTS performance_full_year;

DROP TABLE IF EXISTS performance_full_month;

DROP TABLE IF EXISTS performance_full_week;

DROP TABLE IF EXISTS performance_full_day;

CREATE TABLE performance_full_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'FULL'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_full_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'FULL'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_full_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'FULL'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_full_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'FULL'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;