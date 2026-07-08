DROP TABLE IF EXISTS distribution_hour_lost_year_60;

CREATE TABLE distribution_hour_lost_year_60 AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    qdescr,
    Date_format(
        Sec_to_time(
            Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                From_unixtime (
                    timestamp_in
                )
            ) %(60 * 60) + (60 * 60)
        ),
        "%H:%i"
    ) AS time_60,
    Count(id) AS total
FROM
    report_queue
WHERE
    ACTION in ('ABANDON', 'EXITEMPTY', 'EXITWITHKEY', 'FULL', 'JOINEMPTY', 'EXITWITHTIMEOUT')
GROUP BY
    period,
    qname,
    time_60
ORDER BY
    period,
    qname,
    time_60;

DROP TABLE IF EXISTS distribution_hour_lost_month_60;

CREATE TABLE distribution_hour_lost_month_60 AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    qdescr,
    Date_format(
        Sec_to_time(
            Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                From_unixtime (
                    timestamp_in
                )
            ) %(60 * 60) + (60 * 60)
        ),
        "%H:%i"
    ) AS time_60,
    Count(id) AS total
FROM
    report_queue
WHERE
    ACTION in ('ABANDON', 'EXITEMPTY', 'EXITWITHKEY', 'FULL', 'JOINEMPTY', 'EXITWITHTIMEOUT')
GROUP BY
    period,
    qname,
    time_60
ORDER BY
    period,
    qname,
    time_60;

DROP TABLE IF EXISTS distribution_hour_lost_week_60;

CREATE TABLE distribution_hour_lost_week_60 AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    qdescr,
    Date_format(
        Sec_to_time(
            Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                From_unixtime (
                    timestamp_in
                )
            ) %(60 * 60) + (60 * 60)
        ),
        "%H:%i"
    ) AS time_60,
    Count(id) AS total
FROM
    report_queue
WHERE
    ACTION in ('ABANDON', 'EXITEMPTY', 'EXITWITHKEY', 'FULL', 'JOINEMPTY', 'EXITWITHTIMEOUT')
GROUP BY
    period,
    qname,
    time_60
ORDER BY
    period,
    qname,
    time_60;

DROP TABLE IF EXISTS distribution_hour_lost_day_60;

CREATE TABLE distribution_hour_lost_day_60 AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    qdescr,
    Date_format(
        Sec_to_time(
            Time_to_sec(From_unixtime(timestamp_in)) - Time_to_sec(
                From_unixtime (
                    timestamp_in
                )
            ) %(60 * 60) + (60 * 60)
        ),
        "%H:%i"
    ) AS time_60,
    Count(id) AS total
FROM
    report_queue
WHERE
    ACTION in ('ABANDON', 'EXITEMPTY', 'EXITWITHKEY', 'FULL', 'JOINEMPTY', 'EXITWITHTIMEOUT')
GROUP BY
    period,
    qname,
    time_60
ORDER BY
    period,
    qname,
    time_60;