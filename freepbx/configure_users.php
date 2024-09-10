<?php
#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once '/etc/freepbx_db.conf';

if (!isset($_ENV['NETHVOICE_LDAP_HOST'])
	|| !isset($_ENV['NETHVOICE_LDAP_PORT'])
	|| !isset($_ENV['NETHVOICE_LDAP_USER'])
	|| !isset($_ENV['NETHVOICE_LDAP_PASS'])
	|| !isset($_ENV['NETHVOICE_LDAP_SCHEMA'])
	|| !isset($_ENV['NETHVOICE_LDAP_BASE'])
) {
	// Disable NethServer userbase except for custom that are always ignored
	$sql = "UPDATE userman_directories SET `active` = 0 WHERE `name` LIKE 'NethServer%' AND `name` != 'NethServer8 [custom]'";
	$stmt = $db->prepare($sql);
	$stmt->execute();
	echo "NethServer8 LDAP configuration environment not setted. Any not-custom userbase disabled\n";
	exit(0);
}

// Get list of directories
$sql = "SELECT * FROM userman_directories WHERE `name` LIKE 'NethServer%'";
$stmt = $db->prepare($sql);
$stmt->execute();
$results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

if ($_ENV['NETHVOICE_LDAP_SCHEMA'] === 'ad') {
	# extract username and domain
	if (!preg_match('/DC=/i', $_ENV['NETHVOICE_LDAP_BASE'])) {
		echo "Invalid DOMAIN format\n";
		exit(1);
	} elseif (preg_match('/^([^@]*)@([^@]*)$/', $_ENV['NETHVOICE_LDAP_USER'],$tmp)) {
		# user: username@domain
		$username = $tmp[1];
	} elseif (preg_match('/^([^\\\\]*)\\\\([^\\\\]*)$/', $_ENV['NETHVOICE_LDAP_USER'],$tmp)) {
		# user: domain\username
		$username = $tmp[2];
	} elseif (preg_match('/^([^@]*)$/', $_ENV['NETHVOICE_LDAP_USER'],$tmp)) {
		# user: username
		$username = $tmp[1];
	}
	$ldap_settings = array(
		"host" => $_ENV['NETHVOICE_LDAP_HOST'],
		"port" => $_ENV['NETHVOICE_LDAP_PORT'],
		"dn" => $_ENV['NETHVOICE_LDAP_BASE'],
		"username" => $username,
		"password" => $_ENV['NETHVOICE_LDAP_PASS'],
		"domain" => preg_replace(['/DC=/i', '/,/i'], ['', '.'],$_ENV['NETHVOICE_LDAP_BASE']),
		"connection" => '',
		"localgroups" => '0',
		"createextensions" => '',
		"externalidattr" => 'objectGUID',
		"descriptionattr" => 'description',
		"commonnameattr" => 'cn',
		"userdn" => '',
		"userobjectclass" => 'user',
		"userobjectfilter" => '(&(objectClass=user)(objectCategory=person))',
		"usernameattr" => 'sAMAccountName',
		"userfirstnameattr" => 'givenName',
		"userlastnameattr" => 'sn',
		"userdisplaynameattr" => 'displayName',
		"usertitleattr" => 'personaltitle',
		"usercompanyattr" => 'company',
		"usercellphoneattr" => 'mobile',
		"userworkphoneattr" => 'telephoneNumber',
		"userhomephoneattr" => 'homephone',
		"userfaxphoneattr" => 'facsimileTelephoneNumber',
		"usermailattr" => 'mail',
		"usergroupmemberattr" => 'memberOf',
		"la" => '',
		"groupdnaddition" => '',
		"groupobjectclass" => 'group',
		"groupobjectfilter" => '(objectCategory=Group)',
		"groupmemberattr" => 'member',
		"sync" => '0 * * * *'
	);
	$driver = 'Msad2';
} else {
	$ldap_settings = array(
		"host" => $_ENV['NETHVOICE_LDAP_HOST'],
		"port" => $_ENV['NETHVOICE_LDAP_PORT'],
		"basedn" => $_ENV['NETHVOICE_LDAP_BASE'],
		"username" => $_ENV['NETHVOICE_LDAP_USER'],
		"password" => $_ENV['NETHVOICE_LDAP_PASS'],
		"displayname" => 'displayName',
		"userdn" => 'ou=People',
		"connection" => '',
		"localgroups" => '0',
		"createextensions" => '',
		"externalidattr" => 'entryUUID',
		"descriptionattr" => 'description',
		"commonnameattr" => 'uid',
		"userobjectclass" => 'posixAccount',
		"userobjectfilter" => '(&(objectclass=posixAccount)(!(uid=domguests))(!(uid=domcomputers))(!(uid=nsstest))(!(uid=locals))(!(uid=domadmins)))',
		"usernameattr" => 'uid',
		"userfirstnameattr" => 'givenName',
		"userlastnameattr" => 'sn',
		"userdisplaynameattr" => 'displayName',
		"usertitleattr" => '',
		"usercompanyattr" => '',
		"usercellphoneattr" => '',
		"userworkphoneattr" => 'telephoneNumber',
		"userhomephoneattr" => 'homephone',
		"userfaxphoneattr" => 'facsimileTelephoneNumber',
		"usermailattr" => 'mail',
		"usergroupmemberattr" => 'memberOf',
		"la" => '',
		"groupnameattr" => 'cn',
		"groupdnaddition" => 'ou=Groups',
		"groupobjectclass" => 'posixGroup',
		"groupobjectfilter" => '(objectclass=posixGroup)',
		"groupmemberattr" => 'memberUid',
		"sync" => '0 * * * *',
		"driver" => 'Openldap2',
	);
	$driver = 'Openldap2';
}

