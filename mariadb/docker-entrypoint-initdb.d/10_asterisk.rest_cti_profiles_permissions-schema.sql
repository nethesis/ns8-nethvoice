/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `rest_cti_profiles_permissions` (
  `profile_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  UNIQUE KEY `line` (`profile_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `rest_cti_profiles_permissions_ibfk_1` FOREIGN KEY (`profile_id`) REFERENCES `rest_cti_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `rest_cti_profiles_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `rest_cti_permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
