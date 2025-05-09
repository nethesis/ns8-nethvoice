USE `roomsdb`;

CREATE TABLE IF NOT EXISTS `rooms` (
  `extension` int(11) NOT NULL DEFAULT '0',
  `start` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `group` int(11) DEFAULT NULL,
  `clean` tinyint(1) NOT NULL DEFAULT '0',
  `text` varchar(32) DEFAULT NULL,
  `lang` varchar(5) DEFAULT NULL,
  PRIMARY KEY (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
