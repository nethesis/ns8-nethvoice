#!/usr/bin/env php
<?php
// Run the real AGI body in a child process, isolating its exit() calls and
// replacing only FreePBX/AGI I/O. This does not simulate Asterisk channel state.
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
class FreePBX {
    public static function Database() { return new self(); }
    public function prepare($sql) { return $this; }
    public function execute($args) { check($args === ['201'], 'wrong PIN owner'); }
    public function fetch($mode) { return json_decode($GLOBALS['argv'][2], true)['row']; }
}
class AGI {
    public array $events = [];
    public array $digits;
    public function __construct() {
        $this->digits = json_decode($GLOBALS['argv'][2], true)['digits'];
        register_shutdown_function(function () { echo json_encode($this->events); });
    }
    public function verbose($message) {}
    public function answer() { $this->events[] = 'answer'; }
    public function exec($app, $args) { $this->events[] = [$app, $args]; }
    public function stream_file($file) { $this->events[] = $file; }
    public function get_data($file, $timeout, $length) {
        $this->events[] = 'read';
        check(count($this->digits) > 0, 'too many PIN attempts');
        return ['result' => array_shift($this->digits)];
    }
    public function hangup() { $this->events[] = 'hangup'; }
}
if (($argv[1] ?? '') === '--worker') {
    $source = file_get_contents(__DIR__.'/../var/www/html/freepbx/admin/modules/pin/agi-bin/outbound-routes-pin.php');
    $argv[1] = '201';
    // Skip the system bootstrap; execute the debug helper and complete AGI body.
    eval(substr($source, strpos($source, 'function neth_debug(')));
    exit;
}
$row = ['pin' => '1234', 'enabled' => '1'];
foreach ([
    [$row, ['1234'], 1, false],
    [['pin' => '0042', 'enabled' => '1'], ['42', '42', '42'], 3, true],
    [['pin' => '0042', 'enabled' => '1'], ['0042'], 1, false],
    [$row, ['0', '0', '1234'], 3, false],
    [$row, ['0', '0', '0'], 3, true],
    [$row, ['', '', ''], 3, true],
    [false, [], 0, false],
    [['pin' => '1234', 'enabled' => '0'], [], 0, false],
    [['pin' => '', 'enabled' => '1'], [], 0, false],
] as [$fixture, $digits, $reads, $hangup]) {
    $process = proc_open([PHP_BINARY, __FILE__, '--worker', json_encode(['row' => $fixture, 'digits' => $digits])],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $events = json_decode(stream_get_contents($pipes[1]), true);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    check(proc_close($process) === 0 && $errors === '', 'AGI failed: '.$errors);
    check(count(array_filter($events, fn($e) => $e === 'read')) === $reads, 'incorrect retry count');
    check(in_array('hangup', $events, true) === $hangup, 'incorrect PIN hangup decision');
    if ($hangup) { check(end($events) === 'hangup', 'AGI continued after hangup'); }
    check(!str_contains(json_encode($events), 'Macro'), 'unsupported Macro executed');
}
echo "PASS: PIN success, third-attempt success, three failures, timeouts and unprotected users\n";
