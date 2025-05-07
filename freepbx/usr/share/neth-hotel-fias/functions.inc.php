<?php

date_default_timezone_set('Europe/Rome');

define( "ERROR" , 0);
define( "INFO" , 1);
define( "DEBUG" , 2);
define( "DEBUGVERBOSE" , 3);

$ini_file = parse_ini_file("/etc/asterisk/fias.conf", true);
$config = $ini_file["fiasd"];

function logMessage($message, $level=ERROR, $tag="") {
    global $config;
    if ($level>$config["DebugLevel"]) {
        return;
    }
    if (is_array($message)) {
        $message = print_r($message,true);
    }
    if ($level== ERROR) {
        $out = fopen('php://stderr', 'w');
    } else {
        $out = fopen('php://stdout', 'w');
    }
    fputs($out, Date("ymd H.i.s")." {$tag}[".getmypid()."]: ".$message);
    fclose($out);
}

function getSection($command_full_path) {
    global $ini_file;
    // Get name of the section that contains called script path and name as "command"
    $section = array_search($command_full_path, array_map(function($val){if (isset($val['command'])) return $val['command'];}, $ini_file));
    logMessage($command_full_path . " section: " . $section , DEBUGVERBOSE, __FUNCTION__);
    return $section;
}

function getArguments($section,$args) {
    global $ini_file;
    // Read the command expected format
    $format = explode("_", $ini_file[$section]["format"]);

    $arguments = array();
    $c = 1;
    foreach ($format as $label) {
        if (!empty($label) && isset($args[$c])) {
            $arguments[$label] = $args[$c];
        }
        $c += 1;
    }
    logMessage($section . " " . json_encode($arguments), DEBUG, __FUNCTION__);
    return $arguments;
}

function insertMessageIntoDB($section,$parameters) {
    global $fiasdb;
    try {
        if (!preg_match('/^([A-Z]*)2([A-Z]*)$/', $section, $matches)) {
            throw new Exception("ERROR: Unknow section $section");
        }
        logMessage("command: {$matches[1]}, direction: {$matches[2]}, parameters: ".json_encode($parameters),DEBUG,'insertMessageIntoDB');
        $query = "INSERT INTO messages (cmd, dir) VALUES (?,?)";
        $sth = $fiasdb->prepare($query);
        $rs = $sth->execute(array($matches[1],$matches[2]));
        if (!$rs) {
            throw new Exception('Mysql Error inserting message');
        }
        $msgid = $fiasdb->lastInsertId();
        if (!empty($parameters)) {
            foreach ($parameters as $label => $value) {
                $query = "INSERT INTO messagesparameters (msgid, param, value) VALUES (?, ?, ?)";
                $sth = $fiasdb->prepare($query);
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

include_once('/etc/freepbx_db.conf');
$fiasdb = new \PDO($amp_conf['AMPDBENGINE'].':host='.$amp_conf['AMPDBHOST'].';port='.$amp_conf['AMPDBPORT'].';dbname=fias',
	$amp_conf['AMPDBUSER'],
	$amp_conf['AMPDBPASS']);

if ($fiasdb === false) {
    logMessage("Error connecting to database; ".mysql_error(), ERROR, __FILE__);
    exit(1);
}

