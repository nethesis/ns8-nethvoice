/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `cron_jobs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `modulename` varchar(170) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `jobname` varchar(170) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `command` longtext COLLATE utf8mb4_unicode_ci,
  `class` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `schedule` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `max_runtime` int(11) NOT NULL DEFAULT '30',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `execution_order` int(11) NOT NULL DEFAULT '100',
  PRIMARY KEY (`id`),
  UNIQUE KEY `modulename` (`modulename`,`jobname`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
