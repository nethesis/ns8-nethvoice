DROP TABLE IF EXISTS data_ivr_year;

DROP TABLE IF EXISTS data_ivr_month;

DROP TABLE IF EXISTS data_ivr_week;

DROP TABLE IF EXISTS data_ivr_day;

CREATE TABLE data_ivr_year AS
SELECT
    DATE_FORMAT(time, "%Y") AS period,
    data3 AS ivr_id,
    data4 AS ivr_name,
    data2 AS choice,
    count(*) AS tot
FROM
    queue_log_history
WHERE
    queuename = 'NONE'
    AND agent = 'NONE'
    AND event = 'INFO'
    AND data1 = 'IVRAPPEND'
GROUP BY
    period,
    ivr_id,
    choice
ORDER BY
    period ASC;

CREATE TABLE data_ivr_month AS
SELECT
    DATE_FORMAT(time, "%Y-%m") AS period,
    data3 AS ivr_id,
    data4 AS ivr_name,
    data2 AS choice,
    count(*) AS tot
FROM
    queue_log_history
WHERE
    queuename = 'NONE'
    AND agent = 'NONE'
    AND event = 'INFO'
    AND data1 = 'IVRAPPEND'
GROUP BY
    period,
    ivr_id,
    choice
ORDER BY
    period ASC;

CREATE TABLE data_ivr_week AS
SELECT
    DATE_FORMAT(time, "%x-W%v") AS period,
    data3 AS ivr_id,
    data4 AS ivr_name,
    data2 AS choice,
    count(*) AS tot
FROM
    queue_log_history
WHERE
    queuename = 'NONE'
    AND agent = 'NONE'
    AND event = 'INFO'
    AND data1 = 'IVRAPPEND'
GROUP BY
    period,
    ivr_id,
    choice
ORDER BY
    period ASC;

CREATE TABLE data_ivr_day AS
SELECT
    DATE_FORMAT(time, "%Y-%m-%d") AS period,
    data3 AS ivr_id,
    data4 AS ivr_name,
    data2 AS choice,
    count(*) AS tot
FROM
    queue_log_history
WHERE
    queuename = 'NONE'
    AND agent = 'NONE'
    AND event = 'INFO'
    AND data1 = 'IVRAPPEND'
GROUP BY
    period,
    ivr_id,
    choice
ORDER BY
    period ASC;