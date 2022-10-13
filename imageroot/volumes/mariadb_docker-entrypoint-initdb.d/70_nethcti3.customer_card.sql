/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `nethcti3`;
INSERT INTO `customer_card` (`id`,`name`,`creation`,`query`,`template`,`dbconn_id`,`permission_id`) VALUES
(1,"Identity","2021-03-30 17:39:34","select * from phonebook where REPLACE(homephone, \' \', \'\') like \'%$NUMBER\' or REPLACE(workphone, \' \', \'\') like \'%$NUMBER\' or REPLACE(cellphone, \' \', \'\') like \'%$NUMBER\' or REPLACE(fax, \' \', \'\') like \'%$NUMBER\'","identity",1,NULL),
(2,"Last calls","2021-03-30 17:39:34","select DATE_FORMAT(calldate,\'%d/%m/%Y\') as date, DATE_FORMAT(calldate,\'%H:%i:%S\') as time, clid, src, dst, uniqueid,duration, time_format(billsec, \'%H:%i:%S\') as billsec, disposition,if(src=\'$NUMBER\',\'in\',\'out\') as direction from cdr where (src LIKE \'%$NUMBER\' or dst LIKE \'%$NUMBER\') and disposition = \'ANSWERED\' order by calldate desc limit 0,10","lastcalls",2,NULL);
