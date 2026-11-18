DROP TABLE IF EXISTS performance_exitempty_year;

DROP TABLE IF EXISTS performance_exitempty_month;

DROP TABLE IF EXISTS performance_exitempty_week;

DROP TABLE IF EXISTS performance_exitempty_day;

CREATE TABLE performance_exitempty_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'EXITEMPTY'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_exitempty_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'EXITEMPTY'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_exitempty_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'EXITEMPTY'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_exitempty_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    ACTION = 'EXITEMPTY'
GROUP BY
    period,
    qname
ORDER BY
    period ASC;