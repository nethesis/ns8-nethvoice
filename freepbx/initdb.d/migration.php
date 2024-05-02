<?php
#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once '/etc/freepbx_db.conf';

# TODO check if migration is needed. Exit 0 if not

# Add srtp column to rest_devices_phones
$db->query("ALTER TABLE `asterisk`.`rest_devices_phones` ADD COLUMN `srtp` BOOLEAN DEFAULT NULL AFTER `type`");



/* Convert existing srtp physical and mobile extensions to be used with proxy */
# get all NethVoice extensions with srtp enabled
$sql = "SELECT extension,
        IF (`asterisk`.`sip`.`data` = 'sdes', true, false) AS `srtp`
        FROM `asterisk`.`rest_devices_phones`
        JOIN `asterisk`.`sip`
        ON `asterisk`.`rest_devices_phones`.`extension` = `asterisk`.`sip`.`id`
        WHERE ( `type` = 'physical' OR `type` = 'mobile' )
        AND	`srtp` IS NULL
        AND `keyword`='media_encryption'
        AND extension IS NOT NULL";

$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);

if (count($res) > 0) {
	$qm_string = str_repeat('?, ', count($res) - 1) . '?';

	# set media_encryption to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'media_encryption' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));

	# set srtp true or false in rest_devices_phones table
	$db->beginTransaction();
	$sql = "UPDATE `asterisk`.`rest_devices_phones` SET `srtp` = ? WHERE `extension` = ?";
	$stmt = $db->prepare($sql);
	foreach ($res as $row) {
	    $stmt->execute([$row['srtp'], $row['extension']]);
	}
	$db->commit();

	# configure proxy on all FreePBX extensions
	$proxy_host = $_ENV['PROXY_IP'];
	$proxy_port = $_ENV['PROXY_PORT'];

	$sql = "UPDATE `asterisk`.`sip` SET `data` = ? WHERE `keyword` = 'outbound_proxy' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_merge(['sip:'.$proxy_host.':'.$proxy_port], array_column($res, 'extension')));

	# set rtp_symmetric to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'rtp_symmetric' WHERE `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));

	# set rewrite_contact to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'rewrite_contact' WHERE `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));

	# set force_rport to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'force_rport' WHERE `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));

	# set transport to udp in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = '0.0.0.0-udp' WHERE `keyword` = 'transport' WHERE `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));
}

# migrate profiles, macro_permissions and permissions scheme to new format
# Check if NethVoice CTI macro_permission exists
$sql = "SELECT * FROM `rest_cti_macro_permissions` WHERE `macro_permission_id` = 12";
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
if (count($res) == 0) {
	# Add NethVoice CTI macro_permission
	$db->query("INSERT INTO `rest_cti_macro_permissions` VALUES (12,'nethvoice_cti','NethVoice CTI','Enables access to NethVoice CTI application')");
	# Add NethVoice CTI macro_permission to all existing profiles
	$db->query("INSERT INTO `rest_cti_profiles_macro_permissions` (`profile_id`, `macro_permission_id`) SELECT `id`, 12 FROM `rest_cti_profiles`");
}
# move pickup from presence_panel to settings
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 5 AND `permission_id` = 18");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (1,18);");
# move spy from presence_panel to settings
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 5 AND `permission_id` = 15");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (1,15);");
# move intrude from presence_panel to settings
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 5 AND `permission_id` = 16");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (1,16);");
# move phone_buttons from settings to nethvoice_cti
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 1 AND `permission_id` = 2000");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (12,2000);");
# move privacy from settings to nethvoice_cti
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 1 AND `permission_id` = 9");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (12,9);");
# move chat from settings to nethvoice_cti
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 1 AND `permission_id` = 8");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (12,8);");
# move screen_sharing from settings to nethvoice_cti
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 1 AND `permission_id` = 1000");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (12,1000);");
# move video_conference from settings to nethvoice_cti
$db->query("DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = 1 AND `permission_id` = 3000");
$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (12,3000);");

