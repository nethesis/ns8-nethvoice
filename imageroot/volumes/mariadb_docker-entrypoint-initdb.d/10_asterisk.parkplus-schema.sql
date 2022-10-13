/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `parkplus` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `defaultlot` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'no',
  `type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'public',
  `name` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `parkext` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `parkpos` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `numslots` int(11) NOT NULL DEFAULT '4',
  `parkingtime` int(11) NOT NULL DEFAULT '45',
  `parkedmusicclass` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  `generatefc` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'yes',
  `findslot` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'first',
  `parkedplay` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'both',
  `parkedcalltransfers` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'caller',
  `parkedcallreparking` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'caller',
  `alertinfo` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `rvolume` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cidpp` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `autocidpp` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `announcement_id` int(11) DEFAULT NULL,
  `comebacktoorigin` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'yes',
  `dest` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
