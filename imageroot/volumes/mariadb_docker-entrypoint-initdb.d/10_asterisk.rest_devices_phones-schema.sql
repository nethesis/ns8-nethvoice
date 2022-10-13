/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `rest_devices_phones` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `mac` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendor` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `line` int(11) DEFAULT '1',
  `extension` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `secret` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `web_user` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `web_password` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'physical',
  PRIMARY KEY (`id`),
  UNIQUE KEY `mac` (`mac`,`line`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
