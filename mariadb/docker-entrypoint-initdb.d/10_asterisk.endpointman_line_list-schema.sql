/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `endpointman_line_list` (
  `luid` int(11) NOT NULL AUTO_INCREMENT,
  `mac_id` int(11) NOT NULL,
  `line` smallint(2) NOT NULL,
  `ext` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `custom_cfg_data` longblob NOT NULL,
  `user_cfg_data` longblob NOT NULL,
  PRIMARY KEY (`luid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
