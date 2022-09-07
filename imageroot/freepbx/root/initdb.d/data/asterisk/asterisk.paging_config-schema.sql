/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `paging_config` (
  `page_group` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `force_page` int(1) NOT NULL,
  `duplex` int(1) NOT NULL DEFAULT 0,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `announcement` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `volume` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`page_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
