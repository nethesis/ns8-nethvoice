/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `userman_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `auth` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT 'freepbx',
  `authid` varchar(750) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_extension` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `primary_group` int(11) DEFAULT NULL,
  `permissions` longblob,
  `fname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `displayname` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `language` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timezone` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateformat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeformat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `datetimeformat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` longtext COLLATE utf8mb4_unicode_ci,
  `cell` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `work` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fax` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_UNIQUE` (`username`,`auth`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
