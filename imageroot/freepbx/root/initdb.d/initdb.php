<?php

// Connect to DBs
$db = new \PDO('mysql:host=127.0.0.1;port='.$_ENV['MARIADB_PORT'],
        'root',
        $_ENV['MARIADB_ROOT_PASSWORD']);

/*
 * load default data
 */
foreach (scandir("/initdb.d/data") as $database) {
        if ($database == '.' || $database == '..') continue;
        fwrite(STDERR, "Processing /initdb.d/data/$database\n");
        // Get all files
        $files = scandir("/initdb.d/data/".$database,SCANDIR_SORT_ASCENDING);

        $db_creates = array_filter($files,function($file){
                return preg_match('/-schema-create\.sql$/',$file);
        });

        $schemas = array_filter($files,function($file){
                return preg_match('/-schema\.sql$/',$file);
        });

        $datas = array_filter($files,function($file){
                return (preg_match('/\.sql$/',$file) && !preg_match('/-schema\.sql$/',$file) && !preg_match('/-schema-create\.sql$/',$file));
        });

        // Create DB
        fwrite(STDERR, "Creating $database from ".'/initdb.d/data/'.$database.'/'.$database.'-schema-create.sql'."\n");
        $db->exec(file_get_contents('/initdb.d/data/'.$database.'/'.$database.'-schema-create.sql'));

        // Connect to new db
        fwrite(STDERR, "Connecting to $database\n");
        $newdb = new \PDO('mysql:host=127.0.0.1;port='.$_ENV['MARIADB_PORT'].';dbname='.$database,
                'root',
                $_ENV['MARIADB_ROOT_PASSWORD']);

        // Create schemas ad insert datas into new created db
        foreach ([$schemas,$datas] as $sql_files) {
                foreach ($sql_files as $sql_file) {
                        fwrite(STDERR, "Processing ".'/initdb.d/data/'.$database.'/'.$sql_file."\n");
                        $newdb->exec(file_get_contents('/initdb.d/data/'.$database.'/'.$sql_file));
                }
        }
}

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

