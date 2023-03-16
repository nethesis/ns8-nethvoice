/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;

/*!40103 SET TIME_ZONE='+00:00' */;
USE `phonebook`;
CREATE TABLE `phonebook` (
  id int(11) NOT NULL auto_increment,
  owner_id varchar(255) NOT NULL default '',
  type varchar(255) NOT NULL default '',
  homeemail varchar(255) default NULL,
  workemail varchar(255) default NULL,
  homephone varchar(25) default NULL,
  workphone varchar(25) default NULL,
  cellphone varchar(25) default NULL,
  fax varchar(25) default NULL,
  title varchar(255) default NULL,
  company varchar(255) default NULL,
  notes text,
  name varchar(255) default NULL,
  homestreet varchar(255) default NULL,
  homepob varchar(10) default NULL,
  homecity varchar(255) default NULL,
  homeprovince varchar(255) default NULL,
  homepostalcode varchar(255) default NULL,
  homecountry varchar(255) default NULL,
  workstreet varchar(255) default NULL,
  workpob varchar(10) default NULL,
  workcity varchar(255) default NULL,
  workprovince varchar(255) default NULL,
  workpostalcode varchar(255) default NULL,
  workcountry varchar(255) default NULL,
  url varchar(255) default NULL,
  sid_imported varchar(255) default NULL,
  PRIMARY KEY  (id),
  KEY owner_idx (owner_id),
  KEY wemail_idx (workemail),
  KEY hemail_idx (homeemail),
  KEY name_idx (name),
  KEY hphone_idx (homephone),
  KEY wphone_idx (workphone),
  KEY cphone_idx (cellphone),
  KEY fax_idx (fax),
  KEY company_idx (company)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
