/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `endpointman_oui_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `oui` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` int(11) NOT NULL,
  `custom` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `oui` (`oui`)
) ENGINE=MyISAM AUTO_INCREMENT=521 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
