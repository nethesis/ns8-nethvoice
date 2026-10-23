<?php
#
# Copyright (C) 2025 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once '/etc/freepbx_db.conf';

// The image supplies SLN sounds. Avoid downloading other formats when
// soundlang updates the installed languages.
$db->exec("UPDATE `asterisk`.`soundlang_settings` SET `value` = 'sln' WHERE `keyword` = 'formats'");

// Remove malformed prompt filenames before soundlang is installed/upgraded by
// freepbx_init.sh. Older sound manifests imported description/blank lines with
// their trailing newline instead of valid sound filenames.
$db->exec('DELETE FROM `asterisk`.`soundlang_prompts` WHERE LOCATE(CHAR(10), `filename`) > 0');

// Shared FIAS rooms display all guest names in this field. The original
// 32-character limit is too short even for two ordinary guest names.
$sql = "SELECT CHARACTER_MAXIMUM_LENGTH
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'roomsdb' AND TABLE_NAME = 'rooms' AND COLUMN_NAME = 'text'";
$stmt = $db->query($sql);
$roomTextLength = $stmt->fetchColumn();
if ($roomTextLength !== false && (int)$roomTextLength < 255) {
	$db->exec('ALTER TABLE `roomsdb`.`rooms` MODIFY `text` varchar(255) DEFAULT NULL');
}

// Keep a database-enforced identity for groups created from FIAS GG. The
// nullable key lets manually managed groups continue to use the same name.
$sql = "SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'roomsdb' AND TABLE_NAME = 'room_groups'
          AND COLUMN_NAME = 'fias_guest_group_number'";
if ((int)$db->query($sql)->fetchColumn() === 0) {
	$db->exec('ALTER TABLE `roomsdb`.`room_groups` ADD COLUMN `fias_guest_group_number` varchar(100) DEFAULT NULL AFTER `note`');
}

