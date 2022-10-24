/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `callback` (
  `callback_id` int(11) NOT NULL AUTO_INCREMENT,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `callbacknum` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destination` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sleep` int(11) DEFAULT NULL,
  `deptname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timeout` int(10) DEFAULT NULL,
  `callerid` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`callback_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
