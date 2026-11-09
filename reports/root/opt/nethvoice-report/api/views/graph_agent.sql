DROP TABLE IF EXISTS graph_agent_answer_year;

DROP TABLE IF EXISTS graph_agent_answer_month;

DROP TABLE IF EXISTS graph_agent_answer_week;

DROP TABLE IF EXISTS graph_agent_answer_day;

CREATE TABLE graph_agent_answer_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'ANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;

CREATE TABLE graph_agent_answer_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'ANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;

CREATE TABLE graph_agent_answer_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'ANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;

CREATE TABLE graph_agent_answer_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'ANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;

DROP TABLE IF EXISTS graph_agent_noanswer_year;

DROP TABLE IF EXISTS graph_agent_noanswer_month;

DROP TABLE IF EXISTS graph_agent_noanswer_week;

DROP TABLE IF EXISTS graph_agent_noanswer_day;

CREATE TABLE graph_agent_noanswer_year AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'RINGNOANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;

CREATE TABLE graph_agent_noanswer_month AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'RINGNOANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;

CREATE TABLE graph_agent_noanswer_week AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'RINGNOANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;

CREATE TABLE graph_agent_noanswer_day AS
SELECT
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
    qname,
    qdescr,
    agent,
    count(id) AS total
FROM
    report_queue_agents
WHERE
    TRUE
    AND ACTION = 'RINGNOANSWER'
GROUP BY
    qdescr,
    period,
    agent
ORDER BY
    period,
    qdescr,
    agent;