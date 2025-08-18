<?php
#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

// Connect to DB
$db = new \PDO('mysql:host=127.0.0.1;port='.$_ENV['NETHVOICE_MARIADB_PORT'],
	$_ENV['AMPDBUSER'],
	$_ENV['AMPDBPASS']);

// update freepbx settings
$vars = array(
	'AMPDBUSER' => $_ENV['AMPDBUSER'],
	'AMPDBPASS' => $_ENV['AMPDBPASS'],
	'ASTMANAGERHOST' => (empty($_ENV['ASTMANAGERHOST']) ? '127.0.0.1' : $_ENV['ASTMANAGERHOST']),
	'ASTMANAGERPORT' => (empty($_ENV['ASTMANAGERPORT']) ? '5038' : $_ENV['ASTMANAGERPORT']),
	'AMPMGRUSER' => (empty($_ENV['AMPMGRUSER']) ? 'admin' : $_ENV['AMPMGRUSER']),
	'AMPMGRPASS' => (empty($_ENV['AMPMGRPASS']) ? 'amp111' : $_ENV['AMPMGRPASS']),
	'CDRDBHOST' => '127.0.0.1',
	'CDRDBPORT' => $_ENV['NETHVOICE_MARIADB_PORT'],
	'CDRDBNAME' => 'asteriskcdrdb',
	'CDRDBUSER' => $_ENV['CDRDBUSER'],
	'CDRDBPASS' => $_ENV['CDRDBPASS'],
	'AMPASTERISKGROUP' => (empty($_ENV['AMPASTERISKGROUP']) ? 'asterisk' : $_ENV['AMPASTERISKGROUP']),
	'AMPASTERISKUSER' => (empty($_ENV['AMPASTERISKUSER']) ? 'asterisk' : $_ENV['AMPASTERISKUSER']),
	'AMPASTERISKWEBGROUP' => (empty($_ENV['AMPASTERISKWEBGROUP']) ? 'asterisk' : $_ENV['AMPASTERISKWEBGROUP']),
	'AMPASTERISKWEBUSER' => (empty($_ENV['AMPASTERISKWEBUSER']) ? 'asterisk' : $_ENV['AMPASTERISKWEBUSER']),
	'CELDBNAME' => 'asteriskcdrdb',
	'CELDBTABLENAME' => 'cel',
	'FPBXDBUGFILE' => 'php://stderr',
	'FPBX_LOG_FILE' => 'php://stderr',
);

$exec = [];
$sql = '';
foreach ($vars as $key => $value) {
	$sql .= 'UPDATE `asterisk`.`freepbx_settings` SET `value` = ? WHERE `keyword` = ?;';
	$exec[] = $value;
	$exec[] = $key;
}
$stmt = $db->prepare($sql);
$stmt->execute($exec);
$stmt->closeCursor();

// Update /etc/amportal.conf
$amportal = file_get_contents('/etc/amportal.conf');
$sql = 'SELECT keyword,value FROM asterisk.freepbx_settings';
$stmt = $db->prepare($sql);
$stmt->execute();
while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
	$amportal = preg_replace('/^'.$row['keyword'].'=.*$/m',$row['keyword'].'='.$row['value'],$amportal);
}
$stmt->closeCursor();
file_put_contents('/etc/amportal.conf',$amportal);

// Set NethCTI AMI user if it is needed
$sql = 'SELECT `password` FROM `asterisk`.`arimanager` WHERE `name` = "proxycti"';
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll();
if (empty($res)) {
        // prxycti user doesn't exists and needs to be created
        $sql = "INSERT INTO `asterisk`.`arimanager` (`name`, `password`, `password_format`, `read_only`) VALUES ('proxycti',?,'plain',1)";
        $stmt = $db->prepare($sql);
        $stmt->execute([$_ENV['NETHCTI_AMI_PASSWORD']]);

        // Get proxycti entry id
        $id = $db->lastInsertId();

        // write manager entry
        $sql = "INSERT INTO `asterisk`.`manager` (`manager_id`, `name`, `secret`, `deny`, `permit`, `read`, `write`, `writetimeout`) VALUES (?,'proxycti',?,'0.0.0.0/0.0.0.0','127.0.0.1/255.255.255.0','system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate','system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate',100);";
        $stmt = $db->prepare($sql);
        $stmt->execute([$id,$_ENV['NETHCTI_AMI_PASSWORD']]);

        // Enable needreload
        $db->query("UPDATE `asterisk`.`admin` SET `value` = 'true' WHERE `variable` = 'need_reload'");
} else if ($res[0][0] !== $_ENV['NETHCTI_AMI_PASSWORD']) {
	// user already exists, but password is different
        $sql = "UPDATE `asterisk`.`arimanager` SET `password` = ? WHERE `name`='proxycti'";
        $stmt = $db->prepare($sql);
        $stmt->execute([$_ENV['NETHCTI_AMI_PASSWORD']]);
        $sql = "UPDATE `asterisk`.`manager` SET `secret` = ? WHERE `name`='proxycti'";
        $stmt = $db->prepare($sql);
        $stmt->execute([$_ENV['NETHCTI_AMI_PASSWORD']]);

        // Enable needreload
        $db->query("UPDATE `asterisk`.`admin` SET `value` = 'true' WHERE `variable` = 'need_reload'");
}

