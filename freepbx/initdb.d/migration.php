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

	# set rtp_symmetric to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'rtp_symmetric' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));

	# set rewrite_contact to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'rewrite_contact' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));

	# set force_rport to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'force_rport' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));

	# set transport to udp in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = '0.0.0.0-udp' WHERE `keyword` = 'transport' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_column($res, 'extension'));
}

# set allowed video codecs in freepbx sip table, only for configured pjsip extensions
$sql = "SELECT extension FROM `asterisk`.`rest_devices_phones`";
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);

if (count($res) > 0) {
	foreach ($res as $row) {
		$sql = "UPDATE `asterisk`.`sip` SET `data` = 'ulaw,alaw,gsm,g726,vp8' WHERE `keyword` = 'allow' AND `id` = ?";
		$stmt = $db->prepare($sql);
		$stmt->execute([$row['extension']]);
	}
}

# set allowed video codecs in freepbx sipsettings table
$db->query("UPDATE `asterisk`.`sipsettings` SET `data` = '{\"vp8\":1, \"h264\":2}' WHERE `keyword` = 'videocodecs'");
$db->query("UPDATE `asterisk`.`sipsettings` SET `data` = 'yes' WHERE `keyword` = 'videosupport'");
$db->query("UPDATE `asterisk`.`kvstore_Sipsettings` SET `val` = '{\"vp8\":1,\"h264\":2}' WHERE `key` = 'videocodecs'");
$db->query("UPDATE `asterisk`.`kvstore_Sipsettings` SET `val` = 'yes' WHERE `key` = 'videosupport'");

/* Set outbound_proxy to all physical and mobile extensions to be used with proxy */
$sql = "UPDATE `asterisk`.`sip`
	JOIN `asterisk`.`rest_devices_phones`
	ON `sip`.`id` = `rest_devices_phones`.`extension`
	SET `sip`.`data` = ?
	WHERE `sip`.`keyword` = 'outbound_proxy'
	AND `rest_devices_phones`.`type` IN ('physical', 'mobile', 'customphysical')";

$stmt = $db->prepare($sql);
$stmt->execute(['sip:'.$_ENV['PROXY_IP'].':'.$_ENV['PROXY_PORT'].';lr']);
$sql = "UPDATE `asterisk`.`pjsip`
	SET `pjsip`.`data` = ?
	WHERE `pjsip`.`keyword` = 'outbound_proxy'
	AND `pjsip`.`id` IN (
		SELECT `id`
		FROM `asterisk`.`pjsip` as pjsip_inner
		WHERE `pjsip_inner`.`keyword` = 'trunk_name'
		AND `pjsip_inner`.`data` NOT LIKE '%custom%'
		AND `pjsip_inner`.`data` NOT LIKE '%identity0%'
	)";

$stmt = $db->prepare($sql);
$stmt->execute(['sip:'.$_ENV['PROXY_IP'].':'.$_ENV['PROXY_PORT'].';lr']);
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

# migrate MeetMe to ConfBridge
$db->query("UPDATE `asterisk`.`featurecodes` SET `featurename` = 'confbridge_conf' WHERE `featurename` = 'meetme_conf'");

