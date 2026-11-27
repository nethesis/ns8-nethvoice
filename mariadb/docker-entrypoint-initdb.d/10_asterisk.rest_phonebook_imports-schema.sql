/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE IF NOT EXISTS `rest_phonebook_imports` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` int(10) unsigned NOT NULL,
  `owner` varchar(255) NOT NULL,
  `filename` varchar(255) DEFAULT NULL,
  `type` varchar(1024) NOT NULL,
  `total` int(10) unsigned NOT NULL DEFAULT '0',
  `imported` int(10) unsigned NOT NULL DEFAULT '0',
  `skipped` int(10) unsigned NOT NULL DEFAULT '0',
  `failed` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `created_at_key` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
