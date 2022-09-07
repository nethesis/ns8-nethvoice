/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `certman_cas` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `basename` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cn` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `on` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passphrase` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salt` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `basename` (`basename`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
