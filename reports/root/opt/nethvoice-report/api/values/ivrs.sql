SELECT
    DISTINCT CONCAT(data3, ",", data4)
FROM
    queue_log_history
WHERE
    data1 LIKE 'IVRAPPEND%'
    AND event = "INFO"
ORDER BY
    CONCAT(data3, ",", data4);