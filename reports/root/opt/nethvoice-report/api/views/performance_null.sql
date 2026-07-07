DROP TABLE IF EXISTS performance_null_year;

DROP TABLE IF EXISTS performance_null_month;

DROP TABLE IF EXISTS performance_null_week;

DROP TABLE IF EXISTS performance_null_day;

CREATE TABLE performance_null_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    (
        ACTION = 'ABANDON'
        AND hold <= {{ ExtractSettings "NullCallTime" }}
    )
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_null_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    (
        ACTION = 'ABANDON'
        AND hold <= {{ ExtractSettings "NullCallTime" }}
    )
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_null_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    (
        ACTION = 'ABANDON'
        AND hold <= {{ ExtractSettings "NullCallTime" }}
    )
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_null_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    Count(id) AS count
FROM
    report_queue
WHERE
    (
        ACTION = 'ABANDON'
        AND hold <= {{ ExtractSettings "NullCallTime" }}
    )
GROUP BY
    period,
    qname
ORDER BY
    period ASC;