/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `rest_cti_streaming_gates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `source` varchar(50) NOT NULL,
  `position` int(10) unsigned NOT NULL DEFAULT '0',
  `name` varchar(50) NOT NULL,
  `type` varchar(10) NOT NULL DEFAULT 'dtmf',
  `code` varchar(30) DEFAULT NULL,
  `url` varchar(2048) DEFAULT NULL,
  `method` varchar(6) NOT NULL DEFAULT 'GET',
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `source_position` (`source`,`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
