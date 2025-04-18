USE `roomsdb`;

CREATE TABLE `alarmcalls` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` int(11) NOT NULL DEFAULT '0',
  `extension` int(11) NOT NULL DEFAULT '0',
  `enabled` tinyint(1) DEFAULT '1',
  `alarmtype` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
