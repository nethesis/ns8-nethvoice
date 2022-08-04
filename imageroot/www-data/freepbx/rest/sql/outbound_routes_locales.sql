USE asterisk;
DROP TABLE IF EXISTS `outbound_routes_locales`;
CREATE TABLE IF NOT EXISTS `outbound_routes_locales` (
  `id` INT UNSIGNED AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `locale` varchar(10) NOT NULL default '',
  `key` varchar(50) default NULL,
  `prefix_value` varchar(50) default NULL,
  `pattern_value` varchar(50) default NULL,
  KEY `locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `outbound_routes_locales` WRITE;
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','national','','0ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','national','+39','0ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','national','0039','0ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','national','','1XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','national','','15XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','national','','800XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','national','','803XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','cellphone','','3XXXXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','cellphone','+39','3XXXXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','cellphone','0039','3XXXXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','international','','00XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','toll','','12XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','toll','','144XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','toll','','166XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','toll','','178XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','toll','','199XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','toll','','702XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('it','toll','','8ZXXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','national','','0[1-59]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','national','+33','0[1-59]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','national','0033','0[1-59]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','national','','0800XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','national','','0801XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','national','','1X');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','national','','1XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','cellphone','','0[67]XXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','cellphone','+33','0[67]XXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','cellphone','0033','0[67]XXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','international','','00XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('fr','toll','','08XXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','national','','9ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','national','+34','9ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','national','0034','9ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','national','','1XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','national','','0XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','national','','800XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','national','','900XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','cellphone','','06XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','cellphone','+34','06XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','cellphone','0034','06XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','international','','00XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','toll','','80ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('es','toll','','90ZXXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','','0[2-7]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','+49','0[2-7]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','0049','0[2-7]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','','0[89]XZXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','+49','0[89]XZXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','0049','0[89]XZXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','','1XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','national','','0800XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','cellphone','','01[5-7]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','cellphone','+49','01[5-7]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','cellphone','0049','01[5-7]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','international','','00XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','toll','','0900XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('de','toll','','01[2389]XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','national','','0[1235]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','national','+44','0[1235]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','national','0044','0[1235]XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','national','','0800XX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','national','','9XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','national','','1XX');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','cellphone','','07XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','cellphone','+44','07XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','cellphone','0044','07XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','international','','00XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','toll','','084XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','toll','','087XXX.');
INSERT IGNORE INTO `outbound_routes_locales` (`locale`,`key`,`prefix_value`,`pattern_value`) VALUES ('en','toll','','09XXX.');
UNLOCK TABLES;
