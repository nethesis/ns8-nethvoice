<?php
// Run with: php freepbx/tests/nethhotel_alarm_test.php
namespace NethHotelAlarmTest;

set_error_handler(function ($severity, $message, $file, $line) {
    throw new \ErrorException($message, 0, $severity, $file, $line);
});
function check($condition, $message) {
    if (!$condition) throw new \RuntimeException($message);
}
class Database {
    public array $alarms = [];
    public $reception;
    public int $retry = 0;
    public array $processed = [];
    public array $history = [];
    public array $escalations = [];
    public static function connection() { global $db; return $db; }
    public function prepare($query) { return new Statement($this, $query); }
}
class Statement {
    public function __construct(private Database $db, private string $query) {}
    public function execute($args) {
        if (str_starts_with($this->query, 'UPDATE roomsdb.alarmcalls')) {
            check(str_contains($this->query, 'WHERE id = ?'), 'Only the handled alarm job may be marked processed');
            $this->db->processed[] = $args[0];
        } elseif (str_starts_with($this->query, 'INSERT INTO roomsdb.alarms_history')) {
            $this->db->history[] = $args;
        } elseif (str_starts_with($this->query, 'INSERT INTO roomsdb.alarmcalls')) {
            $this->db->escalations[] = $args;
        }
    }
    public function fetchAll() {
        return str_contains($this->query, 'max(retry)') ? [[$this->db->retry]] : $this->db->alarms;
    }
    public function fetchColumn() { return $this->db->reception; }
}
// Isolate filesystem ownership and the live Asterisk spool, retaining real callfile writes.
function tempnam($directory, $prefix) { global $temporary; return \tempnam($temporary, $prefix); }
function chown($file, $owner) { return true; }
function chgrp($file, $group) { return true; }
function rename($source, $destination) {
    global $files;
    check(str_starts_with($destination, '/var/spool/asterisk/outgoing/'), 'Unexpected callfile destination');
    $files[basename($destination)] = file_get_contents($source);
    return unlink($source);
}
function neth_debug($message) {}
function fias($command, $fields) { global $feedback; $feedback[] = [$command, $fields]; }

$module = __DIR__.'/../var/www/html/freepbx/admin/modules/nethhotel';
$scheduler = file_get_contents($module.'/bin/alarms.php');
$scheduler = str_replace(["<?php", "include_once('/etc/freepbx.conf');", '\FreePBX::Database()'], ['', '', 'Database::connection()'], $scheduler);
$failure = file_get_contents($module.'/agi-bin/svegliafallita.php');
$start = strpos($failure, '$extension = $argv[1];');
$failure = substr($failure, $start, strrpos($failure, 'exit(0);') - $start);
$temporary = sys_get_temp_dir().'/nethhotel-alarms-'.bin2hex(random_bytes(8));
mkdir($temporary, 0700);
try {
    foreach ([false, null, '', '  ', '88990'] as $reception) {
        $db = new Database();
        $db->reception = $reception;
        $db->alarms = [
            ['id' => 1, 'extension' => '88991', 'timestamp' => time(), 'alarmtype' => 0],
            ['id' => 2, 'extension' => '88991', 'timestamp' => time(), 'alarmtype' => 1],
        ];
        $files = [];
        eval('namespace NethHotelAlarmTest;'.$scheduler);
        $configured = trim((string)$reception) !== '';
        check(count($files) === ($configured ? 2 : 1), 'Room alarm must be dispatched independently of reception');
        $roomCall = reset($files);
        check(str_contains($roomCall, 'Channel: Local/88991@from-internal') && str_contains($roomCall, "MaxRetries: 2\n"), 'Room destination or retries changed');
        $callerid = $configured ? '88990' : '88991';
        check(str_contains($roomCall, 'CallerID: "Sveglia" <'.$callerid.'>'), 'Wake-up call needs a valid caller ID without reception');
        check($db->processed === [1, 2], 'Handled jobs must be marked processed individually');
        foreach ($files as $file) check(!str_contains($file, 'Channel: Local/@'), 'Empty reception destination was dialed');
        if ($configured) check(str_contains(end($files), 'Channel: Local/88990@from-internal'), 'Configured reception must receive escalation');
    }

    foreach ([null, '', '88990'] as $reception) {
        foreach ([0 => 1, 1 => 2, 2 => 99] as $previous => $expected) {
            $db = new Database();
            $db->retry = $previous;
            $argv = ['svegliafallita.php', '88991', (string)time()];
            if ($reception !== null) $argv[] = $reception;
            $feedback = [];
            $calldate = date('Y-m-d H:i:s');
            eval('namespace NethHotelAlarmTest;'.$failure);
            check(count($db->history) === 1 && $db->history[0][3] === $expected, 'Retry and failure history must be retained without reception');
            check(count($db->escalations) === ($expected === 99 && $reception === '88990' ? 1 : 0), 'Reception escalation must require a configured destination');
            check($feedback[0][1]['AS'] === ($expected === 99 ? 'NR' : 'RY'), 'Hotel failure feedback changed');
        }
    }
} finally {
    foreach (glob($temporary.'/*') as $file) unlink($file);
    rmdir($temporary);
}
echo "NethHotel optional-reception alarm regressions passed\n";
