/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
INSERT INTO `parkplus` (`id`,`defaultlot`,`type`,`name`,`parkext`,`parkpos`,`numslots`,`parkingtime`,`parkedmusicclass`,`generatefc`,`findslot`,`parkedplay`,`parkedcalltransfers`,`parkedcallreparking`,`alertinfo`,`rvolume`,`cidpp`,`autocidpp`,`announcement_id`,`comebacktoorigin`,`dest`) VALUES
(1,"yes","public","Default Lot","70","71",8,45,"default","yes","first","both","caller","caller","","","","none",NULL,"yes","app-blackhole,hangup,1");
