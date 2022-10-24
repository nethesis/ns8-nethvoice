/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `userman_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `auth` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT 'freepbx',
  `authid` varchar(750) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `groupname` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `language` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timezone` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateformat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeformat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `datetimeformat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` int(11) NOT NULL DEFAULT '5',
  `users` longblob,
  `permissions` longblob,
  `local` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `groupname_UNIQUE` (`groupname`,`auth`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
