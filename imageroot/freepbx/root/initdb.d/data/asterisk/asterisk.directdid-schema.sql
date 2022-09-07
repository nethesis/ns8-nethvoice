/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `directdid` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timeout` int(11) NOT NULL DEFAULT 15,
  `timeout_destination` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
  `busy_destination` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
  `unavailable_destination` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app-blackhole,hangup,1',
  `root` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `prefix` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `varlength` int(2) NOT NULL DEFAULT 2,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
