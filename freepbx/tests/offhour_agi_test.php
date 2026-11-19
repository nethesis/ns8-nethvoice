#!/usr/bin/env php
<?php
// Run the off-hour AGI in a child process with a fixture row and stub AGI I/O.
class AGI {
    private array $commands = [];

    public function __construct() {
        register_shutdown_function(function () { echo json_encode($this->commands); });
    }

    public function verbose($message, $level) {}
    public function answer() { $this->commands[] = 'answer'; }
    public function stream_file($file) { $this->commands[] = ['play', $file]; }
    public function set_variable($name, $value) {
        $this->commands[] = ['set', $name, $value];
        return ['result' => $GLOBALS['fixture']['setResult'] ?? '1'];
    }
    public function exec_goto($context, $extension, $priority) {
        $this->commands[] = ['goto', $context, $extension, $priority];
        return $GLOBALS['fixture']['gotoResponse'] ?? ['code' => '200', 'result' => '0'];
    }
    public function hangup() { $this->commands[] = 'hangup'; }
}

if (($argv[1] ?? '') === '--worker') {
    $fixture = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    $argv = [__FILE__, '202', '5550100'];
    $amp_conf = ['PHPTIMEZONE' => 'UTC'];
    define('DB_FETCHMODE_ASSOC', 2);
    $db = new class {
        public function getRow($sql, $mode) {
            if ($sql !== "SELECT * FROM offhour WHERE didcidnum='202' AND didextension='5550100'") {
                throw new RuntimeException('Wrong inbound route selected');
            }
            return $GLOBALS['fixture'] + [
                'enabled' => 1, 'tsbegin' => 0, 'tsend' => 0,
                'displayname' => 'Test rule', 'message' => 'test/announcement',
            ];
        }
        public function isError($result) { return false; }
    };
    $source = file_get_contents(__DIR__.'/../var/www/html/freepbx/admin/modules/nethcti3/agi-bin/offhour.php');
    eval(substr($source, strpos($source, 'global $db;')));
    exit;
}

$play = ['play', 'test/announcement'];
$set = ['set', 'NETHVOICE_OFFHOUR_MAILBOX', '220'];
$goto = ['goto', 'nethvoice-offhour-voicemail', 's', 1];
foreach ([
    'play three times' => [['action' => '0'], ['answer', $play, $play, $play, 'hangup']],
    'hand off once' => [['action' => '1', 'param' => '220'], ['answer', $play, $set, $goto]],
    'empty mailbox' => [['action' => '1', 'param' => ''], ['answer', $play, 'hangup']],
    'mailbox unavailable in FreePBX' => [
        ['action' => '1', 'param' => '999'],
        ['answer', $play, ['set', 'NETHVOICE_OFFHOUR_MAILBOX', '999'], $goto],
    ],
    'mailbox variable rejected' => [
        ['action' => '1', 'param' => '220', 'setResult' => '-1'],
        ['answer', $play, $set, 'hangup'],
    ],
    'handoff command rejected' => [
        ['action' => '1', 'param' => '220', 'gotoResponse' => ['code' => '511', 'result' => null]],
        ['answer', $play, $set, $goto, 'hangup'],
    ],
] as $name => [$row, $expected]) {
    $process = proc_open([PHP_BINARY, __FILE__, '--worker', json_encode($row)],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $actual = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($process) !== 0 || $errors !== '' || json_decode($actual, true) !== $expected) {
        throw new RuntimeException("$name failed: $actual $errors");
    }
    echo "PASS: $name\n";
}
