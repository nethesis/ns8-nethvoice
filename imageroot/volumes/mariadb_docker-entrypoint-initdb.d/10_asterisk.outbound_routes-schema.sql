/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `outbound_routes` (
  `route_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcid` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcid_mode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_route` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intracompany_route` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mohclass` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_group_id` int(11) DEFAULT NULL,
  `dest` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_mode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `calendar_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `calendar_group_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timezone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`route_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
