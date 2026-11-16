SELECT
    DISTINCT reason
FROM
    agentsessions
WHERE
    reason NOT LIKE 'Local/%@from-queue/n'
    AND reason NOT LIKE ''
UNION
SELECT
    DISTINCT event
FROM
    queue_failed;