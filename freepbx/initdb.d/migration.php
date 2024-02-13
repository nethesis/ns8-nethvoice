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