USE `roomsdb`;

CREATE TABLE `room_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '',
  `note` varchar(255) NOT NULL DEFAULT '',
  `groupcalls` tinyint(1) DEFAULT NULL,
  `roomscalls` tinyint(1) DEFAULT NULL,
  `externalcalls` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
