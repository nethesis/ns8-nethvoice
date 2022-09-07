/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `rest_cti_users_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `group_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_group` (`user_id`,`group_id`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `rest_cti_users_groups_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `rest_cti_groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `rest_cti_users_groups_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `userman_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
