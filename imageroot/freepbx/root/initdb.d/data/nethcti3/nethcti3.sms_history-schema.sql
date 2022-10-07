/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `sms_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender` varchar(50) DEFAULT NULL,
  `destination` varchar(50) DEFAULT NULL,
  `text` varchar(165) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `status` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sender_index` (`sender`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
