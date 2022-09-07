/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `gateway_models` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `manufacturer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tech` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `n_pri_trunks` int(10) unsigned DEFAULT 0,
  `n_isdn_trunks` int(10) unsigned DEFAULT 0,
  `n_fxo_trunks` int(10) unsigned DEFAULT 0,
  `n_fxs_ext` int(10) unsigned DEFAULT 0,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `model_manufacturer` (`model`,`manufacturer`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
