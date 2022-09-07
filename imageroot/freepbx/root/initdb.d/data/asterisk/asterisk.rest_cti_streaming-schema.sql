/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `rest_cti_streaming` (
  `descr` varchar(50) NOT NULL,
  `url` varchar(8000) NOT NULL DEFAULT 'localhost',
  `user` varchar(30) DEFAULT '',
  `secret` varchar(90) DEFAULT '',
  `frame-rate` int(11) DEFAULT 1000,
  `exten` int(11) DEFAULT NULL,
  `open` varchar(10) DEFAULT '',
  PRIMARY KEY (`descr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
