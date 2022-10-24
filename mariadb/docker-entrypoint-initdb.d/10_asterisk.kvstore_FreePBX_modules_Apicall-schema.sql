/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `kvstore_FreePBX_modules_Apicall` (
  `key` char(255) NOT NULL,
  `val` varchar(4096) DEFAULT NULL,
  `type` char(16) DEFAULT NULL,
  `id` char(255) DEFAULT NULL,
  UNIQUE KEY `uniqueindex` (`key`(190),`id`(190)),
  KEY `keyindex` (`key`(190)),
  KEY `idindex` (`id`(190))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
