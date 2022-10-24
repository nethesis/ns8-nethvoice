/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
INSERT INTO `customcontexts_contexts_list` (`context`,`description`,`locked`) VALUES
("from-internal","Default Internal Context",1),
("from-internal-additional","Internal Dialplan",0),
("outbound-allroutes","Outbound Routes",0);
