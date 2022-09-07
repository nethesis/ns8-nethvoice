/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `report_queue_callers` (
  `id` int(11) unsigned NOT NULL,
  `timestamp_out` bigint(20) DEFAULT NULL,
  `timestamp_in` varchar(32) NOT NULL,
  `qname` varchar(32) NOT NULL,
  `cid` varchar(100) DEFAULT NULL,
  `action` varchar(32) NOT NULL,
  `position` bigint(21) unsigned NOT NULL DEFAULT 0,
  `qdescr` varchar(35) NOT NULL,
  `prefisso` varchar(6) DEFAULT '0',
  `comune` varchar(30) DEFAULT '0',
  `siglaprov` varchar(4) DEFAULT '0',
  `provincia` varchar(30) DEFAULT '0',
  `regione` varchar(30) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
