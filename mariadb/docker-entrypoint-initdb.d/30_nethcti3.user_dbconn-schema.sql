/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `nethcti3`;
CREATE TABLE `user_dbconn` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `host` varchar(128) NOT NULL,
  `port` varchar(64) NOT NULL,
  `type` varchar(32) NOT NULL,
  `user` varchar(64) NOT NULL,
  `pass` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `creation` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `same_resource` (`host`,`port`,`user`,`name`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
