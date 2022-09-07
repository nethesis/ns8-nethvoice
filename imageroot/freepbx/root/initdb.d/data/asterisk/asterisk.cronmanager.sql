/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
INSERT INTO `cronmanager` (`module`,`id`,`time`,`freq`,`lasttime`,`command`) VALUES
("module_admin","UPDATES","22",24,0,"/var/lib/asterisk/bin/module_admin listonline > /dev/null 2>&1");
