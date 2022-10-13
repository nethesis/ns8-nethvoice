<?php

// Connect to DBs
$db = new \PDO('mysql:host=127.0.0.1;port='.$_ENV['MARIADB_PORT'],
        'root',
        $_ENV['MARIADB_ROOT_PASSWORD']);

// update freepbx settings
$vars = array(
        'AMPDBUSER' => $_ENV['AMPDBUSER'],
        'AMPDBPASS' => $_ENV['AMPDBPASS'],
        'ASTMANAGERHOST' => (empty($_ENV['ASTMANAGERHOST']) ? '127.0.0.1' : $_ENV['ASTMANAGERHOST']),
        'ASTMANAGERPORT' => (empty($_ENV['ASTMANAGERPORT']) ? '5038' : $_ENV['ASTMANAGERPORT']),
        'AMPMGRUSER' => (empty($_ENV['AMPMGRUSER']) ? 'admin' : $_ENV['AMPMGRUSER']),
        'AMPMGRPASS' => (empty($_ENV['AMPMGRPASS']) ? 'amp111' : $_ENV['AMPMGRPASS']),
        'CDRDBHOST' => '127.0.0.1',
        'CDRDBPORT' => $_ENV['MARIADB_PORT'],
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

$db->exec("GRANT ALL on asterisk.* to '".$vars['AMPDBUSER']."'@'127.0.0.1' identified by '".$vars['AMPDBPASS']."'");
$db->exec("GRANT ALL on asteriskcdrdb.* to '".$vars['CDRDBUSER']."'@'".$vars['CDRDBHOST']."' identified by '".$vars['CDRDBPASS']."'");

