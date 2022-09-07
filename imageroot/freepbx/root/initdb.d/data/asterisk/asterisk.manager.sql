/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
INSERT INTO `manager` (`manager_id`,`name`,`secret`,`deny`,`permit`,`read`,`write`,`writetimeout`) VALUES
(3,"proxycti","qNyaSI_9d7o3TiJW","0.0.0.0/0.0.0.0","127.0.0.1/255.255.255.0","system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate","system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate",100);
