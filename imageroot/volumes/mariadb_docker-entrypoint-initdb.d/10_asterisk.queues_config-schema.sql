/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `queues_config` (
  `extension` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `descr` varchar(35) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `grppre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `alertinfo` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `ringing` tinyint(1) NOT NULL DEFAULT '0',
  `maxwait` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `password` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `ivr_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '0',
  `dest` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cwignore` tinyint(1) NOT NULL DEFAULT '0',
  `queuewait` tinyint(1) DEFAULT '0',
  `use_queue_context` tinyint(1) DEFAULT '0',
  `togglehint` tinyint(1) DEFAULT '0',
  `qnoanswer` tinyint(1) DEFAULT '0',
  `callconfirm` tinyint(1) DEFAULT '0',
  `callconfirm_id` int(11) DEFAULT NULL,
  `qregex` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agentannounce_id` int(11) DEFAULT NULL,
  `joinannounce_id` int(11) DEFAULT NULL,
  `monitor_type` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monitor_heard` int(11) DEFAULT NULL,
  `monitor_spoken` int(11) DEFAULT NULL,
  `callback_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
