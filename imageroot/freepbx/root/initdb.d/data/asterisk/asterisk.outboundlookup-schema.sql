/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `outboundlookup` (
  `mysql_host` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mysql_dbname` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mysql_query` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mysql_username` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mysql_password` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mysql_charset` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
