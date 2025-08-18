/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `asteriskcdrdb`;
CREATE TABLE IF NOT EXISTS `voicemessages_transcriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `voicemessage_id` int(11) NOT NULL DEFAULT '0',
  `transcription` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_voicemessage_id` (`voicemessage_id`),
  CONSTRAINT `fk_voicemessages_transcriptions_voicemessage_id` FOREIGN KEY (`voicemessage_id`) REFERENCES `voicemessages` (`id`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
