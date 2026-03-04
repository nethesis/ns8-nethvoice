/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asteriskcdrdb`;
CREATE TABLE `report_queue` (
  `id` int(11) unsigned NOT NULL,
  `timestamp_out` bigint(20) DEFAULT NULL,
  `timestamp_in` varchar(32) NOT NULL,
  `qname` varchar(32) NOT NULL,
  `action` varchar(32) NOT NULL,
  `position` bigint(21) unsigned NOT NULL DEFAULT '0',
  `duration` bigint(21) unsigned NOT NULL DEFAULT '0',
  `hold` bigint(21) unsigned NOT NULL DEFAULT '0',
  `agent` varchar(32) NOT NULL,
  `cid` varchar(100) DEFAULT NULL,
  `qdescr` varchar(35) NOT NULL,
  `data4` bigint(21) unsigned NOT NULL DEFAULT '0',
  `agents` varchar(100) NOT NULL DEFAULT '',
  UNIQUE KEY `uid` (`id`,`timestamp_in`,`action`,`agent`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
