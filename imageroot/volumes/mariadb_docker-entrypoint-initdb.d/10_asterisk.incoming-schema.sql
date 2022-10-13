/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `incoming` (
  `cidnum` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `extension` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `destination` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `privacyman` tinyint(1) DEFAULT NULL,
  `alertinfo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ringing` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fanswer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mohclass` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `description` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grppre` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delay_answer` int(11) DEFAULT NULL,
  `pricid` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pmmaxretries` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pmminlength` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reversal` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rvolume` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `indication_zone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  PRIMARY KEY (`cidnum`,`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
