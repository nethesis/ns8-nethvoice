/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `customcontexts_includes` (
  `context` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `include` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `timegroupid` int(11) DEFAULT NULL,
  `sort` int(11) NOT NULL DEFAULT 0,
  `userules` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`context`,`include`),
  KEY `sort` (`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
