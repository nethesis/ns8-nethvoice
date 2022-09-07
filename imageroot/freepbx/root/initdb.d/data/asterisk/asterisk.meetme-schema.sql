/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `meetme` (
  `exten` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userpin` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adminpin` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `joinmsg_id` int(11) DEFAULT NULL,
  `music` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `users` smallint(5) unsigned DEFAULT 0,
  `language` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `timeout` int(10) unsigned DEFAULT 21600,
  PRIMARY KEY (`exten`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
