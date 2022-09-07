/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
CREATE TABLE `bosssecretary_secretary` (
  `id_group` int(11) NOT NULL,
  `secretary_extension` varchar(20) NOT NULL,
  PRIMARY KEY (`id_group`,`secretary_extension`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
