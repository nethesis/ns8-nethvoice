DROP TABLE IF EXISTS performance_notmanaged_year;

DROP TABLE IF EXISTS performance_notmanaged_month;

DROP TABLE IF EXISTS performance_notmanaged_week;

DROP TABLE IF EXISTS performance_notmanaged_day;

CREATE TABLE performance_notmanaged_year AS
SELECT
    Date_format(From_unixtime(time), "%Y") AS period,
    qname,
    Count(*) AS count
FROM
    queue_failed
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_notmanaged_month AS
SELECT
    Date_format(From_unixtime(time), "%Y-%m") AS period,
    qname,
    Count(*) AS count
FROM
    queue_failed
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_notmanaged_week AS
SELECT
    Date_format(From_unixtime(time), "%x-W%v") AS period,
    qname,
    Count(*) AS count
FROM
    queue_failed
GROUP BY
    period,
    qname
ORDER BY
    period ASC;

CREATE TABLE performance_notmanaged_day AS
SELECT
    Date_format(From_unixtime(time), "%Y-%m-%d") AS period,
    qname,
    Count(*) AS count
FROM
    queue_failed
GROUP BY
    period,
    qname
ORDER BY
    period ASC;
