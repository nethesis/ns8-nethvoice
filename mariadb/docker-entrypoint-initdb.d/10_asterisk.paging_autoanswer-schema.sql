/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `paging_autoanswer` (
  `useragent` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `var` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`useragent`,`var`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
