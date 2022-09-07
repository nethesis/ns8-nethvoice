/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `fax_incoming` (
  `cidnum` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extension` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detection` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detectionwait` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destination` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `legacy_email` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ring` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
