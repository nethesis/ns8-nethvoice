#!/usr/bin/env php
<?php

const PROCESS_STARTUP_TIMEOUT = 10;
const STEP_TIMEOUT = 30;
const POLL_INTERVAL_USEC = 250000;
const MOVE_ROOM_OFFSET = 1000;

function getEnvOrDefault($name, $default = '') {
    $value = getenv($name);
    if ($value === false || $value === '') {
        return $default;
    }

    return $value;
}

function isTruthyEnv($name) {
    return in_array(strtolower((string) getEnvOrDefault($name, '')), array('1', 'true', 'yes', 'on'), true);
}

function usage() {
    $script = basename(__FILE__);
    fwrite(STDERR, "Usage: {$script} <room-number>\n");
    fwrite(STDERR, "Run inside a FreePBX container or host with access to /etc/freepbx_db.conf and /var/www/html/freepbx/hotel/functions.inc.php.\n");
    fwrite(STDERR, "For isolated temporary databases, also provide MariaDB admin credentials with FIAS_E2E_ADMIN_DB_USER/FIAS_E2E_ADMIN_DB_PASS or export MARIADB_ROOT_PASSWORD.\n");
    exit(1);
}

function quoteIdentifier($identifier) {
    if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new RuntimeException("Invalid SQL identifier {$identifier}");
    }
    return '`'.$identifier.'`';
}

function connectMysqlWithCredentials($engine, $host, $port, $user, $password, $databaseName = '') {
    $dsn = $engine.':host='.$host;
    if (!empty($port)) {
        $dsn .= ';port='.$port;
    }
    if ($databaseName !== '') {
        $dsn .= ';dbname='.$databaseName;
    }

    return new PDO(
        $dsn,
        $user,
        $password,
        array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        )
    );
}

function getAmpDbSettings($ampConf) {
    return array(
        'AMPDBENGINE' => $ampConf['AMPDBENGINE'],
        'AMPDBHOST' => $ampConf['AMPDBHOST'],
        'AMPDBPORT' => isset($ampConf['AMPDBPORT']) ? $ampConf['AMPDBPORT'] : '',
        'AMPDBUSER' => $ampConf['AMPDBUSER'],
        'AMPDBPASS' => $ampConf['AMPDBPASS'],
        'AMPDBNAME' => isset($ampConf['AMPDBNAME']) ? $ampConf['AMPDBNAME'] : '',
        'datasource' => isset($ampConf['datasource']) ? $ampConf['datasource'] : '',
    );
}

function connectMysqlFromSettings($dbSettings, $databaseName = '') {
    return connectMysqlWithCredentials(
        $dbSettings['AMPDBENGINE'],
        $dbSettings['AMPDBHOST'],
        isset($dbSettings['AMPDBPORT']) ? $dbSettings['AMPDBPORT'] : '',
        $dbSettings['AMPDBUSER'],
        $dbSettings['AMPDBPASS'],
        $databaseName
    );
}

function connectMysql($ampConf, $databaseName = '') {
    return connectMysqlFromSettings(
        getAmpDbSettings($ampConf),
        $databaseName
    );
}

function getAdminDbSettings($ampConf) {
    $adminPassword = getEnvOrDefault('FIAS_E2E_ADMIN_DB_PASS', getEnvOrDefault('MARIADB_ROOT_PASSWORD', ''));
    $adminUser = getEnvOrDefault('FIAS_E2E_ADMIN_DB_USER', $adminPassword !== '' ? 'root' : '');
    if ($adminUser === '') {
        return null;
    }

    return array(
        'AMPDBENGINE' => $ampConf['AMPDBENGINE'],
        'AMPDBHOST' => getEnvOrDefault('FIAS_E2E_ADMIN_DB_HOST', $ampConf['AMPDBHOST']),
        'AMPDBPORT' => getEnvOrDefault('FIAS_E2E_ADMIN_DB_PORT', isset($ampConf['AMPDBPORT']) ? $ampConf['AMPDBPORT'] : ''),
        'AMPDBUSER' => $adminUser,
        'AMPDBPASS' => $adminPassword,
        'AMPDBNAME' => isset($ampConf['AMPDBNAME']) ? $ampConf['AMPDBNAME'] : '',
        'datasource' => isset($ampConf['datasource']) ? $ampConf['datasource'] : '',
    );
}

