#!/usr/bin/env php
<?php

require_once dirname(__DIR__) . '/command-runner.inc.php';
require_once dirname(__DIR__) . '/database.inc.php';

function securityTestFail($message)
{
    throw new RuntimeException($message);
}

function securityTestSame($expected, $actual, $message)
{
    if ($expected !== $actual) {
        securityTestFail(
            $message . PHP_EOL
                . 'expected: ' . var_export($expected, true) . PHP_EOL
                . 'actual:   ' . var_export($actual, true)
        );
    }
}

function securityTestTrue($value, $message)
{
    securityTestSame(true, $value, $message);
}

function securityTestThrows($callback, $expectedMessage, $message)
{
    try {
        $callback();
    } catch (Throwable $exception) {
        if (strpos($exception->getMessage(), $expectedMessage) !== false) {
            return;
        }
        securityTestFail($message . ': unexpected error ' . $exception->getMessage());
    }
    securityTestFail($message . ': expected exception was not thrown');
}

class SecurityTestStatement
{
    private $database;
    private $queryIndex;

    public function __construct($database, $queryIndex)
    {
        $this->database = $database;
        $this->queryIndex = $queryIndex;
    }

    public function execute($values)
    {
        $this->database->queries[$this->queryIndex]['executions'][] = $values;
        return true;
    }
}

class SecurityTestDatabase
{
    public $queries = array();

    public function prepare($query)
    {
        $this->queries[] = array('sql' => $query, 'executions' => array());
        return new SecurityTestStatement($this, count($this->queries) - 1);
    }

    public function lastInsertId()
    {
        return '42';
    }
}

$testId = getmypid() . '-' . bin2hex(random_bytes(4));
$temporaryDirectory = sys_get_temp_dir() . '/fias-security-' . $testId;
if (!mkdir($temporaryDirectory, 0700)) {
    fwrite(STDERR, "not ok - unable to create {$temporaryDirectory}\n");
    exit(1);
}

$marker = sys_get_temp_dir() . '/fias-pwn-' . $testId;
$capture = $temporaryDirectory . '/captured-value';

