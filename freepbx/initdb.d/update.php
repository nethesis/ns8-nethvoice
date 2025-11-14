<?php
#
# Copyright (C) 2025 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once '/etc/freepbx_db.conf';

# Create hotel cti context if not exist and NETHVOICE_HOTEL environment variable is set
# check if hotel profile exists
$sql = 'SELECT id FROM `asterisk`.`rest_cti_profiles` WHERE name = "Hotel"';
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
if (count($res) == 0 && !empty($_ENV['NETHVOICE_HOTEL']) && $_ENV['NETHVOICE_HOTEL'] == 'True') {
	# Install hotel context
	# create hotel profile
	$db->query('INSERT IGNORE INTO `asterisk`.`rest_cti_profiles` SET name = "Hotel"');
	# get hotel profile id;
	$stmt = $db->prepare('SELECT id FROM `asterisk`.`rest_cti_profiles` WHERE name = "Hotel"');
	$stmt->execute();
	$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
	$hotel_profile_id = $res[0]['id'];
	# add profile permissions and macro permissions to hotel profile
	$sql = 'INSERT IGNORE INTO `asterisk`.`rest_cti_profiles_permissions` (profile_id, permission_id) VALUES (?,?)';
	$stmt = $db->prepare($sql);
	$stmt->execute([$hotel_profile_id, 2]);
	$stmt->execute([$hotel_profile_id, 9]);
	$sql = 'INSERT IGNORE INTO `asterisk`.`rest_cti_profiles_macro_permissions` (profile_id, macro_permission_id) VALUES (?,?)';
	$stmt = $db->prepare($sql);
	foreach ([1, 2, 3, 4, 5, 6, 12] as $macro_permission_id) {
		$stmt->execute([$hotel_profile_id, $macro_permission_id]);
	}
	# assign users in hotel context to hotel profile
	#UPDATE rest_users SET profile_id = $PROFILE_ID WHERE user_id IN (SELECT DISTINCT user_id FROM rest_devices_phones WHERE extension IN ( SELECT \`id\` FROM sip WHERE \`keyword\`='context' AND \`data\` = 'hotel'))
	$sql = 'UPDATE `rest_users` SET profile_id = ? WHERE user_id IN (SELECT DISTINCT user_id FROM rest_devices_phones WHERE extension IN ( SELECT `id` FROM sip WHERE `keyword`="context" AND `data` = "hotel"))';
	$stmt = $db->prepare($sql);
	$stmt->execute([$hotel_profile_id]);
} elseif (count($res) > 0 && (empty($_ENV['NETHVOICE_HOTEL']) || $_ENV['NETHVOICE_HOTEL'] != 'True')) {
	# Remove hotel profile
	$hotel_profile_id = $res[0]['id'];
	# remove hotel profile permissions and macro permissions
	$sql = 'DELETE FROM `asterisk`.`rest_cti_profiles_permissions` WHERE profile_id = ?';
	$stmt = $db->prepare($sql);
	$stmt->execute([$hotel_profile_id]);
	$sql = 'DELETE FROM `asterisk`.`rest_cti_profiles_macro_permissions` WHERE profile_id = ?';
	$stmt = $db->prepare($sql);
	$stmt->execute([$hotel_profile_id]);
	# remove hotel profile
	$sql = 'DELETE FROM `asterisk`.`rest_cti_profiles` WHERE id = ?';
	$stmt = $db->prepare($sql);
	$stmt->execute([$hotel_profile_id]);
	# set 'Base' profile to all users with hotel profile
	$sql = 'UPDATE `asterisk`.`rest_users` SET profile_id = 1 WHERE profile_id = ?';
	$stmt = $db->prepare($sql);
	$stmt->execute([$hotel_profile_id]);
}

// Check if NETHVOICE_HOST changed and reset phones RPS if it has
$stmt = $db->prepare("SELECT `value` FROM `asterisk`.`admin` WHERE `variable` = 'NETHVOICE_HOST'");
$stmt->execute();
$res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
if (count($res) > 0 && $res[0]['value'] != $_ENV['NETHVOICE_HOST']) {
	// value exists and differ from current value, update phones RPS
	$output = [];
	$return_var = 0;
	exec("/var/www/html/freepbx/rest/lib/phonesRpsResetHelper.php --all", $output, $return_var);
	if ($return_var !== 0) {
		error_log("Failed to reset phones RPS: " . implode("\n", $output));
	}
}
$stmt = $db->prepare("DELETE IGNORE FROM `asterisk`.`admin` WHERE `variable` = 'NETHVOICE_HOST'");
$stmt->execute();
$stmt = $db->prepare("INSERT IGNORE INTO `asterisk`.`admin` (`variable`, `value`) VALUES ('NETHVOICE_HOST',?)");
$stmt->execute([$_ENV['NETHVOICE_HOST']]);

