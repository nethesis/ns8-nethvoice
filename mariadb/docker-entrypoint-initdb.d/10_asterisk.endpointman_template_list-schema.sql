/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `endpointman_template_list` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `global_custom_cfg_data` longblob,
  `config_files_override` text COLLATE utf8mb4_unicode_ci,
  `global_settings_override` longblob,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
