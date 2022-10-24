/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `gateway_config_isdn` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `config_id` int(10) unsigned NOT NULL DEFAULT '0',
  `trunk` int(11) NOT NULL,
  `trunknumber` int(11) NOT NULL,
  `protocol` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `secret` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `config_id` (`config_id`),
  CONSTRAINT `gateway_config_isdn_ibfk_1` FOREIGN KEY (`config_id`) REFERENCES `gateway_config` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
