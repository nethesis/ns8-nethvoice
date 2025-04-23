<?php

date_default_timezone_set('Europe/Rome');

$ini_file = parse_ini_file("/etc/fias.conf", true);
$config = $ini_file["fiasd"];
$dbconfig = $ini_file["general"];

$fiasserverdb = new \PDO('mysql:host='.$dbconfig["dbhost"].';dbname=fias_server',$dbconfig["user"],$dbconfig["pwd"]);
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
        return TRUE;
    } catch (Exception $e) {
        logMessage("Error: ".$e->getMessage(),ERROR,'insertMessageIntoDB');
        return FALSE;
    }
}
