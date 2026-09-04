#!/usr/bin/env php
<?php

const PROCESS_STARTUP_TIMEOUT = 20;
const STEP_TIMEOUT = 45;
const POLL_INTERVAL_USEC = 200000;
const FIXTURE_ROOM_COUNT = 6;

function envValue($name, $default = '') {
    $value = getenv($name);
    return ($value === false || $value === '') ? $default : $value;
}

function envFlag($name) {
    return in_array(strtolower((string)envValue($name)), array('1', 'true', 'yes', 'on'), true);
}

function usage($exitCode = 1) {
    $script = basename(__FILE__);
    $message = <<<TXT
Usage: {$script} [first-room-number]

Run inside the FreePBX container. The optional room must begin an unused block
of six rooms; when omitted, an unused block is selected automatically.

Environment:
  FIAS_E2E_ARTIFACT_DIR       Sanitized evidence output directory
  FIAS_E2E_SCENARIO           Scenario label for environment.json
  FIAS_E2E_ADMIN_DB_USER/PASS MariaDB administrator credentials
  MARIADB_ROOT_PASSWORD       Alternative root password
  FIAS_DB_NAME                Pre-created client transport database
  FIAS_SERVER_DB_NAME         Pre-created server transport database
  FIAS_E2E_SKIP_DB_CREATE=1   Reuse and truncate the named databases

TXT;
    fwrite($exitCode === 0 ? STDOUT : STDERR, $message);
    exit($exitCode);
}

function requireCondition($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function quoteIdentifier($identifier) {
    if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new RuntimeException("Invalid SQL identifier {$identifier}");
    }
    return '`'.$identifier.'`';
}

function loadAmpConf($path) {
    if (!file_exists($path)) {
        throw new RuntimeException("Missing FreePBX DB config {$path}");
    }
    include $path;
    if (!isset($amp_conf) || !is_array($amp_conf)) {
        throw new RuntimeException("Unable to load FreePBX DB config from {$path}");
    }
    return $amp_conf;
}

function ampSettings($ampConf) {
    return array(
        'engine' => $ampConf['AMPDBENGINE'],
        'host' => $ampConf['AMPDBHOST'],
        'port' => isset($ampConf['AMPDBPORT']) ? $ampConf['AMPDBPORT'] : '',
        'user' => $ampConf['AMPDBUSER'],
        'password' => $ampConf['AMPDBPASS'],
        'database' => isset($ampConf['AMPDBNAME']) ? $ampConf['AMPDBNAME'] : 'asterisk',
        'datasource' => isset($ampConf['datasource']) ? $ampConf['datasource'] : '',
    );
}

function adminSettings($ampConf) {
    $password = envValue('FIAS_E2E_ADMIN_DB_PASS', envValue('MARIADB_ROOT_PASSWORD'));
    $user = envValue('FIAS_E2E_ADMIN_DB_USER', $password !== '' ? 'root' : '');
    if ($user === '') {
        return null;
    }
    $settings = ampSettings($ampConf);
    $settings['host'] = envValue('FIAS_E2E_ADMIN_DB_HOST', $settings['host']);
    $settings['port'] = envValue('FIAS_E2E_ADMIN_DB_PORT', $settings['port']);
    $settings['user'] = $user;
    $settings['password'] = $password;
    return $settings;
}

function connectMysql($settings, $database = '') {
    $dsn = $settings['engine'].':host='.$settings['host'];
    if ($settings['port'] !== '') {
        $dsn .= ';port='.$settings['port'];
    }
    if ($database !== '') {
        $dsn .= ';dbname='.$database;
    }
    return new PDO($dsn, $settings['user'], $settings['password'], array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ));
}

function allocatePort() {
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if ($socket === false) {
        throw new RuntimeException("Unable to allocate TCP port: {$error}");
    }
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $parts = explode(':', $address);
    return (int)end($parts);
}

function processEnvironment($overrides) {
    $environment = getenv();
    if (!is_array($environment)) {
        $environment = array();
    }
    return array_merge($environment, $overrides);
}

function replaceOnce($config, $pattern, $replacement, $description) {
    $count = 0;
    $updated = preg_replace($pattern, $replacement, $config, 1, $count);
    if ($updated === null || $count !== 1) {
        throw new RuntimeException("Unable to replace {$description} in temporary fias.conf");
    }
    return $updated;
}

function writeTransportConfig($source, $target, $port, $dbSettings) {
    $config = file_get_contents($source);
    if ($config === false) {
        throw new RuntimeException("Unable to read {$source}");
    }
    $replacements = array(
        array('/^address=.*$/m', 'address=127.0.0.1', 'address'),
        array('/^port=.*$/m', 'port='.$port, 'port'),
        array('/^timeout=.*$/m', 'timeout=1', 'timeout'),
        array('/^send_msdelay=.*$/m', 'send_msdelay=25', 'send delay'),
        array('/^link_check_interval=.*$/m', 'link_check_interval=3', 'link check interval'),
        array('/^DebugLevel=.*$/m', 'DebugLevel=3', 'debug level'),
        array('/^1="LR\|RIGI\|FLRNG#GNGLGSSFA0A1A2A3\|"$/m', '1="LR|RIGI|FLRNG#GNGLGGGSSFA0A1A2A3|"', 'GI link record'),
        array('/^format=RN_G#_GN_GL_GS_SF_A0_A1_A2_A3$/m', 'format=RN_G#_GN_GL_GG_GS_SF_A0_A1_A2_A3', 'GI format'),
    );
    if ($dbSettings !== null) {
        foreach (array('dbhost' => 'host', 'dbport' => 'port', 'user' => 'user', 'pwd' => 'password') as $iniKey => $settingsKey) {
            $quoted = '"'.addcslashes((string)$dbSettings[$settingsKey], "\\\"").'"';
            $replacements[] = array('/^'.preg_quote($iniKey, '/').'=.*$/m', $iniKey.'='.$quoted, $iniKey);
        }
    }
    foreach ($replacements as $item) {
        $config = replaceOnce($config, $item[0], $item[1], $item[2]);
    }
    if (file_put_contents($target, $config) === false) {
        throw new RuntimeException("Unable to write {$target}");
    }
}

function setConfigValue($path, $section, $key, $value) {
    $lines = file($path);
    if ($lines === false) {
        throw new RuntimeException("Unable to read {$path}");
    }
    $currentSection = '';
    $replaced = 0;
    foreach ($lines as &$line) {
        if (preg_match('/^\[([^]]+)\]/', trim($line), $matches)) {
            $currentSection = $matches[1];
        } elseif ($currentSection === $section && preg_match('/^'.preg_quote($key, '/').'\s*=/', trim($line))) {
            $line = $key.'='.$value.PHP_EOL;
            $replaced++;
        }
    }
    unset($line);
    if ($replaced !== 1 || file_put_contents($path, implode('', $lines)) === false) {
        throw new RuntimeException("Unable to set [{$section}] {$key} in temporary fias.conf");
    }
}

