SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";

CREATE DATABASE IF NOT EXISTS `fias_server` DEFAULT CHARACTER SET latin1 COLLATE latin1_general_ci;
USE `fias_server`;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` int(11) NOT NULL auto_increment,
  `cmd` char(2) collate latin1_general_ci NOT NULL,
  `dir` char(3) collate latin1_general_ci NOT NULL,
  `creationtime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `elaborationtime` timestamp NULL default NULL,
  `raw` varchar(500) collate latin1_general_ci default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=latin1 COLLATE=latin1_general_ci AUTO_INCREMENT=478 ;

CREATE TABLE IF NOT EXISTS `messagesparameters` (
  `mid` int(11) NOT NULL auto_increment,
  `msgid` int(11) NOT NULL,
  `param` char(2) collate latin1_general_ci NOT NULL,
  `value` varchar(50) collate latin1_general_ci default NULL,
  PRIMARY KEY  (`mid`),
  KEY `msgid` (`msgid`)
) ENGINE=MyISAM  DEFAULT CHARSET=latin1 COLLATE=latin1_general_ci AUTO_INCREMENT=1762 ;

CREATE TABLE IF NOT EXISTS `reservations` (
  `room_number` int(8) NOT NULL,
  `reservation_number` int(10) PRIMARY KEY ,
  `guest_name` varchar(40) default NULL,
  `guest_language` varchar(2) default 'EA',
  `share_flag` char (1) default 'N',
  `checkindate` timestamp default CURRENT_TIMESTAMP,
  `checkoutdate` timestamp
);

GRANT ALL PRIVILEGES 
ON fias_server.*
TO fias@localhost;

FLUSH privileges;


