/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `certman_certs` (
  `cid` int(11) NOT NULL AUTO_INCREMENT,
  `caid` int(11) DEFAULT NULL,
  `basename` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ss',
  `default` tinyint(1) NOT NULL DEFAULT '0',
  `additional` longblob,
  PRIMARY KEY (`cid`),
  UNIQUE KEY `basename_UNIQUE` (`basename`),
  UNIQUE KEY `basename` (`basename`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
