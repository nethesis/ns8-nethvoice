<?php

date_default_timezone_set('Europe/Rome');

$dbconfig = $ini_file["general"];
$dbport = '';
if (isset($dbconfig['dbport']) && $dbconfig['dbport'] !== '') {
    $dbport = $dbconfig['dbport'];
} elseif (isset($amp_conf['AMPDBPORT']) && $amp_conf['AMPDBPORT'] !== '') {
    $dbport = $amp_conf['AMPDBPORT'];
}

$fiasserverdb = new \PDO(
    buildMysqlDsn($dbconfig["dbhost"], getFiasServerDatabaseName(), $dbport),
    $dbconfig["user"],
    $dbconfig["pwd"]
);
if ($fiasserverdb === false) {
    logMessage("Error connecting to database; ".mysql_error(), ERROR, __FILE__);
    exit(1);
}

function getServerSection($command_full_path) {
    global $ini_file;
    $section = getSection($command_full_path);
    if (empty($section)) {
        $section = getSection(preg_replace('/fias-server-/', '', $command_full_path));
    }
    return $section;
}


function insertMessageIntoServerDB($section,$parameters) {
    global $fiasserverdb;
    try {
        if (!preg_match('/^([A-Z]*)2([A-Z]*)$/', $section, $matches)) {
            throw new Exception("ERROR: Unknow section $section");
        }
        logMessage("command: {$matches[1]}, direction: {$matches[2]}, parameters: ".json_encode($parameters),DEBUG,'insertMessageIntoServerDB');
        $query = "INSERT INTO messages (cmd, dir) VALUES (?,?)";
        $sth = $fiasserverdb->prepare($query);
        $rs = $sth->execute(array($matches[1],$matches[2]));
        if (!$rs) {
            throw new Exception('Mysql Error inserting message');
        }
        $msgid = $fiasserverdb->lastInsertId();
        if (!empty($parameters)) {
            foreach ($parameters as $label => $value) {
                $query = "INSERT INTO messagesparameters (msgid, param, value) VALUES (?, ?, ?)";
                $sth = $fiasserverdb->prepare($query);
                $rs = $sth->execute(array($msgid,$label,$value));
                if (!$rs) {
                    throw new Exception('Mysql Error inserting messageparameters');
                }
            }
	}
        logMessage("Queued {$section} server message {$msgid}", INFO, 'insertMessageIntoServerDB');
        return TRUE;
    } catch (Exception $e) {
        logMessage("Error: ".$e->getMessage(),ERROR,'insertMessageIntoDB');
        return FALSE;
    }
}
