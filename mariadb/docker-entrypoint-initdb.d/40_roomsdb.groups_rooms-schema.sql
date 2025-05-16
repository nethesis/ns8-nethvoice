USE `roomsdb`;

CREATE TABLE IF NOT EXISTS `groups_rooms` (
  `group_id` int(11) NOT NULL,
  `extension` int(11) NOT NULL,
  PRIMARY KEY (`group_id`,`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
