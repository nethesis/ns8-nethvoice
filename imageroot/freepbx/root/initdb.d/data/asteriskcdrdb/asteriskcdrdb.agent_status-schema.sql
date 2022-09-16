/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `agent_status` (
  `agentId` varchar(40) NOT NULL DEFAULT '',
  `agentName` varchar(40) DEFAULT NULL,
  `agentStatus` varchar(30) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT NULL,
  `callid` varchar(32) DEFAULT NULL,
  `queue` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`agentId`),
  KEY `agentName` (`agentName`),
  KEY `agentStatus` (`agentStatus`,`timestamp`,`callid`),
  KEY `queue` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