// Preserve the deterministic first group used by previous PR builds. Any
// additional duplicate definitions remain unkeyed and are no longer selected
// by FIAS; their room assignments are reconciled by the next GI/GO event.
$db->exec("UPDATE `roomsdb`.`room_groups` AS `rg`
           INNER JOIN (
             SELECT `name`, MIN(`id`) AS `canonical_id`
             FROM `roomsdb`.`room_groups`
             WHERE `note` LIKE 'Created from FIAS guest group %'
             GROUP BY `name`
           ) AS `legacy`
             ON `legacy`.`canonical_id` = `rg`.`id`
           LEFT JOIN `roomsdb`.`room_groups` AS `keyed`
             ON `keyed`.`fias_guest_group_number` = `legacy`.`name`
           SET `rg`.`fias_guest_group_number` = `legacy`.`name`
           WHERE `rg`.`fias_guest_group_number` IS NULL
             AND `keyed`.`id` IS NULL");

$sql = "SELECT COUNT(*)
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = 'roomsdb' AND TABLE_NAME = 'room_groups'
          AND INDEX_NAME = 'unique_fias_guest_group_number'";
if ((int)$db->query($sql)->fetchColumn() === 0) {
	$db->exec('ALTER TABLE `roomsdb`.`room_groups` ADD UNIQUE KEY `unique_fias_guest_group_number` (`fias_guest_group_number`)');
}

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

// Add Audio Test feature code
$stmt = $db->prepare("INSERT IGNORE INTO `featurecodes` (`modulename`,`featurename`,`description`,`helptext`,`defaultcode`,`customcode`,`enabled`,`providedest`) VALUES ('nethcti3','audio_test','Audio Test','NethVoice CTI Audio Test','*41',NULL,1,0)");
$stmt->execute();

// Prefer header matching before IP so proxied static PJSIP trunks are identified
// from X-Forwarded-* headers. Accept both the original comma-separated default
// and the JSON array saved by the interface.
$pjsip_identifiers_order = json_encode(['header', 'ip', 'username', 'auth_username', 'anonymous']);
$stmt = $db->prepare("UPDATE `asterisk`.`kvstore_Sipsettings` SET `val` = ? WHERE `key` = 'pjsip_identifers_order' AND `val` IN ('ip,username,anonymous,auth_username', '[\"ip\",\"username\",\"anonymous\",\"header\",\"auth_username\"]')");
$stmt->execute([$pjsip_identifiers_order]);

// Disable automatic module updates and keep security updates in email-only mode.
$stmt = $db->prepare(
	"INSERT INTO `asterisk`.`kvstore_FreePBX` (`key`, `val`, `type`, `id`) VALUES (?, ?, NULL, 'updates')
	ON DUPLICATE KEY UPDATE `val` = VALUES(`val`), `type` = VALUES(`type`)"
);
foreach ([
	['auto_module_updates', 'disabled'],
	['auto_module_security_updates', 'emailonly'],
	['unsigned_module_emails', 'disabled'],
] as [$key, $value]) {
	$stmt->execute([$key, $value]);
}

// Rename the Satellite CTI permission displayname/description on existing
// installations. The migration.php script exits early once it has already run,
// so its UPDATE branch never reaches already-migrated installs; doing it here
// (update.php runs on every start and is idempotent) ensures the rename is
// applied everywhere. Kept before the multi-statement query below: after a
// multi-statement execute the PDO connection has pending result sets, which
// would make this query silently fail.
$stmt = $db->prepare("UPDATE `asterisk`.`rest_cti_permissions` SET `displayname` = 'Transcription and Summary', `description` = 'Calls transcription and summary' WHERE `id` = 5000 AND `displayname` = 'Speech-To-Text'");
$stmt->execute();

// Update outbound routes notification_on field
// If is set to "call" and there is an email address configured for that route,
// set it to "pattern", if no email is configured set it to empty.
// "call" option doesn't even works and breaks satellite real time transcription #7795
$sql = "SELECT COUNT(*) AS `required_tables`
	FROM `information_schema`.`TABLES`
	WHERE `TABLE_SCHEMA` = 'asterisk'
	AND `TABLE_NAME` IN ('outbound_routes', 'outbound_route_email')";
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetch(\PDO::FETCH_ASSOC);
if ((int) ($res['required_tables'] ?? 0) === 2) {
	$sql = "UPDATE `asterisk`.`outbound_routes` 
			SET `notification_on` = 'pattern' 
			WHERE `notification_on` = 'call' AND `route_id` IN (
				SELECT `route_id` 
				FROM `asterisk`.`outbound_route_email` 
				WHERE `emailto` LIKE '%@%');
			UPDATE `asterisk`.`outbound_routes` 
			SET `notification_on` = ''
			WHERE `route_id` NOT IN (
				SELECT `route_id` 
				FROM `asterisk`.`outbound_route_email` 
				WHERE `emailto` LIKE '%@%')";
	$stmt = $db->prepare($sql);
	$stmt->execute();
}

// The trunk name is also the Asterisk endpoint name. With a space, and no From
// User, Asterisk cannot build the OPTIONS qualify of the trunk ("Unable to
// create outbound OPTIONS request"), so a provider outage is never detected.
// Names with spaces still come from the FreePBX trunk page (it replaces spaces
// only in trunks.name), CSV imports, restores and NethServer 7 migrations.
// Every character not valid in a SIP URI becomes "_", the same rule of the
// wizard API (rest/modules/trunks.php). This runs before the reload of
// freepbx_init.sh. Routes refer to trunks by id and inbound trunks are matched
// by IP, so calls keep working; a custom dialplan that uses the old name must
// be fixed by hand.
try {
	$trunks = $db->query("SELECT `trunkid`, `channelid`, `name` FROM `asterisk`.`trunks` WHERE `tech` = 'pjsip'")->fetchAll(PDO::FETCH_NUM);
	$used = array_column($trunks, 1);
	foreach ($trunks as [$trunkid, $channelid, $name]) {
		$new_name = preg_replace('/[^A-Za-z0-9_.-]/', '_', $channelid);
		if ($new_name === $channelid && !preg_match('/[^A-Za-z0-9_.-]/', $name)) {
			continue;
		}
		if ($new_name !== $channelid && in_array($new_name, $used, true)) {
			$new_name .= '_' . $trunkid;
		}
		$used[] = $new_name;
		$db->prepare("UPDATE `asterisk`.`trunks` SET `channelid` = ?, `name` = ? WHERE `trunkid` = ?")->execute([$new_name, $new_name, $trunkid]);
		$db->prepare("UPDATE `asterisk`.`pjsip` SET `data` = ? WHERE `id` = ? AND `keyword` IN ('trunk_name', 'sv_channelid', 'sv_trunk_name')")->execute([$new_name, $trunkid]);
		if ($new_name === $channelid) {
			error_log("Trunk $trunkid: name '$name' set to '$new_name'");
		} else {
			error_log("Trunk $trunkid renamed from '$channelid' to '$new_name': check custom dialplan that uses the old name");
		}
	}
} catch (Exception $e) {
	error_log('Cannot check the trunk names: ' . $e->getMessage());
}
