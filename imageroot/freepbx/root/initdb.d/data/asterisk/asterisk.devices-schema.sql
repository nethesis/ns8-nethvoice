/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `devices` (
  `id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `tech` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dial` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `devicetype` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `user` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_cid` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hint_override` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  KEY `id` (`id`),
  KEY `tech` (`tech`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
