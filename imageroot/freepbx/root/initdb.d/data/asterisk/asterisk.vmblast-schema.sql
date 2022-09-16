/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `vmblast` (
  `grpnum` bigint(20) NOT NULL,
  `description` varchar(35) COLLATE utf8mb4_unicode_ci NOT NULL,
  `audio_label` int(11) NOT NULL DEFAULT '-1',
  `password` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`grpnum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
