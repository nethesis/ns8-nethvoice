DROP TABLE IF EXISTS data_summary_agent_year;

DROP TABLE IF EXISTS data_summary_agent_month;

DROP TABLE IF EXISTS data_summary_agent_week;

DROP TABLE IF EXISTS data_summary_agent_day;

CREATE TABLE data_summary_agent_year AS
SELECT
       Date_format(calldate, "%Y") AS period,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Count(*) AS total,
       Count(DISTINCT dst) AS uniqCallees,
       Min(billsec) AS minBill,
       Avg(billsec) AS avgBill,
       Max(billsec) AS maxBill,
       Sum(billsec) AS totalBill,
       IF(get_trunk_name(channel) IN
             (SELECT channelid
                                                                         FROM
             asterisk.trunks), "IN", IF(get_trunk_name(dstchannel) IN (
                                        SELECT
                                                                      channelid
                                        FROM
       asterisk.trunks), "EXTERNAL", "LOCAL"))  AS type
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       agentName,
       type;

CREATE TABLE data_summary_agent_month AS
SELECT
       Date_format(calldate, "%Y-%m") AS period,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Count(*) AS total,
       Count(DISTINCT dst) AS uniqCallees,
       Min(billsec) AS minBill,
       Avg(billsec) AS avgBill,
       Max(billsec) AS maxBill,
       Sum(billsec) AS totalBill,
       IF(get_trunk_name(channel) IN
             (SELECT channelid
                                                                         FROM
             asterisk.trunks), "IN", IF(get_trunk_name(dstchannel) IN (
                                        SELECT
                                                                      channelid
                                        FROM
       asterisk.trunks), "EXTERNAL", "LOCAL"))  AS type
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       agentName,
       type;

CREATE TABLE data_summary_agent_week AS
SELECT
       Date_format(calldate, "%x-W%v") AS period,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Count(*) AS total,
       Count(DISTINCT dst) AS uniqCallees,
       Min(billsec) AS minBill,
       Avg(billsec) AS avgBill,
       Max(billsec) AS maxBill,
       Sum(billsec) AS totalBill,
       IF(get_trunk_name(channel) IN
             (SELECT channelid
                                                                         FROM
             asterisk.trunks), "IN", IF(get_trunk_name(dstchannel) IN (
                                        SELECT
                                                                      channelid
                                        FROM
       asterisk.trunks), "EXTERNAL", "LOCAL"))  AS type
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       agentName,
       type;

CREATE TABLE data_summary_agent_day AS
SELECT
       Date_format(calldate, "%Y-%m-%d") AS period,
       (
              SELECT
                     name
              FROM
                     agent_extensions
              WHERE
                     extension = IF(asteriskcdrdb.cdr.cnum IS NULL OR asteriskcdrdb.cdr.cnum = "", asteriskcdrdb.cdr.src, asteriskcdrdb.cdr.cnum)
       ) AS agentName,
       Count(*) AS total,
       Count(DISTINCT dst) AS uniqCallees,
       Min(billsec) AS minBill,
       Avg(billsec) AS avgBill,
       Max(billsec) AS maxBill,
       Sum(billsec) AS totalBill,
       IF(get_trunk_name(channel) IN
             (SELECT channelid
                                                                         FROM
             asterisk.trunks), "IN", IF(get_trunk_name(dstchannel) IN (
                                        SELECT
                                                                      channelid
                                        FROM
       asterisk.trunks), "EXTERNAL", "LOCAL"))  AS type
FROM
       asteriskcdrdb.cdr
WHERE
       billsec != 0
       AND IF(cnum IS NULL OR cnum = "", src, cnum) IN (
              SELECT
                     extension
              FROM
                     agent_extensions
       )
GROUP BY
       period,
       agentName,
       type;
