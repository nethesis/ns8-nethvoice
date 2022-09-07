/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `logfile_logfiles` (
  `name` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `debug` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dtmf` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fax` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notice` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verbose` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warning` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `security` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
