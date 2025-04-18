USE `roomsdb`;

CREATE TABLE `alarms_history` (
  `calldate` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `extension` int(11) NOT NULL DEFAULT '0',
  `alarm` varchar(20) NOT NULL DEFAULT '0000-00-00 00:00:00',
  `retry` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
