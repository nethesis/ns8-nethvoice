DROP TABLE IF EXISTS distribution_hour_ivr_year_10;

DROP TABLE IF EXISTS distribution_hour_ivr_year_15;

DROP TABLE IF EXISTS distribution_hour_ivr_year_30;

DROP TABLE IF EXISTS distribution_hour_ivr_year_60;

CREATE TABLE distribution_hour_ivr_year_10 AS
SELECT
       Date_format(time, "%Y") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_10
ORDER BY
       period ASC,
       time_10;

CREATE TABLE distribution_hour_ivr_year_15 AS
SELECT
       Date_format(time, "%Y") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_15
ORDER BY
       period ASC,
       time_15;

CREATE TABLE distribution_hour_ivr_year_30 AS
SELECT
       Date_format(time, "%Y") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_30
ORDER BY
       period ASC,
       time_30;

CREATE TABLE distribution_hour_ivr_year_60 AS
SELECT
       Date_format(time, "%Y") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_60
ORDER BY
       period ASC,
       time_60;

DROP TABLE IF EXISTS distribution_hour_ivr_month_10;

DROP TABLE IF EXISTS distribution_hour_ivr_month_15;

DROP TABLE IF EXISTS distribution_hour_ivr_month_30;

DROP TABLE IF EXISTS distribution_hour_ivr_month_60;

CREATE TABLE distribution_hour_ivr_month_10 AS
SELECT
       Date_format(time, "%Y-%m") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_10
ORDER BY
       period ASC,
       time_10;

CREATE TABLE distribution_hour_ivr_month_15 AS
SELECT
       Date_format(time, "%Y-%m") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_15
ORDER BY
       period ASC,
       time_15;

CREATE TABLE distribution_hour_ivr_month_30 AS
SELECT
       Date_format(time, "%Y-%m") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_30
ORDER BY
       period ASC,
       time_30;

CREATE TABLE distribution_hour_ivr_month_60 AS
SELECT
       Date_format(time, "%Y-%m") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_60
ORDER BY
       period ASC,
       time_60;

DROP TABLE IF EXISTS distribution_hour_ivr_week_10;

DROP TABLE IF EXISTS distribution_hour_ivr_week_15;

DROP TABLE IF EXISTS distribution_hour_ivr_week_30;

DROP TABLE IF EXISTS distribution_hour_ivr_week_60;

CREATE TABLE distribution_hour_ivr_week_10 AS
SELECT
       Date_format(time, "%x-W%v") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_10
ORDER BY
       period ASC,
       time_10;

CREATE TABLE distribution_hour_ivr_week_15 AS
SELECT
       Date_format(time, "%x-W%v") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_15
ORDER BY
       period ASC,
       time_15;

CREATE TABLE distribution_hour_ivr_week_30 AS
SELECT
       Date_format(time, "%x-W%v") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_30
ORDER BY
       period ASC,
       time_30;

CREATE TABLE distribution_hour_ivr_week_60 AS
SELECT
       Date_format(time, "%x-W%v") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_60
ORDER BY
       period ASC,
       time_60;

DROP TABLE IF EXISTS distribution_hour_ivr_day_10;

DROP TABLE IF EXISTS distribution_hour_ivr_day_15;

DROP TABLE IF EXISTS distribution_hour_ivr_day_30;

DROP TABLE IF EXISTS distribution_hour_ivr_day_60;

CREATE TABLE distribution_hour_ivr_day_10 AS
SELECT
       Date_format(time, "%Y-%m-%d") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (10 * 60)
              ),
              "%H:%i"
       ) AS time_10,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_10
ORDER BY
       period ASC,
       time_10;

CREATE TABLE distribution_hour_ivr_day_15 AS
SELECT
       Date_format(time, "%Y-%m-%d") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (15 * 60)
              ),
              "%H:%i"
       ) AS time_15,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_15
ORDER BY
       period ASC,
       time_15;

CREATE TABLE distribution_hour_ivr_day_30 AS
SELECT
       Date_format(time, "%Y-%m-%d") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (30 * 60)
              ),
              "%H:%i"
       ) AS time_30,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_30
ORDER BY
       period ASC,
       time_30;

CREATE TABLE distribution_hour_ivr_day_60 AS
SELECT
       Date_format(time, "%Y-%m-%d") AS period,
       Date_format(
              Sec_to_time(
                     Time_to_sec(time) - Time_to_sec(time) % (60 * 60)
              ),
              "%H:%i"
       ) AS time_60,
       data3 AS ivr_id,
       data4 AS ivr_name,
       data2 AS choice,
       Count(*) AS tot
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
       choice,
       time_60
ORDER BY
       period ASC,
       time_60;