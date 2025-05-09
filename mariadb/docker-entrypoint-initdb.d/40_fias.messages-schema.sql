USE `fias`;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` int(11) NOT NULL auto_increment,
  `cmd` char(2) collate latin1_general_ci NOT NULL,
  `dir` char(3) collate latin1_general_ci NOT NULL,
  `creationtime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `elaborationtime` timestamp NULL default NULL,
  `raw` varchar(500) collate latin1_general_ci default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=latin1 COLLATE=latin1_general_ci;
