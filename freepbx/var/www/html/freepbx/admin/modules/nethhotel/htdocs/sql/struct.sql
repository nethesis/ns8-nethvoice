create database if not exists roomsdb;
use mysql;
grant all on roomsdb.* to 'freepbxuser';
flush privileges;

use roomsdb;

CREATE TABLE IF NOT EXISTS `alarms` (
  `extension` int(11) NOT NULL default '0',
  `hour` time NOT NULL default '00:00:00',
  `start` date default NULL,
  `end` date default NULL,
  `enabled` tinyint(1) default '0',
  PRIMARY KEY  (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `alarms_history` (
  `calldate` datetime NOT NULL default '0000-00-00 00:00:00',
  `extension` int(11) NOT NULL default '0',
  `alarm` varchar(20) NOT NULL default '0000-00-00 00:00:00',
  `retry` tinyint(1) default '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `codes` (
  `id` int(11) NOT NULL auto_increment,
  `code` int(5) NOT NULL default '0',
  `number` int(11) NOT NULL default '0',
  `note` varchar(255) NOT NULL default '',
  `id_timegroups_groups` int(11) NOT NULL default 0,
  `falsegoto` varchar(50) default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `extra` (
  `id` int(11) NOT NULL auto_increment,
  `name` varchar(50) NOT NULL,
  `price` float NOT NULL default '0',
  `code` int(5) NOT NULL,
  `enabled` tinyint(1) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `extra_history` (
  `extension` int(11) NOT NULL,
  `id` int(11) NOT NULL,
  `date` datetime default NULL,
  `name` varchar(50) NOT NULL,
  `price` float default '0',
  `number` int(3) NOT NULL,
  `checkout` tinyint(1) NOT NULL,
  KEY `extension` (`extension`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `history` (
  `extension` int(11) default NULL,
  `start` datetime default NULL,
  `end` datetime default NULL,
  UNIQUE KEY `k` (`extension`,`start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `options` (
  `variable` varchar(100) default NULL,
  `value` varchar(100) default NULL,
  UNIQUE KEY `u` (`variable`,`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rates` (
  `id` int(11) NOT NULL auto_increment,
  `name` varchar(50) NOT NULL default '',
  `duration` int(11) NOT NULL default '0',
  `price` float NOT NULL default '0',
  `answer_duration` int(11) NOT NULL default '0',
  `answer_price` float NOT NULL default '0',
  `pattern` varchar(100) NOT NULL default '',
  `enabled` tinyint(1) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rooms` (
  `extension` int(11) NOT NULL default '0',
  `start` timestamp NOT NULL default '0000-00-00 00:00:00',
  `group` int(11) default NULL,
  `clean` tinyint(1) NOT NULL default '0',
  `text` varchar(32) default NULL,
  `lang` varchar(5) default NULL,
  PRIMARY KEY  (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `room_groups` (
  `id` int(11) NOT NULL auto_increment,
  `name` varchar(100) NOT NULL default '',
  `note` varchar(255) NOT NULL default '',
  `groupcalls` tinyint(1),
  `roomscalls` tinyint(1),
  `externalcalls` tinyint(1),
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `groups_rooms` (
  `group_id` int(11) NOT NULL,
  `extension` int(11) NOT NULL,
  PRIMARY KEY (`group_id`,`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `alarmcalls` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` int(11) NOT NULL DEFAULT '0',
  `extension` int(11) NOT NULL DEFAULT '0',
  `enabled` tinyint(1) DEFAULT '1',
  `alarmtype` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
)
