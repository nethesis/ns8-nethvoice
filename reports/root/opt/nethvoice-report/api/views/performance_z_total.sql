DROP TABLE IF EXISTS performance_total_year;

DROP TABLE IF EXISTS performance_total_month;

DROP TABLE IF EXISTS performance_total_week;

DROP TABLE IF EXISTS performance_total_day;

CREATE TABLE performance_total_year AS
SELECT
       p_a_d.period,
       p_a_d.qname,
       Sum(
              (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_processed_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_null_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_failed_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_timeout_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitempty_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitkey_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_full_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_joinempty_year
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              )
       ) AS total
FROM
       performance_wait_duration_year p_a_d
GROUP BY
       p_a_d.period,
       p_a_d.qname;

CREATE TABLE performance_total_month AS
SELECT
       p_a_d.period,
       p_a_d.qname,
       Sum(
              (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_processed_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_null_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_failed_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_timeout_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitempty_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitkey_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_full_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_joinempty_month
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              )
       ) AS total
FROM
       performance_wait_duration_month p_a_d
GROUP BY
       p_a_d.period,
       p_a_d.qname;

CREATE TABLE performance_total_week AS
SELECT
       p_a_d.period,
       p_a_d.qname,
       Sum(
              (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_processed_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_null_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_failed_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_timeout_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitempty_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitkey_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_full_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_joinempty_week
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              )
       ) AS total
FROM
       performance_wait_duration_week p_a_d
GROUP BY
       p_a_d.period,
       p_a_d.qname;

CREATE TABLE performance_total_day AS
SELECT
       p_a_d.period,
       p_a_d.qname,
       Sum(
              (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_processed_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_null_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_failed_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_timeout_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitempty_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_exitkey_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_full_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              ) + (
                     SELECT
                            COALESCE(Sum(count), 0)
                     FROM
                            performance_joinempty_day
                     WHERE
                            period = p_a_d.period
                            AND qname = p_a_d.qname
              )
       ) AS total
FROM
       performance_wait_duration_day p_a_d
GROUP BY
       p_a_d.period,
       p_a_d.qname;