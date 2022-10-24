/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asteriskcdrdb`;
CREATE TABLE `zone` (
  `prefisso` varchar(6) NOT NULL DEFAULT '0',
  `comune` varchar(30) NOT NULL DEFAULT '0',
  `siglaprov` varchar(4) NOT NULL DEFAULT '0',
  `provincia` varchar(30) NOT NULL DEFAULT '0',
  `regione` varchar(30) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
