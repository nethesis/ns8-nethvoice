USE `fias`;

CREATE TABLE IF NOT EXISTS `messagesparameters` (
  `mid` int(11) NOT NULL auto_increment,
  `msgid` int(11) NOT NULL,
  `param` char(2) collate latin1_general_ci NOT NULL,
  `value` varchar(50) collate latin1_general_ci default NULL,
  PRIMARY KEY  (`mid`),
  KEY `msgid` (`msgid`)
) ENGINE=MyISAM  DEFAULT CHARSET=latin1 COLLATE=latin1_general_ci;
