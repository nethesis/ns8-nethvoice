/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `callrecording_module` (
  `extension` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cidnum` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `callrecording` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
