/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `findmefollow` (
  `grpnum` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `strategy` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grptime` smallint(6) NOT NULL,
  `grppre` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grplist` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `annmsg_id` int(11) DEFAULT NULL,
  `postdest` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dring` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rvolume` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remotealert_id` int(11) DEFAULT NULL,
  `needsconf` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toolate_id` int(11) DEFAULT NULL,
  `pre_ring` smallint(6) NOT NULL DEFAULT '0',
  `ringing` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `calendar_enable` tinyint(1) DEFAULT '0',
  `calendar_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `calendar_group_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `calendar_match` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT 'yes',
  PRIMARY KEY (`grpnum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
