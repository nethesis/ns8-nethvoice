/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `queue_log_processed` (
  `recid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `origid` int(10) unsigned NOT NULL,
  `callid` varchar(32) NOT NULL DEFAULT '',
  `queuename` varchar(32) NOT NULL DEFAULT '',
  `agentdev` varchar(32) NOT NULL,
  `event` varchar(32) NOT NULL DEFAULT '',
  `data1` varchar(128) NOT NULL,
  `data2` varchar(128) NOT NULL,
  `data3` varchar(128) NOT NULL,
  `datetime` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`recid`),
  KEY `data1` (`data1`),
  KEY `data2` (`data2`),
  KEY `data3` (`data3`),
  KEY `event` (`event`),
  KEY `queuename` (`queuename`),
  KEY `callid` (`callid`),
  KEY `datetime` (`datetime`),
  KEY `agentdev` (`agentdev`),
  KEY `origid` (`origid`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8;
