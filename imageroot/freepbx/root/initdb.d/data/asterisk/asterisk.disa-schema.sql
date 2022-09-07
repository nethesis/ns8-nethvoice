/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `disa` (
  `disa_id` int(11) NOT NULL AUTO_INCREMENT,
  `displayname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pin` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cid` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `context` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `digittimeout` int(11) DEFAULT NULL,
  `resptimeout` int(11) DEFAULT NULL,
  `needconf` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hangup` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keepcid` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`disa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
