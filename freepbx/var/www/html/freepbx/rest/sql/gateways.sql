USE asterisk;

CREATE TABLE IF NOT EXISTS `gateway_models` (
  `id` INT UNSIGNED AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `model` varchar(100) NOT NULL default '',
  `manufacturer` varchar(20) default NULL,
  `tech` varchar(20) default NULL,
  `n_pri_trunks` INT UNSIGNED default '0',
  `n_isdn_trunks` INT UNSIGNED default '0',
  `n_fxo_trunks` INT UNSIGNED default '0',
  `n_fxs_ext` INT UNSIGNED default '0',
  `description` varchar(50) default NULL,
  UNIQUE KEY `model_manufacturer` (`model`, `manufacturer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `gateway_models` WRITE;
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4552','Patton','isdn',0,1,0,0,'SMARTNODE ISDN 1 Porta');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4554','Patton','isdn',0,2,0,0,'SMARTNODE ISDN 2 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4638','Patton','isdn',0,4,0,0,'SMARTNODE ISDN 4 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4661','Patton','isdn',0,8,0,0,'SMARTNODE ISDN 8 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4112fxs','Patton','fxs',0,0,0,2,'SMARTNODE Analogico 2 Porte FXS');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4112fxo','Patton','fxo',0,0,2,0,'SMARTNODE Analogico 2 Porte FXO');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4114fxs','Patton','fxs',0,0,0,4,'SMARTNODE Analogico 4 Porte FXS');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4114fxo','Patton','fxo',0,0,4,0,'SMARTNODE Analogico 4 Porte FXO');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4526fxs','Patton','fxs',0,0,0,6,'SMARTNODE Analogico 6 Porte FXS');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4118fxs','Patton','fxs',0,0,0,8,'SMARTNODE Analogico 8 Porte FXS');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_FXO_2','Patton','fxo',0,0,2,0,'TRINITY Analogico 2 Porte FXO');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_FXO_4','Patton','fxo',0,0,4,0,'TRINITY Analogico 4 Porte FXO');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_FXO_8','Patton','fxo',0,0,8,0,'TRINITY Analogico 8 Porte FXO');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4970','Patton','pri',1,0,0,0,'SMARTNODE PRI 1 Porta');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('4970_4','Patton','pri',4,0,0,0,'SMARTNODE PRI 4 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_ISDN_1','Patton','isdn',0,1,0,0, 'TRINITY ISDN 1 Porta');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_ISDN_2','Patton','isdn',0,2,0,0, 'TRINITY ISDN 2 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_ISDN_4','Patton','isdn',0,4,0,0, 'TRINITY ISDN 4 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_PRI_1','Patton','pri',1,0,0,0, 'TRINITY PRI 1 Porta');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_PRI_2','Patton','pri',2,0,0,0, 'TRINITY PRI 2 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('TRI_PRI_4','Patton','pri',4,0,0,0, 'TRINITY PRI 4 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('Vega_50_24fxs','Sangoma','fxs',0,0,0,24,'Vega 3000 FXS 24 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('Vega_60_4fxo','Sangoma','fxo',0,0,4,0,'Vega 60 FXO 4 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('Vega_60_2isdn','Sangoma','isdn',0,2,0,0,'Vega 60 ISDN 2 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('Vega_60_4isdn','Sangoma','isdn',0,4,0,0,'Vega 60 ISDN 4 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('Vega_100_1pri','Sangoma','pri',1,0,0,0,'Vega 100 PRI 1 Porta');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('Vega_200_2pri','Sangoma','pri',2,0,0,0,'Vega 200 PRI 2 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('M4401','Mediatrix','isdn',0,1,0,0, '4401 ISDN 1 Porta');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('M4402','Mediatrix','isdn',0,2,0,0, '4402 ISDN 2 Porte');
INSERT IGNORE INTO `gateway_models` (`model`, `manufacturer`, `tech`, `n_pri_trunks`, `n_isdn_trunks`, `n_fxo_trunks`, `n_fxs_ext`, `description`) VALUES ('M4404','Mediatrix','isdn',0,4,0,0, '4404 ISDN 4 Porte');

UNLOCK TABLES;

CREATE TABLE IF NOT EXISTS `gateway_config` (
  `id` INT UNSIGNED AUTO_INCREMENT NOT NULL,
  `model_id` INT UNSIGNED NOT NULL default 0,
  `name` varchar(100) default NULL,
  `ipv4` varchar(20) default NULL,
  `ipv4_new` varchar(20) default NULL,
  `gateway` varchar(20) default NULL,
  `ipv4_green` varchar(20) default NULL,
  `netmask_green` varchar(20) default NULL,
  `mac` char(18) default NULL,
  UNIQUE `mac_key` (`mac`),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`model_id`) REFERENCES `gateway_models`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gateway_config_fxo` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_id` INT UNSIGNED NOT NULL default '0',
  `trunk` int(11) NOT NULL,
  `trunknumber` int(11) NOT NULL,
  `number` varchar(100) default NULL,
  `secret` varchar(10) default NULL,
  PRIMARY KEY  (`id`),
  FOREIGN KEY (`config_id`) REFERENCES `gateway_config`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gateway_config_isdn` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_id` INT UNSIGNED NOT NULL default '0',
  `trunk` int(11) NOT NULL,
  `trunknumber` int(11) NOT NULL,
  `protocol` varchar(3) default NULL,
  `secret` varchar(10) default NULL,
  PRIMARY KEY  (`id`),
  FOREIGN KEY (`config_id`) REFERENCES `gateway_config`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gateway_config_pri` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_id` INT UNSIGNED NOT NULL default '0',
  `trunk` int(11) NOT NULL,
  `trunknumber` int(11) NOT NULL,
  `secret` varchar(10) default NULL,
  PRIMARY KEY  (`id`),
  FOREIGN KEY (`config_id`) REFERENCES `gateway_config`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gateway_config_fxs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_id` INT UNSIGNED NOT NULL default '0',
  `extension` varchar(100) default NULL,
  `physical_extension` varchar(100) default NULL,
  `secret` varchar(100) default NULL,
  PRIMARY KEY  (`id`),
  FOREIGN KEY (`config_id`) REFERENCES `gateway_config`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


