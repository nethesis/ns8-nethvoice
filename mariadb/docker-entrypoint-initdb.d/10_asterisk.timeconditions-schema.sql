/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `timeconditions` (
  `timeconditions_id` int(11) NOT NULL AUTO_INCREMENT,
  `displayname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time` int(11) DEFAULT NULL,
  `truegoto` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `falsegoto` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deptname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `generate_hint` tinyint(1) DEFAULT '0',
  `invert_hint` tinyint(1) DEFAULT '0',
  `fcc_password` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `priority` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timezone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'time-group',
  `calendar_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `calendar_group_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`timeconditions_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
