DROP TABLE IF EXISTS recall_hour;

CREATE TABLE recall_hour AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       Date_format(From_unixtime(timestamp_in), "%H:00") AS HOUR,
       Count(id) AS num,
       Avg(data4) AS avg_recall_time
FROM
       report_queue
WHERE action IN ('ABANDON', 'EXITWITHTIMEOUT', 'EXITWITHKEY', 'EXITEMPTY', 'FULL', 'JOINEMPTY', 'JOINUNAVAIL')
AND data4 > 0
GROUP BY
       qdescr,
       period,
       HOUR
ORDER BY
       period,
       qdescr,
       HOUR;
