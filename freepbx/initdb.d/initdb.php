<?php

// Connect to DBs waiting for 60 seconds mysql to come up
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
$sql = 'SELECT keyword,value FROM freepbx_settings';
$stmt = $db->prepare($sql);
$stmt->execute();
while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
	$amportal = preg_replace('/^'.$row['keyword'].'=.*$/',$row['keyword'].'='.$row['value'],$amportal);
}
$stmt->closeCursor();
file_put_contents('/etc/amportal.conf',$amportal);

