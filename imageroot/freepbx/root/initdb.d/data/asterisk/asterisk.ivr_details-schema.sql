/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `ivr_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `announcement` int(11) DEFAULT NULL,
  `directdial` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invalid_loops` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invalid_retry_recording` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invalid_destination` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeout_enabled` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invalid_recording` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `retvm` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeout_time` int(11) DEFAULT NULL,
  `timeout_recording` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeout_retry_recording` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeout_destination` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeout_loops` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeout_append_announce` tinyint(1) NOT NULL DEFAULT 1,
  `invalid_append_announce` tinyint(1) NOT NULL DEFAULT 1,
  `timeout_ivr_ret` tinyint(1) NOT NULL DEFAULT 0,
  `invalid_ivr_ret` tinyint(1) NOT NULL DEFAULT 0,
  `alertinfo` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rvolume` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `strict_dial_timeout` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
