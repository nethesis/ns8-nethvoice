USE `roomsdb`;

CREATE TABLE IF NOT EXISTS `options` (
  `variable` varchar(100) DEFAULT NULL,
  `value` varchar(100) DEFAULT NULL,
  UNIQUE KEY `u` (`variable`,`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
