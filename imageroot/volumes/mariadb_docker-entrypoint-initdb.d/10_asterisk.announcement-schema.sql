/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
CREATE TABLE `announcement` (
  `announcement_id` int(11) NOT NULL AUTO_INCREMENT,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recording_id` int(11) DEFAULT NULL,
  `allow_skip` int(11) DEFAULT NULL,
  `post_dest` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `return_ivr` tinyint(1) NOT NULL DEFAULT '0',
  `noanswer` tinyint(1) NOT NULL DEFAULT '0',
  `repeat_msg` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`announcement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
