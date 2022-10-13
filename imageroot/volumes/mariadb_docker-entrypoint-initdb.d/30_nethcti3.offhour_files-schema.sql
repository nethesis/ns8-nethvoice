/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `nethcti3`;
CREATE TABLE `offhour_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `description` varchar(50) NOT NULL,
  `privacy` varchar(50) NOT NULL,
  `creation` datetime NOT NULL,
  `path` varchar(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `path` (`path`),
  UNIQUE KEY `username_description` (`description`,`username`),
  KEY `index_username` (`username`),
  KEY `index_privacy` (`privacy`),
  KEY `index_description` (`description`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