function writeDbConfig($path, $settings) {
    $mapping = array(
        'AMPDBUSER' => 'user', 'AMPDBPASS' => 'password', 'AMPDBHOST' => 'host',
        'AMPDBPORT' => 'port', 'AMPDBNAME' => 'database', 'AMPDBENGINE' => 'engine',
        'datasource' => 'datasource',
    );
    $content = "<?php\n\n";
    foreach ($mapping as $outputKey => $settingsKey) {
        $content .= '$amp_conf['.var_export($outputKey, true).'] = '.var_export($settings[$settingsKey], true).";\n";
    }
    if (file_put_contents($path, $content) === false) {
        throw new RuntimeException("Unable to write {$path}");
    }
}

function clearTransport($pdo) {
    $pdo->exec('TRUNCATE TABLE messagesparameters');
    $pdo->exec('TRUNCATE TABLE messages');
    $pdo->exec('TRUNCATE TABLE reservations');
}

function ensureTransportSchema($pdo) {
    $pdo->exec('CREATE TABLE IF NOT EXISTS messages (id int(11) NOT NULL auto_increment, cmd char(2) NOT NULL, dir char(3) NOT NULL, creationtime timestamp NOT NULL default CURRENT_TIMESTAMP, elaborationtime timestamp NULL default NULL, raw varchar(500) default NULL, PRIMARY KEY (id)) ENGINE=MyISAM DEFAULT CHARSET=latin1');
    $pdo->exec('CREATE TABLE IF NOT EXISTS messagesparameters (mid int(11) NOT NULL auto_increment, msgid int(11) NOT NULL, param char(2) NOT NULL, value varchar(50) default NULL, PRIMARY KEY (mid), KEY msgid (msgid)) ENGINE=MyISAM DEFAULT CHARSET=latin1');
    $pdo->exec('CREATE TABLE IF NOT EXISTS reservations (room_number int(8) NOT NULL, reservation_number int(10) PRIMARY KEY, guest_name varchar(40) default NULL, guest_language varchar(2) default "EA", share_flag char(1) default "N", checkindate timestamp default CURRENT_TIMESTAMP, checkoutdate timestamp NULL) ENGINE=MyISAM DEFAULT CHARSET=latin1');
    clearTransport($pdo);
}

function grantDatabase($adminPdo, $ampConf, $database) {
    foreach (array('127.0.0.1', 'localhost') as $host) {
        $adminPdo->exec('GRANT ALL ON '.quoteIdentifier($database).'.* TO '.$adminPdo->quote($ampConf['AMPDBUSER']).'@'.$adminPdo->quote($host).' IDENTIFIED BY '.$adminPdo->quote($ampConf['AMPDBPASS']));
    }
    $adminPdo->exec('FLUSH PRIVILEGES');
}

function createTransport($adminPdo, $ampConf, $settings, $database) {
    requireCondition($adminPdo instanceof PDO, 'Isolated database creation needs FIAS_E2E_ADMIN_DB_USER/FIAS_E2E_ADMIN_DB_PASS or MARIADB_ROOT_PASSWORD');
    $identifier = quoteIdentifier($database);
    $adminPdo->exec('DROP DATABASE IF EXISTS '.$identifier);
    $adminPdo->exec('CREATE DATABASE '.$identifier.' DEFAULT CHARACTER SET latin1 COLLATE latin1_general_ci');
    grantDatabase($adminPdo, $ampConf, $database);
    $pdo = connectMysql($settings, $database);
    ensureTransportSchema($pdo);
    return $pdo;
}

function waitUntil($description, $callback, $timeout = STEP_TIMEOUT) {
    $deadline = microtime(true) + $timeout;
    do {
        if ($callback()) {
            return;
        }
        usleep(POLL_INTERVAL_USEC);
    } while (microtime(true) < $deadline);
    throw new RuntimeException("Timed out waiting for {$description}");
}

function startProcess($script, $environment, $log) {
    $pipes = array();
    $process = proc_open(
        escapeshellarg(PHP_BINARY).' '.escapeshellarg($script),
        array(0 => array('pipe', 'r'), 1 => array('file', $log, 'a'), 2 => array('file', $log, 'a')),
        $pipes,
        dirname($script),
        $environment
    );
    if (!is_resource($process)) {
        throw new RuntimeException("Unable to start {$script}");
    }
    fclose($pipes[0]);
    return array('process' => $process, 'script' => basename($script), 'log' => $log);
}

function assertProcessRunning($processInfo) {
    $status = proc_get_status($processInfo['process']);
    if (!$status['running']) {
        $log = file_exists($processInfo['log']) ? trim(file_get_contents($processInfo['log'])) : '';
        throw new RuntimeException($processInfo['script'].' exited early with code '.$status['exitcode'].($log !== '' ? ":\n{$log}" : ''));
    }
}

function stopProcess($processInfo) {
    if (!is_resource($processInfo['process'])) {
        return;
    }
    $status = proc_get_status($processInfo['process']);
    if ($status['running']) {
        proc_terminate($processInfo['process']);
        $deadline = microtime(true) + 5;
        do {
            usleep(100000);
            $status = proc_get_status($processInfo['process']);
        } while ($status['running'] && microtime(true) < $deadline);
        if ($status['running']) {
            proc_terminate($processInfo['process'], 9);
        }
    }
    proc_close($processInfo['process']);
}

function runPhp($script, $arguments, $environment) {
    $command = escapeshellarg(PHP_BINARY).' '.escapeshellarg($script);
    foreach ($arguments as $argument) {
        $command .= ' '.escapeshellarg((string)$argument);
    }
    $pipes = array();
    $process = proc_open($command, array(0 => array('pipe', 'r'), 1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, dirname($script), $environment);
    if (!is_resource($process)) {
        throw new RuntimeException("Unable to execute {$script}");
    }
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);
    $output = trim($stdout."\n".$stderr);
    if ($exitCode !== 0) {
        throw new RuntimeException(basename($script)." failed with exit code {$exitCode}".($output !== '' ? ":\n{$output}" : ''));
    }
    return $output;
}

function removeDirectory($path) {
    if (!is_dir($path)) {
        return;
    }
    foreach (scandir($path) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $target = $path.'/'.$item;
        is_dir($target) ? removeDirectory($target) : unlink($target);
    }
    rmdir($path);
}

function ensureEmptyDirectory($path) {
    if (file_exists($path)) {
        requireCondition(is_dir($path) && count(scandir($path)) === 2, "Directory must be empty: {$path}");
    } elseif (!mkdir($path, 0755, true) && !is_dir($path)) {
        throw new RuntimeException("Unable to create {$path}");
    }
}

