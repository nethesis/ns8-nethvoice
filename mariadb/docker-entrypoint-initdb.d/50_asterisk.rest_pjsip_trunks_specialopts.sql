/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
INSERT INTO `rest_pjsip_trunks_specialopts` (`provider_id`,`keyword`,`data`) VALUES
(6,"secret",""),
(6,"username",""),
(14,"client_uri","sip:$USERNAME@CHANGE_ME"),
(23,"client_uri","sip:$USERNAME@nomecliente.site:5083"),
(27,"username","$PHONE"),
(27,"auth_username","$USERNAME"),
(27,"contact_user","$PHONE"),
(27,"from_user","$PHONE");
