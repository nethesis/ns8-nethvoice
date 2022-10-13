/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
INSERT INTO `cron_jobs` (`id`,`modulename`,`jobname`,`command`,`class`,`schedule`,`max_runtime`,`enabled`,`execution_order`) VALUES
(1,"dashboard","scheduler",NULL,"FreePBX\\modules\\Dashboard\\Job","* * * * *",30,1,100);
