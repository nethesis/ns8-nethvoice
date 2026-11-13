<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

global $db;
global $amp_conf;

$freepbx_conf =& freepbx_conf::create();
$set=[];
$set['value'] = true;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 0;
$set['module'] = '';
$set['category'] = 'Dialplan and Operational';
$set['emptyok'] = 1;
$set['sortorder'] = 0;
$set['name'] = 'Attended Transfer Caller ID Override';
$set['description'] = 'Use transferor\'s extension number when doing an attended transfer of an external outgoing call';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('ATX_CID_OVERRIDE',$set,true);

$sql='
    CREATE TABLE IF NOT EXISTS `offhour` (
      `id` int(11) NOT NULL auto_increment,
      `displayname` varchar(50) default NULL,
      `didcidnum` varchar(20) default NULL,
      `didextension` varchar(20) default NULL,
      `tsbegin` int(10) unsigned default 0,
      `tsend` int(10) unsigned default 0,
      `message` varchar(500) default NULL,
      `action` int(1) DEFAULT NULL,
      `param` varchar(50) DEFAULT NULL,
      `destination` varchar(500) DEFAULT "",
      `enabled` tinyint(1) DEFAULT "0",
      PRIMARY KEY  (`id`)
   ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
';

$check = $db->query($sql);
if(DB::IsError($check)) {
    die_freepbx("Can not create inboundlookup table\n");
}


$sql='
    CREATE TABLE IF NOT EXISTS `rest_orphan_extensions` (
      `id` int(11) NOT NULL auto_increment,
      `user_id` int(11) NOT NULL,
      `username` varchar(255) NOT NULL,
      `displayname` varchar(255) NOT NULL DEFAULT "",
      `extension` varchar(16) NOT NULL,
      `devices` text NOT NULL,
      `secrets` text NOT NULL,
      `profile_id` int(11) DEFAULT NULL,
      `cti_groups` text NOT NULL,
      `removed_at` int(10) unsigned NOT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `extension` (`extension`),
      KEY `username` (`username`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
';

$check = $db->query($sql);
if(DB::IsError($check)) {
    die_freepbx("Can not create rest_orphan_extensions table\n");
}
