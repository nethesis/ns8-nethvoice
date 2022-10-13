/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `nethcti3`;
CREATE TABLE `postit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `text` varchar(255) DEFAULT NULL,
  `creator` varchar(50) DEFAULT NULL,
  `readdate` datetime DEFAULT NULL,
  `recipient` varchar(50) DEFAULT NULL,
  `creation` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `index_creator` (`creator`),
  KEY `index_recipient` (`recipient`),
  KEY `index_readdate` (`readdate`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
