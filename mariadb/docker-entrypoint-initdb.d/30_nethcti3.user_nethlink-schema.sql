/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `nethcti3`;
CREATE TABLE `user_nethlink` (
  `user` varchar(255) NOT NULL UNIQUE,
  `extension` varchar(255) NOT NULL,
  `timestamp` varchar(255) DEFAULT NULL,
  `nethlink_version` varchar(64) DEFAULT NULL,
  `os_type` varchar(32) DEFAULT NULL,
  `os_release` varchar(128) DEFAULT NULL,
  `arch` varchar(32) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
