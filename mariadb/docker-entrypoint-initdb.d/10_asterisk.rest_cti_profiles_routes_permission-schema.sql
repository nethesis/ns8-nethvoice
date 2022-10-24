/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `rest_cti_profiles_routes_permission` (
  `profile_id` int(10) unsigned NOT NULL,
  `route_id` int(11) NOT NULL,
  `permission` tinyint(1) DEFAULT NULL,
  UNIQUE KEY `line` (`profile_id`,`route_id`),
  KEY `route_id` (`route_id`),
  CONSTRAINT `rest_cti_profiles_routes_permission_ibfk_1` FOREIGN KEY (`profile_id`) REFERENCES `rest_cti_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `rest_cti_profiles_routes_permission_ibfk_2` FOREIGN KEY (`route_id`) REFERENCES `outbound_routes` (`route_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
