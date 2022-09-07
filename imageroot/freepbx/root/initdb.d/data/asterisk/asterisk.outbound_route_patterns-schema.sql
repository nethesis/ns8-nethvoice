/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `outbound_route_patterns` (
  `route_id` int(11) NOT NULL,
  `match_pattern_prefix` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `match_pattern_pass` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `match_cid` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `prepend_digits` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`route_id`,`match_pattern_prefix`,`match_pattern_pass`,`match_cid`,`prepend_digits`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
