USE `roomsdb`;

CREATE TABLE IF NOT EXISTS `extra_history` (
  `extension` int(11) NOT NULL,
  `id` int(11) NOT NULL,
  `date` datetime DEFAULT NULL,
  `name` varchar(50) NOT NULL,
  `price` float DEFAULT '0',
  `number` int(3) NOT NULL DEFAULT '1',
  `checkout` tinyint(1) NOT NULL DEFAULT '0',
  KEY `extension` (`extension`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
