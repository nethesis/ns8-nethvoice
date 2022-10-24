/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asteriskcdrdb`;
CREATE TABLE `agentsessions` (
  `qname` varchar(32) NOT NULL,
  `agent` varchar(32) NOT NULL,
  `action` varchar(5) NOT NULL,
  `timestamp_in` bigint(20) DEFAULT NULL,
  `reason` varchar(100) NOT NULL,
  `timestamp_out` bigint(20) DEFAULT NULL,
  `qdescr` varchar(35) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
