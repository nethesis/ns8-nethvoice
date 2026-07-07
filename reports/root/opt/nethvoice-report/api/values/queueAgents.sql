SELECT
    DISTINCT CONCAT(queuename, ",", agent)
FROM
    queue_log_history
WHERE
    queuename != "NONE"
    AND queuename != "all"
    AND agent NOT LIKE 'Local/%@from-queue/n'
    AND agent NOT LIKE ''
    AND agent != "NONE"
ORDER BY
    queuename, agent;
