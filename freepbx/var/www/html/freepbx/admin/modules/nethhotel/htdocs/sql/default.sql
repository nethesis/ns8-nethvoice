use roomsdb;

LOCK TABLES `options` WRITE;
INSERT IGNORE INTO `options` VALUES ('ext_pattern','XXX'),('internal_call','1'),('prefix','0'),('enableclean','1'),('groupcalls','1'),('externalcalls','1');
UNLOCK TABLES;

LOCK TABLES `rates` WRITE;
INSERT IGNORE INTO `rates` VALUES (41,'Green numbers',0,0,0,0,'800.',1),(38,'National',10,10,10,10,'0ZXXXXX.',1),(42,'International',10,10,10,10,'00XXXXX.',1),(35,'Cell phones',10,10,10,10,'3XXXXXX.',1),(25,'Special 7',10,10,10,10,'7XXXXXX.',1),(39,'Special 199',10,10,10,10,'199XXXX.',1),(40,'Special 8',10,52,35,40,'8ZXXXXX.',1),(28,'Emergencies',0,0,0,0,'1XX',1),(29,'Special 1XXX',10,10,10,10,'1XXX',1);
UNLOCK TABLES;

