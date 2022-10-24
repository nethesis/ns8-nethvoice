/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asteriskcdrdb`;
CREATE TABLE `ivr_choice` (
  `uniqueid` varchar(32) NOT NULL DEFAULT '0',
  `timestamp_in` varchar(32) NOT NULL DEFAULT '0',
  `cid_name` varchar(80) NOT NULL DEFAULT '0',
  `cid_num` varchar(80) NOT NULL DEFAULT '0',
  `ivr_id` varchar(30) NOT NULL,
  `ivr_name` varchar(60) NOT NULL,
  `choice` varchar(10) NOT NULL,
  KEY `UNIQUEID_INDEX` (`uniqueid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