function connectMysqlAdmin($ampConf) {
    $adminDbSettings = getAdminDbSettings($ampConf);
    if ($adminDbSettings === null) {
        return null;
    }

    return connectMysqlFromSettings($adminDbSettings);
}

function loadAmpConf($configPath) {
    if (!file_exists($configPath)) {
        throw new RuntimeException("Missing FreePBX DB config {$configPath}");
    }

    include $configPath;
    if (!isset($amp_conf) || !is_array($amp_conf)) {
        throw new RuntimeException("Unable to load FreePBX DB config from {$configPath}");
    }

    return $amp_conf;
}

function allocatePort() {
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
    if ($socket === false) {
        throw new RuntimeException("Unable to allocate TCP port: {$errstr}");
    }

    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $parts = explode(':', $address);
    return (int) end($parts);
}

function buildProcessEnvironment($overrides) {
    $environment = getenv();
    if (!is_array($environment)) {
        $environment = array();
    }
    if (isset($_SERVER['PATH']) && !isset($environment['PATH'])) {
        $environment['PATH'] = $_SERVER['PATH'];
    }
    if (isset($_SERVER['HOME']) && !isset($environment['HOME'])) {
        $environment['HOME'] = $_SERVER['HOME'];
    }
    foreach ($overrides as $key => $value) {
        $environment[$key] = $value;
    }
    return $environment;
}

function quoteIniValue($value) {
    return '"'.addcslashes((string) $value, "\\\"").'"';
}

function writeTransportConfig($sourcePath, $targetPath, $port, $dbSettings = null) {
    $config = file_get_contents($sourcePath);
    if ($config === false) {
        throw new RuntimeException("Unable to read {$sourcePath}");
    }

    $replacements = array(
        '/^address=.*$/m' => 'address=127.0.0.1',
        '/^port=.*$/m' => 'port='.$port,
    );

    if ($dbSettings !== null) {
        $replacements['/^dbhost=.*$/m'] = 'dbhost='.quoteIniValue($dbSettings['AMPDBHOST']);
        $replacements['/^dbport=.*$/m'] = 'dbport='.quoteIniValue(isset($dbSettings['AMPDBPORT']) ? $dbSettings['AMPDBPORT'] : '');
        $replacements['/^user=.*$/m'] = 'user='.quoteIniValue($dbSettings['AMPDBUSER']);
        $replacements['/^pwd=.*$/m'] = 'pwd='.quoteIniValue($dbSettings['AMPDBPASS']);
    }

    foreach ($replacements as $pattern => $replacement) {
        $config = preg_replace($pattern, $replacement, $config, 1);
        if ($config === null) {
            throw new RuntimeException('Unable to build temporary FIAS configuration');
        }
    }

    if (file_put_contents($targetPath, $config) === false) {
        throw new RuntimeException("Unable to write {$targetPath}");
    }
}

function writeFreepbxDbConfig($targetPath, $dbSettings) {
    $content = "<?php\n\n";
    $content .= '$amp_conf[\'AMPDBUSER\'] = '.var_export($dbSettings['AMPDBUSER'], true).";\n";
    $content .= '$amp_conf[\'AMPDBPASS\'] = '.var_export($dbSettings['AMPDBPASS'], true).";\n";
    $content .= '$amp_conf[\'AMPDBHOST\'] = '.var_export($dbSettings['AMPDBHOST'], true).";\n";
    $content .= '$amp_conf[\'AMPDBPORT\'] = '.var_export(isset($dbSettings['AMPDBPORT']) ? $dbSettings['AMPDBPORT'] : '', true).";\n";
    $content .= '$amp_conf[\'AMPDBNAME\'] = '.var_export(isset($dbSettings['AMPDBNAME']) ? $dbSettings['AMPDBNAME'] : '', true).";\n";
    $content .= '$amp_conf[\'AMPDBENGINE\'] = '.var_export($dbSettings['AMPDBENGINE'], true).";\n";
    $content .= '$amp_conf[\'datasource\'] = '.var_export(isset($dbSettings['datasource']) ? $dbSettings['datasource'] : '', true).";\n";

    if (file_put_contents($targetPath, $content) === false) {
        throw new RuntimeException("Unable to write {$targetPath}");
    }
}

