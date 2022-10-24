/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `endpointman_mac_list` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `mac` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_id` int(11) NOT NULL,
  `global_custom_cfg_data` longblob NOT NULL,
  `global_user_cfg_data` longblob NOT NULL,
  `config_files_override` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `global_settings_override` longblob,
  `specific_settings` longblob,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mac` (`mac`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
