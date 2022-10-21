<?php
#
#    Copyright (C) 2017 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of CQR.
#
#    CQR is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    CQR is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with CQR.  If not, see <http://www.gnu.org/licenses/>.
#

global $db;

$check = $db->getRow('SELECT `use_workphone` from `nethcqr_details` ');
if(DB::IsError($check)) {
    $check = $db->getAll('DESCRIBE nethcqr_details',DB_FETCHMODE_ASSOC);
    if(!DB::IsError($check)){
        $db->query('ALTER TABLE `nethcqr_details` ADD COLUMN `use_workphone` BOOLEAN default TRUE AFTER manual_code');
    }
}

$sqls[] = "CREATE TABLE IF NOT EXISTS `nethcqr_details` (
  `id_cqr` int(11) NOT NULL auto_increment,
  `name` varchar(60) NOT NULL UNIQUE,
  `description` varchar(120) default NULL,
  `announcement` int(11),
  `use_code` BOOLEAN default FALSE,
  `manual_code` BOOLEAN default FALSE, 
  `use_workphone` BOOLEAN default TRUE, 
  `cod_cli_announcement` int(11) DEFAULT NULL,
  `err_announcement` int(11) DEFAULT NULL,
  `code_length` int(2) default 5,
  `code_retries` int(1) default 3,
  `db_type` varchar(30) default 'mysql',
  `db_url` varchar(60) default 'localhost',
  `db_name` varchar(30) default NULL,
  `db_user` varchar(30) default NULL,
  `db_pass` varchar(90) default NULL,
  `query` text(8000) default NULL,
  `cc_db_type` varchar(30) default 'mysql',
  `cc_db_url` varchar(60) default 'localhost',
  `cc_db_name` varchar(30) default NULL,
  `cc_db_user` varchar(30) default NULL,
  `cc_db_pass` varchar(90) default NULL,
  `cc_query` text(8000) default NULL,
  `ccc_query` text(8000) default NULL,
  `default_destination` varchar(50) default NULL,
  PRIMARY KEY  (`id_cqr`)
)";
$sqls[] = "CREATE TABLE IF NOT EXISTS `nethcqr_entries` (
  `id_dest` int(11) NOT NULL auto_increment,
  `id_cqr` int(11) NOT NULL,
  `position` int(11),
  `condition` text(8000) default NULL,
  `destination` varchar(50) default NULL,
  PRIMARY KEY  (`id_dest`)
)";

foreach ($sqls as $sql) {
    $res = $db->query($sql);
    if(DB::IsError($res)){
        error_log('FAIL creating CQR DB tables');
    }
}
