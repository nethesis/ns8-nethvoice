/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `ampusers` (
  `username` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_sha1` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extension_low` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `extension_high` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `deptname` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sections` longblob NOT NULL,
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