$failure = null;
try {
    $payloads = array(
        'x$(touch ' . $marker . ')',
        'x; touch ' . $marker,
        'x`touch ' . $marker . '`',
        "x'); DROP TABLE reservations; --",
        "line one\nline two",
        'value with spaces and "quotes"',
    );

    foreach ($payloads as $payload) {
        if (file_exists($capture)) {
            unlink($capture);
        }
        $command = fiasBuildCommand(
            array(
                PHP_BINARY,
                '-r',
                'file_put_contents($argv[1], $argv[2]);',
                '%ROOM%',
                '%ARG%',
            ),
            array('%ROOM%' => $capture, '%ARG%' => $payload)
        );
        $result = fiasRunProcess($command);
        securityTestSame(0, $result['exit_code'], 'argv process should succeed');
        securityTestSame($payload, file_get_contents($capture), 'payload should remain literal data');
        securityTestSame(false, file_exists($marker), 'payload must not create a marker');
    }

    $legacy = 'logger -t fias "Check-in room %ROOM% #%RESERVATION% Guest: '
        . '%GUESTNAME% %GUESTLANGUAGE%. Custom field A0: %ARG%"';
    $legacyPayload = 'x$(touch ' . $marker . ')';
    securityTestTrue(
        strlen($legacyPayload) <= 50,
        'command injection payload should fit the FIAS database field'
    );
    $legacyCommand = fiasBuildCommand(
        $legacy,
        array(
            '%ARG%' => $legacyPayload,
            '%ROOM%' => '101',
            '%RESERVATION%' => '555',
            '%GUESTNAME%' => 'Smith',
            '%GUESTLANGUAGE%' => 'en',
        )
    );
    securityTestSame('logger', $legacyCommand[0], 'legacy executable should remain fixed');
    securityTestTrue(
        count(array_filter($legacyCommand, function ($argument) use ($legacyPayload) {
            return strpos($argument, $legacyPayload) !== false;
        })) === 1,
        'legacy payload should remain literal inside one argument'
    );
    securityTestSame(
        4,
        count($legacyCommand),
        'legacy quoted argument grouping should be preserved'
    );
    $placeholderPayloadCommand = fiasBuildCommand(
        '/bin/echo "%ARG% %ROOM%"',
        array('%ARG%' => '%ROOM%', '%ROOM%' => '101')
    );
    securityTestSame(
        '%ROOM% 101',
        $placeholderPayloadCommand[1],
        'payload text that resembles a placeholder must remain literal'
    );
    $legacyCaptureCommand = fiasBuildCommand(
        PHP_BINARY
            . ' -r \'file_put_contents($argv[1], $argv[2]);\''
            . ' "%ROOM%" "prefix:%ARG%"',
        array('%ROOM%' => $capture, '%ARG%' => $legacyPayload)
    );
    $legacyCaptureResult = fiasRunProcess($legacyCaptureCommand);
    securityTestSame(0, $legacyCaptureResult['exit_code'], 'legacy argv process should succeed');
    securityTestSame(
        'prefix:' . $legacyPayload,
        file_get_contents($capture),
        'legacy payload should remain literal process data'
    );
    securityTestSame(false, file_exists($marker), 'legacy payload must not create a marker');

    $operatorCommand = fiasBuildCommand('/bin/echo safe ; touch ' . $marker);
    $operatorResult = fiasRunProcess($operatorCommand);
    securityTestSame(0, $operatorResult['exit_code'], 'legacy shell syntax should be passed literally');
    securityTestSame(false, file_exists($marker), 'legacy shell syntax must not execute');

    $configPath = dirname(__DIR__, 4) . '/etc/asterisk/fias.conf';
    $configuration = parse_ini_file($configPath, true);
    securityTestTrue(is_array($configuration), 'shipped FIAS configuration should parse');
    securityTestTrue(
        is_array($configuration['custom_fields']['A0']),
        'shipped A0 command should use argv configuration'
    );
    $defaultCommand = fiasBuildCommand(
        $configuration['custom_fields']['A0'],
        array(
            '%ARG%' => $legacyPayload,
            '%ROOM%' => '101',
            '%RESERVATION%' => '555',
            '%GUESTNAME%' => 'Smith',
            '%GUESTLANGUAGE%' => 'en',
        )
    );
    securityTestSame('/usr/bin/logger', $defaultCommand[0], 'default executable should be absolute');
    securityTestTrue(
        in_array($legacyPayload, $defaultCommand, true),
        'default command should pass A0 as one literal argument'
    );

    securityTestThrows(
        function () {
            fiasBuildCommand(array('%ARG%', 'value'), array('%ARG%' => '/bin/echo'));
        },
        'executable cannot contain a placeholder',
        'data must not select an executable'
    );
    securityTestThrows(
        function () {
            fiasBuildCommand(array('/bin/echo', 'prefix %ARG%'), array('%ARG%' => 'value'));
        },
        'standalone arguments',
        'array placeholders must not be embedded in literals'
    );
    securityTestThrows(
        function () {
            fiasBuildCommand('/bin/echo "%UNKNOWN%"');
        },
        'Unknown command placeholder',
        'unknown placeholders should be rejected'
    );
    securityTestThrows(
        function () {
            fiasBuildCommand('/bin/echo "unterminated');
        },
        'unterminated quote',
        'malformed legacy quoting should be rejected'
    );
    securityTestThrows(
        function () {
            fiasBuildCommand(array('/bin/echo', '%ARG%'), array('%ARG%' => "bad\0value"));
        },
        'NUL byte',
        'NUL payloads should be rejected'
    );

    $failureResult = fiasRunProcess(
        array(PHP_BINARY, '-r', 'fwrite(STDERR, "failure\\n"); exit(7);')
    );
    securityTestSame(7, $failureResult['exit_code'], 'child exit status should be retained');
    securityTestSame(array('failure'), $failureResult['output'], 'stderr should be captured safely');

    $sqlPayload = "x'); DROP TABLE reservations; --";
    securityTestTrue(
        strlen($sqlPayload) <= 50,
        'SQL injection payload should fit the FIAS database field'
    );
    $database = new SecurityTestDatabase();
    $messageId = insertFiasMessage(
        $database,
        'GI',
        'PBX',
        array(array('A0', $sqlPayload)),
        'GI|A0' . $sqlPayload
    );
    securityTestSame('42', $messageId, 'database helper should return the inserted message id');
    securityTestSame(2, count($database->queries), 'message persistence should use two statements');
    foreach ($database->queries as $query) {
        securityTestSame(
            false,
            strpos($query['sql'], $sqlPayload) !== false,
            'SQL payload must not be interpolated into a statement'
        );
        securityTestSame(1, substr_count($query['sql'], 'INSERT INTO'), 'only fixed INSERT SQL is allowed');
    }
    securityTestSame(
        array('GI', 'PBX', 'GI|A0' . $sqlPayload),
        $database->queries[0]['executions'][0],
        'raw FIAS data should be bound to the message statement'
    );
    securityTestSame(
        array('42', 'A0', $sqlPayload),
        $database->queries[1]['executions'][0],
        'FIAS field data should be bound to the parameter statement'
    );
    $pdoOptions = fiasPdoOptions();
    securityTestSame(
        PDO::ERRMODE_EXCEPTION,
        $pdoOptions[PDO::ATTR_ERRMODE],
        'PDO errors should raise exceptions'
    );
    securityTestSame(
        false,
        $pdoOptions[PDO::ATTR_EMULATE_PREPARES],
        'FIAS connections should use native prepared statements'
    );
    if (defined('PDO::MYSQL_ATTR_MULTI_STATEMENTS')) {
        securityTestSame(
            false,
            $pdoOptions[PDO::MYSQL_ATTR_MULTI_STATEMENTS],
            'FIAS connections should disable multiple SQL statements'
        );
    }
    securityTestThrows(
        function () use ($database) {
            insertFiasMessage($database, 'GI; DROP TABLE messages', 'PBX', array());
        },
        'Invalid FIAS command',
        'FIAS command identifiers should be validated'
    );
    securityTestThrows(
        function () use ($database) {
            insertFiasMessage($database, 'GI', 'PBX', array('A0; DROP' => 'value'));
        },
        'Invalid FIAS parameter',
        'FIAS parameter identifiers should be validated'
    );

} catch (Throwable $exception) {
    $failure = $exception;
} finally {
    foreach (array($capture, $marker) as $path) {
        if (file_exists($path)) {
            unlink($path);
        }
    }
    rmdir($temporaryDirectory);
}

if ($failure !== null) {
    fwrite(STDERR, 'not ok - ' . $failure->getMessage() . PHP_EOL);
    exit(1);
}

fwrite(STDOUT, "ok - FIAS command and SQL injection regressions\n");
