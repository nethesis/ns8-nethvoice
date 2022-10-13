/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `userman_groups_settings` (
  `gid` int(11) NOT NULL,
  `module` varchar(65) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `val` longblob NOT NULL,
  `type` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  UNIQUE KEY `index4` (`gid`,`module`,`key`),
  KEY `index2` (`gid`,`key`),
  KEY `index6` (`module`,`gid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