function maxMessageId($pdo) {
    return (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM messages')->fetchColumn();
}

function messageParameters($pdo, $id) {
    $stmt = $pdo->prepare('SELECT param, value FROM messagesparameters WHERE msgid = ? ORDER BY mid');
    $stmt->execute(array($id));
    $parameters = array();
    foreach ($stmt->fetchAll() as $row) {
        $parameters[$row['param']] = $row['value'];
    }
    return $parameters;
}

function waitForMessage($pdo, $afterId, $command, $direction, $elaborated, $description) {
    $message = null;
    waitUntil($description, function () use ($pdo, $afterId, $command, $direction, $elaborated, &$message) {
        $sql = 'SELECT id, cmd, dir, creationtime, elaborationtime, raw FROM messages WHERE id > ? AND cmd = ? AND dir = ?';
        if ($elaborated) {
            $sql .= ' AND elaborationtime IS NOT NULL AND raw IS NOT NULL';
        }
        $sql .= ' ORDER BY id LIMIT 1';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array($afterId, $command, $direction));
        $message = $stmt->fetch();
        return $message !== false;
    });
    $message['parameters'] = messageParameters($pdo, $message['id']);
    return $message;
}

function roomState($pdo, $room) {
    $stmt = $pdo->prepare('SELECT extension, clean, COALESCE(text, "") text, COALESCE(lang, "") lang FROM roomsdb.rooms WHERE extension = ?');
    $stmt->execute(array($room));
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function alarmState($pdo, $room) {
    $stmt = $pdo->prepare('SELECT TIME_FORMAT(hour, "%H:%i:%s") hour, enabled FROM roomsdb.alarms WHERE extension = ?');
    $stmt->execute(array($room));
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function alarmCallCount($pdo, $room) {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM roomsdb.alarmcalls WHERE extension = ?');
    $stmt->execute(array($room));
    return (int)$stmt->fetchColumn();
}

function reservationCount($pdo, $room) {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM reservations WHERE room_number = ?');
    $stmt->execute(array($room));
    return (int)$stmt->fetchColumn();
}

function groupCount($pdo, $groupNumber) {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM roomsdb.room_groups WHERE fias_guest_group_number = ?');
    $stmt->execute(array($groupNumber));
    return (int)$stmt->fetchColumn();
}

function roomGroup($pdo, $room) {
    $stmt = $pdo->prepare('SELECT rg.fias_guest_group_number FROM roomsdb.groups_rooms gr INNER JOIN roomsdb.room_groups rg ON rg.id = gr.group_id WHERE gr.extension = ?');
    $stmt->execute(array($room));
    $value = $stmt->fetchColumn();
    return $value === false ? null : $value;
}

function roomsAreUnused($pdo, $asteriskDatabase, $rooms) {
    $marks = implode(',', array_fill(0, count($rooms), '?'));
    foreach (array('rooms', 'alarms', 'alarmcalls', 'history', 'extra_history', 'groups_rooms') as $table) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM roomsdb.{$table} WHERE extension IN ({$marks})");
        $stmt->execute($rooms);
        if ((int)$stmt->fetchColumn() !== 0) {
            return false;
        }
    }
    foreach (array('users' => 'extension', 'devices' => 'id', 'userman_users' => 'default_extension') as $table => $column) {
        try {
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM '.quoteIdentifier($asteriskDatabase).'.'.quoteIdentifier($table).' WHERE '.quoteIdentifier($column)." IN ({$marks})");
            $stmt->execute($rooms);
            if ((int)$stmt->fetchColumn() !== 0) {
                return false;
            }
        } catch (Throwable $ignored) {
            // FreePBX schema variants can omit one of these tables.
        }
    }
    return true;
}

function fixtureRooms($pdo, $asteriskDatabase, $requestedBase) {
    if ($requestedBase !== null) {
        $rooms = range($requestedBase, $requestedBase + FIXTURE_ROOM_COUNT - 1);
        requireCondition(roomsAreUnused($pdo, $asteriskDatabase, $rooms), 'Requested fixture block is not unused: '.implode(', ', $rooms));
        return $rooms;
    }
    for ($base = 8900; $base >= 7000; $base -= 10) {
        $rooms = range($base, $base + FIXTURE_ROOM_COUNT - 1);
        if (roomsAreUnused($pdo, $asteriskDatabase, $rooms)) {
            return $rooms;
        }
    }
    throw new RuntimeException('No unused six-room fixture block found between 7000 and 8905');
}

function resetFixtures($pdo, $rooms, $groupNumber) {
    $marks = implode(',', array_fill(0, count($rooms), '?'));
    $stmt = $pdo->prepare("DELETE FROM roomsdb.groups_rooms WHERE extension IN ({$marks})");
    $stmt->execute($rooms);
    foreach (array('alarmcalls', 'alarms', 'extra_history', 'history', 'rooms') as $table) {
        $stmt = $pdo->prepare("DELETE FROM roomsdb.{$table} WHERE extension IN ({$marks})");
        $stmt->execute($rooms);
    }
    $stmt = $pdo->prepare('DELETE rg FROM roomsdb.room_groups rg LEFT JOIN roomsdb.groups_rooms gr ON gr.group_id = rg.id WHERE rg.fias_guest_group_number = ? AND gr.group_id IS NULL');
    $stmt->execute(array($groupNumber));
}

function optionSnapshot($pdo, $name) {
    $stmt = $pdo->prepare('SELECT value FROM roomsdb.options WHERE variable = ? ORDER BY value');
    $stmt->execute(array($name));
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function restoreOption($pdo, $name, $values) {
    $stmt = $pdo->prepare('DELETE FROM roomsdb.options WHERE variable = ?');
    $stmt->execute(array($name));
    $stmt = $pdo->prepare('INSERT INTO roomsdb.options (variable, value) VALUES (?, ?)');
    foreach ($values as $value) {
        $stmt->execute(array($name, $value));
    }
}

function asteriskDb($operation, $family, $key) {
    $output = array();
    $exitCode = 0;
    exec('/usr/sbin/asterisk -rx '.escapeshellarg("database {$operation} {$family} {$key}").' 2>&1', $output, $exitCode);
    return array($exitCode, implode("\n", $output));
}

function asteriskValue($family, $key) {
    list($exitCode, $output) = asteriskDb('get', $family, $key);
    if ($exitCode === 0 && preg_match('/Value: (.*)$/m', $output, $matches)) {
        return trim($matches[1]);
    }
    return null;
}

function cleanupAsterisk($rooms) {
    foreach ($rooms as $room) {
        list($dndExit) = asteriskDb('del', 'DND', (string)$room);
        list($cidExit) = asteriskDb('del', 'AMPUSER', $room.'/cidname');
        requireCondition($dndExit === 0 && $cidExit === 0, "Asterisk DB cleanup failed for room {$room}");
        requireCondition(asteriskValue('DND', (string)$room) === null && asteriskValue('AMPUSER', $room.'/cidname') === null, "Asterisk DB state remains for room {$room}");
    }
}

function logText($path) {
    return file_exists($path) ? (string)file_get_contents($path) : '';
}

function logHas($path, $needle) {
    return strpos(logText($path), $needle) !== false;
}

function lineMatches($text, $needle) {
    $found = array();
    foreach (preg_split('/\R/', (string)$text) as $line) {
        if ($line !== '' && strpos($line, $needle) !== false) {
            $found[] = $line;
        }
    }
    return $found;
}

function resultRow($direction, $command, $mode, $trigger, $handler, $message, $assertion, $producerLog = '', $functionalStatus = 'PASS') {
    return array(
        'direction' => $direction,
        'command' => $command,
        'mode' => $mode,
        'trigger_script' => $trigger,
        'dispatched_script' => $handler,
        'message_id' => isset($message['id']) ? (int)$message['id'] : null,
        'raw_frame' => isset($message['raw']) ? $message['raw'] : '',
        'parameters' => isset($message['parameters']) ? $message['parameters'] : array(),
        'transport_status' => 'PASS',
        'functional_status' => $functionalStatus,
        'assertion' => $assertion,
        'producer_log' => $producerLog,
        'associated_logs' => array(),
        'hotel_logs' => array(),
    );
}

function inbound(&$results, $baseDir, $environment, $clientPdo, $script, $command, $mode, $arguments, $handler, $assertionText, $assertion) {
    $before = maxMessageId($clientPdo);
    $producerLog = runPhp($baseDir.'/'.$script, $arguments, $environment);
    $message = waitForMessage($clientPdo, $before, $command, 'PBX', true, "{$command} {$mode} dispatch");
    $results[] = resultRow('PMS -> PBX', $command, $mode, $script, $handler, $message, $assertionText, $producerLog);
    $resultIndex = count($results) - 1;
    try {
        waitUntil($assertionText, $assertion);
    } catch (Throwable $error) {
        $results[$resultIndex]['functional_status'] = 'FAIL';
        throw $error;
    }
    echo "[PASS] PMS -> PBX {$command} {$mode}\n";
    return $message;
}

function outbound(&$results, $baseDir, $environment, $serverPdo, $script, $command, $mode, $arguments, $assertionText) {
    $before = maxMessageId($serverPdo);
    $producerLog = runPhp($baseDir.'/'.$script, $arguments, $environment);
    $message = waitForMessage($serverPdo, $before, $command, 'PMS', false, "{$command} {$mode} wire delivery");
    waitUntil("{$command} {$mode} raw frame", function () use ($serverPdo, &$message) {
        $stmt = $serverPdo->prepare('SELECT raw FROM messages WHERE id = ?');
        $stmt->execute(array($message['id']));
        $raw = $stmt->fetchColumn();
        if ($raw === false || $raw === null || $raw === '') {
            return false;
        }
        $message['raw'] = $raw;
        return true;
    });
    $message['parameters'] = messageParameters($serverPdo, $message['id']);
    $results[] = resultRow('PBX -> PMS', $command, $mode, $script, 'fiasd.php / fias-server.php', $message, $assertionText, $producerLog);
    echo "[PASS] PBX -> PMS {$command} {$mode}\n";
    return $message;
}

function attachLogs(&$results, $logs) {
    foreach ($results as &$result) {
        $lines = array();
        if ($result['direction'] === 'PMS -> PBX' && $result['message_id'] !== null
            && preg_match('/2pbx\.php$/', $result['dispatched_script'])) {
            $dispatcherCommand = strtoupper($result['command']).'2PBX';
            $lines = lineMatches($logs['dispatcher'], 'Message '.$result['message_id'].' ('.$dispatcherCommand.')');
        } elseif ($result['command'] === 'LS/LD/LR/LA') {
            foreach (array('Connected to', 'Send LS', 'LD|', 'LR|', 'Send LA') as $needle) {
                $lines = array_merge($lines, lineMatches($logs['client']."\n".$logs['server'], $needle));
            }
        } else {
            $needle = $result['raw_frame'] !== '' ? $result['raw_frame'] : $result['command'].'|';
            $lines = array_merge(lineMatches($logs['client'], $needle), lineMatches($logs['server'], $needle));
        }
        $result['associated_logs'] = array_values(array_unique($lines));
        $result['hotel_logs'] = array_values(array_filter($lines, function ($line) {
            return strpos($line, 'nethhotel[') !== false;
        }));
    }
    unset($result);
}

function visibleFrame($frame) {
    return str_replace(array(chr(2), chr(3), "\r", "\n"), array('<STX>', '<ETX>', '', '\\n'), (string)$frame);
}

function markdownCell($value) {
    return str_replace(array('|', "\r", "\n"), array('\\|', '', '<br>'), (string)$value);
}

function fileComponent($value) {
    return trim(strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $value)), '-');
}

