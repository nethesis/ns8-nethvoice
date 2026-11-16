SELECT
    DISTINCT CONCAT(data3, ",", COALESCE(NULLIF(i.name, ''), NULLIF(data4, ''), data3))
FROM
    queue_log_history
    LEFT JOIN asterisk.ivr_details i ON CONCAT('ivr-', i.id) = data3
WHERE
    data1 LIKE 'IVRAPPEND%'
    AND event = "INFO"
    AND data3 != ''
ORDER BY
    CONCAT(data3, ",", COALESCE(NULLIF(i.name, ''), NULLIF(data4, ''), data3));