/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `certman_mapping` (
  `id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cid` int(11) DEFAULT NULL,
  `verify` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `setup` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rekey` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
