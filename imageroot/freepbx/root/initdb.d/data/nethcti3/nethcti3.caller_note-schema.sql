/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `caller_note` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `creation` datetime NOT NULL,
  `text` varchar(255) DEFAULT NULL,
  `creator` varchar(50) DEFAULT NULL,
  `number` varchar(50) DEFAULT NULL,
  `public` tinyint(1) DEFAULT '0',
  `expiration` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `reservation` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `index_creator` (`creator`),
  KEY `index_number` (`number`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
