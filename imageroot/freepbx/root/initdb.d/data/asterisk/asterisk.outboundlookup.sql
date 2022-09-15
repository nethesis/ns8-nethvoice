/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
INSERT INTO `outboundlookup` (`mysql_host`,`mysql_dbname`,`mysql_query`,`mysql_username`,`mysql_password`,`mysql_charset`) VALUES
("localhost","phonebook","SELECT name,company FROM phonebook WHERE homephone LIKE \'%[NUMBER]\' OR workphone LIKE \'%[NUMBER]\' OR cellphone LIKE \'%[NUMBER]\' OR fax LIKE \'%[NUMBER]\'","pbookuser","U1toACSWL_3S9H_K",""),
("localhost","phonebook","SELECT name,company FROM phonebook WHERE homephone LIKE \'%[NUMBER]\' OR workphone LIKE \'%[NUMBER]\' OR cellphone LIKE \'%[NUMBER]\' OR fax LIKE \'%[NUMBER]\'","pbookuser","U1toACSWL_3S9H_K",""),
("localhost","phonebook","SELECT name,company FROM phonebook WHERE homephone LIKE \'%[NUMBER]\' OR workphone LIKE \'%[NUMBER]\' OR cellphone LIKE \'%[NUMBER]\' OR fax LIKE \'%[NUMBER]\'","pbookuser","U1toACSWL_3S9H_K","");
