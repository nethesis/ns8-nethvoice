/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `queueoptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_CIDPP` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_AINFO` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_JOINMSG` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_RETRY` tinyint(1) NOT NULL DEFAULT '0',
  `VQ_OPTIONS` tinyint(1) NOT NULL DEFAULT '0',
  `VQ_GOSUB` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_AGI` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_POSITION_ENABLED` tinyint(1) NOT NULL DEFAULT '0',
  `VQ_POSITION` int(11) NOT NULL DEFAULT '2',
  `VQ_CONFIRMMSG` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_AANNOUNCE` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_MOH` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `VQ_MAXWAIT_ENABLED` tinyint(1) NOT NULL DEFAULT '0',
  `VQ_MAXWAIT` int(11) NOT NULL DEFAULT '300',
  `VQ_DEST_ENABLED` tinyint(1) NOT NULL DEFAULT '0',
  `VQ_DEST` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
  `DEST` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