function clearTransportTables($databasePdo) {
    $databasePdo->exec('TRUNCATE TABLE `messagesparameters`');
    $databasePdo->exec('TRUNCATE TABLE `messages`');
    $databasePdo->exec('TRUNCATE TABLE `reservations`');
}

function ensureTransportSchema($databasePdo) {
    $databasePdo->exec(
        'CREATE TABLE IF NOT EXISTS `messages` ('
        .' `id` int(11) NOT NULL auto_increment,'
        .' `cmd` char(2) collate latin1_general_ci NOT NULL,'
        .' `dir` char(3) collate latin1_general_ci NOT NULL,'
        .' `creationtime` timestamp NOT NULL default CURRENT_TIMESTAMP,'
        .' `elaborationtime` timestamp NULL default NULL,'
        .' `raw` varchar(500) collate latin1_general_ci default NULL,'
        .' PRIMARY KEY (`id`)'
        .') ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_general_ci'
    );
    $databasePdo->exec(
        'CREATE TABLE IF NOT EXISTS `messagesparameters` ('
        .' `mid` int(11) NOT NULL auto_increment,'
        .' `msgid` int(11) NOT NULL,'
        .' `param` char(2) collate latin1_general_ci NOT NULL,'
        .' `value` varchar(50) collate latin1_general_ci default NULL,'
        .' PRIMARY KEY (`mid`),'
        .' KEY `msgid` (`msgid`)'
        .') ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_general_ci'
    );
    $databasePdo->exec(
        'CREATE TABLE IF NOT EXISTS `reservations` ('
        .' `room_number` int(8) NOT NULL,'
        .' `reservation_number` int(10) PRIMARY KEY,'
        .' `guest_name` varchar(40) default NULL,'
        .' `guest_language` varchar(2) default "EA",'
        .' `share_flag` char(1) default "N",'
        .' `checkindate` timestamp default CURRENT_TIMESTAMP,'
        .' `checkoutdate` timestamp NULL'
        .') ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_general_ci'
    );

    clearTransportTables($databasePdo);
}

function grantDatabasePrivileges($adminPdo, $ampConf, $databaseName) {
    $databasePattern = quoteIdentifier($databaseName).'.*';
    $quotedUser = $adminPdo->quote($ampConf['AMPDBUSER']);
    $quotedPassword = $adminPdo->quote($ampConf['AMPDBPASS']);
    foreach (array('127.0.0.1', 'localhost') as $host) {
        $quotedHost = $adminPdo->quote($host);
        $adminPdo->exec("GRANT ALL ON {$databasePattern} TO {$quotedUser}@{$quotedHost} IDENTIFIED BY {$quotedPassword}");
    }
    $adminPdo->exec('FLUSH PRIVILEGES');
}

function createTransportDatabase($adminPdo, $ampConf, $databaseSettings, $databaseName) {
    if ($adminPdo === null) {
        throw new RuntimeException(
            'Creating isolated transport databases requires MariaDB admin credentials. '
            .'Set FIAS_E2E_ADMIN_DB_USER and FIAS_E2E_ADMIN_DB_PASS, or export MARIADB_ROOT_PASSWORD if root access is available. '
            .'Alternatively, pre-create two dedicated databases, grant '.$ampConf['AMPDBUSER'].' access, and rerun with '
            .'FIAS_DB_NAME, FIAS_SERVER_DB_NAME, and FIAS_E2E_SKIP_DB_CREATE=1.'
        );
    }

    $quotedDatabase = quoteIdentifier($databaseName);
    $adminPdo->exec('DROP DATABASE IF EXISTS '.$quotedDatabase);
    $adminPdo->exec('CREATE DATABASE '.$quotedDatabase.' DEFAULT CHARACTER SET latin1 COLLATE latin1_general_ci');
    grantDatabasePrivileges($adminPdo, $ampConf, $databaseName);

    $databasePdo = connectMysqlFromSettings($databaseSettings, $databaseName);
    ensureTransportSchema($databasePdo);

    return $databasePdo;
}