// Cleanup freepbx_settings from deprecated entries
$deprecated = array(
	'AST_FUNC_CONNECTEDLINE',
	'AST_FUNC_MASTER_CHANNEL',
	'AST_FUNC_SHARED',
	'AST_FUNC_EXTENSION_STATE',
	'AST_FUNC_PRESENCE_STATE'
);
$sql = 'DELETE FROM `asterisk`.`freepbx_settings` WHERE `keyword` IN ("'.implode('","',$deprecated).'")';
$db->query($sql);

// Set proxy ip and port in VoIP provider default settings
if (!empty($_ENV['PROXY_IP']) && !empty($_ENV['PROXY_PORT'])) {
	$sql = 'UPDATE `asterisk`.`rest_pjsip_trunks_defaults` SET `data` = ? WHERE `keyword` = "outbound_proxy"';
	$stmt = $db->prepare($sql);
	$stmt->execute(['sip:'.$_ENV['PROXY_IP'].':'.$_ENV['PROXY_PORT'].';lr']);
}

// Set port for Asterisk http server from environment
if (!empty($_ENV['ASTERISK_WS_PORT'])) {
	$sql = 'UPDATE `asterisk`.`freepbx_settings` SET `value` = ? WHERE `keyword` = "HTTPBINDPORT"';
	$stmt = $db->prepare($sql);
	$stmt->execute([$_ENV['ASTERISK_WS_PORT']]);
	$sql = 'UPDATE `asterisk`.`freepbx_settings` SET `value` = ? WHERE `keyword` = "HTTPENABLED"';
	$stmt = $db->prepare($sql);
	$stmt->execute([1]);
}

// Set port for Asterisk WSS from environment
if (!empty($_ENV['ASTERISK_WSS_PORT'])) {
	$sql = 'UPDATE `asterisk`.`freepbx_settings` SET `value` = ? WHERE `keyword` = "HTTPTLSBINDPORT"';
	$stmt = $db->prepare($sql);
	$stmt->execute([$_ENV['ASTERISK_WSS_PORT']]);
	$sql = 'UPDATE `asterisk`.`freepbx_settings` SET `value` = ? WHERE `keyword` = "HTTPTLSENABLED"';
	$stmt = $db->prepare($sql);
	$stmt->execute([1]);
	$sql = 'UPDATE `asterisk`.`freepbx_settings` SET `value` = ? WHERE `keyword` = "HTTPTLSCERTFILE"';
	$stmt = $db->prepare($sql);
	$stmt->execute(['/etc/asterisk/keys/NethServer.crt']);
	$sql = 'UPDATE `asterisk`.`freepbx_settings` SET `value` = ? WHERE `keyword` = "HTTPTLSPRIVATEKEY"';
	$stmt = $db->prepare($sql);
	$stmt->execute(['/etc/asterisk/keys/NethServer.key']);
}

// Create/update ARI account for Satellite
if (!empty($_ENV['SATELLITE_ARI_PASSWORD'])) {
	// Hash the password using crypt
	$salt = '$6$' . bin2hex(random_bytes(8)) . '$'; // $6$ for SHA-512
	$hashedPassword = crypt($_ENV['SATELLITE_ARI_PASSWORD'], $salt);

	// Check if the entry already exists
	$sql = 'SELECT `password` FROM `asterisk`.`arimanager` WHERE `name` = "satellite"';
	$stmt = $db->prepare($sql);
	$stmt->execute();
	$res = $stmt->fetchAll();
	if (empty($res)) {
		// Entry doesn't exist, create it
		$sql = "INSERT INTO `asterisk`.`arimanager` (`name`, `password`, `password_format`, `read_only`) VALUES ('satellite', ?, 'crypt', 0)";
	} else {
		// Entry exists, update it
		$sql = "UPDATE `asterisk`.`arimanager` SET `password` = ?, `password_format` = 'crypt' WHERE `name` = 'satellite'";
	}
	$stmt = $db->prepare($sql);
	$stmt->execute([$hashedPassword]);
}

// Set IAX2 Port
$sql = "INSERT INTO `asterisk`.`iaxsettings` (`keyword`, `data`) 
        VALUES ('bindport', ?) 
        ON DUPLICATE KEY UPDATE `data` = ?";
$stmt = $db->prepare($sql);
$stmt->execute([$_ENV['ASTERISK_IAX_PORT'],$_ENV['ASTERISK_IAX_PORT']]);
