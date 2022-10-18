/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `endpointman_model_list` (
  `id` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Key ',
  `brand` int(11) NOT NULL COMMENT 'Brand',
  `model` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Model',
  `max_lines` smallint(2) NOT NULL,
  `template_list` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_data` longblob NOT NULL,
  `product_id` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` int(1) NOT NULL DEFAULT '0',
  `hidden` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
