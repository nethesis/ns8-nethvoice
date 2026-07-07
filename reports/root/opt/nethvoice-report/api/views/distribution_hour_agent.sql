DROP TABLE IF EXISTS distribution_hour_agent_year_10;

DROP TABLE IF EXISTS distribution_hour_agent_year_15;

DROP TABLE IF EXISTS distribution_hour_agent_year_30;

DROP TABLE IF EXISTS distribution_hour_agent_year_60;

CREATE TABLE distribution_hour_agent_year_10 AS
SELECT
       Date_format(calldate, "%Y") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (10 * 60) + (
                            10 * 60
                     )
              ),
              "%H:%i"
       ) AS time_10,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10;

CREATE TABLE distribution_hour_agent_year_15 AS
SELECT
       Date_format(calldate, "%Y") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (15 * 60) + (
                            15 * 60
                     )
              ),
              "%H:%i"
       ) AS time_15,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15;

CREATE TABLE distribution_hour_agent_year_30 AS
SELECT
       Date_format(calldate, "%Y") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (30 * 60) + (
                            30 * 60
                     )
              ),
              "%H:%i"
       ) AS time_30,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30;

CREATE TABLE distribution_hour_agent_year_60 AS
SELECT
       Date_format(calldate, "%Y") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (60 * 60) + (
                            60 * 60
                     )
              ),
              "%H:%i"
       ) AS time_60,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60;

DROP TABLE IF EXISTS distribution_hour_agent_month_10;

DROP TABLE IF EXISTS distribution_hour_agent_month_15;

DROP TABLE IF EXISTS distribution_hour_agent_month_30;

DROP TABLE IF EXISTS distribution_hour_agent_month_60;

CREATE TABLE distribution_hour_agent_month_10 AS
SELECT
       Date_format(calldate, "%Y-%m") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (10 * 60) + (
                            10 * 60
                     )
              ),
              "%H:%i"
       ) AS time_10,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10;

CREATE TABLE distribution_hour_agent_month_15 AS
SELECT
       Date_format(calldate, "%Y-%m") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (15 * 60) + (
                            15 * 60
                     )
              ),
              "%H:%i"
       ) AS time_15,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15;

CREATE TABLE distribution_hour_agent_month_30 AS
SELECT
       Date_format(calldate, "%Y-%m") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (30 * 60) + (
                            30 * 60
                     )
              ),
              "%H:%i"
       ) AS time_30,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30;

CREATE TABLE distribution_hour_agent_month_60 AS
SELECT
       Date_format(calldate, "%Y-%m") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (60 * 60) + (
                            60 * 60
                     )
              ),
              "%H:%i"
       ) AS time_60,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60;

DROP TABLE IF EXISTS distribution_hour_agent_week_10;

DROP TABLE IF EXISTS distribution_hour_agent_week_15;

DROP TABLE IF EXISTS distribution_hour_agent_week_30;

DROP TABLE IF EXISTS distribution_hour_agent_week_60;

CREATE TABLE distribution_hour_agent_week_10 AS
SELECT
       Date_format(calldate, "%x-W%v") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (10 * 60) + (
                            10 * 60
                     )
              ),
              "%H:%i"
       ) AS time_10,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10;

CREATE TABLE distribution_hour_agent_week_15 AS
SELECT
       Date_format(calldate, "%x-W%v") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (15 * 60) + (
                            15 * 60
                     )
              ),
              "%H:%i"
       ) AS time_15,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15;

CREATE TABLE distribution_hour_agent_week_30 AS
SELECT
       Date_format(calldate, "%x-W%v") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (30 * 60) + (
                            30 * 60
                     )
              ),
              "%H:%i"
       ) AS time_30,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30;

CREATE TABLE distribution_hour_agent_week_60 AS
SELECT
       Date_format(calldate, "%x-W%v") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (60 * 60) + (
                            60 * 60
                     )
              ),
              "%H:%i"
       ) AS time_60,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60;

DROP TABLE IF EXISTS distribution_hour_agent_day_10;

DROP TABLE IF EXISTS distribution_hour_agent_day_15;

DROP TABLE IF EXISTS distribution_hour_agent_day_30;

DROP TABLE IF EXISTS distribution_hour_agent_day_60;

CREATE TABLE distribution_hour_agent_day_10 AS
SELECT
       Date_format(calldate, "%Y-%m-%d") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (10 * 60) + (
                            10 * 60
                     )
              ),
              "%H:%i"
       ) AS time_10,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_10;

CREATE TABLE distribution_hour_agent_day_15 AS
SELECT
       Date_format(calldate, "%Y-%m-%d") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (15 * 60) + (
                            15 * 60
                     )
              ),
              "%H:%i"
       ) AS time_15,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_15;

CREATE TABLE distribution_hour_agent_day_30 AS
SELECT
       Date_format(calldate, "%Y-%m-%d") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (30 * 60) + (
                            30 * 60
                     )
              ),
              "%H:%i"
       ) AS time_30,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_30;

CREATE TABLE distribution_hour_agent_day_60 AS
SELECT
       Date_format(calldate, "%Y-%m-%d") AS period,
       IF(cnum IS NULL OR cnum = "", src, cnum) AS agentNum,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Date_format(
              Sec_to_time(
                     Time_to_sec(calldate) - Time_to_sec(calldate) % (60 * 60) + (
                            60 * 60
                     )
              ),
              "%H:%i"
       ) AS time_60,
       Count(*) AS total
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60
ORDER BY
       period,
       IF(cnum IS NULL OR cnum = "", src, cnum),
       time_60;