# change default host for nethcqr from localhost to 127.0.0.1:${NETHVOICE_MARIADB_PORT}
$db->query("UPDATE `asterisk`.`nethcqr_details` SET `db_url` = '127.0.0.1:{$_ENV['NETHVOICE_MARIADB_PORT']}' WHERE `db_url` = 'localhost'");
$db->query("UPDATE `asterisk`.`nethcqr_details` SET `cc_db_url` = '127.0.0.1:{$_ENV['NETHVOICE_MARIADB_PORT']}' WHERE `cc_db_url` = 'localhost'");

# Migrate old mobile app extensions to new Acrobit mobile app
$sip_options=[
	'force_rport' => 'no',
	'maximum_expiration' => '7200',
	'media_encryption' => 'no',
	'outbound_proxy' => 'sip:'.$_ENV['PROXY_IP'].':'.$_ENV['PROXY_PORT'],
	'qualifyfreq' => '60',
	'rewrite_contact' => 'no',
	'rtp_symmetric' => 'no',
	'transport' => '0.0.0.0-udp',
];

$sql = "SELECT extension
        FROM `asterisk`.`rest_devices_phones`
        WHERE `type` = 'mobile'
        AND extension IS NOT NULL";

$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
$extensions = array_column($res, 'extension');

if (count($extensions) > 0) {
	$qm_string = str_repeat('?, ',count($extensions) - 1) . '?';
	foreach ($sip_options as $sip_option => $value)	{
		$sql = "UPDATE `asterisk`.`sip` SET `data` = ? WHERE `keyword` = ? AND `id` IN ($qm_string)";
		$stmt = $db->prepare($sql);
		$stmt->execute(array_merge([$value,$sip_option],$extensions));
	}
}

# add nethlink table if not exist
$nethcti3db->query("CREATE TABLE IF NOT EXISTS `user_nethlink` (`user` varchar(255) NOT NULL UNIQUE,`extension` varchar(255) NOT NULL,`timestamp` varchar(255) DEFAULT NULL) ENGINE=MyISAM DEFAULT CHARSET=utf8");

