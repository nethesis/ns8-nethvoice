<?php

date_default_timezone_set('Europe/Rome');

define( "ERROR" , 0);
define( "INFO" , 1);
define( "WARNING" , 1);
define( "DEBUG" , 2);
define( "DEBUGVERBOSE" , 3);

function getEnvOrDefault($name, $default) {
    $value = getenv($name);
    if ($value === false || $value === '') {
        return $default;
    }
    return $value;
}

function getFiasConfigPath() {
    return getEnvOrDefault('FIAS_CONFIG_PATH', '/etc/asterisk/fias.conf');
}

function getFreepbxDbConfigPath() {
    return getEnvOrDefault('FREEPBX_DB_CONF_PATH', '/etc/freepbx_db.conf');
}

function getFiasDatabaseName() {
    return getEnvOrDefault('FIAS_DB_NAME', 'fias');
}

function getFiasServerDatabaseName() {
    return getEnvOrDefault('FIAS_SERVER_DB_NAME', 'fias_server');
}

function buildMysqlDsn($host, $databaseName, $port = '') {
    $dsn = 'mysql:host='.$host.';';
    if ($port !== '' && $port !== null) {
        $dsn .= 'port='.$port.';';
    }
    return $dsn.'dbname='.$databaseName;
}

$ini_file = parse_ini_file(getFiasConfigPath(), true);
if ($ini_file === false || !isset($ini_file['fiasd'])) {
    fwrite(STDERR, "Unable to load FIAS configuration from ".getFiasConfigPath().PHP_EOL);
    exit(1);
}

$config = $ini_file["fiasd"];

function getLogTag($tag = "") {
    if (!empty($tag)) {
        return $tag;
    }
    if (!empty($GLOBALS['fias_script_logging']['tag'])) {
        return $GLOBALS['fias_script_logging']['tag'];
    }
    return 'fias';
}

function logMessage($message, $level=ERROR, $tag="") {
    global $config;
    if ($level == ERROR) {
        $GLOBALS['fias_script_logging']['failed'] = true;
    }
    if ($level>$config["DebugLevel"]) {
        return;
    }
    if (is_array($message) || is_object($message)) {
        $message = print_r($message,true);
    }
    $tag = getLogTag($tag);
    if ($level== ERROR) {
        $out = fopen('php://stderr', 'w');
    } else {
        $out = fopen('php://stdout', 'w');
    }
    fputs($out, Date("ymd H.i.s")." {$tag}[".getmypid()."]: ".rtrim((string) $message)."\n");
    fclose($out);
}

function initScriptLifecycleLogging() {
    if (PHP_SAPI !== 'cli') {
        return;
    }
    if (!empty($GLOBALS['fias_script_logging']['initialized'])) {
        return;
    }

    $script = basename($_SERVER['argv'][0] ?? '');
    if ($script === '' || $script === basename(__FILE__)) {
        return;
    }

    $tag = preg_replace('/\.php$/', '', $script);
    $GLOBALS['fias_script_logging'] = array(
        'initialized' => true,
        'tag' => $tag,
        'script' => $script,
        'failed' => false,
    );

    logMessage("Start {$script}", INFO, $tag);

    set_exception_handler(function ($exception) use ($script, $tag) {
        $GLOBALS['fias_script_logging']['failed'] = true;
        logMessage("Unhandled exception in {$script}: ".$exception->getMessage(), ERROR, $tag);
        exit(1);
    });

    register_shutdown_function(function () use ($script, $tag) {
        $last_error = error_get_last();
        if ($last_error !== null && in_array($last_error['type'], array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR), true)) {
            $GLOBALS['fias_script_logging']['failed'] = true;
            logMessage(
                "Fatal error in {$script}: {$last_error['message']} at {$last_error['file']}:{$last_error['line']}",
                ERROR,
                $tag
            );
            return;
        }

        if (!empty($GLOBALS['fias_script_logging']['failed'])) {
            logMessage("Finished {$script} with errors", ERROR, $tag);
            return;
        }

        logMessage("Finished {$script} successfully", INFO, $tag);
    });
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
        logMessage("Queued {$section} message {$msgid}", INFO, 'insertMessageIntoDB');
        return TRUE;
    } catch (Exception $e) {
        logMessage("Error: ".$e->getMessage(),ERROR,'insertMessageIntoDB');
        return FALSE;
    }
}

include_once(getFreepbxDbConfigPath());
$fiasdb = new \PDO(buildMysqlDsn($amp_conf['AMPDBHOST'], getFiasDatabaseName(), $amp_conf['AMPDBPORT']),
	$amp_conf['AMPDBUSER'],
	$amp_conf['AMPDBPASS']);

if ($fiasdb === false) {
    logMessage("Error connecting to database; ".mysql_error(), ERROR, __FILE__);
    exit(1);
}

initScriptLifecycleLogging();

