/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `trunk_dialpatterns` (
  `trunkid` int(11) NOT NULL DEFAULT 0,
  `match_pattern_prefix` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `match_pattern_pass` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `prepend_digits` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `seq` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`trunkid`,`match_pattern_prefix`,`match_pattern_pass`,`prepend_digits`,`seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
