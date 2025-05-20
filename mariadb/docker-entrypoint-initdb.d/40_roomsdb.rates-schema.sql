USE `roomsdb`;

CREATE TABLE IF NOT EXISTS `rates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL DEFAULT '',
  `duration` int(11) NOT NULL DEFAULT '0',
  `price` float NOT NULL DEFAULT '0',
  `answer_duration` int(11) NOT NULL DEFAULT '0',
  `answer_price` float NOT NULL DEFAULT '0',
  `pattern` varchar(100) NOT NULL DEFAULT '',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4;
