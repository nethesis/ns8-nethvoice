/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `ivr_entries` (
  `ivr_id` int(11) NOT NULL,
  `selection` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dest` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ivr_ret` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
