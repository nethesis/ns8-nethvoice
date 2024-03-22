/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `nethcti3`;
CREATE TABLE IF NOT EXISTS `user_nethlink` (
  `id` int(11) NOT NULL auto_increment,
  `user` varchar(255) NOT NULL,
  `extension` varchar(255) NOT NULL,
  `timestamp` varchar(255) default NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;