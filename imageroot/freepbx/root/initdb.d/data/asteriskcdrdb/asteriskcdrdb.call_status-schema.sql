/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `call_status` (
  `callId` varchar(32) NOT NULL DEFAULT '',
  `callerId` varchar(13) NOT NULL,
  `status` varchar(30) NOT NULL,
  `timestamp` timestamp NULL DEFAULT NULL,
  `queue` varchar(25) NOT NULL,
  `agent` varchar(32) NOT NULL DEFAULT '',
  `position` varchar(11) NOT NULL,
  `originalPosition` varchar(11) NOT NULL,
  `holdtime` varchar(11) NOT NULL,
  `keyPressed` varchar(11) NOT NULL,
  `callduration` int(11) NOT NULL,
  PRIMARY KEY (`callId`),
  KEY `callerId` (`callerId`),
  KEY `status` (`status`),
  KEY `timestamp` (`timestamp`),
  KEY `queue` (`queue`),
  KEY `position` (`position`,`originalPosition`,`holdtime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
