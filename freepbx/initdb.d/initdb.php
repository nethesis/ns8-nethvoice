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
$sql = 'SELECT password FROM arimanager WHERE name = "proxycti"';
$stmt = $db->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll();
if (empty($res)) {
        // prxycti user doesn't exists and needs to be created
        $sql = "INSERT INTO `arimanager` (`name`, `password`, `password_format`, `read_only`) VALUES ('proxycti',?,'plain',1)";
        $stmt = $db->prepare($sql);
        $stmt->execute([$_ENV['NETHCTI_AMI_PASSWORD']]);

        // Get proxycti entry id
        $id = $db->lastInsertId();

        // write manager entry
        $sql = "INSERT INTO `manager` (`manager_id`, `name`, `secret`, `deny`, `permit`, `read`, `write`, `writetimeout`) VALUES (?,'proxycti',?,'0.0.0.0/0.0.0.0','127.0.0.1/255.255.255.0','system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate','system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate',100);";
        $stmt = $db->prepare($sql);
        $stmt->execute([$id,$_ENV['NETHCTI_AMI_PASSWORD']]);

        // Enable needreload
        $db->query("UPDATE admin SET value = 'true' WHERE variable = 'need_reload'");
} else if ($res[0][0] !== $_ENV['NETHCTI_AMI_PASSWORD']) {
	// user already exists, but password is different
        $sql = "UPDATE `arimanager` SET `password` = ? WHERE `name`='proxycti'";
        $stmt = $db->prepare($sql);
        $stmt->execute([$_ENV['NETHCTI_AMI_PASSWORD']]);
        $sql = "UPDATE `manager` SET `secret` = ? WHERE `name`='proxycti'";
        $stmt = $db->prepare($sql);
        $stmt->execute([$_ENV['NETHCTI_AMI_PASSWORD']]);

        // Enable needreload
        $db->query("UPDATE admin SET value = 'true' WHERE variable = 'need_reload'");
}

