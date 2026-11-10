/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `rest_cti_streaming` (
  `descr` varchar(50) NOT NULL,
  `type` varchar(10) NOT NULL DEFAULT 'image',
  `url` varchar(8000) NOT NULL DEFAULT 'localhost',
  `user` varchar(255) DEFAULT '',
  `secret` varchar(255) DEFAULT '',
  `frame-rate` int(11) DEFAULT '1000',
  `exten` int(11) DEFAULT NULL,
  `open` varchar(30) DEFAULT '',
  `tls_skip_verify` tinyint(1) NOT NULL DEFAULT 0,
  `tls_fingerprint` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`descr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
