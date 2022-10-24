/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `fax_users` (
  `user` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `faxenabled` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `faxemail` longtext COLLATE utf8mb4_unicode_ci,
  `faxattachformat` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  UNIQUE KEY `user` (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
