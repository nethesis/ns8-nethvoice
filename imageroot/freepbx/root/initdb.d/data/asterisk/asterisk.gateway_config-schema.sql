/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `gateway_config` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `model_id` int(10) unsigned NOT NULL DEFAULT '0',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipv4` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipv4_new` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipv4_green` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `netmask_green` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mac` char(18) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mac_key` (`mac`),
  KEY `model_id` (`model_id`),
  CONSTRAINT `gateway_config_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `gateway_models` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
