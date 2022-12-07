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
	exit(0);
}

// Get list of directories
$sql = "SELECT * FROM userman_directories WHERE `name` LIKE 'NethServer%'";
$stmt = $db->prepare($sql);
$stmt->execute();
$results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

$ldap_settings = array(
	"host" => $_ENV['NETHVOICE_LDAP_HOST'],
	"port" => $_ENV['NETHVOICE_LDAP_PORT'],
	"basedn" => $_ENV['NETHVOICE_LDAP_BASE'],
	"username" => $_ENV['NETHVOICE_LDAP_USER'],
	"password" => $_ENV['NETHVOICE_LDAP_PASS'],
	"displayname" => 'gecos',
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
	"userdisplaynameattr" => 'gecos',
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

if (empty($results)) {
	// Not configured
	$sql = "INSERT INTO `userman_directories` (`name`, `driver`, `active`, `order`, `default`, `locked`) VALUES ('NethServer8','Openldap2',1,5,1,0)";
	$stmt = $db->prepare($sql);
	$stmt->execute();
	$id = $db->lastInsertId();
} else {
	// If userbase is "custom" exit without changes
	if ($results[0]['name'] === 'NethServer8 [custom]') {
		exit (0);
	}

	$id = $results[0]['id'];
	$sql = "UPDATE IGNORE `userman_directories` SET `name`= ?, `driver` = 'Openldap2', `active` = 1, `order` = 5, `default` = 1, `locked` = 0 WHERE `id` = ?";
	$stmt = $db->prepare($sql);

	if ($results[0]['name'] === 'NethServer AD' || $results[0]['name'] === 'NethServer LDAP') {
		// Default NethServer7
		$ldap_settings['name'] = 'NethServer8';
	} elseif (strpos($results[0]['name'],'NethServer ') === 0) {
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
		$ldap_settings['name'] = 'NethServer8';
	}
	$stmt->execute([$ldap_settings['name'], $id]);

	$sql = "INSERT INTO kvstore_FreePBX_modules_Userman (`key`, `val`, `type`, `id`) VALUES ('auth-settings',?,'json-arr',?)";
	$stmt = $db->prepare($sql);
	$stmt->execute([json_encode($ldap_settings), $id]);
}

