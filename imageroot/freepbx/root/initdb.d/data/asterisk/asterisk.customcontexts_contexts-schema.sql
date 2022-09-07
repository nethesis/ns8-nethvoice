/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `customcontexts_contexts` (
  `context` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dialrules` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `faildestination` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `featurefaildestination` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failpin` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failpincdr` tinyint(1) NOT NULL DEFAULT 0,
  `featurefailpin` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `featurefailpincdr` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`context`),
  UNIQUE KEY `description` (`description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
