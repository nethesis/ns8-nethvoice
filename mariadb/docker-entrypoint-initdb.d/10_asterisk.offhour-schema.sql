/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `offhour` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `displayname` varchar(50) DEFAULT NULL,
  `didcidnum` varchar(20) DEFAULT NULL,
  `didextension` varchar(20) DEFAULT NULL,
  `tsbegin` int(10) unsigned DEFAULT '0',
  `tsend` int(10) unsigned DEFAULT '0',
  `message` varchar(500) DEFAULT NULL,
  `action` int(1) DEFAULT NULL,
  `param` varchar(50) DEFAULT NULL,
  `destination` varchar(500) DEFAULT '',
  `enabled` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
