-- MySQL dump 10.14  Distrib 5.5.68-MariaDB, for Linux (x86_64)
--
-- Host: localhost    Database: asteriskcdrdb
-- ------------------------------------------------------
-- Server version	5.5.68-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Create database asteriskcdrdb if it doesn't exist
--
CREATE DATABASE IF NOT EXISTS asteriskcdrdb;
USE asteriskcdrdb;

--
-- Table structure for table `agent_status`
--

DROP TABLE IF EXISTS `agent_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_status`
--

LOCK TABLES `agent_status` WRITE;
/*!40000 ALTER TABLE `agent_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `agent_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `call_status`
--

DROP TABLE IF EXISTS `call_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `call_status`
--

LOCK TABLES `call_status` WRITE;
/*!40000 ALTER TABLE `call_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `call_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cdr`
--

DROP TABLE IF EXISTS `cdr`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cdr` (
  `calldate` datetime NOT NULL DEFAULT '1000-01-01 00:00:00',
  `clid` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `src` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dst` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dcontext` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `channel` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dstchannel` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lastapp` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lastdata` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `duration` int(11) NOT NULL DEFAULT '0',
  `billsec` int(11) NOT NULL DEFAULT '0',
  `disposition` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `amaflags` int(11) NOT NULL DEFAULT '0',
  `accountcode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `uniqueid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `userfield` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `did` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `recordingfile` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cnum` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cnam` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `outbound_cnum` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `outbound_cnam` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dst_cnam` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `linkedid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `peeraccount` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sequence` int(11) NOT NULL DEFAULT '0',
  `ccompany` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dst_ccompany` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  KEY `calldate` (`calldate`),
  KEY `dst` (`dst`),
  KEY `accountcode` (`accountcode`),
  KEY `uniqueid` (`uniqueid`),
  KEY `did` (`did`),
  KEY `recordingfile` (`recordingfile`(191)),
  KEY `clid` (`clid`),
  KEY `cnum` (`cnum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cdr`
--

LOCK TABLES `cdr` WRITE;
/*!40000 ALTER TABLE `cdr` DISABLE KEYS */;
/*!40000 ALTER TABLE `cdr` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cel`
--

DROP TABLE IF EXISTS `cel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cel` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `eventtype` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventtime` datetime NOT NULL,
  `cid_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cid_num` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cid_ani` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cid_rdnis` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cid_dnid` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `exten` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `context` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channame` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appname` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appdata` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amaflags` int(11) NOT NULL,
  `accountcode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uniqueid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `linkedid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `peer` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userdeftype` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extra` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `uniqueid_index` (`uniqueid`),
  KEY `linkedid_index` (`linkedid`),
  KEY `context_index` (`context`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cel`
--

LOCK TABLES `cel` WRITE;
/*!40000 ALTER TABLE `cel` DISABLE KEYS */;
/*!40000 ALTER TABLE `cel` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_cdr`
--

DROP TABLE IF EXISTS `daily_cdr`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `daily_cdr` (
  `calldate` datetime NOT NULL DEFAULT '1000-01-01 00:00:00',
  `clid` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `src` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dst` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dcontext` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `channel` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dstchannel` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lastapp` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `lastdata` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `duration` int(11) NOT NULL DEFAULT '0',
  `billsec` int(11) NOT NULL DEFAULT '0',
  `disposition` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `amaflags` int(11) NOT NULL DEFAULT '0',
  `accountcode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `uniqueid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `userfield` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `did` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `recordingfile` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cnum` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cnam` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `outbound_cnum` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `outbound_cnam` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dst_cnam` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `linkedid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `peeraccount` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sequence` int(11) NOT NULL DEFAULT '0',
  `ccompany` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dst_ccompany` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  KEY `calldate` (`calldate`),
  KEY `dst` (`dst`),
  KEY `accountcode` (`accountcode`),
  KEY `uniqueid` (`uniqueid`),
  KEY `did` (`did`),
  KEY `recordingfile` (`recordingfile`(191)),
  KEY `clid` (`clid`),
  KEY `cnum` (`cnum`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_cdr`
--

LOCK TABLES `daily_cdr` WRITE;
/*!40000 ALTER TABLE `daily_cdr` DISABLE KEYS */;
/*!40000 ALTER TABLE `daily_cdr` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queue_log`
--

DROP TABLE IF EXISTS `queue_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queue_log` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `time` char(26) DEFAULT NULL,
  `callid` varchar(32) NOT NULL DEFAULT '',
  `queuename` varchar(32) NOT NULL DEFAULT '',
  `agent` varchar(32) NOT NULL DEFAULT '',
  `event` varchar(32) NOT NULL DEFAULT '',
  `data` varchar(100) NOT NULL DEFAULT '',
  `data1` varchar(100) NOT NULL DEFAULT '',
  `data2` varchar(100) NOT NULL DEFAULT '',
  `data3` varchar(100) NOT NULL DEFAULT '',
  `data4` varchar(100) NOT NULL DEFAULT '',
  `data5` varchar(100) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `event` (`event`),
  KEY `ib1` (`agent`,`queuename`),
  KEY `callid_idx` (`callid`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queue_log`
--

LOCK TABLES `queue_log` WRITE;
/*!40000 ALTER TABLE `queue_log` DISABLE KEYS */;
INSERT INTO `queue_log` VALUES (1,'2021-03-30 17:39:11.905999','NONE','NONE','NONE','CONFIGRELOAD','','','','','',''),(2,'2021-03-30 17:39:14.532198','NONE','NONE','NONE','CONFIGRELOAD','','','','','',''),(3,'2021-03-30 17:39:20.042795','NONE','NONE','NONE','CONFIGRELOAD','','','','','',''),(4,'2021-03-30 17:39:24.323550','NONE','NONE','NONE','QUEUESTART','','','','','',''),(5,'2021-05-20 09:00:23.927489','NONE','NONE','NONE','QUEUESTART','','','','','',''),(6,'2021-05-20 09:11:28.259547','NONE','NONE','NONE','QUEUESTART','','','','','',''),(7,'2021-05-20 09:17:23.930979','NONE','NONE','NONE','QUEUESTART','','','','','',''),(8,'2021-05-20 09:21:45.041191','NONE','NONE','NONE','QUEUESTART','','','','','',''),(9,'2021-05-20 09:26:37.427786','NONE','NONE','NONE','CONFIGRELOAD','','','','','',''),(10,'2021-05-20 09:26:42.751759','NONE','NONE','NONE','CONFIGRELOAD','','','','','',''),(11,'2021-05-20 09:26:47.379988','NONE','NONE','NONE','QUEUESTART','','','','','',''),(12,'2021-05-20 09:35:22.617741','NONE','NONE','NONE','CONFIGRELOAD','','','','','',''),(13,'2021-05-20 09:35:28.357258','NONE','NONE','NONE','CONFIGRELOAD','','','','','',''),(14,'2021-05-20 09:35:33.839185','NONE','NONE','NONE','QUEUESTART','','','','','',''),(15,'2021-06-18 09:45:50.038131','NONE','NONE','NONE','QUEUESTART','','','','','','');
/*!40000 ALTER TABLE `queue_log` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `asteriskcdrdb`.`bi_queueEvents` BEFORE INSERT ON `asteriskcdrdb`.`queue_log`
FOR EACH ROW BEGIN
IF NEW.event = 'ADDMEMBER' THEN
INSERT INTO agent_status (agentId,agentStatus,timestamp,callid,queue) VALUES (NEW.agent,'READY',NEW.time,NULL,NEW.queuename) ON DUPLICATE KEY UPDATE agentStatus = "READY", timestamp = NEW.time, callid = NULL, queue = NEW.queuename;
ELSEIF NEW.event = 'REMOVEMEMBER' THEN
INSERT INTO `agent_status` (agentId,agentStatus,timestamp,callid,queue) VALUES (NEW.agent,'LOGGEDOUT',NEW.time,NULL,NEW.queuename) ON DUPLICATE KEY UPDATE agentStatus = "LOGGEDOUT", timestamp = NEW.time, callid = NULL, queue = NEW.queuename;
ELSEIF NEW.event = 'AGENTLOGIN' THEN
INSERT INTO `agent_status` (agentId,agentStatus,timestamp,callid,queue) VALUES (NEW.agent,'LOGGEDIN',NEW.time,NULL,NEW.queuename) ON DUPLICATE KEY UPDATE agentStatus = "LOGGEDIN", timestamp = NEW.time, callid = NULL, queue = NEW.queuename;
ELSEIF NEW.event = 'AGENTLOGOFF' THEN
INSERT INTO `agent_status` (agentId,agentStatus,timestamp,callid,queue) VALUES (NEW.agent,'LOGGEDOUT',NEW.time,NULL,NEW.queuename) ON DUPLICATE KEY UPDATE agentStatus = "LOGGEDOUT", timestamp = NEW.time, callid = NULL, queue = NEW.queuename;
ELSEIF NEW.event = 'PAUSE' THEN
INSERT INTO agent_status (agentId,agentStatus,timestamp,callid,queue) VALUES (NEW.agent,'PAUSE',NEW.time,NULL,NEW.queuename) ON DUPLICATE KEY UPDATE agentStatus = "PAUSE", timestamp = NEW.time, callid = NULL, queue = NEW.queuename;
ELSEIF NEW.event = 'UNPAUSE' THEN
INSERT INTO `agent_status` (agentId,agentStatus,timestamp,callid,queue) VALUES (NEW.agent,'READY',NEW.time,NULL,NEW.queuename) ON DUPLICATE KEY UPDATE agentStatus = "READY", timestamp = NEW.time, callid = NULL, queue = NEW.queuename;
ELSEIF NEW.event = 'ENTERQUEUE' THEN
REPLACE INTO `call_status` VALUES
(NEW.callid,NEW.data2,
'inQue',
NEW.time,
NEW.queuename,
'',
'',
'',
'',
'',
0);
ELSEIF NEW.event = 'CONNECT' THEN
UPDATE `call_status` SET
callid = NEW.callid,
status = NEW.event,
timestamp = NEW.time,
queue = NEW.queuename,
holdtime = NEW.data1,
agent = NEW.agent
where callid = NEW.callid;
INSERT INTO agent_status (agentId,agentStatus,timestamp,callid,queue) VALUES
(NEW.agent,NEW.event,
NEW.time,
NEW.callid,
NEW.queuename)
ON DUPLICATE KEY UPDATE
agentStatus = NEW.event,
timestamp = NEW.time,
callid = NEW.callid,
queue = NEW.queuename;
ELSEIF NEW.event in ('COMPLETECALLER','COMPLETEAGENT') THEN
UPDATE `call_status` SET
callid = NEW.callid,
status = NEW.event,
timestamp = NEW.time,
queue = NEW.queuename,
originalPosition = NEW.data3,
holdtime = NEW.data1,
callduration = NEW.data2,
agent = NEW.agent
where callid = NEW.callid;
INSERT INTO agent_status (agentId,agentStatus,timestamp,callid,queue) VALUES (NEW.agent,NEW.event,NEW.time,NULL,NEW.queuename) ON DUPLICATE KEY UPDATE agentStatus = "READY", timestamp = NEW.time, callid = NULL, queue = NEW.queuename;
ELSEIF NEW.event in ('TRANSFER') THEN
UPDATE `call_status` SET
callid = NEW.callid,
status = NEW.event,
timestamp = NEW.time,
queue = NEW.queuename,
holdtime = NEW.data1,
callduration = NEW.data3,
agent = NEW.agent
where callid = NEW.callid;
INSERT INTO agent_status (agentId,agentStatus,timestamp,callid,queue) VALUES
(NEW.agent,'READY',NEW.time,NULL,NEW.queuename)
ON DUPLICATE KEY UPDATE
agentStatus = "READY",
timestamp = NEW.time,
callid = NULL,
queue = NEW.queuename;
ELSEIF NEW.event in ('ABANDON','EXITEMPTY') THEN
UPDATE `call_status` SET
callid = NEW.callid,
status = NEW.event,
timestamp = NEW.time,
queue = NEW.queuename,
position = NEW.data1,
originalPosition = NEW.data2,
holdtime = NEW.data3,
agent = NEW.agent
where callid = NEW.callid;
ELSEIF NEW.event = 'EXITWITHKEY' THEN
UPDATE `call_status` SET
callid = NEW.callid,
status = NEW.event,
timestamp = NEW.time,
queue = NEW.queuename,
position = NEW.data2,
keyPressed = NEW.data1,
agent = NEW.agent
where callid = NEW.callid;
ELSEIF NEW.event = 'EXITWITHTIMEOUT' THEN
UPDATE `call_status` SET
callid = NEW.callid,
status = NEW.event,
timestamp = NEW.time,
queue = NEW.queuename,
position = NEW.data1,
agent = NEW.agent
where callid = NEW.callid;
END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `asteriskcdrdb`.`update_processed` AFTER INSERT ON `asteriskcdrdb`.`queue_log`
FOR EACH ROW BEGIN
INSERT INTO queue_log_processed (callid,queuename,agentdev,event,data1,data2,data3,datetime)
VALUES (NEW.callid,NEW.queuename,NEW.agent,NEW.event,NEW.data1,NEW.data2,NEW.data3,NEW.time);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `queue_log_processed`
--

DROP TABLE IF EXISTS `queue_log_processed`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queue_log_processed`
--

LOCK TABLES `queue_log_processed` WRITE;
/*!40000 ALTER TABLE `queue_log_processed` DISABLE KEYS */;
INSERT INTO `queue_log_processed` VALUES (1,0,'NONE','NONE','NONE','CONFIGRELOAD','','','','2021-03-30 17:39:11'),(2,0,'NONE','NONE','NONE','CONFIGRELOAD','','','','2021-03-30 17:39:14'),(3,0,'NONE','NONE','NONE','CONFIGRELOAD','','','','2021-03-30 17:39:20'),(4,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-03-30 17:39:24'),(5,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-05-20 09:00:23'),(6,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-05-20 09:11:28'),(7,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-05-20 09:17:23'),(8,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-05-20 09:21:45'),(9,0,'NONE','NONE','NONE','CONFIGRELOAD','','','','2021-05-20 09:26:37'),(10,0,'NONE','NONE','NONE','CONFIGRELOAD','','','','2021-05-20 09:26:42'),(11,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-05-20 09:26:47'),(12,0,'NONE','NONE','NONE','CONFIGRELOAD','','','','2021-05-20 09:35:22'),(13,0,'NONE','NONE','NONE','CONFIGRELOAD','','','','2021-05-20 09:35:28'),(14,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-05-20 09:35:33'),(15,0,'NONE','NONE','NONE','QUEUESTART','','','','2021-06-18 09:45:50');
/*!40000 ALTER TABLE `queue_log_processed` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voicemessages`
--

DROP TABLE IF EXISTS `voicemessages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voicemessages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `msgnum` int(11) NOT NULL DEFAULT '0',
  `dir` varchar(80) DEFAULT '',
  `context` varchar(80) DEFAULT '',
  `macrocontext` varchar(80) DEFAULT '',
  `callerid` varchar(40) DEFAULT '',
  `origtime` varchar(40) DEFAULT '',
  `duration` varchar(20) DEFAULT '',
  `mailboxuser` varchar(80) DEFAULT '',
  `mailboxcontext` varchar(80) DEFAULT '',
  `recording` longblob,
  `flag` varchar(128) DEFAULT '',
  `read` tinyint(1) DEFAULT '0',
  `msg_id` varchar(40) DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `dir` (`dir`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voicemessages`
--

LOCK TABLES `voicemessages` WRITE;
/*!40000 ALTER TABLE `voicemessages` DISABLE KEYS */;
/*!40000 ALTER TABLE `voicemessages` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2021-06-18  9:50:38
