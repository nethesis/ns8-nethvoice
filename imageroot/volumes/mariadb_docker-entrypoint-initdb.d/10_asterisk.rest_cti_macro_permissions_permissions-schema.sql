/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `rest_cti_macro_permissions_permissions` (
  `macro_permission_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  UNIQUE KEY `line` (`macro_permission_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `rest_cti_macro_permissions_permissions_ibfk_1` FOREIGN KEY (`macro_permission_id`) REFERENCES `rest_cti_macro_permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `rest_cti_macro_permissions_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `rest_cti_permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