if (empty($results)) {
	// Not configured
	echo "Userbase not configured. Creating a new one...\n";
	$sql = "INSERT INTO `userman_directories` (`name`, `driver`, `active`, `order`, `default`, `locked`) VALUES ('NethServer8',?,1,5,1,0)";
	$stmt = $db->prepare($sql);
	$stmt->execute([$driver]);
	$id = $db->lastInsertId();
	$ldap_settings['name'] = 'NethServer8';
} else {
	// If userbase is "custom" exit without changes
	if ($results[0]['name'] === 'NethServer8 [custom]') {
		echo "Custom NethServer 8 userbase already configured. Exit\n";
		exit (0);
	}

	$id = $results[0]['id'];
	$sql = "UPDATE IGNORE `userman_directories` SET `name`= ?, `driver` = ?, `active` = 1, `order` = 5, `default` = 1, `locked` = 0 WHERE `id` = ?";
	$stmt = $db->prepare($sql);

	if ($results[0]['name'] === 'NethServer AD' || $results[0]['name'] === 'NethServer LDAP') {
		// Default NethServer7
		$ldap_settings['name'] = 'NethServer8';
		echo "Default NethServer 7 userbase found. Migrating it to NethServer 8...\n";
	} elseif (strpos($results[0]['name'],'NethServer ') === 0) {
		echo "Custom NethServer 7 userbase found. Migrating it to NethServer 8...\n";
		// Custom NethServer7
		$ldap_settings['name'] = 'NethServer8 [custom]';
		// get old User Object Filter
		$sql = "SELECT `val` FROM `kvstore_FreePBX_modules_Userman` WHERE `id` = ?";
		$stmt = $db->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchAll(\PDO::FETCH_ASSOC)[0];
		$old_data = json_decode($results);
		$ldap_settings['userobjectfilter'] = $old_data['userobjectfilter'];
	} else {
		// NethServer8 default,
		echo "Default NethServer 8 userbase found...\n";
		$ldap_settings['name'] = 'NethServer8';
	}
	$stmt->execute([$ldap_settings['name'], $driver, $id]);
}