# Migrate old mobile app extensions to new Acrobit mobile app
$sip_options=[
	'force_rport' => 'no',
	'maximum_expiration' => '7200',
	'media_encryption' => 'no',
	'outbound_proxy' => 'sip:'.$_ENV['PROXY_IP'].':'.$_ENV['PROXY_PORT'].';lr',
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
	$db->query("ALTER TABLE `asterisk`.`gateway_config_pri` MODIFY COLUMN `secret` VARCHAR(255) DEFAULT NULL");

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

/* Migrate NethCQR */
# change default configuration for phonebook database
$sql = "UPDATE `asterisk`.`nethcqr_details` SET `db_url` = ?, `db_name` = ?, `db_user` = ?, `db_pass` = ?  WHERE `db_url` = 'localhost' AND `db_name` = 'phonebook' AND `db_user` = 'pbookuser'";
$stmt = $db->prepare($sql);
$stmt->execute([$_ENV['PHONEBOOK_DB_HOST'].':'.$_ENV['PHONEBOOK_DB_PORT'],$_ENV['PHONEBOOK_DB_NAME'],$_ENV['PHONEBOOK_DB_USER'],$_ENV['PHONEBOOK_DB_PASS']]);

# do the same also for cc_... fields
$sql = "UPDATE `asterisk`.`nethcqr_details` SET `cc_db_url` = ?, `cc_db_name` = ?, `cc_db_user` = ?, `cc_db_pass` = ?  WHERE `cc_db_url` = 'localhost' AND `cc_db_name` = 'phonebook' AND `cc_db_user` = 'pbookuser'";
$stmt = $db->prepare($sql);
$stmt->execute([$_ENV['PHONEBOOK_DB_HOST'].':'.$_ENV['PHONEBOOK_DB_PORT'],$_ENV['PHONEBOOK_DB_NAME'],$_ENV['PHONEBOOK_DB_USER'],$_ENV['PHONEBOOK_DB_PASS']]);

# change default configuration for local databases
$sql = "UPDATE `asterisk`.`nethcqr_details` SET `db_url` = ? WHERE `db_url` = 'localhost'";
$stmt = $db->prepare($sql);
$stmt->execute(['127.0.0.1:'.$_ENV['NETHVOICE_MARIADB_PORT']]);

# do the same also for cc_... fields
$sql = "UPDATE `asterisk`.`nethcqr_details` SET `cc_db_url` = ? WHERE `cc_db_url` = 'localhost'";
$stmt = $db->prepare($sql);
$stmt->execute(['127.0.0.1:'.$_ENV['NETHVOICE_MARIADB_PORT']]);

# Create pjsip trunks custom flags table if not exist
# create NethCTI3 configuration table if not exist
$sql = "CREATE TABLE IF NOT EXISTS `kvstore_FreePBX_modules_Nethcti3` (
	`key` char(255) COLLATE utf8mb4_unicode_ci NOT NULL,
	`val` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
	`type` char(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
	`id` char(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
	UNIQUE KEY `uniqueindex` (`key`(190),`id`(190)),
	KEY `keyindex` (`key`(190)),
	KEY `idindex` (`id`(190))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
$stmt = $db->prepare($sql);
$stmt->execute();
# check if table exists
$sql = "SELECT * FROM information_schema.tables WHERE TABLE_SCHEMA = 'asterisk' AND TABLE_NAME = 'pjsip_trunks_custom_flags'";
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
if (count($res) == 0) {
	// Create table and add default values
	$db->query("CREATE TABLE `rest_pjsip_trunks_custom_flags` (
  		`provider_id` bigint(20) NOT NULL,
		`keyword` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
		`value` TINYINT(1) NOT NULL DEFAULT 0,
		PRIMARY KEY (`provider_id`,`keyword`)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"	);
	$db->query("INSERT INTO `rest_pjsip_trunks_custom_flags` (`provider_id`, `keyword`, `value`) VALUES
		(1,'disable_topos_header',0),
		(2,'disable_topos_header',0),
		(3,'disable_topos_header',0),
		(4,'disable_topos_header',0),
		(5,'disable_topos_header',0),
		(6,'disable_topos_header',0),
		(7,'disable_topos_header',0),
		(8,'disable_topos_header',0),
		(9,'disable_topos_header',0),
		(10,'disable_topos_header',0),
		(11,'disable_topos_header',0),
		(12,'disable_topos_header',0),
		(13,'disable_topos_header',0),
		(14,'disable_topos_header',0),
		(15,'disable_topos_header',0),
		(16,'disable_topos_header',0),
		(17,'disable_topos_header',0),
		(18,'disable_topos_header',0),
		(19,'disable_topos_header',0),
		(20,'disable_topos_header',0),
		(21,'disable_topos_header',0),
		(22,'disable_topos_header',0),
		(23,'disable_topos_header',0),
		(24,'disable_topos_header',0),
		(25,'disable_topos_header',0),
		(1,'disable_srtp_header',1),
		(2,'disable_srtp_header',1),
		(3,'disable_srtp_header',0),
		(4,'disable_srtp_header',1),
		(5,'disable_srtp_header',1),
		(6,'disable_srtp_header',1),
		(7,'disable_srtp_header',1),
		(8,'disable_srtp_header',1),
		(9,'disable_srtp_header',1),
		(10,'disable_srtp_header',0),
		(11,'disable_srtp_header',1),
		(12,'disable_srtp_header',1),
		(13,'disable_srtp_header',1),
		(14,'disable_srtp_header',1),
		(15,'disable_srtp_header',1),
		(16,'disable_srtp_header',1),
		(17,'disable_srtp_header',1),
		(18,'disable_srtp_header',1),
		(19,'disable_srtp_header',1),
		(20,'disable_srtp_header',1),
		(21,'disable_srtp_header',1),
		(22,'disable_srtp_header',1),
		(23,'disable_srtp_header',1),
		(24,'disable_srtp_header',1);
	");
}
// Add disable_srtp_header configuration for existing trunks that doesn't have media encription enabled and proxy configured
$sql = "SELECT DISTINCT id
	FROM pjsip
	WHERE id IN (
		SELECT id
		FROM pjsip
		WHERE keyword = 'media_encryption' AND data = 'no'
		)
	AND id IN (
		SELECT id
		FROM pjsip
		WHERE keyword = 'outbound_proxy' AND data IS NOT NULL AND data != ''
		)";
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
$trunk_ids = array_column($res, 'id');
foreach ($trunk_ids as $trunk_id) {
	$sql = "INSERT IGNORE INTO `kvstore_FreePBX_modules_Nethcti3` (`key`, `val`,`id`) VALUES ('disable_srtp_header','1',?)";
	$stmt = $db->prepare($sql);
	$stmt->execute([$trunk_id]);
}

# Check if all_groups permission exists
$sql = "SELECT * FROM `rest_cti_permissions` WHERE `id` = 3500";
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
if (count($res) == 0) {
	# Add all_groups permission
	$db->query("INSERT INTO `rest_cti_permissions` VALUES (3500,'all_groups','All groups','Allow to see all groups and operators')");
	# Place all_groups permission inside presence panel
	$db->query("INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`,`permission_id`) VALUES (5,3500)");
	# Add all_groups permission to all profiles for retrocompatibility: before the creation of the permission any user could see all groups
	$db->query("INSERT INTO `rest_cti_profiles_permissions` (`profile_id`,`permission_id`) VALUES
		(1,3500),
		(2,3500),
		(3,3500);
	");
}
