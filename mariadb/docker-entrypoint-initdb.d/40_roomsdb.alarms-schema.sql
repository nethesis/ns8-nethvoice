USE `roomsdb`;

CREATE TABLE IF NOT EXISTS `alarms` (
  `extension` int(11) NOT NULL DEFAULT '0',
  `hour` time NOT NULL DEFAULT '00:00:00',
  `start` date DEFAULT NULL,
  `end` date DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
