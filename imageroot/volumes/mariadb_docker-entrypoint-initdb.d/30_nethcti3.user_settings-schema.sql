/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `nethcti3`;
CREATE TABLE `user_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `key_name` varchar(50) NOT NULL,
  `value` mediumtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_key_name` (`username`,`key_name`),
  KEY `index_username` (`username`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