// Add proxy field to gateway configuration if it doesn't exist
$sql = "SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'asterisk' AND TABLE_NAME = 'gateway_config' AND COLUMN_NAME = 'proxy'";
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
if (count($res) == 0) {
	$db->query("ALTER TABLE `asterisk`.`gateway_config` ADD COLUMN `proxy` VARCHAR(255) DEFAULT NULL AFTER `mac`");
	// set default proxy for all existing gateways
	$db->query("UPDATE `asterisk`.`gateway_config` SET `proxy` = 'sip:".$_ENV['PROXY_IP'].":".$_ENV['PROXY_PORT']."' WHERE `proxy` IS NULL");
	// set pbx ip to NETHVOICE_HOST
	$db->query("UPDATE `asterisk`.`gateway_config` SET `ipv4_green` = '".$_ENV['NETHVOICE_HOST']);
	# use bigger field for gateways ip fields to allow also the use of hostnames
	$db->query("ALTER TABLE `asterisk`.`gateway_config` MODIFY COLUMN `gateway` VARCHAR(255) DEFAULT NULL");
	$db->query("ALTER TABLE `asterisk`.`gateway_config` MODIFY COLUMN `ipv4` VARCHAR(255) DEFAULT NULL");
	$db->query("ALTER TABLE `asterisk`.`gateway_config` MODIFY COLUMN `ipv4_green` VARCHAR(255) DEFAULT NULL");
	$db->query("ALTER TABLE `asterisk`.`gateway_config` MODIFY COLUMN `ipv4_new` VARCHAR(255) DEFAULT NULL");
	$db->query("ALTER TABLE `asterisk`.`gateway_config_isdn` MODIFY COLUMN `secret` VARCHAR(255) DEFAULT NULL");
	$db->query("ALTER TABLE `asterisk`.`gateway_config_fxo` MODIFY COLUMN `secret` VARCHAR(255) DEFAULT NULL");

	// remove all but old gateways from gateway_config
	$db->query("DELETE FROM `asterisk`.`gateway_models`");
	$db->query('INSERT INTO `asterisk`.`gateway_models` (`id`,`model`,`manufacturer`,`tech`,`n_pri_trunks`,`n_isdn_trunks`,`n_fxo_trunks`,`n_fxs_ext`,`description`) VALUES
		(11,"TRI_FXO_2","Patton","fxo",0,0,2,0,"TRINITY Analogico 2 Porte FXO"),
		(12,"TRI_FXO_4","Patton","fxo",0,0,4,0,"TRINITY Analogico 4 Porte FXO"),
		(13,"TRI_FXO_8","Patton","fxo",0,0,8,0,"TRINITY Analogico 8 Porte FXO"),
		(16,"TRI_ISDN_1","Patton","isdn",0,1,0,0,"TRINITY ISDN 1 Porta"),
		(17,"TRI_ISDN_2","Patton","isdn",0,2,0,0,"TRINITY ISDN 2 Porte"),
		(18,"TRI_ISDN_4","Patton","isdn",0,4,0,0,"TRINITY ISDN 4 Porte"),
		(19,"TRI_PRI_1","Patton","pri",1,0,0,0,"TRINITY PRI 1 Porta"),
		(20,"TRI_PRI_2","Patton","pri",2,0,0,0,"TRINITY PRI 2 Porte"),
		(21,"TRI_PRI_4","Patton","pri",4,0,0,0,"TRINITY PRI 4 Porte"),
		(28,"M4401","Mediatrix","isdn",0,1,0,0,"4401 ISDN 1 Porta"),
		(29,"M4402","Mediatrix","isdn",0,2,0,0,"4402 ISDN 2 Porte"),
		(30,"M4404","Mediatrix","isdn",0,4,0,0,"4404 ISDN 4 Porte"),
		(31,"ht801","Grandstream","fxs",0,0,0,1,"HT801 SIP 1 Porta FXS"),
		(32,"ht801TLS","Grandstream","fxs",0,0,0,1,"HT801 SIP TLS 1 Porta FXS"),
		(33,"ht802","Grandstream","fxs",0,0,0,2,"HT802 SIP 2 Porte FXS"),
		(34,"ht802TLS","Grandstream","fxs",0,0,0,2,"HT802 SIP TLS 2 Porte FXS"),
		(35,"ht812","Grandstream","fxs",0,0,0,2,"HT812 SIP 2 Porte FXS"),
		(36,"ht812TLS","Grandstream","fxs",0,0,0,2,"HT812 SIP TLS 2 Porte FXS"),
		(37,"ht814","Grandstream","fxs",0,0,0,4,"HT814 SIP 4 Porte FXS"),
		(38,"ht814TLS","Grandstream","fxs",0,0,0,4,"HT814 SIP TLS 4 Porte FXS"),
		(39,"gxw4216","Grandstream","fxs",0,0,0,16,"GXW4216 SIP 16 Porte FXS"),
		(40,"gxw4216TLS","Grandstream","fxs",0,0,0,16,"GXW4216 SIP TLS 16 Porte FXS"),
		(41,"gxw4224","Grandstream","fxs",0,0,0,24,"GXW4224 SIP 24 Porte FXS"),
		(42,"gxw4224TLS","Grandstream","fxs",0,0,0,24,"GXW4224 SIP TLS 24 Porte FXS"),
		(43,"gxw4232","Grandstream","fxs",0,0,0,32,"GXW4216 SIP 32 Porte FXS"),
		(44,"gxw4232TLS","Grandstream","fxs",0,0,0,32,"GXW4232 SIP TLS 32 Porte FXS"),
		(45,"gxw4248","Grandstream","fxs",0,0,0,48,"GXW4216 SIP 48 Porte FXS"),
		(46,"gxw4248TLS","Grandstream","fxs",0,0,0,48,"GXW4216 SIP TLS 48 Porte FXS")'
	);
}


