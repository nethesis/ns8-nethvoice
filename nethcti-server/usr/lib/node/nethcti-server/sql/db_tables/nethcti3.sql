CREATE DATABASE IF NOT EXISTS nethcti3 DEFAULT CHARACTER SET = 'utf8';

USE nethcti3;

CREATE TABLE IF NOT EXISTS `caller_note` (
  `id` int(11) NOT NULL auto_increment,
  `creation` datetime NOT NULL,
  `text` varchar(255) default NULL,
  `creator` varchar(50) default NULL,
  `number` varchar(50) default NULL,
  `public` tinyint(1) default '0',
  `expiration` datetime NOT NULL default '0000-00-00 00:00:00',
  `reservation` tinyint(1) default '0',
  PRIMARY KEY  (`id`),
  KEY `index_creator` (`creator`),
  KEY `index_number` (`number`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `cti_phonebook` (
  `id` int(11) NOT NULL auto_increment,
  `owner_id` varchar(255) NOT NULL default '',
  `type` varchar(255) NOT NULL default '',
  `homeemail` varchar(255) default NULL,
  `workemail` varchar(255) default NULL,
  `homephone` varchar(25) default NULL,
  `workphone` varchar(25) default NULL,
  `cellphone` varchar(25) default NULL,
  `fax` varchar(25) default NULL,
  `title` varchar(255) default NULL,
  `company` varchar(255) default NULL,
  `notes` text,
  `name` varchar(255) default NULL,
  `homestreet` varchar(255) default NULL,
  `homepob` varchar(10) default NULL,
  `homecity` varchar(255) default NULL,
  `homeprovince` varchar(255) default NULL,
  `homepostalcode` varchar(255) default NULL,
  `homecountry` varchar(255) default NULL,
  `workstreet` varchar(255) default NULL,
  `workpob` varchar(10) default NULL,
  `workcity` varchar(255) default NULL,
  `workprovince` varchar(255) default NULL,
  `workpostalcode` varchar(255) default NULL,
  `workcountry` varchar(255) default NULL,
  `url` varchar(255) default NULL,
  `extension` varchar(255) default NULL,
  `speeddial_num` varchar(255) default NULL,
  PRIMARY KEY  (`id`),
  KEY `owner_idx` (`owner_id`),
  KEY `wemail_idx` (`workemail`),
  KEY `hemail_idx` (`homeemail`),
  KEY `name_idx` (`name`),
  KEY `hphone_idx` (`homephone`),
  KEY `wphone_idx` (`workphone`),
  KEY `cphone_idx` (`cellphone`),
  KEY `extension_idx` (`extension`),
  KEY `fax_idx` (`fax`),
  KEY `company_idx` (`company`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `postit` (
  `id` int(11) NOT NULL auto_increment,
  `text` varchar(255) default NULL,
  `creator` varchar(50) default NULL,
  `readdate` datetime default NULL,
  `recipient` varchar(50) default NULL,
  `creation` datetime NOT NULL,
  PRIMARY KEY  (`id`),
  KEY `index_creator` (`creator`),
  KEY `index_recipient` (`recipient`),
  KEY `index_readdate` (`readdate`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `sms_history` (
  `id` int(11) NOT NULL auto_increment,
  `sender` varchar(50) default NULL,
  `destination` varchar(50) default NULL,
  `text` varchar(165) default NULL,
  `date` datetime default NULL,
  `status` tinyint(1) default NULL,
  PRIMARY KEY  (`id`),
  KEY `sender_index` (`sender`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_settings` (
  `id` int(11) NOT NULL auto_increment,
  `username` varchar(50) NOT NULL,
  `key_name` varchar(50) NOT NULL,
  `value` MEDIUMTEXT default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `username_key_name` (`username`,`key_name`),
  KEY `index_username` (`username`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user_dbconn` (
  `id` int(11) NOT NULL auto_increment,
  `host` varchar(128) NOT NULL,
  `port` varchar(64) NOT NULL,
  `type` varchar(32) NOT NULL,
  `user` varchar(64) NOT NULL,
  `pass` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `creation` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `same_resource` (`host`,`port`,`user`,`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `customer_card` (
  `id` int(11) NOT NULL auto_increment,
  `name` varchar(128) NOT NULL,
  `creation` datetime NOT NULL,
  `query` text,
  `template` varchar(128) DEFAULT NULL,
  `dbconn_id` int(11) DEFAULT NULL,
  `permission_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `offhour_files` (
  `id` int(11) NOT NULL auto_increment,
  `username` varchar(50) NOT NULL,
  `description` varchar(50) NOT NULL,
  `privacy` varchar(50) NOT NULL,
  `creation` datetime NOT NULL,
  `path` varchar(250) NOT NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `path` (`path`),
  UNIQUE KEY `username_description` (`description`, `username`),
  KEY `index_username` (`username`),
  KEY `index_privacy` (`privacy`),
  KEY `index_description` (`description`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `auth` (
  `id` int(11) NOT NULL auto_increment,
  `token` varchar(255) NOT NULL,
  `user` varchar(64) NOT NULL,
  `creation` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user` (`user`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;