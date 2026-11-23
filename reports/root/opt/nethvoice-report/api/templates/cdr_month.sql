CREATE TABLE IF NOT EXISTS `cdr_{{ YearMap .Year }}-{{ MonthMap .Month }}`
(UNIQUE KEY uniq (calldate,uniqueid,dstchannel,duration))
SELECT *
FROM `cdr_{{ YearMap .Year }}`
WHERE calldate >= '{{ YearMap .Year }}-{{ MonthMap .Month }}-01'
      AND calldate < '{{ YearMap .Year }}-{{ MonthMap .Month }}-01' + INTERVAL 1 MONTH;

INSERT IGNORE INTO `cdr_{{ YearMap .Year }}-{{ MonthMap .Month }}`
SELECT *
FROM `cdr_{{ YearMap .Year }}`
WHERE calldate >= DATE(NOW() - INTERVAL 1 DAY)
      AND calldate < DATE(NOW())
      AND calldate >= '{{ YearMap .Year }}-{{ MonthMap .Month }}-01'
      AND calldate < '{{ YearMap .Year }}-{{ MonthMap .Month }}-01' + INTERVAL 1 MONTH;
