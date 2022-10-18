/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `endpointman_product_list` (
  `id` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brand` int(11) NOT NULL,
  `long_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `short_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cfg_dir` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cfg_ver` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hidden` int(1) NOT NULL DEFAULT '0',
  `firmware_vers` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firmware_files` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_files` text COLLATE utf8mb4_unicode_ci,
  `special_cfgs` blob NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
