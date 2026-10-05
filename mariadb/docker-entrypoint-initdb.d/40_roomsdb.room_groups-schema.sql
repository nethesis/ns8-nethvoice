USE `roomsdb`;

CREATE TABLE IF NOT EXISTS `room_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '',
  `note` varchar(255) NOT NULL DEFAULT '',
  `fias_guest_group_number` varchar(100) DEFAULT NULL,
  `groupcalls` tinyint(1) DEFAULT NULL,
  `roomscalls` tinyint(1) DEFAULT NULL,
  `externalcalls` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_fias_guest_group_number` (`fias_guest_group_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
