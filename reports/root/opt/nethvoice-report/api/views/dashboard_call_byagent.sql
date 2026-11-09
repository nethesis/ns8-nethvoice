DROP TABLE IF EXISTS dashboard_call_byagent_year;

DROP TABLE IF EXISTS dashboard_call_byagent_month;

DROP TABLE IF EXISTS dashboard_call_byagent_week;

DROP TABLE IF EXISTS dashboard_call_byagent_day;

CREATE TABLE dashboard_call_byagent_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    IF(
        locate('@', agent) > 0,
        substring_index(substring_index(agent, '/', -2), '@', 1),
        substring_index(substring_index(agent, '/', -1), '-', 1)
    ) AS agent,
    count(id) AS total
FROM
    report_queue
WHERE
    TRUE
    AND NOT agent = 'NONE'
    AND action = 'ANSWER'
GROUP BY
    period,
    agent
ORDER BY
    period,
    total DESC,
    agent;

CREATE TABLE dashboard_call_byagent_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    IF(
        locate('@', agent) > 0,
        substring_index(substring_index(agent, '/', -2), '@', 1),
        substring_index(substring_index(agent, '/', -1), '-', 1)
    ) AS agent,
    count(id) AS total
FROM
    report_queue
WHERE
    TRUE
    AND NOT agent = 'NONE'
    AND action = 'ANSWER'
GROUP BY
    period,
    agent
ORDER BY
    period,
    total DESC,
    agent;

CREATE TABLE dashboard_call_byagent_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    IF(
        locate('@', agent) > 0,
        substring_index(substring_index(agent, '/', -2), '@', 1),
        substring_index(substring_index(agent, '/', -1), '-', 1)
    ) AS agent,
    count(id) AS total
FROM
    report_queue
WHERE
    TRUE
    AND NOT agent = 'NONE'
    AND action = 'ANSWER'
GROUP BY
    period,
    agent
ORDER BY
    period,
    total DESC,
    agent;

CREATE TABLE dashboard_call_byagent_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    IF(
        locate('@', agent) > 0,
        substring_index(substring_index(agent, '/', -2), '@', 1),
        substring_index(substring_index(agent, '/', -1), '-', 1)
    ) AS agent,
    count(id) AS total
FROM
    report_queue
WHERE
    TRUE
    AND NOT agent = 'NONE'
    AND action = 'ANSWER'
GROUP BY
    period,
    agent
ORDER BY
    period,
    total DESC,
    agent;
