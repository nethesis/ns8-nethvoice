USE `roomsdb`;

CREATE TABLE `history` (
  `extension` int(11) DEFAULT NULL,
  `start` datetime DEFAULT NULL,
  `end` datetime DEFAULT NULL,
  UNIQUE KEY `k` (`extension`,`start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
