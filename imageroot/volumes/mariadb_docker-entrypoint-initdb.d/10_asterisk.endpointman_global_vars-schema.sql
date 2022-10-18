/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `endpointman_global_vars` (
  `idnum` int(11) NOT NULL AUTO_INCREMENT COMMENT 'Index',
  `var_name` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Variable Name',
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Data',
  PRIMARY KEY (`idnum`),
  UNIQUE KEY `var_name` (`var_name`)
) ENGINE=MyISAM AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
