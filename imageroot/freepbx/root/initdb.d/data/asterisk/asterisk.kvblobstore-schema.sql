/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `kvblobstore` (
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` char(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` longblob DEFAULT NULL,
  PRIMARY KEY (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
