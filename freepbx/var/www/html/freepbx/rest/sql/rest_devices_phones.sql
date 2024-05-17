USE asterisk;
CREATE TABLE IF NOT EXISTS `rest_devices_phones`(
  `id` BIGINT(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int(11) DEFAULT NULL,
  `mac` varchar(20),
  `vendor` varchar(64) DEFAULT NULL,
  `model` varchar(64) DEFAULT NULL,
  `line` int DEFAULT '1',
  `extension` varchar(16) DEFAULT NULL,
  `secret` varchar(128) DEFAULT NULL,
  `web_user` varchar(128) DEFAULT NULL,
  `web_password` varchar(128) DEFAULT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'physical',
  UNIQUE KEY `mac` (`mac`,`line`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
