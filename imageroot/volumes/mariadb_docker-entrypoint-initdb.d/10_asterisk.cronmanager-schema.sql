/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `cronmanager` (
  `module` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `id` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `time` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `freq` int(11) NOT NULL DEFAULT '0',
  `lasttime` int(11) NOT NULL DEFAULT '0',
  `command` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`module`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
