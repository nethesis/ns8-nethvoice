/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `users` (
  `extension` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `password` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `voicemail` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ringtimer` int(11) DEFAULT NULL,
  `noanswer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recording` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outboundcid` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sipname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `noanswer_cid` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `busy_cid` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `chanunavail_cid` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `noanswer_dest` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `busy_dest` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `chanunavail_dest` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `mohclass` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  KEY `extension` (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
