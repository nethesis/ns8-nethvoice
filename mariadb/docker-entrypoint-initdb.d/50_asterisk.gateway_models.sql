/*!40101 SET NAMES binary*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
-- Preserve imported IDs and gateway references; match models by model/manufacturer.
INSERT INTO `gateway_models` (`model`,`manufacturer`,`tech`,`n_pri_trunks`,`n_isdn_trunks`,`n_fxo_trunks`,`n_fxs_ext`,`description`) VALUES
("TRI_FXO_2","Patton","fxo",0,0,2,0,"TRINITY Analogico 2 Porte FXO"),
("TRI_FXO_4","Patton","fxo",0,0,4,0,"TRINITY Analogico 4 Porte FXO"),
("TRI_FXO_8","Patton","fxo",0,0,8,0,"TRINITY Analogico 8 Porte FXO"),
("TRI_ISDN_1","Patton","isdn",0,1,0,0,"TRINITY ISDN 1 Porta"),
("TRI_ISDN_2","Patton","isdn",0,2,0,0,"TRINITY ISDN 2 Porte"),
("TRI_ISDN_4","Patton","isdn",0,4,0,0,"TRINITY ISDN 4 Porte"),
("TRI_PRI_1","Patton","pri",1,0,0,0,"TRINITY PRI 1 Porta"),
("TRI_PRI_2","Patton","pri",2,0,0,0,"TRINITY PRI 2 Porte"),
("TRI_PRI_4","Patton","pri",4,0,0,0,"TRINITY PRI 4 Porte"),
("ht801","Grandstream","fxs",0,0,0,1,"HT801 SIP 1 Porta FXS"),
("ht801TLS","Grandstream","fxs",0,0,0,1,"HT801 SIP TLS 1 Porta FXS"),
("ht802","Grandstream","fxs",0,0,0,2,"HT802 SIP 2 Porte FXS"),
("ht802TLS","Grandstream","fxs",0,0,0,2,"HT802 SIP TLS 2 Porte FXS"),
("ht812","Grandstream","fxs",0,0,0,2,"HT812 SIP 2 Porte FXS"),
("ht812TLS","Grandstream","fxs",0,0,0,2,"HT812 SIP TLS 2 Porte FXS"),
("ht814","Grandstream","fxs",0,0,0,4,"HT814 SIP 4 Porte FXS"),
("ht814TLS","Grandstream","fxs",0,0,0,4,"HT814 SIP TLS 4 Porte FXS"),
("gxw4216","Grandstream","fxs",0,0,0,16,"GXW4216 SIP 16 Porte FXS"),
("gxw4216TLS","Grandstream","fxs",0,0,0,16,"GXW4216 SIP TLS 16 Porte FXS"),
("gxw4224","Grandstream","fxs",0,0,0,24,"GXW4224 SIP 24 Porte FXS"),
("gxw4224TLS","Grandstream","fxs",0,0,0,24,"GXW4224 SIP TLS 24 Porte FXS"),
("gxw4232","Grandstream","fxs",0,0,0,32,"GXW4216 SIP 32 Porte FXS"),
("gxw4232TLS","Grandstream","fxs",0,0,0,32,"GXW4232 SIP TLS 32 Porte FXS"),
("gxw4248","Grandstream","fxs",0,0,0,48,"GXW4216 SIP 48 Porte FXS"),
("gxw4248TLS","Grandstream","fxs",0,0,0,48,"GXW4216 SIP TLS 48 Porte FXS"),
("ht841TLS","Grandstream","fxo",0,0,4,0,"HT841 Analogico 4 Porte FXO")
ON DUPLICATE KEY UPDATE
`model`=VALUES(`model`),
`manufacturer`=VALUES(`manufacturer`),
`tech`=VALUES(`tech`),
`n_pri_trunks`=VALUES(`n_pri_trunks`),
`n_isdn_trunks`=VALUES(`n_isdn_trunks`),
`n_fxo_trunks`=VALUES(`n_fxo_trunks`),
`n_fxs_ext`=VALUES(`n_fxs_ext`),
`description`=VALUES(`description`);
