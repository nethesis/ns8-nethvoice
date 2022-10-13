/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `outbound_routes_locales` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `locale` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `key` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prefix_value` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pattern_value` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `locale` (`locale`)
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
