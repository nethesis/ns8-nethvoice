/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `manager` (
  `manager_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `secret` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deny` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permit` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `write` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `writetimeout` int(11) DEFAULT NULL,
  PRIMARY KEY (`manager_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
