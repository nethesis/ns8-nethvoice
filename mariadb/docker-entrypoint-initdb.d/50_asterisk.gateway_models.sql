/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
INSERT INTO `gateway_models` (`id`,`model`,`manufacturer`,`tech`,`n_pri_trunks`,`n_isdn_trunks`,`n_fxo_trunks`,`n_fxs_ext`,`description`) VALUES
(11,"TRI_FXO_2","Patton","fxo",0,0,2,0,"TRINITY Analogico 2 Porte FXO"),
(12,"TRI_FXO_4","Patton","fxo",0,0,4,0,"TRINITY Analogico 4 Porte FXO"),
(13,"TRI_FXO_8","Patton","fxo",0,0,8,0,"TRINITY Analogico 8 Porte FXO"),
(16,"TRI_ISDN_1","Patton","isdn",0,1,0,0,"TRINITY ISDN 1 Porta"),
(17,"TRI_ISDN_2","Patton","isdn",0,2,0,0,"TRINITY ISDN 2 Porte"),
(18,"TRI_ISDN_4","Patton","isdn",0,4,0,0,"TRINITY ISDN 4 Porte"),
(19,"TRI_PRI_1","Patton","pri",1,0,0,0,"TRINITY PRI 1 Porta"),
(20,"TRI_PRI_2","Patton","pri",2,0,0,0,"TRINITY PRI 2 Porte"),
(21,"TRI_PRI_4","Patton","pri",4,0,0,0,"TRINITY PRI 4 Porte"),
(28,"M4401","Mediatrix","isdn",0,1,0,0,"4401 ISDN 1 Porta"),
(29,"M4402","Mediatrix","isdn",0,2,0,0,"4402 ISDN 2 Porte"),
(30,"M4404","Mediatrix","isdn",0,4,0,0,"4404 ISDN 4 Porte"),
(31,"ht801","Grandstream","fxs",0,0,0,1,"HT801 SIP 1 Porta FXS"),
(32,"ht801TLS","Grandstream","fxs",0,0,0,1,"HT801 SIP TLS 1 Porta FXS"),
(33,"ht802","Grandstream","fxs",0,0,0,2,"HT802 SIP 2 Porte FXS"),
(34,"ht802TLS","Grandstream","fxs",0,0,0,2,"HT802 SIP TLS 2 Porte FXS"),
(35,"ht812","Grandstream","fxs",0,0,0,2,"HT812 SIP 2 Porte FXS"),
(36,"ht812TLS","Grandstream","fxs",0,0,0,2,"HT812 SIP TLS 2 Porte FXS"),
(37,"ht814","Grandstream","fxs",0,0,0,4,"HT814 SIP 4 Porte FXS"),
(38,"ht814TLS","Grandstream","fxs",0,0,0,4,"HT814 SIP TLS 4 Porte FXS"),
(39,"gxw4216","Grandstream","fxs",0,0,0,16,"GXW4216 SIP 16 Porte FXS"),
(40,"gxw4216TLS","Grandstream","fxs",0,0,0,16,"GXW4216 SIP TLS 16 Porte FXS"),
(41,"gxw4224","Grandstream","fxs",0,0,0,24,"GXW4224 SIP 24 Porte FXS"),
(42,"gxw4224TLS","Grandstream","fxs",0,0,0,24,"GXW4224 SIP TLS 24 Porte FXS"),
(43,"gxw4232","Grandstream","fxs",0,0,0,32,"GXW4216 SIP 32 Porte FXS"),
(44,"gxw4232TLS","Grandstream","fxs",0,0,0,32,"GXW4232 SIP TLS 32 Porte FXS"),
(45,"gxw4248","Grandstream","fxs",0,0,0,48,"GXW4216 SIP 48 Porte FXS"),
(46,"gxw4248TLS","Grandstream","fxs",0,0,0,48,"GXW4216 SIP TLS 48 Porte FXS");
