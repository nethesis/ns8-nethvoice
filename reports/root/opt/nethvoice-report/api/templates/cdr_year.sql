-- Pre-compute trunk list to avoid correlated subqueries (executed once, not per-row)
DROP TEMPORARY TABLE IF EXISTS _trunk_list;
CREATE TEMPORARY TABLE _trunk_list AS SELECT DISTINCT channelid FROM asterisk.trunks;
ALTER TABLE _trunk_list ADD PRIMARY KEY (channelid);

CREATE TABLE IF NOT EXISTS `cdr_{{ YearMap .Year }}`
(
	`call_type` TEXT DEFAULT '',
	`cost` DOUBLE DEFAULT NULL, UNIQUE KEY uniq (calldate,uniqueid,dstchannel,duration),
	`dispositions` LONGTEXT DEFAULT '',
	`src_region` VARCHAR(100) DEFAULT NULL,
	`src_province` VARCHAR(100) DEFAULT NULL,
	`dst_region` VARCHAR(100) DEFAULT NULL,
	`dst_province` VARCHAR(100) DEFAULT NULL
)
SELECT `calldate`,
       `clid`,
       `src`,
       `dst`,
       `dcontext`,
       `channel`,
       `dstchannel`,
       `lastapp`,
       `lastdata`,
       MAX(`duration`) as duration,
       IF (MIN(`disposition`) = 'ANSWERED', MAX(billsec), MIN(billsec)) as billsec,
       `disposition`,
       `amaflags`,
       `accountcode`,
       `uniqueid`,
       `userfield`,
       `did`,
       `recordingfile`,
       `cnum`,
       `cnam`,
       `outbound_cnum`,
       `outbound_cnam`,
       `dst_cnam`,
       `linkedid`,
       `peeraccount`,
       `sequence`,
       `ccompany`,
       `dst_ccompany`,
       IF(t_in.channelid IS NOT NULL, "IN",
          IF(t_out.channelid IS NOT NULL, "OUT", "LOCAL")) AS type,
       Group_concat(disposition, "")       AS dispositions,
       Group_concat(lastapp, "")           AS lastapps,
       Group_concat(dcontext, "")          AS dcontexts,
       {{ ExtractPatterns }}               AS call_type,
       NULL                                AS cost,
       NULL                                AS src_region,
       NULL                                AS src_province,
       NULL                                AS dst_region,
       NULL                                AS dst_province
FROM   cdr c
LEFT JOIN _trunk_list t_in ON t_in.channelid = get_trunk_name(c.channel)
LEFT JOIN _trunk_list t_out ON t_out.channelid = get_trunk_name(c.dstchannel)
WHERE  uniqueid = linkedid
       AND calldate >= '{{ YearMap .Year }}-01-01'
       AND calldate < '{{ YearMap .Year }}-01-01' + INTERVAL 1 YEAR
GROUP  BY linkedid,
          peeraccount
ORDER  BY calldate;

INSERT IGNORE INTO `cdr_{{ YearMap .Year }}`
SELECT `calldate`,
       `clid`,
       `src`,
       `dst`,
       `dcontext`,
       `channel`,
       `dstchannel`,
       `lastapp`,
       `lastdata`,
       MAX(`duration`) as duration,
       IF (MIN(`disposition`) = 'ANSWERED', MAX(billsec), MIN(billsec)) as billsec,
       `disposition`,
       `amaflags`,
       `accountcode`,
       `uniqueid`,
       `userfield`,
       `did`,
       `recordingfile`,
       `cnum`,
       `cnam`,
       `outbound_cnum`,
       `outbound_cnam`,
       `dst_cnam`,
       `linkedid`,
       `peeraccount`,
       `sequence`,
       `ccompany`,
       `dst_ccompany`,
       IF(t_in.channelid IS NOT NULL, "IN",
          IF(t_out.channelid IS NOT NULL, "OUT", "LOCAL")) AS type,
       Group_concat(disposition, "")       AS dispositions,
       Group_concat(lastapp, "")           AS lastapps,
       Group_concat(dcontext, "")          AS dcontexts,
       {{ ExtractPatterns }}               AS call_type,
       NULL                                AS cost,
       NULL                                AS src_region,
       NULL                                AS src_province,
       NULL                                AS dst_region,
       NULL                                AS dst_province
FROM   cdr c
LEFT JOIN _trunk_list t_in ON t_in.channelid = get_trunk_name(c.channel)
LEFT JOIN _trunk_list t_out ON t_out.channelid = get_trunk_name(c.dstchannel)
WHERE  uniqueid = linkedid
       AND calldate >= DATE(NOW() - INTERVAL 1 DAY)
       AND calldate < DATE(NOW())
       AND calldate >= '{{ YearMap .Year }}-01-01'
       AND calldate < '{{ YearMap .Year }}-01-01' + INTERVAL 1 YEAR
GROUP  BY linkedid,
          peeraccount
ORDER  BY calldate;

DROP TEMPORARY TABLE IF EXISTS _trunk_list;

UPDATE `cdr_{{ YearMap .Year }}` SET call_type = "" WHERE type = "IN";
UPDATE `cdr_{{ YearMap .Year }}` SET call_type = "" WHERE type = "LOCAL";
