/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `nethcqr_details` (
  `id_cqr` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `announcement` int(11) DEFAULT NULL,
  `use_code` tinyint(1) DEFAULT 0,
  `manual_code` tinyint(1) DEFAULT 0,
  `use_workphone` tinyint(1) DEFAULT 1,
  `cod_cli_announcement` int(11) DEFAULT NULL,
  `err_announcement` int(11) DEFAULT NULL,
  `code_length` int(2) DEFAULT 5,
  `code_retries` int(1) DEFAULT 3,
  `db_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'mysql',
  `db_url` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT 'localhost',
  `db_name` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `db_user` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `db_pass` varchar(90) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `query` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cc_db_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'mysql',
  `cc_db_url` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT 'localhost',
  `cc_db_name` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cc_db_user` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cc_db_pass` varchar(90) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cc_query` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ccc_query` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_destination` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_cqr`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