function useExistingTransportDatabase($databaseSettings, $databaseName) {
    $databasePdo = connectMysqlFromSettings($databaseSettings, $databaseName);
    ensureTransportSchema($databasePdo);

    return $databasePdo;
}

function dropDatabase($adminPdo, $databaseName) {
    $adminPdo->exec('DROP DATABASE IF EXISTS '.quoteIdentifier($databaseName));
}

function resetRoomState($roomsPdo, $rooms) {
    $placeholders = implode(',', array_fill(0, count($rooms), '?'));
    foreach (array('alarmcalls', 'alarms', 'extra_history', 'history', 'rooms') as $table) {
        $stmt = $roomsPdo->prepare("DELETE FROM roomsdb.{$table} WHERE extension IN ({$placeholders})");
        $stmt->execute($rooms);
    }
}

function fetchRoom($roomsPdo, $room) {
    $stmt = $roomsPdo->prepare(
        'SELECT extension, clean, COALESCE(text, "") AS text, COALESCE(lang, "") AS lang '
        .'FROM roomsdb.rooms WHERE extension = ?'
    );
    $stmt->execute(array($room));
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function fetchAlarm($roomsPdo, $room) {
    $stmt = $roomsPdo->prepare(
        'SELECT TIME_FORMAT(hour, "%H:%i:%s") AS hour, enabled, '
        .'DATE_FORMAT(start, "%Y-%m-%d") AS start_date, '
        .'DATE_FORMAT(end, "%Y-%m-%d") AS end_date '
        .'FROM roomsdb.alarms WHERE extension = ?'
    );
    $stmt->execute(array($room));
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function fetchAlarmCallCount($roomsPdo, $room) {
    $stmt = $roomsPdo->prepare('SELECT COUNT(*) AS total FROM roomsdb.alarmcalls WHERE extension = ?');
    $stmt->execute(array($room));
    $row = $stmt->fetch();
    return (int) $row['total'];
}

function fetchRoomsdbSnapshot($roomsPdo, $rooms) {
    $snapshot = array(
        'rooms' => array(),
        'alarms' => array(),
        'alarmcalls' => array(),
    );
    foreach ($rooms as $room) {
        $snapshot['rooms'][$room] = fetchRoom($roomsPdo, $room);
        $snapshot['alarms'][$room] = fetchAlarm($roomsPdo, $room);
        $snapshot['alarmcalls'][$room] = fetchAlarmCallCount($roomsPdo, $room);
    }
    return $snapshot;
}

function pendingServerMessages($serverPdo, $command) {
    $stmt = $serverPdo->prepare('SELECT COUNT(*) AS total FROM messages WHERE cmd = ? AND elaborationtime IS NULL');
    $stmt->execute(array($command));
    $row = $stmt->fetch();
    return (int) $row['total'];
}

function waitForCondition($description, $callback, $timeoutSeconds = STEP_TIMEOUT) {
    $deadline = microtime(true) + $timeoutSeconds;
    while (microtime(true) < $deadline) {
        if ($callback()) {
            return;
        }
        usleep(POLL_INTERVAL_USEC);
    }
    throw new RuntimeException("Timed out waiting for {$description}");
}

function startBackgroundProcess($scriptPath, $environment, $logPath) {
    $command = escapeshellarg(PHP_BINARY).' '.escapeshellarg($scriptPath);
    $descriptorSpec = array(
        0 => array('pipe', 'r'),
        1 => array('file', $logPath, 'a'),
        2 => array('file', $logPath, 'a'),
    );

    $pipes = array();
    $process = proc_open($command, $descriptorSpec, $pipes, dirname($scriptPath), $environment);
    if (!is_resource($process)) {
        throw new RuntimeException("Unable to start {$scriptPath}");
    }
    fclose($pipes[0]);

    return array(
        'process' => $process,
        'script' => basename($scriptPath),
        'log' => $logPath,
    );
}

function ensureProcessRunning($processInfo) {
    $status = proc_get_status($processInfo['process']);
    if (!$status['running']) {
        $logOutput = file_exists($processInfo['log']) ? trim(file_get_contents($processInfo['log'])) : '';
        throw new RuntimeException(
            $processInfo['script'].' exited early with code '.$status['exitcode']
            .($logOutput !== '' ? ":\n{$logOutput}" : '')
        );
    }
}

function stopBackgroundProcess($processInfo) {
    if (!is_resource($processInfo['process'])) {
        return;
    }

    $status = proc_get_status($processInfo['process']);
    if ($status['running']) {
        proc_terminate($processInfo['process']);
        $deadline = microtime(true) + 5;
        while ($status['running'] && microtime(true) < $deadline) {
            usleep(100000);
            $status = proc_get_status($processInfo['process']);
        }
        if ($status['running']) {
            proc_terminate($processInfo['process'], 9);
        }
    }

    proc_close($processInfo['process']);
}

function runPhpScript($scriptPath, $arguments, $environment) {
    $command = escapeshellarg(PHP_BINARY).' '.escapeshellarg($scriptPath);
    foreach ($arguments as $argument) {
        $command .= ' '.escapeshellarg((string) $argument);
    }

    $descriptorSpec = array(
        0 => array('pipe', 'r'),
        1 => array('pipe', 'w'),
        2 => array('pipe', 'w'),
    );

    $pipes = array();
    $process = proc_open($command, $descriptorSpec, $pipes, dirname($scriptPath), $environment);
    if (!is_resource($process)) {
        throw new RuntimeException("Unable to execute {$scriptPath}");
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);
    if ($exitCode !== 0) {
        throw new RuntimeException(
            basename($scriptPath).' failed with exit code '.$exitCode
            .($stdout !== '' ? "\nSTDOUT:\n{$stdout}" : '')
            .($stderr !== '' ? "\nSTDERR:\n{$stderr}" : '')
        );
    }
}

function removeDirectory($path) {
    if (!is_dir($path)) {
        return;
    }

    $items = scandir($path);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $itemPath = $path.DIRECTORY_SEPARATOR.$item;
        if (is_dir($itemPath)) {
            removeDirectory($itemPath);
        } else {
            unlink($itemPath);
        }
    }

    rmdir($path);
}

if ($argc !== 2 || !ctype_digit($argv[1]) || (int) $argv[1] <= 0) {
    usage();
}

$primaryRoom = (int) $argv[1];
$secondaryRoom = $primaryRoom + MOVE_ROOM_OFFSET;
$reservationNumber = (string) (($primaryRoom * 10) + 1);
$guestName = 'E2E Guest';
$freepbxDbConfigPath = '/etc/freepbx_db.conf';
$baseConfigPath = '/etc/asterisk/fias.conf';
$hotelFunctionsPath = '/var/www/html/freepbx/hotel/functions.inc.php';
$skipDatabaseCreate = isTruthyEnv('FIAS_E2E_SKIP_DB_CREATE');

if (!file_exists($baseConfigPath) || !file_exists($hotelFunctionsPath)) {
    usage();
}

$ampConf = loadAmpConf($freepbxDbConfigPath);
$ampDbSettings = getAmpDbSettings($ampConf);
$adminDbSettings = getAdminDbSettings($ampConf);
$transportDbSettings = $adminDbSettings !== null ? $adminDbSettings : $ampDbSettings;
$adminPdo = connectMysqlAdmin($ampConf);
$roomsPdo = connectMysql($ampConf, 'roomsdb');

$tempId = getmypid();
$tempDir = sys_get_temp_dir().'/fias-e2e-'.$tempId;
if (!mkdir($tempDir, 0700, true) && !is_dir($tempDir)) {
    throw new RuntimeException("Unable to create {$tempDir}");
}

$artifacts = array(
    'temp_dir' => $tempDir,
    'config' => $tempDir.'/fias.conf',
    'freepbx_db_conf' => $tempDir.'/freepbx_db.conf',
    'server_log' => $tempDir.'/fias-server.log',
    'client_log' => $tempDir.'/fiasd.log',
    'dispatcher_log' => $tempDir.'/dispatcher.log',
);

$transportFreepbxDbConfigPath = $freepbxDbConfigPath;
if ($adminDbSettings !== null) {
    $transportFreepbxDbConfigPath = $artifacts['freepbx_db_conf'];
}

$databaseNames = array(
    'fias' => getEnvOrDefault('FIAS_DB_NAME', 'fias_e2e_'.$tempId),
    'server' => getEnvOrDefault('FIAS_SERVER_DB_NAME', 'fias_server_e2e_'.$tempId),
);

if ($databaseNames['fias'] === $databaseNames['server']) {
    throw new RuntimeException('FIAS_DB_NAME and FIAS_SERVER_DB_NAME must be different');
}

if ($skipDatabaseCreate && (getEnvOrDefault('FIAS_DB_NAME', '') === '' || getEnvOrDefault('FIAS_SERVER_DB_NAME', '') === '')) {
    throw new RuntimeException('FIAS_E2E_SKIP_DB_CREATE=1 requires pre-created FIAS_DB_NAME and FIAS_SERVER_DB_NAME values');
}

$environment = buildProcessEnvironment(array(
    'FIAS_CONFIG_PATH' => $artifacts['config'],
    'FIAS_DB_NAME' => $databaseNames['fias'],
    'FIAS_SERVER_DB_NAME' => $databaseNames['server'],
    'FREEPBX_DB_CONF_PATH' => $transportFreepbxDbConfigPath,
    'FIAS_SERVER_LOCK_PATH' => $artifacts['temp_dir'].'/fias-server.lock',
));

$processes = array();
$keepArtifacts = false;
$exitCode = 0;
$fiasPdo = null;
$serverPdo = null;

try {
    $port = allocatePort();
    writeTransportConfig($baseConfigPath, $artifacts['config'], $port, $adminDbSettings);
    if ($adminDbSettings !== null) {
        writeFreepbxDbConfig($artifacts['freepbx_db_conf'], $adminDbSettings);
    }

    if ($skipDatabaseCreate) {
        $fiasPdo = useExistingTransportDatabase($transportDbSettings, $databaseNames['fias']);
        $serverPdo = useExistingTransportDatabase($transportDbSettings, $databaseNames['server']);
    } else {
        $fiasPdo = createTransportDatabase($adminPdo, $ampConf, $transportDbSettings, $databaseNames['fias']);
        $serverPdo = createTransportDatabase($adminPdo, $ampConf, $transportDbSettings, $databaseNames['server']);
    }

    resetRoomState($roomsPdo, array($primaryRoom, $secondaryRoom));

    $baseDir = __DIR__;
    $processes[] = startBackgroundProcess($baseDir.'/fias-server.php', $environment, $artifacts['server_log']);
    $processes[] = startBackgroundProcess($baseDir.'/dispatcher.php', $environment, $artifacts['dispatcher_log']);
    $processes[] = startBackgroundProcess($baseDir.'/fiasd.php', $environment, $artifacts['client_log']);

    waitForCondition('FIAS background processes to stay up', function () use ($processes) {
        foreach ($processes as $processInfo) {
            ensureProcessRunning($processInfo);
        }
        return true;
    }, PROCESS_STARTUP_TIMEOUT);

    echo "Running FIAS E2E test for room {$primaryRoom} (move target {$secondaryRoom})\n";

    echo "[1/7] GI check-in\n";
    runPhpScript($baseDir.'/fias-server-gi2pbx.php', array($primaryRoom, $reservationNumber, $guestName, 'IT', '', ''), $environment);
    waitForCondition('GI to create the checked-in room', function () use ($roomsPdo, $primaryRoom, $guestName) {
        $room = fetchRoom($roomsPdo, $primaryRoom);
        return $room !== null
            && (int) $room['clean'] === 0
            && $room['text'] === $guestName
            && $room['lang'] === 'it';
    });

    echo "[2/7] GC room move\n";
    runPhpScript($baseDir.'/fias-server-gc2pbx.php', array($secondaryRoom, $reservationNumber, $guestName, 'IT', '', $primaryRoom), $environment);
    waitForCondition('GC to move the guest to the target room', function () use ($roomsPdo, $primaryRoom, $secondaryRoom, $guestName) {
        $oldRoom = fetchRoom($roomsPdo, $primaryRoom);
        $newRoom = fetchRoom($roomsPdo, $secondaryRoom);
        return $oldRoom !== null
            && (int) $oldRoom['clean'] === 1
            && $oldRoom['text'] === ''
            && $newRoom !== null
            && (int) $newRoom['clean'] === 0
            && $newRoom['text'] === $guestName
            && $newRoom['lang'] === 'it';
    });

    echo "[3/7] GO check-out\n";
    runPhpScript($baseDir.'/fias-server-go2pbx.php', array($secondaryRoom, $reservationNumber, '', ''), $environment);
    waitForCondition('GO to mark the moved room as checked out', function () use ($roomsPdo, $secondaryRoom) {
        $room = fetchRoom($roomsPdo, $secondaryRoom);
        return $room !== null && (int) $room['clean'] === 1 && $room['text'] === '';
    });

    $alarmDate = date('ymd', time() + 86400);
    $alarmTime = '233000';

    echo "[4/7] WR wakeup request\n";
    runPhpScript($baseDir.'/fias-server-wr2pbx.php', array($alarmDate, $alarmTime, $secondaryRoom), $environment);
    waitForCondition('WR to create an enabled alarm', function () use ($roomsPdo, $secondaryRoom) {
        $alarm = fetchAlarm($roomsPdo, $secondaryRoom);
        return $alarm !== null
            && (int) $alarm['enabled'] === 1
            && $alarm['hour'] === '23:30:00'
            && fetchAlarmCallCount($roomsPdo, $secondaryRoom) > 0;
    });

    echo "[5/7] WC wakeup clear\n";
    runPhpScript($baseDir.'/fias-server-wc2pbx.php', array($alarmDate, $alarmTime, $secondaryRoom), $environment);
    waitForCondition('WC to disable the room alarm', function () use ($roomsPdo, $secondaryRoom) {
        $alarm = fetchAlarm($roomsPdo, $secondaryRoom);
        return $alarm !== null
            && (int) $alarm['enabled'] === 0
            && fetchAlarmCallCount($roomsPdo, $secondaryRoom) === 0;
    });

    echo "[6/7] RE clean/vacant\n";
    runPhpScript($baseDir.'/fias-server-re2pbx.php', array($secondaryRoom, '3', '', ''), $environment);
    waitForCondition('RE to remove the cleaned room', function () use ($roomsPdo, $secondaryRoom) {
        return fetchRoom($roomsPdo, $secondaryRoom) === null;
    });

    echo "[7/7] LE link end\n";
    $snapshotBeforeLe = fetchRoomsdbSnapshot($roomsPdo, array($primaryRoom, $secondaryRoom));
    runPhpScript($baseDir.'/fias-server-le2pbx.php', array(), $environment);
    waitForCondition('LE to be sent to the client', function () use ($serverPdo) {
        return pendingServerMessages($serverPdo, 'LE') === 0;
    });
    $snapshotAfterLe = fetchRoomsdbSnapshot($roomsPdo, array($primaryRoom, $secondaryRoom));
    if ($snapshotAfterLe !== $snapshotBeforeLe) {
        throw new RuntimeException('LE changed roomsdb state unexpectedly: '.json_encode($snapshotAfterLe));
    }

    echo "All FIAS server commands completed successfully.\n";
} catch (Throwable $throwable) {
    $keepArtifacts = true;
    fwrite(STDERR, "FIAS E2E test failed: ".$throwable->getMessage()."\n");
    fwrite(STDERR, "Artifacts preserved in {$artifacts['temp_dir']}\n");
    fwrite(STDERR, "Temporary databases: {$databaseNames['fias']}, {$databaseNames['server']}\n");
    $exitCode = 1;
} finally {
    for ($index = count($processes) - 1; $index >= 0; $index--) {
        stopBackgroundProcess($processes[$index]);
    }

    resetRoomState($roomsPdo, array($primaryRoom, $secondaryRoom));

    if (!$keepArtifacts) {
        if ($skipDatabaseCreate) {
            if ($fiasPdo instanceof PDO) {
                clearTransportTables($fiasPdo);
            }
            if ($serverPdo instanceof PDO) {
                clearTransportTables($serverPdo);
            }
        } else {
            dropDatabase($adminPdo, $databaseNames['fias']);
            dropDatabase($adminPdo, $databaseNames['server']);
        }
        removeDirectory($artifacts['temp_dir']);
    }
}

if ($exitCode !== 0) {
    exit($exitCode);
}