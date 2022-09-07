/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `trunks` (
  `trunkid` int(11) NOT NULL DEFAULT 0,
  `tech` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channelid` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `outcid` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `keepcid` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT 'off',
  `maxchans` varchar(6) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `failscript` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dialoutprefix` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `usercontext` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disabled` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT 'off',
  `continue` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT 'off',
  PRIMARY KEY (`trunkid`,`tech`,`channelid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
