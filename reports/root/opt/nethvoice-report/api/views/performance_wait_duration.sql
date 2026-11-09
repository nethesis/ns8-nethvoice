DROP TABLE IF EXISTS performance_wait_duration_year;

DROP TABLE IF EXISTS performance_wait_duration_month;

DROP TABLE IF EXISTS performance_wait_duration_week;

DROP TABLE IF EXISTS performance_wait_duration_day;

CREATE TABLE performance_wait_duration_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    Max(hold) AS max_hold,
    Min(hold) AS min_hold,
    Avg(hold) AS avg_hold,
    Max(IF(ACTION = 'ANSWER',duration,NULL)) AS max_duration,
    Min(IF(ACTION = 'ANSWER',Nullif(duration, 0),NULL)) AS min_duration,
    Avg(IF(ACTION = 'ANSWER',duration,NULL)) AS avg_duration,
    qdescr
FROM
    report_queue
GROUP BY
    period,
    qname;

CREATE TABLE performance_wait_duration_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    Max(hold) AS max_hold,
    Min(hold) AS min_hold,
    Avg(hold) AS avg_hold,
    Max(IF(ACTION = 'ANSWER',duration,NULL)) AS max_duration,
    Min(IF(ACTION = 'ANSWER',Nullif(duration, 0),NULL)) AS min_duration,
    Avg(IF(ACTION = 'ANSWER',duration,NULL)) AS avg_duration,
    qdescr
FROM
    report_queue
GROUP BY
    period,
    qname;

CREATE TABLE performance_wait_duration_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    Max(hold) AS max_hold,
    Min(hold) AS min_hold,
    Avg(hold) AS avg_hold,
    Max(IF(ACTION = 'ANSWER',duration,NULL)) AS max_duration,
    Min(IF(ACTION = 'ANSWER',Nullif(duration, 0),NULL)) AS min_duration,
    Avg(IF(ACTION = 'ANSWER',duration,NULL)) AS avg_duration,
    qdescr
FROM
    report_queue
GROUP BY
    period,
    qname;

CREATE TABLE performance_wait_duration_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    Max(hold) AS max_hold,
    Min(hold) AS min_hold,
    Avg(hold) AS avg_hold,
    Max(IF(ACTION = 'ANSWER',duration,NULL)) AS max_duration,
    Min(IF(ACTION = 'ANSWER',Nullif(duration, 0),NULL)) AS min_duration,
    Avg(IF(ACTION = 'ANSWER',duration,NULL)) AS avg_duration,
    qdescr
FROM
    report_queue
GROUP BY
    period,
    qname;
