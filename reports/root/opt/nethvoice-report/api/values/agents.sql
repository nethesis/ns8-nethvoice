SELECT
    DISTINCT agent
FROM
    queue_log_history
WHERE
    agent NOT LIKE 'Local/%@from-queue/n'
    AND agent NOT LIKE ''
    AND agent != "NONE";
