DROP TABLE IF EXISTS data_lost;

CREATE TABLE data_lost AS
SELECT
    DATE_FORMAT(
        FROM_UNIXTIME(time),
        '%Y-%m-%d %H:%i:%s'
    ) AS period,
    qname,
    asterisk.queues_config.descr AS qdescr,
    cid,
    `name`,
    company,
    direction,
    `event` AS reason
FROM
    queue_failed
    JOIN asterisk.queues_config ON asteriskcdrdb.queue_failed.qname = asterisk.queues_config.extension
ORDER BY
    period ASC;