$sql = "DELETE FROM kvstore_FreePBX_modules_Userman WHERE `id` = ? ; INSERT INTO kvstore_FreePBX_modules_Userman (`key`, `val`, `type`, `id`) VALUES ('auth-settings',?,'json-arr',?)";
$stmt = $db->prepare($sql);
$stmt->execute([$id, json_encode($ldap_settings), $id]);
echo $ldap_settings['name'] . " userbase configuration: " . json_encode($ldap_settings) . "\n";

// Check if domain changed and clean extensions
$stmt = $db->prepare('SELECT `value` FROM `freepbx_settings` WHERE `keyword` = "USER_DOMAIN"');
$stmt->execute();
$old_domain = $stmt->fetchColumn();

// this array list all tables => [fields] that could contain an extension as destination
$extensions_destinations_table_field = array(
	'announcement' => ['post_dest'],
	'daynight' => ['dest'],
	'findmefollow' => ['postdest'],
	'incoming' => ['destination'],
	'ivr_details' => ['invalid_destination','timeout_destination'],
	'ivr_entries' => ['dest'],
	'nethcqr_details' => ['default_destination'],
	'nethcqr_entries' => ['destination'],
	'parkplus' => ['dest'],
	'queueexit' => ['timeout_destination','full_destination','joinempty_destination','leaveempty_destination','joinunavail_destination','leavunavail_destination','continue_destination'],
	'queues_config' => ['dest'],
	'ringgroups' => ['postdest'],
	'timeconditions' => ['truegoto','falsegoto'],
);

if (empty($old_domain) && !empty($_ENV['USER_DOMAIN'])) {
	$db->prepare('INSERT IGNORE INTO `freepbx_settings` (`keyword`, `value`, `name`, `level`, `description`, `type`, `options`, `defaultval`,`readonly`,`hidden`,`category`,`module`,`emptyok`,`sortorder`) VALUES ("USER_DOMAIN", ?, "Name of NethVoice user base domain", 0, "This is automatically configured at FreePBX container startup using environment NETHVOICE_LDAP_ variables", "text", "", "",1,1,"System Setup","",1,0)')->execute([$_ENV['USER_DOMAIN']]);
} elseif ($old_domain !== $_ENV['USER_DOMAIN']) {
	$db->prepare('UPDATE `freepbx_settings` SET `value` = ? WHERE `keyword` = "USER_DOMAIN"')->execute([$_ENV['USER_DOMAIN']]);
	// Clean extensions
	$stmt = $db->prepare('SELECT `extension` FROM `users`');
	$stmt->execute();
	$extensions = $stmt->fetchAll(\PDO::FETCH_COLUMN);
	foreach ($extensions as $extension) {
		$db->prepare('DELETE IGNORE FROM `users` WHERE `extension` = ?')->execute([$extension]);
		$db->prepare('DELETE IGNORE FROM `sip` WHERE `id` = ?')->execute([$extension]);
		$db->prepare('DELETE IGNORE FROM `rest_devices_phones` WHERE `extension` = ?')->execute([$extension]);
		$db->prepare('DELETE IGNORE FROM `devices` WHERE `id` = ?')->execute([$extension]);
		// change destinations that has extensions to app-blackhole,hangup,1
		foreach ($extensions_destinations_table_field as $table => $fields) {
			foreach ($fields as $field) {
				$db->prepare('UPDATE `' . $table . '` SET `' . $field . '` = "app-blackhole,hangup,1" WHERE `' . $field . '` = ? OR `' . $field . '` = ? OR `' . $field . '` = ?')->execute(['from-did-direct,'.$extension.',1','ext-local,'.$extension.',1', 'ext-local,vms'.$extension.',1']);
			}
		}
	}
	//remove all extensions from groups
	$db->prepare('UPDATE `groups` SET `grplist` = ""')->execute();
	//remove all extensions from queues members
	$db->prepare('DELETE IGNORE FROM `queues_details` WHERE `keyword` = "member" AND `data` LIKE "Local/%@%"')->execute();
}