function writeEvidence($artifactDir, $logs, $results, $status, $error, $environmentInfo, $cleanup) {
    $commandDir = $artifactDir.'/commands';
    if (!is_dir($commandDir) && !mkdir($commandDir, 0755, true)) {
        throw new RuntimeException("Unable to create {$commandDir}");
    }
    file_put_contents($artifactDir.'/fias-server.log', $logs['server']);
    file_put_contents($artifactDir.'/fiasd.log', $logs['client']);
    file_put_contents($artifactDir.'/dispatcher.log', $logs['dispatcher']);
    $hotelLines = array();
    foreach ($results as $index => &$result) {
        $name = sprintf('%02d-%s-%s.log', $index + 1, fileComponent($result['command']), fileComponent($result['mode']));
        $result['evidence_file'] = 'commands/'.$name;
        $content = 'Direction: '.$result['direction']."\n";
        $content .= 'FIAS record: '.$result['command'].' ('.$result['mode'].")\n";
        $content .= 'Trigger script: '.$result['trigger_script']."\nDispatched script: ".$result['dispatched_script']."\n";
        $content .= 'Message ID: '.($result['message_id'] === null ? 'n/a' : $result['message_id'])."\n";
        $content .= 'Raw frame: '.visibleFrame($result['raw_frame'])."\nParameters: ".json_encode($result['parameters'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n";
        $content .= 'Transport: '.$result['transport_status']."\nFunction: ".$result['functional_status'].' - '.$result['assertion']."\n\n";
        $content .= "Producer log:\n".($result['producer_log'] !== '' ? $result['producer_log'] : '(none expected)')."\n\n";
        $content .= "Associated daemon/dispatcher logs:\n".(count($result['associated_logs']) ? implode("\n", $result['associated_logs']) : '(none captured)')."\n\n";
        $content .= "Associated NethHotel logs:\n".(count($result['hotel_logs']) ? implode("\n", $result['hotel_logs']) : '(none expected)')."\n";
        file_put_contents($commandDir.'/'.$name, $content);
        foreach ($result['hotel_logs'] as $line) {
            $hotelLines[] = sprintf('[%02d %s %s] %s', $index + 1, $result['command'], $result['mode'], $line);
        }
    }
    unset($result);
    file_put_contents($artifactDir.'/hotel.log', count($hotelLines) ? implode("\n", $hotelLines)."\n" : "No NethHotel log entries were emitted.\n");
    file_put_contents($artifactDir.'/environment.json', json_encode($environmentInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");

    $exclusions = array(
        'gc2pms.php is present but not wired by the default fias.conf.',
        'wa2pbx.php is not present/wired; WA is PBX -> PMS only.',
        'RE2PBX statuses 2 and 5 explicitly log not implemented; status 6 has no handler branch.',
        'PA2PBX transport/dispatch is tested; its business handler explicitly logs not implemented.',
    );
    $report = array(
        'status' => $status,
        'error' => $error,
        'generated_at' => gmdate('c'),
        'scenario' => $environmentInfo['scenario'],
        'environment' => $environmentInfo,
        'commands_tested' => count($results),
        'results' => $results,
        'cleanup' => $cleanup,
        'expected_exclusions' => $exclusions,
    );
    file_put_contents($artifactDir.'/report.json', json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");

    $markdown = "# FIAS end-to-end evidence\n\n- Overall status: **{$status}**\n";
    $markdown .= '- Scenario: `'.markdownCell($environmentInfo['scenario'])."`\n- Fixture rooms: `".implode(', ', $environmentInfo['fixture_rooms'])."`\n- Tested records/modes: **".count($results)."**\n";
    if ($error !== '') {
        $markdown .= '- Failure: `'.markdownCell($error)."`\n";
    }
    $markdown .= "\n| # | Direction | FIAS record / mode | Trigger script | Dispatched script | Wire evidence | Functional assertion | Hotel log evidence |\n| ---: | --- | --- | --- | --- | --- | --- | --- |\n";
    foreach ($results as $index => $result) {
        $hotel = count($result['hotel_logs']) ? implode('<br>', array_map('markdownCell', $result['hotel_logs'])) : 'none expected';
        $wire = '['.$result['transport_status'].']('.$result['evidence_file'].') `'.markdownCell(visibleFrame($result['raw_frame'])).'`';
        $markdown .= '| '.($index + 1).' | '.markdownCell($result['direction']).' | `'.markdownCell($result['command']).'` '.markdownCell($result['mode']).' | `'.markdownCell($result['trigger_script']).'` | `'.markdownCell($result['dispatched_script']).'` | '.$wire.' | **'.$result['functional_status'].'** — '.markdownCell($result['assertion']).' | '.$hotel." |\n";
    }
    $markdown .= "\n## Cleanup\n\n";
    foreach ($cleanup as $name => $value) {
        $markdown .= '- '.markdownCell($name).': **'.markdownCell($value)."**\n";
    }
    $markdown .= "\n## Expected exclusions\n\n";
    foreach ($exclusions as $exclusion) {
        $markdown .= '- '.$exclusion."\n";
    }
    $markdown .= "\nFull logs: [fiasd.log](fiasd.log), [fias-server.log](fias-server.log), [dispatcher.log](dispatcher.log), [hotel.log](hotel.log).\n";
    file_put_contents($artifactDir.'/report.md', $markdown);
}

if (in_array('--help', $argv, true) || in_array('-h', $argv, true)) {
    usage(0);
}
if ($argc > 2 || ($argc === 2 && (!ctype_digit($argv[1]) || (int)$argv[1] <= 0 || (int)$argv[1] > 9994))) {
    usage();
}

$dbConfigPath = '/etc/freepbx_db.conf';
$baseConfigPath = '/etc/asterisk/fias.conf';
if (!file_exists($baseConfigPath) || !file_exists('/var/www/html/freepbx/hotel/functions.inc.php')) {
    usage();
}

$runId = getmypid();
$runtimeDir = sys_get_temp_dir().'/fias-e2e-runtime-'.$runId;
$artifactDir = envValue('FIAS_E2E_ARTIFACT_DIR', sys_get_temp_dir().'/fias-e2e-evidence-'.$runId);
ensureEmptyDirectory($artifactDir);
if (!mkdir($runtimeDir, 0700, true) && !is_dir($runtimeDir)) {
    throw new RuntimeException("Unable to create {$runtimeDir}");
}
$paths = array(
    'config' => $runtimeDir.'/fias.conf',
    'db_config' => $runtimeDir.'/freepbx_db.conf',
    'server' => $runtimeDir.'/fias-server.log',
    'client' => $runtimeDir.'/fiasd.log',
    'dispatcher' => $runtimeDir.'/dispatcher.log',
);
$results = array();
$processes = array();
$status = 'FAIL';
$error = '';
$logs = array('server' => '', 'client' => '', 'dispatcher' => '');
$cleanup = array('fixture rows' => 'NOT RUN', 'Asterisk state' => 'NOT RUN', 'needReload option' => 'NOT RUN', 'transport databases' => 'NOT RUN', 'runtime secrets' => 'NOT RUN');
$fiasPdo = null;
$serverPdo = null;
$roomsPdo = null;
$adminPdo = null;
$rooms = array();
$needReload = array();
$groupNumber = 'FIAS-E2E-'.$runId;
$skipDatabaseCreate = envFlag('FIAS_E2E_SKIP_DB_CREATE');
$databaseNames = array('fias' => envValue('FIAS_DB_NAME', 'fias_e2e_'.$runId), 'server' => envValue('FIAS_SERVER_DB_NAME', 'fias_server_e2e_'.$runId));
$environmentInfo = array(
    'scenario' => envValue('FIAS_E2E_SCENARIO', 'manual'),
    'module_id' => envValue('FIAS_E2E_MODULE_ID'),
    'node' => envValue('FIAS_E2E_NODE'),
    'image' => envValue('FIAS_E2E_IMAGE'),
    'php_version' => PHP_VERSION,
    'fixture_rooms' => array(),
);

try {
    requireCondition($databaseNames['fias'] !== $databaseNames['server'], 'FIAS_DB_NAME and FIAS_SERVER_DB_NAME must differ');
    if ($skipDatabaseCreate) {
        requireCondition(envValue('FIAS_DB_NAME') !== '' && envValue('FIAS_SERVER_DB_NAME') !== '', 'FIAS_E2E_SKIP_DB_CREATE=1 requires both database names');
    }
    $ampConf = loadAmpConf($dbConfigPath);
    $appSettings = ampSettings($ampConf);
    $rootSettings = adminSettings($ampConf);
    $transportSettings = $rootSettings === null ? $appSettings : $rootSettings;
    $adminPdo = $rootSettings === null ? null : connectMysql($rootSettings);
    $roomsPdo = connectMysql($appSettings, 'roomsdb');
    $rooms = fixtureRooms($roomsPdo, $appSettings['database'], $argc === 2 ? (int)$argv[1] : null);
    $environmentInfo['fixture_rooms'] = $rooms;
    foreach ($rooms as $room) {
        requireCondition(asteriskValue('DND', (string)$room) === null, "Fixture room {$room} already has DND state");
        requireCondition(asteriskValue('AMPUSER', $room.'/cidname') === null, "Fixture room {$room} already has cidname state");
    }
    $needReload = optionSnapshot($roomsPdo, 'needReload');

    writeTransportConfig($baseConfigPath, $paths['config'], allocatePort(), $rootSettings);
    $processDbConfig = $dbConfigPath;
    if ($rootSettings !== null) {
        writeDbConfig($paths['db_config'], $rootSettings);
        $processDbConfig = $paths['db_config'];
    }
    if ($skipDatabaseCreate) {
        $fiasPdo = connectMysql($transportSettings, $databaseNames['fias']);
        $serverPdo = connectMysql($transportSettings, $databaseNames['server']);
        ensureTransportSchema($fiasPdo);
        ensureTransportSchema($serverPdo);
    } else {
        $fiasPdo = createTransport($adminPdo, $ampConf, $transportSettings, $databaseNames['fias']);
        $serverPdo = createTransport($adminPdo, $ampConf, $transportSettings, $databaseNames['server']);
    }

    $environment = processEnvironment(array(
        'FIAS_CONFIG_PATH' => $paths['config'],
        'FIAS_DB_NAME' => $databaseNames['fias'],
        'FIAS_SERVER_DB_NAME' => $databaseNames['server'],
        'FREEPBX_DB_CONF_PATH' => $processDbConfig,
        'FIAS_SERVER_LOCK_PATH' => $runtimeDir.'/fias-server.lock',
    ));
    $baseDir = __DIR__;
    $processes[] = startProcess($baseDir.'/fias-server.php', $environment, $paths['server']);
    $processes[] = startProcess($baseDir.'/dispatcher.php', $environment, $paths['dispatcher']);
    $processes[] = startProcess($baseDir.'/fiasd.php', $environment, $paths['client']);
    waitUntil('FIAS LS/LD/LR/LA handshake', function () use ($processes, $paths) {
        foreach ($processes as $process) {
            assertProcessRunning($process);
        }
        return logHas($paths['client'], 'Connected to') && logHas($paths['client'], 'received: LS|')
            && logHas($paths['client'], 'received: LA|') && logHas($paths['server'], 'LR|RIGI|');
    }, PROCESS_STARTUP_TIMEOUT);
    $results[] = resultRow(
        'Bidirectional', 'LS/LD/LR/LA', 'initial handshake',
        'fiasd.php + fias-server.php', 'fiasd.php + fias-server.php',
        array('raw' => 'LS -> LD/LR -> LA', 'parameters' => array('records' => 'LS, LD, LR, LA')),
        'client and PMS simulator complete link synchronization'
    );
    echo "[PASS] FIAS LS/LD/LR/LA handshake\n";

    list($mainRoom, $moveRoom, $groupRoomA, $groupRoomB, $statusRoomA, $statusRoomB) = $rooms;
    $date = date('ymd', time() + 86400);
    $reservationBase = $mainRoom * 100;

    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-gi2pbx.php', 'GI', 'standard check-in',
        array($mainRoom, $reservationBase + 1, 'Move Guest', 'IT', '', 'N', '', '', '', '', ''), 'gi2pbx.php',
        'room checked in with guest name and Italian language', function () use ($roomsPdo, $mainRoom) {
            $room = roomState($roomsPdo, $mainRoom);
            return $room !== null && (int)$room['clean'] === 0 && $room['text'] === 'Move Guest' && $room['lang'] === 'it';
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-gc2pbx.php', 'GC', 'room move',
        array($moveRoom, $reservationBase + 1, 'Moved Guest', 'EN', 'N', $mainRoom, '', '', '', ''), 'gc2pbx.php',
        'reservation and occupied room moved to the new room', function () use ($roomsPdo, $fiasPdo, $mainRoom, $moveRoom) {
            $old = roomState($roomsPdo, $mainRoom);
            $new = roomState($roomsPdo, $moveRoom);
            return $old !== null && (int)$old['clean'] === 1 && $new !== null && (int)$new['clean'] === 0
                && $new['text'] === 'Moved Guest' && reservationCount($fiasPdo, $moveRoom) === 1;
        });

    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-gi2pbx.php', 'GI', 'GG group create',
        array($groupRoomA, $reservationBase + 2, 'Group Alpha', 'FR', $groupNumber, 'N', '', '', '', '', ''), 'gi2pbx.php',
        'FIAS-managed guest group created and assigned', function () use ($roomsPdo, $groupRoomA, $groupNumber) {
            return groupCount($roomsPdo, $groupNumber) === 1 && roomGroup($roomsPdo, $groupRoomA) === $groupNumber;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-gi2pbx.php', 'GI', 'GG group reuse',
        array($groupRoomB, $reservationBase + 3, 'Shared Alpha', 'GE', $groupNumber, 'N', '', '', '', '', ''), 'gi2pbx.php',
        'same FIAS-managed group reused for a second room', function () use ($roomsPdo, $groupRoomB, $groupNumber) {
            return groupCount($roomsPdo, $groupNumber) === 1 && roomGroup($roomsPdo, $groupRoomB) === $groupNumber;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-gi2pbx.php', 'GI', 'shared guest',
        array($groupRoomB, $reservationBase + 4, 'Shared Beta', 'EN', $groupNumber, 'Y', '', '', '', '', ''), 'gi2pbx.php',
        'shared guest appended while group assignment is retained', function () use ($roomsPdo, $fiasPdo, $groupRoomB, $groupNumber) {
            $room = roomState($roomsPdo, $groupRoomB);
            return $room !== null && $room['text'] === 'Shared Alpha - Shared Beta'
                && reservationCount($fiasPdo, $groupRoomB) === 2 && roomGroup($roomsPdo, $groupRoomB) === $groupNumber;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-go2pbx.php', 'GO', 'partial shared checkout',
        array($groupRoomB, $reservationBase + 3, 'Y', ''), 'go2pbx.php',
        'one shared guest removed while occupancy and group remain', function () use ($roomsPdo, $fiasPdo, $groupRoomB, $groupNumber) {
            $room = roomState($roomsPdo, $groupRoomB);
            return $room !== null && (int)$room['clean'] === 0 && $room['text'] === 'Shared Beta'
                && reservationCount($fiasPdo, $groupRoomB) === 1 && roomGroup($roomsPdo, $groupRoomB) === $groupNumber;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-go2pbx.php', 'GO', 'final shared checkout',
        array($groupRoomB, $reservationBase + 4, 'Y', ''), 'go2pbx.php',
        'final shared guest checked out and FIAS group assignment removed', function () use ($roomsPdo, $fiasPdo, $groupRoomB) {
            $room = roomState($roomsPdo, $groupRoomB);
            return $room !== null && (int)$room['clean'] === 1 && reservationCount($fiasPdo, $groupRoomB) === 0 && roomGroup($roomsPdo, $groupRoomB) === null;
        });

    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-wr2pbx.php', 'WR', 'create wake-up',
        array($date, '233000', $moveRoom), 'wr2pbx.php', 'enabled 23:30 alarm and call row created', function () use ($roomsPdo, $moveRoom) {
            $alarm = alarmState($roomsPdo, $moveRoom);
            return $alarm !== null && (int)$alarm['enabled'] === 1 && $alarm['hour'] === '23:30:00' && alarmCallCount($roomsPdo, $moveRoom) > 0;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-wc2pbx.php', 'WC', 'clear wake-up',
        array($date, '233000', $moveRoom), 'wc2pbx.php', 'wake-up alarm disabled and call rows removed', function () use ($roomsPdo, $moveRoom) {
            $alarm = alarmState($roomsPdo, $moveRoom);
            return $alarm !== null && (int)$alarm['enabled'] === 0 && alarmCallCount($roomsPdo, $moveRoom) === 0;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-go2pbx.php', 'GO', 'final checkout',
        array($moveRoom, $reservationBase + 1, 'N', ''), 'go2pbx.php', 'moved reservation checked out', function () use ($roomsPdo, $fiasPdo, $moveRoom) {
            $room = roomState($roomsPdo, $moveRoom);
            return $room !== null && (int)$room['clean'] === 1 && reservationCount($fiasPdo, $moveRoom) === 0;
        });

    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-gi2pbx.php', 'GI', 'RE fixture A',
        array($statusRoomA, $reservationBase + 5, 'Status One', 'EN', '', 'N', '', '', '', '', ''), 'gi2pbx.php',
        'first room prepared for room-status tests', function () use ($roomsPdo, $statusRoomA) {
            $room = roomState($roomsPdo, $statusRoomA);
            return $room !== null && (int)$room['clean'] === 0;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-re2pbx.php', 'RE', 'RS=1, DN=Y',
        array($statusRoomA, '1', '', '', 'Y'), 're2pbx.php', 'Dirty/Vacant checks out the room and enables DND', function () use ($roomsPdo, $statusRoomA) {
            $room = roomState($roomsPdo, $statusRoomA);
            return $room !== null && (int)$room['clean'] === 1 && asteriskValue('DND', (string)$statusRoomA) === 'YES';
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-re2pbx.php', 'RE', 'RS=4, DN=N',
        array($statusRoomA, '4', '', '', 'N'), 're2pbx.php', 'Inspected/Vacant removes the room and disables DND', function () use ($roomsPdo, $statusRoomA) {
            return roomState($roomsPdo, $statusRoomA) === null && asteriskValue('DND', (string)$statusRoomA) === null;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-gi2pbx.php', 'GI', 'RE fixture B',
        array($statusRoomB, $reservationBase + 6, 'Status Three', 'EN', '', 'N', '', '', '', '', ''), 'gi2pbx.php',
        'second room prepared for room-status tests', function () use ($roomsPdo, $statusRoomB) {
            $room = roomState($roomsPdo, $statusRoomB);
            return $room !== null && (int)$room['clean'] === 0;
        });
    inbound($results, $baseDir, $environment, $fiasPdo, 'fias-server-re2pbx.php', 'RE', 'RS=3',
        array($statusRoomB, '3', '', '', ''), 're2pbx.php', 'Clean/Vacant removes the room', function () use ($roomsPdo, $statusRoomB) {
            return roomState($roomsPdo, $statusRoomB) === null;
        });

    $beforePa = maxMessageId($fiasPdo);
    $paLog = runPhp($baseDir.'/fias-server-pa2pbx.php', array('OK', $date, '42', $moveRoom, date('His')), $environment);
    $paMessage = waitForMessage($fiasPdo, $beforePa, 'PA', 'PBX', true, 'PA transport and dispatch');
    waitUntil('PA not-implemented marker', function () use ($paths, $paMessage) {
        return logHas($paths['dispatcher'], 'Message '.$paMessage['id'].' (PA2PBX) handler:') && logHas($paths['dispatcher'], '[not implemented]');
    });
    $results[] = resultRow('PMS -> PBX', 'PA', 'posting answer placeholder', 'fias-server-pa2pbx.php', 'pa2pbx.php', $paMessage,
        'transport and dispatch pass; business handler explicitly reports not implemented', $paLog, 'NOT_IMPLEMENTED');
    echo "[PASS] PMS -> PBX PA expected placeholder\n";

    $connections = substr_count(logText($paths['client']), 'Connected to');
    $beforeLe = maxMessageId($serverPdo);
    $leLog = runPhp($baseDir.'/fias-server-le2pbx.php', array(), $environment);
    $leMessage = waitForMessage($serverPdo, $beforeLe, 'LE', 'PBX', true, 'PMS-initiated LE transmission');
    waitUntil('fiasd reconnect after PMS-initiated LE', function () use ($paths, $connections) {
        return substr_count(logText($paths['client']), 'Connected to') > $connections;
    });
    $leMessage['parameters'] = array();
    $results[] = resultRow('PMS -> PBX', 'LE', 'PMS-initiated link end and reconnect', 'fias-server-le2pbx.php', 'fiasd.php link state', $leMessage,
        'LE closes the link and fiasd reconnects with a fresh handshake', $leLog);
    echo "[PASS] PMS -> PBX LE reconnect\n";

    outbound($results, $baseDir, $environment, $serverPdo, 'wr2pms.php', 'WR', 'wake-up request', array($date, '073000', $moveRoom), 'WR frame received by PMS simulator');
    outbound($results, $baseDir, $environment, $serverPdo, 'wc2pms.php', 'WC', 'wake-up clear', array($date, '073000', $moveRoom), 'WC frame received by PMS simulator');
    outbound($results, $baseDir, $environment, $serverPdo, 'wa2pms.php', 'WA', 'answer status OK', array($date, '073000', $moveRoom, 'OK'), 'WA/AS=OK frame received by PMS simulator');
    foreach (array('1', '3', '4') as $roomStatus) {
        outbound($results, $baseDir, $environment, $serverPdo, 're2pms.php', 'RE', 'RS='.$roomStatus, array($moveRoom, $roomStatus), 'RE room-status frame received by PMS simulator');
    }
    outbound($results, $baseDir, $environment, $serverPdo, 'ps2pms.php', 'PS', 'direct producer',
        array($date, '3281231231', '000015', '', '', '', 'C', $moveRoom, '25', '113000', '9001', '', 'E2E'),
        'direct PS posting frame received by PMS simulator');
    outbound($results, $baseDir, $environment, $serverPdo, 'dr2pms.php', 'DR', 'database resync', array($date, date('His')), 'DR frame received by PMS simulator');

    setConfigValue($paths['config'], 'minibar', 'psmode', 'M');
    $minibarM = outbound($results, $baseDir, $environment, $serverPdo, 'minibar.php', 'PS', 'minibar mode M',
        array($date, '113100', $moveRoom, 'SNACK', '2', '12'), 'minibar emits PT=M with article and quantity');
    requireCondition(isset($minibarM['parameters']['PT']) && $minibarM['parameters']['PT'] === 'M'
        && isset($minibarM['parameters']['MA']) && !isset($minibarM['parameters']['TA']), 'Minibar mode M fields are incorrect');
    setConfigValue($paths['config'], 'minibar', 'psmode', 'C');
    $minibarC = outbound($results, $baseDir, $environment, $serverPdo, 'minibar.php', 'PS', 'minibar mode C',
        array($date, '113200', $moveRoom, 'SNACK', '2', '12'), 'minibar emits PT=C with total amount and sales outlet');
    requireCondition(isset($minibarC['parameters']['PT']) && $minibarC['parameters']['PT'] === 'C'
        && isset($minibarC['parameters']['TA']) && !isset($minibarC['parameters']['MA']), 'Minibar mode C fields are incorrect');

    $cdrArguments = array(
        $moveRoom, 'PJSIP/'.$moveRoom.'-00000001', '2026-09-04 12:00:20', '20', '', 'fias-e2e-'.$runId, '',
        '2026-09-04 12:00:00', '', '3281231231', 'ANSWERED', 'Dial', '20', 'hotel', 'PJSIP/trunk-00000001', $moveRoom,
    );
    setConfigValue($paths['config'], 'cdr', 'cdrMode', 'C');
    $cdrC = outbound($results, $baseDir, $environment, $serverPdo, 'cdr.php', 'PS', 'CDR mode C', $cdrArguments,
        'answered outbound CDR emits PT=C and total amount');
    requireCondition(isset($cdrC['parameters']['PT']) && $cdrC['parameters']['PT'] === 'C' && isset($cdrC['parameters']['TA']), 'CDR mode C fields are incorrect');
    setConfigValue($paths['config'], 'cdr', 'cdrMode', 'T');
    $cdrArguments[5] = 'fias-e2e-'.$runId.'-t';
    $cdrT = outbound($results, $baseDir, $environment, $serverPdo, 'cdr.php', 'PS', 'CDR mode T', $cdrArguments,
        'answered outbound CDR emits PT=T and meter pulses');
    requireCondition(isset($cdrT['parameters']['PT']) && $cdrT['parameters']['PT'] === 'T' && isset($cdrT['parameters']['MP']), 'CDR mode T fields are incorrect');

    $beforeClientLe = maxMessageId($fiasPdo);
    $clientLeLog = runPhp($baseDir.'/le2pms.php', array(), $environment);
    $clientLeMessage = waitForMessage($fiasPdo, $beforeClientLe, 'LE', 'PMS', true, 'PBX-initiated LE completion');
    $clientLeMessage['parameters'] = array();
    $results[] = resultRow('PBX -> PMS', 'LE', 'PBX-initiated clean shutdown', 'le2pms.php', 'fiasd.php link state', $clientLeMessage,
        'LE frame sent and client daemon exits cleanly', $clientLeLog);
    waitUntil('fiasd exit after PBX-initiated LE', function () use ($processes) {
        $processStatus = proc_get_status($processes[2]['process']);
        return !$processStatus['running'];
    });
    echo "[PASS] PBX -> PMS LE clean shutdown\n";
    $status = 'PASS';
} catch (Throwable $throwable) {
    $error = $throwable->getMessage();
    fwrite(STDERR, "FIAS E2E test failed: {$error}\n");
} finally {
    for ($index = count($processes) - 1; $index >= 0; $index--) {
        stopProcess($processes[$index]);
    }
    $logs = array('server' => logText($paths['server']), 'client' => logText($paths['client']), 'dispatcher' => logText($paths['dispatcher']));
    attachLogs($results, $logs);

    try {
        if ($roomsPdo instanceof PDO && count($rooms)) {
            resetFixtures($roomsPdo, $rooms, $groupNumber);
            $cleanup['fixture rows'] = 'PASS';
        }
    } catch (Throwable $cleanupError) {
        $cleanup['fixture rows'] = 'FAIL: '.$cleanupError->getMessage();
        $status = 'FAIL';
    }
    try {
        cleanupAsterisk($rooms);
        $cleanup['Asterisk state'] = 'PASS';
    } catch (Throwable $cleanupError) {
        $cleanup['Asterisk state'] = 'FAIL: '.$cleanupError->getMessage();
        $status = 'FAIL';
    }
    try {
        if ($roomsPdo instanceof PDO) {
            restoreOption($roomsPdo, 'needReload', $needReload);
            $cleanup['needReload option'] = 'PASS';
        }
    } catch (Throwable $cleanupError) {
        $cleanup['needReload option'] = 'FAIL: '.$cleanupError->getMessage();
        $status = 'FAIL';
    }
    try {
        if ($skipDatabaseCreate) {
            if ($fiasPdo instanceof PDO) {
                clearTransport($fiasPdo);
            }
            if ($serverPdo instanceof PDO) {
                clearTransport($serverPdo);
            }
        } elseif ($adminPdo instanceof PDO) {
            $adminPdo->exec('DROP DATABASE IF EXISTS '.quoteIdentifier($databaseNames['fias']));
            $adminPdo->exec('DROP DATABASE IF EXISTS '.quoteIdentifier($databaseNames['server']));
        }
        $cleanup['transport databases'] = 'PASS';
    } catch (Throwable $cleanupError) {
        $cleanup['transport databases'] = 'FAIL: '.$cleanupError->getMessage();
        $status = 'FAIL';
    }
    try {
        removeDirectory($runtimeDir);
        $cleanup['runtime secrets'] = file_exists($runtimeDir) ? 'FAIL: runtime directory remains' : 'PASS';
        if (file_exists($runtimeDir)) {
            $status = 'FAIL';
        }
    } catch (Throwable $cleanupError) {
        $cleanup['runtime secrets'] = 'FAIL: '.$cleanupError->getMessage();
        $status = 'FAIL';
    }
    try {
        writeEvidence($artifactDir, $logs, $results, $status, $error, $environmentInfo, $cleanup);
    } catch (Throwable $reportError) {
        fwrite(STDERR, 'Unable to write evidence: '.$reportError->getMessage()."\n");
        $status = 'FAIL';
    }
}

echo "FIAS E2E status: {$status}\nEvidence: {$artifactDir}/report.md\n";
exit($status === 'PASS' ? 0 : 1);
