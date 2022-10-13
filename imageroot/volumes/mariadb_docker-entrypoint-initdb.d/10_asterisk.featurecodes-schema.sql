/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `featurecodes` (
  `modulename` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `featurename` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `helptext` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `defaultcode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customcode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `providedest` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`modulename`,`featurename`),
  KEY `enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
