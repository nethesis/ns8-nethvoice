<?php
#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once '/etc/freepbx_db.conf';

# TODO check if migration is needed. Exit 0 if not

# Add srtp column to rest_devices_phones
$db->query("ALTER TABLE `asterisk`.`rest_devices_phones` ADD COLUMN `srtp` BOOLEAN DEFAULT NULL AFTER `type`");



/* Convert existing srtp extensions to be used with proxy */

# get all NethVoice extensions with srtp enabled
$sql = "SELECT extension
		FROM `asterisk`.`rest_devices_phones` 
		JOIN `asterisk`.`sip` 
		ON `asterisk`.`rest_devices_phones`.`extension` = `asterisk`.`sip`.`id` 
		WHERE `type` = 'physical' 
		AND	`srtp` IS NULL 
		AND `keyword`='media_encryption' 
		AND `data`='sdes'";

$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
$extensions = array_column($res, 'extension');

if (count($extensions) > 0) {
	$qm_string = str_repeat('?, ', count($extensions) - 1) . '?';

	# set media_encryption to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'media_encryption' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute($extensions);

	# set srtp to true in rest_devices_phones table
	$sql = "UPDATE `asterisk`.`rest_devices_phones` SET `srtp` = 1 WHERE `extension` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute($extensions);

	# configure proxy on all FreePBX extensions
	$proxy_host = $_ENV['PUBLIC_IP'];
	$proxy_port = 5060;

	$sql = "UPDATE `asterisk`.`sip` SET `data` = ? WHERE `keyword` = 'outbound_proxy' AND `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute(array_merge(['sip:'.$proxy_host.':'.$proxy_port], $extensions));

	# set rtp_symmetric to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'rtp_symmetric' WHERE `id` IN ($qm_string)";
	$stmt = $db->prepare($sql);
	$stmt->execute($extensions);

	# set rewrite_contact to no in freepbx sip table
	$sql = "UPDATE `asterisk`.`sip` SET `data` = 'no' WHERE `keyword` = 'rewrite_contact' WHERE `id` IN ($qm_string)";
	$db->query($sql);
	$stmt = $db->prepare($sql);
	$stmt->execute($extensions);
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