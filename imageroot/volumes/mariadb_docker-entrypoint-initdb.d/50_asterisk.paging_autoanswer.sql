/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
INSERT INTO `paging_autoanswer` (`useragent`,`var`,`setting`) VALUES
("default","ALERTINFO","Ring Answer"),
("default","CALLINFO","<uri>\\;answer-after=0"),
("default","SIPURI","intercom=true"),
("Digium","ALERTINFO","ring-answer"),
("Mitel","CALLINFO","<sip:broadworks.net>\\;answer-after=0"),
("OpenStage","ALERTINFO","<http://example.com>\\;info=alert-autoanswer"),
("Panasonic","ALERTINFO","Intercom"),
("Polycom","ALERTINFO","info=Auto Answer"),
("Sangoma P","ALERTINFO","ring-answer"),
("Sangoma S","ALERTINFO","<http://www.sangoma.com>\\;info=external${PAGE_VOL}");
