<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the visual plan REST library against in-memory FreePBX modules.
// Run with: php freepbx/tests/visualplan_rest_test.php
require __DIR__ . '/../var/www/html/freepbx/rest/lib/libVisualPlan.php';

$log = tempnam(sys_get_temp_dir(), 'visualplan-rest-');
ini_set('error_log', $log);
register_shutdown_function(fn() => @unlink($log));
set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

class Module {
    public array $calls = [];
    public function __construct(public array $methods = []) {}
    public function __call($name, $args) {
        $this->calls[] = [$name, $args];
        if (!array_key_exists($name, $this->methods)) throw new RuntimeException("Unexpected call $name");
        $method = $this->methods[$name];
        return $method instanceof Closure ? $method(...$args) : $method;
    }
    public function called($name) {
        return array_values(array_map(fn($call) => $call[1], array_filter($this->calls, fn($call) => $call[0] === $name)));
    }
}

class Db {
    public array $statements = [];
    public array $transactions = [];
    public array $missingTables = [];
    public bool $open = false;
    public int $lastId = 0;
    public int $nextId = 100;
    public function prepare($sql) {
        return new class($sql, $this) {
            public function __construct(private string $sql, private Db $db) {}
            public function execute($args) {
                foreach ($this->db->missingTables as $table) {
                    if (str_contains($this->sql, "`$table`")) {
                        $error = new PDOException("Table $table doesn't exist");
                        $error->errorInfo = ['42S02', 1146, "Table $table doesn't exist"];
                        throw $error;
                    }
                }
                $this->db->statements[] = [$this->sql, $args];
                if (str_starts_with($this->sql, 'INSERT')) $this->db->lastId = ++$this->db->nextId;
                return true;
            }
        };
    }
    public function lastInsertId() { return (string) $this->lastId; }
    public function inTransaction() { return $this->open; }
    public function beginTransaction() {
        if ($this->open) throw new PDOException('There is already an active transaction');
        $this->open = true;
        $this->transactions[] = 'begin';
    }
    public function commit() { $this->open = false; $this->transactions[] = 'commit'; }
    public function rollBack() { $this->open = false; $this->transactions[] = 'rollback'; }
}

// The Asterisk DB of the manager, keyed by full path as database_show() returns it.
class Astman {
    public $useCaching = true;
    public function __construct(public array $db = []) {}
    public function database_show($family) {
        return array_filter($this->db, fn($key) => str_starts_with($key, '/' . $family . '/'), ARRAY_FILTER_USE_KEY);
    }
    public function database_get($family, $key) { return $this->db['/' . $family . '/' . $key] ?? false; }
    public function database_put($family, $key, $value) { $this->db['/' . $family . '/' . $key] = (string) $value; return true; }
    public function database_del($family, $key) { unset($this->db['/' . $family . '/' . $key]); return true; }
    public function database_deltree($family) {
        $this->db = array_diff_key($this->db, $this->database_show($family));
        return true;
    }
}
const ASTDB = [
    '/QPENALTY/401/agents/203' => '2', '/QPENALTY/401/agents/204' => '0', '/QPENALTY/401/dynmemberonly' => 'yes',
    '/RINGGROUP/600/changecid' => 'fixed', '/DAYNIGHT/C0' => 'NIGHT', '/CustomDevstate/DAYNIGHT0' => 'INUSE',
    '/AMPUSER/202/voicemail' => 'novm',
];

class FreePBX {
    public static array $modules = [];
    public static function __callStatic($name, $args) {
        if (!isset(self::$modules[$name])) throw new RuntimeException("Unexpected module $name");
        return self::$modules[$name];
    }
}

$functions = [];
$functionCalls = [];
function stub($name, $args) {
    global $functions, $functionCalls;
    if (!isset($functions[$name])) throw new RuntimeException("Unexpected function $name");
    $functionCalls[] = [$name, $args];
    return $functions[$name](...$args);
}
function called($name) {
    global $functionCalls;
    return array_values(array_map(fn($call) => $call[1], array_filter($functionCalls, fn($call) => $call[0] === $name)));
}
// Define the procedural FreePBX functions the library calls as recording stubs.
foreach (['queues_get', 'queues_add', 'queues_del', 'ivr_get_entries', 'nethcqr_get_details', 'nethcqr_get_entries',
    'nethcqr_save_details', 'nethcqr_save_entries', 'nethcqr_delete', 'daynight_list', 'daynight_get_obj',
    'daynight_get_avail', 'daynight_get_timecondition', 'timeconditions_timegroups_get_times'] as $name) {
    eval("function $name(...\$args) { return stub('$name', \$args); }");
}

const QUEUE_401 = [
    'name' => 'Support', 'member' => ['Local/201@from-queue/n,0', 'PJSIP/202,3'], 'dynmembers' => "203,2\n204,0",
    'dynmemberonly' => 'yes', 'strategy' => 'rrmemory', 'timeout' => '15', 'maxwait' => '', 'goto' => 'ext-group,600,1',
    'rtone' => '2', 'prefix' => 'Q:', 'joinannounce_id' => '7', 'announce-position' => 'yes',
    'announce-frequency' => '30', 'announcemenu' => '1', 'callback' => 'none', 'music' => 'default',
    'password' => 'secret', 'agentannounce_id' => '3', 'alertinfo' => 'ring2', 'cwignore' => '2', 'retry' => '7',
    'wrapuptime' => '10', 'servicelevel' => '120', 'cron_schedule' => 'daily', 'lazymembers' => 'yes',
    'answered_elsewhere' => '1', 'eventwhencalled' => 'yes', 'qregex' => '', 'queuewait' => '0',
    'use_queue_context' => '0', 'togglehint' => '0', 'qnoanswer' => '0', 'callconfirm' => '0',
    'callconfirm_id' => null, 'monitor_type' => '', 'monitor_heard' => '0', 'monitor_spoken' => '0',
];
const QUEUE_OPTIONS_9 = [
    'id' => '9', 'name' => 'VIP', 'VQ_CIDPP' => 'VIP:', 'VQ_AINFO' => '', 'VQ_JOINMSG' => 'custom/welcome',
    'VQ_RETRY' => '1', 'VQ_OPTIONS' => '0', 'VQ_GOSUB' => 'sub', 'VQ_AGI' => '', 'VQ_POSITION_ENABLED' => '1',
    'VQ_POSITION' => '2', 'VQ_CONFIRMMSG' => 'confirm', 'VQ_AANNOUNCE' => '', 'VQ_MOH' => 'default',
    'VQ_MAXWAIT_ENABLED' => '0', 'VQ_MAXWAIT' => '300', 'VQ_DEST_ENABLED' => '1',
    'VQ_DEST' => 'queueexit-8,${EXTEN},1', 'DEST' => 'ext-queues,401,1',
];

function fixture() {
    global $functions, $functionCalls, $ivrs, $ivrEntries, $astman, $kvstore;
    $functionCalls = [];
    // The Core kvstore, stored as JSON like FreePBX DB_Helper does.
    $kvstore = ['visualplanLayout' => ['0721/' => json_encode([
        'ivr:1' => ['x' => 10, 'y' => -20], '5' => ['x' => 1, 'y' => 2], 'bad' => ['x' => 1.5, 'y' => 2]])]];
    $astman = new Astman(ASTDB);
    $ivrs = [1 => ['id' => '1', 'name' => 'Men&ugrave;', 'description' => 'Main', 'announcement' => '7',
        'directdial' => 'from-ivr-directory-2', 'invalid_destination' => '', 'timeout_destination' => 'ext-queues,401,1',
        'timeout_loops' => '5', 'invalid_loops' => '4', 'timeout_time' => '7', 'retvm' => 'on']];
    $ivrEntries = [1 => [['ivr_id' => '1', 'selection' => '1', 'dest' => 'from-did-direct,201,1', 'ivr_ret' => '1']]];
    $route = ['extension' => '0721', 'cidnum' => '', 'description' => 'Main', 'alertinfo' => '', 'grppre' => 'M:',
        'destination' => 'ivr-1,s,1', 'mohclass' => 'jazz', 'privacyman' => '1', 'delay_answer' => '2',
        'indication_zone' => 'it', 'ringing' => 'CHECKED', 'fanswer' => '', 'pricid' => '', 'reversal' => '',
        'rvolume' => '', 'pmmaxretries' => '3', 'pmminlength' => '10'];
    $timeCondition = ['timeconditions_id' => '4', 'displayname' => 'Office', 'time' => '5', 'truegoto' => 'ivr-1,s,1',
        'falsegoto' => 'app-announcement-3,s,1', 'timezone' => 'Europe/Rome', 'mode' => 'time-group',
        'calendar_id' => 'cal', 'calendar_group_id' => 'group', 'invert_hint' => '1', 'fcc_password' => '42',
        'deptname' => 'Sales', 0 => '4'];
    FreePBX::$modules = [
        'Core' => new Module([
            'getAllDIDs' => [$route],
            'getDID' => fn($extension, $cidnum) => $extension === '0721' && $cidnum === '' ? $route + [0 => '0721'] : [],
            'editDID' => true, 'editDIDProperties' => true, 'addDID' => true,
            'listUsers' => [['201', 'Alice', 'default'], ['202', 'Bob', 'novm'], ['91201', 'Hidden', 'default']],
            'getUser' => ['extension' => '202', 'name' => 'Bob'],
            'getAll' => fn($id) => array_map(fn($value) => json_decode($value), $GLOBALS['kvstore'][$id] ?? []),
            'getConfig' => fn($key, $id) => isset($GLOBALS['kvstore'][$id][$key]) ? json_decode($GLOBALS['kvstore'][$id][$key]) : false,
            'setConfig' => function ($key, $value, $id) {
                $GLOBALS['kvstore'][$id][$key] = json_encode($value);
                return true;
            },
            'delConfig' => function ($key, $id) { unset($GLOBALS['kvstore'][$id][$key]); },
        ]),
        'Conferences' => new Module(['listConferences' => [['800', 'Meet']], 'addConference' => true,
            'updateConferenceSettingById' => null]),
        'Ringgroups' => new Module([
            'getAllGroups' => [['grpnum' => '600', 'description' => 'Sales', 'grplist' => '201-202-3331234567#',
                'strategy' => 'ringall', 'grptime' => '20', 'postdest' => 'app-blackhole,hangup,1']],
            'get' => ['grpnum' => '600', 'grppre' => 'RG:', 'annmsg_id' => '7', 'alertinfo' => 'ring', 'needsconf' => '',
                'remotealert_id' => '0', 'toolate_id' => '0', 'ringing' => 'Ring', 'cwignore' => 'CHECKED',
                'cfignore' => '', 'cpickup' => 'CHECKED', 'recording' => 'force', 'progress' => 'no',
                'elsewhere' => 'yes', 'rvolume' => '2', 'changecid' => 'fixed', 'fixedcid' => '123'],
            'delete' => null, 'add' => true,
        ]),
        'Queues' => new Module(['listQueues' => [['401', 'Support']]]),
        'Queueoptions' => new Module([
            'queueoptions_get' => fn($id = false) => $id === false ? [QUEUE_OPTIONS_9] : QUEUE_OPTIONS_9 + [0 => '9'],
            'setLazyMembers' => null,
            'logoutUnlistedDynamicMembers' => fn($queue) => $GLOBALS['logoutRequest'] = $_REQUEST,
        ]),
        'Ivr' => new Module([
            'getDetails' => function ($id = false) {
                global $ivrs;
                if ($id === false) return array_values($ivrs);
                return isset($ivrs[$id]) ? $ivrs[$id] + array_values($ivrs[$id]) : [];
            },
            'saveDetails' => function ($row) {
                global $ivrs;
                $id = $row['id'] ?: max(10, ...array_keys($ivrs)) + 1;
                $ivrs[$id] = array_merge($row, ['id' => (string) $id]);
                return $id;
            },
            'saveEntries' => true, 'delete' => null,
        ]),
        'Announcement' => new Module([
            'getAnnouncements' => [['announcement_id' => '3', 'description' => 'Welcome', 'recording_id' => '7',
                'post_dest' => 'ivr-1,s,1']],
            'getAnnouncementByID' => ['announcement_id' => '3', 'description' => 'Welcome', 'recording_id' => '7',
                'allow_skip' => '1', 'post_dest' => 'ivr-1,s,1', 'return_ivr' => '1', 'noanswer' => '0',
                'repeat_msg' => '5'],
            'editAnnouncement' => true, 'addAnnouncement' => '21', 'deleteAnnouncement' => null,
        ]),
        'Timeconditions' => new Module([
            'listTimeconditions' => [$timeCondition],
            'getTimeCondition' => fn($id) => in_array((string) $id, ['4', '31'], true)
                ? array_merge($timeCondition, ['timeconditions_id' => (string) $id, 'tcval' => '*27' . $id]) : ['tcval' => ''],
            'editTimeCondition' => null, 'addTimeCondition' => '31',
            'listTimegroups' => [['5', 'Weekdays', 'value' => '5', 'text' => '5']],
            'addTimeGroup' => '32', 'editTimeGroup' => true, 'delTimeGroup' => true, 'delTimeCondition' => true,
        ]),
        'Daynight' => new Module(['edit' => []]),
        'Setcid' => new Module([
            'listAll' => [['cid_id' => '6', 'description' => 'Tag', 'cid_name' => 'Sales', 'cid_num' => '',
                'dest' => 'ext-queues,401,1']],
            'update' => function ($id) {
                if ($id === null) FreePBX::$modules['Database']->lastId = 101;
                return true;
            },
            'delete' => true,
        ]),
        'Directdid' => new Module(['directdid_get' => [['id' => '7', 'prefix' => '2', 'root' => '0721', 'varlength' => '2',
            'timeout' => '15', 'timeout_destination' => 'app-blackhole,hangup,1',
            'busy_destination' => 'app-blackhole,busy,1', 'unavailable_destination' => 'app-blackhole,hangup,1']]]),
        'Queueexit' => new Module(['queueexit_get' => [['id' => '8', 'displayname' => 'Exit',
            'timeout_destination' => 'ivr-1,s,1', 'full_destination' => 'app-blackhole,hangup,1',
            'joinempty_destination' => 'app-blackhole,hangup,1', 'leaveempty_destination' => 'app-blackhole,hangup,1',
            'joinunavail_destination' => 'app-blackhole,hangup,1', 'leaveunavail_destination' => 'app-blackhole,hangup,1',
            'continue_destination' => 'app-blackhole,hangup,1']]]),
        'Queueprio' => new Module([
            'getPriorities' => [['id' => '10', 'name' => 'High', 'priority' => '5', 'dest' => 'ext-queues,401,1']],
            'addPriority' => '41', 'updatePriority' => true, 'delPriority' => null,
        ]),
        'Recordings' => new Module([
            'getAllRecordings' => [['id' => '7', 'displayname' => 'Welcome &#38; hello', 'filename' => 'custom/welcome',
                'description' => 'Greeting'], ['id' => '8', 'displayname' => 'Bye', 'filename' => 'custom/bye',
                'description' => '']],
        ]),
        'Music' => new Module(['getCategories' => [['category' => 'default'], ['category' => 'jazz']]]),
        'Modules' => new Module(['getDestinations' => [
            'app-blackhole,hangup,1' => ['destination' => 'app-blackhole,hangup,1', 'description' => 'Hangup',
                'category' => 'Terminate Call', 'module' => 'core'],
            'ivr-1,s,1' => ['destination' => 'ivr-1,s,1', 'description' => 'Men&ugrave;', 'module' => 'ivr', 'name' => 'IVR'],
            'custom-odd,s[1],1' => ['destination' => 'custom-odd,s[1],1', 'description' => 'Custom', 'module' => 'customappsreg'],
        ]]),
        'Extensions' => new Module(['checkUsage' => fn($number) => in_array($number, ['201', '202', '401', '600', '800'], true)
            ? ['core' => [$number => []]] : []]),
        'Voicemail' => new Module(['getMailbox' => fn($extension) => $extension === '201' ? ['pwd' => '1'] : null,
            'processQuickCreate' => fn($tech, $extension) => $GLOBALS['astman']->database_put('AMPUSER/' . $extension, 'voicemail', 'default'),
            'delMailbox' => null]),
        'Userman' => new Module(['getUserByDefaultExtension' => ['email' => 'bob@example.com']]),
        'Database' => new Db(),
    ];
    $functions = [
        'queues_get' => fn($number) => $number === '401' ? QUEUE_401 : [],
        'queues_del' => fn($number) => null,
        'queues_add' => function (...$args) {
            $GLOBALS['queueRequest'] = $_REQUEST;
            return true;
        },
        'ivr_get_entries' => fn($id) => $GLOBALS['ivrEntries'][$id] ?? [],
        'nethcqr_get_details' => fn($id = '') => [['id_cqr' => '2', 'name' => 'Customers', 'description' => '',
            'announcement' => '0', 'default_destination' => 'app-blackhole,hangup,1', 'use_code' => '1',
            'use_workphone' => '0', 'manual_code' => '1', 'db_pass' => 'dbsecret', 'query' => 'SELECT 1',
            'code_length' => '6', 'code_retries' => '2']],
        'nethcqr_get_entries' => fn($id) => [1 => ['position' => '1', 'condition' => 'VIP', 'destination' => 'ext-queues,401,1']],
        'nethcqr_save_details' => fn($values) => $values['id_cqr'] ?: '51',
        'nethcqr_save_entries' => fn($id, $entries) => true,
        'nethcqr_delete' => fn($id) => null,
        'daynight_list' => fn() => [['ext' => '0', 'dest' => 'Holidays']],
        'daynight_get_obj' => fn($id) => ['day' => 'timeconditions,4,1', 'night' => 'app-announcement-3,s,1',
            'fc_description' => 'Holidays', 'state' => 'NIGHT', 'password' => '1234', 'day_recording_id' => '7',
            'night_recording_id' => ''],
        'daynight_get_avail' => fn() => [1, 2, 3],
        'daynight_get_timecondition' => fn($id) => ['ext' => '0', 'dmode' => 'timeday'],
        'timeconditions_timegroups_get_times' => fn($id) => [[10, '09:00-18:00|mon-fri|*|*', '']],
    ];
}

function by($list, $field, $value) {
    foreach ($list as $item) if ((string) $item[$field] === (string) $value) return $item;
    throw new RuntimeException("Missing $field $value");
}

function save($changes) {
    return visualplan_save(['changes' => $changes]);
}

function codes($result) {
    return array_map(fn($error) => $error['type'] . ':' . $error['ref'] . ':' . $error['field'] . ':' . $error['message'], $result['body']['errors']);
}

function writes() {
    global $functionCalls;
    $writes = array_filter($functionCalls, fn($call) => preg_match('/_(add|del|save|delete)/', $call[0]));
    foreach (FreePBX::$modules as $name => $module) {
        if ($module instanceof Db) {
            $writes = array_merge($writes, $module->statements);
            continue;
        }
        foreach ($module->calls as $call) {
            if (preg_match('/^(add|edit|update|save|delete|del|set|process)/', $call[0])) $writes[] = [$name, $call];
        }
    }
    return $writes;
}

// GET maps every list, decoding the HTML entities FreePBX stores.
fixture();
$data = visualplan_load();
check($data['unavailable'] === [], 'healthy load reported unavailable lists: ' . implode(',', $data['unavailable']));
check(array_keys($data) === array_merge(array_keys(VISUALPLAN_LISTS), ['layouts', 'unavailable']), 'unexpected data keys');
check(json_encode($data['layouts']) === '{"0721\\/":{"ivr:1":{"x":10,"y":-20},"5":{"x":1,"y":2}}}', 'layouts: ' . json_encode($data['layouts']));
check(json_encode($data) !== false, 'data is not encodable');
check(array_column($data['extensions'], 'voicemail', 'extension') === ['201' => true, '202' => false], 'extensions mapped wrongly');
$queue = by($data['queues'], 'id', '401');
check($queue['staticMembers'] === [['extension' => '201', 'penalty' => 0], ['extension' => '202', 'penalty' => 3]], 'static members');
check($queue['dynamicMembers'] === ['203', '204'], 'dynamic members');
check($queue['ringing'] === 'ring' && $queue['maxWait'] === 0 && $queue['agentTimeout'] === 15, 'queue timings');
check($queue['joinAnnouncement'] === 7 && $queue['breakoutIvr'] === 1 && $queue['positionAnnouncement'] === true, 'queue announcements');
check($queue['announceFrequency'] === 30 && $queue['musicOnHold'] === 'default' && $queue['cidPrefix'] === 'Q:', 'queue options');
check($queue['destination'] === 'ext-group,600,1' && $queue['strategy'] === 'rrmemory', 'queue destination');
$ivr = by($data['ivrs'], 'id', 1);
check($ivr['name'] === 'Menù' && $ivr['announcement'] === 7 && $ivr['directDial'] === true, 'ivr details');
check($ivr['invalidDestination'] === '' && $ivr['timeoutDestination'] === 'ext-queues,401,1', 'empty ivr exits must stay empty');
check($ivr['entries'] === [['selection' => '1', 'destination' => 'from-did-direct,201,1']], 'ivr entries');
check($data['cqrs'][0]['announcement'] === null && $data['cqrs'][0]['entries'][0]['condition'] === 'VIP', 'cqr');
check($data['callFlowControls'] === [['id' => '0', 'name' => 'Holidays', 'state' => 'NIGHT',
    'normalDestination' => 'timeconditions,4,1', 'overrideDestination' => 'app-announcement-3,s,1']], 'call flow control');
check($data['availableCallFlowCodes'] === ['1', '2', '3'], 'available codes');
$options = by($data['queueOptions'], 'id', 9);
check($options['joinAnnouncement'] === 7 && $options['positionEnabled'] && $options['position'] === 2, 'queue options join');
check($options['failoverEnabled'] && $options['failoverDestination'] === 'queueexit-8,${EXTEN},1' && !$options['maxWaitEnabled'], 'queue options failover');
check($options['musicOnHold'] === 'default' && $options['cidPrefix'] === 'VIP:' && $options['destination'] === 'ext-queues,401,1', 'queue options fields');
check($data['timeGroups'] === [['id' => 5, 'description' => 'Weekdays', 'times' => ['09:00-18:00|mon-fri|*|*']]], 'time groups');
check($data['timeConditions'][0]['timeGroup'] === 5, 'time condition group');
check($data['recordings'][0]['name'] === 'Welcome & hello', 'recording name');
check($data['musicOnHold'] === ['default', 'jazz'], 'music on hold');
check(by($data['destinations'], 'destination', 'ivr-1,s,1') === ['destination' => 'ivr-1,s,1', 'category' => 'IVR', 'description' => 'Menù'], 'destinations');
check($data['ringGroups'][0]['members'] === ['201', '202', '3331234567#'] && $data['ringGroups'][0]['ringTime'] === 20, 'ring groups');
check($data['queuePriorities'] === [['id' => 10, 'description' => 'High', 'priority' => 5, 'destination' => 'ext-queues,401,1']], 'queue priorities');

// A list that cannot be read is empty and reported, the others still load.
foreach ([
    ['queues', fn() => FreePBX::$modules['Queues']->methods['listQueues'] = fn() => throw new RuntimeException('db password')],
    ['queues', fn() => $GLOBALS['functions']['queues_get'] = fn() => throw new RuntimeException('db password')],
    ['callFlowControls', fn() => $GLOBALS['functions']['daynight_get_obj'] = fn() => null],
    ['queueOptions', fn() => FreePBX::$modules['Recordings']->methods['getAllRecordings'] = false],
] as [$key, $break]) {
    fixture();
    $break();
    $data = visualplan_load();
    check($data[$key] === [], "$key: failed list is not empty");
    check(in_array($key, $data['unavailable'], true), "$key: failed list is not reported");
    check(count($data['ivrs']) === 1 && count($data['inboundRoutes']) === 1, "$key: other lists were lost");
}
check(!str_contains(file_get_contents($log), 'db password'), 'error messages may leak secrets');
fixture();
FreePBX::$modules['Core']->methods['getAll'] = fn() => throw new RuntimeException('db password');
$broken = visualplan_load();
check(json_encode($broken['layouts']) === '{}' && $broken['unavailable'] === [], 'layouts failure must only empty the layouts');
check(str_contains(file_get_contents($log), 'failed to load layouts (RuntimeException)'), 'layouts failure not logged');
$kvstore = [];
check(json_encode(visualplan_load()['layouts']) === '{}', 'no layouts must be an empty object');

// Canvas layouts are replaced per inbound route.
fixture();
$layout = visualplan_save_layout(['route' => '0721/', 'positions' => ['a' => ['x' => 1, 'y' => 2], '0' => ['x' => -3, 'y' => '4']]]);
check($layout === ['status' => 204, 'body' => null], 'layout not saved: ' . json_encode($layout));
check($kvstore['visualplanLayout']['0721/'] === '{"a":{"x":1,"y":2},"0":{"x":-3,"y":4}}', 'stored layout: ' . $kvstore['visualplanLayout']['0721/']);
check(FreePBX::$modules['Database']->transactions === ['begin', 'commit'], 'layout not saved in a transaction');
check(json_encode(visualplan_load()['layouts']) === '{"0721\\/":{"a":{"x":1,"y":2},"0":{"x":-3,"y":4}}}', 'saved layout not loaded');
check(visualplan_save_layout(['route' => '0721/', 'positions' => []])['status'] === 204 && !isset($kvstore['visualplanLayout']['0721/']), 'empty layout not removed');
$tooMany = array_fill_keys(array_map(fn($i) => 'n' . $i, range(0, 2000)), ['x' => 0, 'y' => 0]);
foreach ([
    [null, ['layout::route:required', 'layout::positions:required']],
    [['route' => '0799/', 'positions' => []], ['layout:0799/:route:not_found']],
    [['route' => '0721/', 'positions' => [['x' => 1, 'y' => 1]]], ['layout:0721/:positions:invalid']],
    [['route' => '0721/', 'positions' => $tooMany], ['layout:0721/:positions:invalid']],
    [['route' => '0721/', 'positions' => [str_repeat('n', 201) => ['x' => 0, 'y' => 0]]], ['layout:0721/:positions:invalid']],
    [['route' => '0721/', 'positions' => ["a\nb" => ['x' => 0, 'y' => 0]]], ['layout:0721/:positions:invalid']],
    [['route' => '0721/', 'positions' => ['a' => ['x' => 1.5, 'y' => 1000001]]], ['layout:0721/:positions.a.x:invalid', 'layout:0721/:positions.a.y:invalid']],
] as [$body, $expected]) {
    $result = visualplan_save_layout($body);
    check($result['status'] === 422 && codes($result) === $expected, 'layout errors: ' . implode(', ', codes($result)));
}
check(isset($kvstore['visualplanLayout']) && $kvstore['visualplanLayout'] === [], 'an invalid layout was stored');
$kvstore['visualplanLayout']['0721/'] = '{"a":{"x":1,"y":2}}';
visualplan_move_layout('0721/', null);
check($kvstore['visualplanLayout'] === [], 'layout of a deleted route not removed');

// Validation reports every error and writes nothing.
fixture();
$result = save([
    ['type' => 'conference', 'ref' => 'c1', 'isNew' => true, 'data' => ['id' => '801']],
    ['type' => 'queue', 'ref' => 'q1', 'isNew' => true, 'data' => array_merge($queue, ['id' => '401'])],
    ['type' => 'ivr', 'ref' => 'i1', 'isNew' => true, 'data' => array_merge($ivr, ['id' => null, 'timeoutDestination' => 'new:ghost'])],
    ['type' => 'ivr', 'ref' => '99', 'isNew' => false, 'data' => $ivr],
    ['type' => 'inboundRoute', 'ref' => 'r1', 'isNew' => true, 'data' => $data['inboundRoutes'][0]],
    ['type' => 'ringGroup', 'ref' => 'g1', 'isNew' => true, 'data' => ['id' => '700', 'description' => 'Two', 'members' => ['201'],
        'strategy' => 'ringall', 'ringTime' => 20, 'destination' => 'new:i1']],
    ['type' => 'ringGroup', 'ref' => 'g2', 'isNew' => true, 'data' => ['id' => '700', 'description' => 'Dup', 'members' => [],
        'strategy' => 'bogus', 'ringTime' => 20, 'destination' => 'not a goto']],
    ['type' => 'callFlowControl', 'ref' => 'f1', 'isNew' => true, 'data' => ['id' => '0', 'name' => 'Busy', 'state' => 'DAY',
        'normalDestination' => '', 'overrideDestination' => '']],
    ['type' => 'timeCondition', 'ref' => 't1', 'isNew' => true, 'data' => ['id' => null, 'name' => 'T', 'timeGroup' => null,
        'timeGroupRef' => 'c1', 'trueDestination' => '', 'falseDestination' => '']],
    ['type' => 'bogus', 'ref' => 'x', 'isNew' => true, 'data' => []],
]);
check($result["status"] === 422 && $result["body"]["message"] !== "", "invalid request was accepted: " . json_encode($result));
$expected = ['conference:c1:name:required', 'queue:q1:id:number_in_use', 'ivr:i1:timeoutDestination:not_found',
    'ivr:99:ref:not_found', 'inboundRoute:r1:extension:number_in_use', 'ringGroup:g2:id:number_in_use',
    'ringGroup:g2:members:required', 'ringGroup:g2:strategy:invalid', 'ringGroup:g2:destination:invalid',
    'callFlowControl:f1:id:number_in_use', 'timeCondition:t1:timeGroupRef:not_found', 'bogus:x:type:invalid'];
check(array_diff($expected, codes($result)) === [], 'missing errors: ' . implode(', ', array_diff($expected, codes($result))));
check(!in_array('ringGroup:g1:destination:not_found', codes($result), true), 'a reference to a new object was rejected');
check(writes() === [], 'a failed validation wrote to the PBX');
check(visualplan_save(null)['body']['errors'] === [['type' => '', 'ref' => '', 'field' => 'changes', 'message' => 'required']], 'missing body');
$result = save([['type' => 'announcement', 'ref' => 'a', 'isNew' => true, 'data' => ['id' => null, 'description' => 'A',
    'recording' => 99, 'destination' => 'new:inbound']], ['type' => 'inboundRoute', 'ref' => 'inbound', 'isNew' => true,
    'data' => ['extension' => '9', 'cidnum' => '', 'description' => '', 'alertinfo' => '', 'grppre' => '', 'destination' => '']]]);
check(codes($result) === ['announcement:a:recording:not_found', 'announcement:a:destination:invalid'], 'unexpected errors: ' . implode(', ', codes($result)));
$result = save([['type' => 'ivr', 'ref' => 'd', 'isNew' => true, 'data' => $ivr], ['type' => 'conference', 'ref' => 'd', 'isNew' => true,
    'data' => ['id' => '801', 'name' => 'Dup']], ['type' => 'ivr', 'ref' => '1', 'isNew' => 'no', 'data' => $ivr]]);
check(codes($result) === ['ivr:d:ref:invalid', 'conference:d:ref:invalid', 'ivr:1:isNew:invalid'], 'unexpected errors: ' . implode(', ', codes($result)));
// A stale reference the user did not change does not block the save, a new one does.
$GLOBALS['ivrs'][1]['announcement'] = '99';
check(save([['type' => 'ivr', 'ref' => '1', 'isNew' => false, 'data' => array_merge($ivr, ['announcement' => 99])]])['status'] === 200, 'unchanged stale reference rejected');
check(codes(save([['type' => 'ivr', 'ref' => '1', 'isNew' => false, 'data' => array_merge($ivr, ['announcement' => 98])]])) === ['ivr:1:announcement:not_found'], 'changed stale reference accepted');

$GLOBALS['functions']['timeconditions_timegroups_get_times'] = fn($id) => [[10, '9:00-18:00|Mon-Fri|*|*', '']];
check(save([['type' => 'timeGroup', 'ref' => '5', 'isNew' => false, 'data' => ['id' => 5, 'description' => 'Week',
    'times' => ['9:00-18:00|Mon-Fri|*|*']]]])['status'] === 200, 'unchanged legacy time rejected');
check(codes(save([['type' => 'timeGroup', 'ref' => '5', 'isNew' => false, 'data' => ['id' => 5, 'description' => 'Week',
    'times' => ['9:00-18:00|Mon-Sat|*|*']]]])) === ['timeGroup:5:times.0:invalid'], 'invalid time accepted');

// Values that do not fit their column, inject dialplan or duplicate other objects are refused.
fixture();
$long = fn($length) => str_repeat('1', $length);
$result = save([
    ['type' => 'queue', 'ref' => '401', 'isNew' => false, 'data' => array_merge($queue, ['destination' => 'ext-queues,' . $long(40) . ',1', 'maxWait' => 100000000])],
    ['type' => 'queue', 'ref' => 'q', 'isNew' => true, 'data' => array_merge($queue, ['id' => '402',
        'staticMembers' => [['extension' => '201', 'penalty' => 0], ['extension' => '201', 'penalty' => 1]], 'dynamicMembers' => ['203', '203']])],
    ['type' => 'inboundRoute', 'ref' => 'r', 'isNew' => true, 'data' => ['extension' => $long(51), 'cidnum' => '',
        'description' => str_repeat('d', 101), 'alertinfo' => '', 'grppre' => '', 'destination' => 'ext-queues,' . $long(48) . ',1']],
    ['type' => 'inboundRoute', 'ref' => 'r2', 'isNew' => true, 'data' => ['extension' => '0799', 'cidnum' => '',
        'description' => str_repeat('d', 100), 'alertinfo' => '', 'grppre' => '', 'destination' => 'ext-queues,' . $long(47) . ',1']],
    ['type' => 'setCallerId', 'ref' => 's', 'isNew' => true, 'data' => ['id' => null, 'description' => "Tag\nexten => s,n,Hangup",
        'cidName' => '${SHELL(id)}', 'cidNum' => '0721;1', 'destination' => 'foo,${SHELL(id)},1']],
    ['type' => 'setCallerId', 'ref' => 's2', 'isNew' => true, 'data' => ['id' => null, 'description' => 'Safe',
        'cidName' => 'VIP ${CALLERID(name)}', 'cidNum' => '${CALLERID(num)}', 'destination' => 'custom-odd,s[1],1']],
    ['type' => 'announcement', 'ref' => 'a', 'isNew' => true, 'data' => ['id' => null, 'description' => 'x$[1+1]',
        'recording' => null, 'destination' => 'custom-odd,s[2],1']],
    ['type' => 'ivr', 'ref' => 'i', 'isNew' => true, 'data' => array_merge($ivr, ['id' => null, 'entries' => [['selection' => '1', 'destination' => '']]])],
    ['type' => 'timeGroup', 'ref' => 'tg', 'isNew' => true, 'data' => ['id' => null, 'description' => ' weekDAYS ', 'times' => []]],
    ['type' => 'cqr', 'ref' => 'c', 'isNew' => true, 'data' => array_merge($data['cqrs'][0], ['id' => null, 'name' => 'CUSTOMERS'])],
    ['type' => 'queuePriority', 'ref' => 'p', 'isNew' => true, 'data' => ['id' => null, 'description' => 'high', 'priority' => 1, 'destination' => 'ivr-1,s,1']],
    ['type' => 'conference', 'ref' => '401', 'isNew' => true, 'data' => ['id' => '805', 'name' => 'Same ref']],
    ['type' => 'directDid', 'ref' => 'd', 'isNew' => true, 'data' => ['id' => null, 'prefix' => '2', 'root' => '0721', 'varlength' => 2,
        'timeout' => 15, 'timeoutDestination' => 'app-blackhole,hangup,1', 'busyDestination' => 'ext-queues,' . $long(70) . ',1', 'unavailableDestination' => '']],
]);
$expected = ['queue:401:maxWait:invalid', 'queue:401:destination:invalid', 'queue:q:staticMembers:invalid', 'queue:q:dynamicMembers:invalid',
    'inboundRoute:r:extension:invalid', 'inboundRoute:r:description:invalid', 'inboundRoute:r:destination:invalid',
    'setCallerId:s:description:invalid', 'setCallerId:s:cidName:invalid', 'setCallerId:s:cidNum:invalid', 'setCallerId:s:destination:invalid',
    'announcement:a:description:invalid', 'announcement:a:destination:invalid', 'ivr:i:entries.0.destination:required',
    'timeGroup:tg:description:invalid', 'cqr:c:name:invalid', 'queuePriority:p:description:invalid', 'conference:401:ref:invalid',
    'directDid:d:busyDestination:invalid'];
$actual = codes($result);
sort($actual);
sort($expected);
check($result['status'] === 422 && $actual === $expected, 'unexpected errors: ' . implode(', ', array_diff(codes($result), $expected)) . ' / missing: ' . implode(', ', array_diff($expected, codes($result))));
check(array_filter(codes($result), fn($code) => str_contains($code, ':r2:') || str_contains($code, ':s2:')) === [], 'valid values refused');

// Two new IVRs pointing at each other are created first, then linked.
fixture();
$result = save([
    ['type' => 'ivr', 'ref' => 'a', 'isNew' => true, 'data' => ['id' => null, 'name' => 'A', 'description' => '',
        'announcement' => null, 'directDial' => true, 'invalidDestination' => 'new:a', 'timeoutDestination' => 'new:b',
        'entries' => [['selection' => '1', 'destination' => 'new:b'], ['selection' => '2', 'destination' => 'new:g']]]],
    ['type' => 'ivr', 'ref' => 'b', 'isNew' => true, 'data' => ['id' => null, 'name' => 'B', 'description' => 'Second',
        'announcement' => 8, 'directDial' => false, 'invalidDestination' => '', 'timeoutDestination' => 'new:a', 'entries' => []]],
    ['type' => 'ringGroup', 'ref' => 'g', 'isNew' => true, 'data' => ['id' => '700', 'description' => 'Team',
        'members' => ['201', '3331234567#'], 'strategy' => 'hunt', 'ringTime' => 25, 'destination' => 'new:b']],
    ['type' => 'announcement', 'ref' => '3', 'isNew' => false, 'data' => ['id' => 3, 'description' => 'Hello',
        'recording' => 7, 'destination' => 'new:a']],
    ['type' => 'callFlowControl', 'ref' => 'f', 'isNew' => true, 'data' => ['id' => '2', 'name' => 'Night',
        'state' => 'NIGHT', 'normalDestination' => 'new:a', 'overrideDestination' => '']],
]);
check($result['status'] === 200 && $result['reload'], 'two-pass save failed: ' . json_encode($result['body']));
check((array) $result['body']['refs'] === ['a' => '11', 'b' => '12', 'g' => '700', '3' => '3', 'f' => '2'], 'refs: ' . json_encode($result['body']));
$saved = FreePBX::$modules['Ivr']->called('saveDetails');
check(count($saved) === 4, 'each new IVR must be created once and written once');
check($saved[0][0]['invalid_destination'] === '' && $saved[0][0]['timeout_destination'] === '', 'first pass must not link');
check($ivrs[11]['invalid_destination'] === 'ivr-11,s,1' && $ivrs[11]['timeout_destination'] === 'ivr-12,s,1', 'cycle not linked');
check($ivrs[12]['timeout_destination'] === 'ivr-11,s,1' && $ivrs[12]['directdial'] === '' && $ivrs[12]['announcement'] === 8, 'second IVR');
check($ivrs[11]['directdial'] === 'ext-local' && $ivrs[11]['timeout_loops'] === 0, 'new IVR defaults');
foreach ($saved as [$row]) check(array_filter(array_keys($row), 'is_int') === [], 'numeric columns written back');
$entries = FreePBX::$modules['Ivr']->called('saveEntries');
check($entries[0] === [11, ['ext' => ['1', '2'], 'goto' => ['ivr-12,s,1', 'ext-group,700,1'], 'ivr_ret' => [0, 0]]], 'entries: ' . json_encode($entries));
$group = FreePBX::$modules['Ringgroups']->called('add')[0];
check($group[0] === '700' && $group[3] === '201-3331234567#' && $group[4] === 'ivr-12,s,1' && end($group) === 1, 'new ring group');
check(FreePBX::$modules['Ringgroups']->called('delete') === [], 'a new ring group must not delete anything');
check(FreePBX::$modules['Announcement']->called('editAnnouncement') === [[3, 'Hello', 7, '1', 'ivr-11,s,1', '1', '0', '5']], 'announcement not preserved');
$flow = FreePBX::$modules['Daynight']->called('edit')[0];
check($flow[1] === '2' && $flow[0]['action'] === 'add' && $flow[0]['dest0'] === 'ivr-11,s,1' && $flow[0]['state'] === 'NIGHT', 'new call flow');
check(FreePBX::$modules['Database']->transactions === ['begin', 'commit'], 'the save must be one transaction');
check(json_encode(save([['type' => 'callFlowControl', 'ref' => '0', 'isNew' => false, 'data' => $data['callFlowControls'][0]]])['body']) === '{"refs":{"0":"0"}}', 'refs must be an object');

// A time condition can use a time group created in the same request.
fixture();
$result = save([
    ['type' => 'timeCondition', 'ref' => 't', 'isNew' => true, 'data' => ['id' => null, 'name' => 'Lunch', 'timeGroup' => null,
        'timeGroupRef' => 'tg', 'trueDestination' => 'ivr-1,s,1', 'falseDestination' => 'new:s']],
    ['type' => 'timeGroup', 'ref' => 'tg', 'isNew' => true, 'data' => ['id' => null, 'description' => 'Lunch',
        'times' => ['12:00-14:00|mon-fri|*|*']]],
    ['type' => 'setCallerId', 'ref' => 's', 'isNew' => true, 'data' => ['id' => null, 'description' => 'Tag',
        'cidName' => 'VIP', 'cidNum' => '', 'destination' => 'ext-queues,401,1']],
    ['type' => 'queuePriority', 'ref' => 'p', 'isNew' => true, 'data' => ['id' => null, 'description' => 'Top',
        'priority' => 9, 'destination' => 'new:t']],
]);
check($result['status'] === 200, 'time group save failed: ' . json_encode($result['body']));
check((array) $result['body']['refs'] === ['t' => '31', 'tg' => '32', 's' => '101', 'p' => '41'], 'refs: ' . json_encode($result['body']));
check(FreePBX::$modules['Timeconditions']->called('addTimeCondition')[0][0]['time'] === 32, 'time group of the new condition');
$times = array_values(array_filter(FreePBX::$modules['Database']->statements, fn($s) => str_contains($s[0], 'timegroups_details')));
check(count($times) === 2 && $times[1][1] === [32, '12:00-14:00|mon-fri|*|*'], 'time strings: ' . json_encode($times));
check(FreePBX::$modules['Setcid']->called('update')[1] === [101, 'Tag', 'VIP', '', 'ext-queues,401,1'], 'set caller id');
check(FreePBX::$modules['Queueprio']->called('addPriority')[0] === ['Top', 9, 'app-blackhole,hangup,1'], 'priority placeholder');
check(FreePBX::$modules['Queueprio']->called('updatePriority')[0] === [41, 'Top', 9, 'timeconditions,31,1'], 'priority link');

check(codes(save([['type' => 'timeGroup', 'ref' => '5', 'isNew' => false, 'data' => ['id' => 5, 'description' => 'Weekdays',
    'times' => ['09:00-18:00|mon-fri|*|*', '*|*|*|*']]]])) === ['timeGroup:5:times.1:invalid'], 'a rule that always matches was accepted');

// A failed first pass removes what it created.
fixture();
FreePBX::$modules['Announcement']->methods['addAnnouncement'] = false;
$result = save([
    ['type' => 'ivr', 'ref' => 'a', 'isNew' => true, 'data' => ['id' => null, 'name' => 'A', 'description' => '',
        'announcement' => null, 'directDial' => true, 'invalidDestination' => '', 'timeoutDestination' => 'new:n', 'entries' => []]],
    ['type' => 'announcement', 'ref' => 'n', 'isNew' => true, 'data' => ['id' => null, 'description' => 'N',
        'recording' => null, 'destination' => '']],
]);
check($result['status'] === 500 && !$result['reload'] && !isset($result['body']['errors']), 'failure must be a generic 500');
check(FreePBX::$modules['Ivr']->called('delete') === [[11]], 'created IVR was not removed');
check(FreePBX::$modules['Database']->transactions === ['begin', 'rollback'], 'the failed save was not rolled back');

// A failed second pass rolls back the database and removes the created objects, without logging secrets.
fixture();
FreePBX::$modules['Announcement']->methods['editAnnouncement'] = fn() => throw new Exception(print_r(['db_pass' => 'topsecret'], true));
$result = save([
    ['type' => 'ivr', 'ref' => 'a', 'isNew' => true, 'data' => ['id' => null, 'name' => 'A', 'description' => '',
        'announcement' => null, 'directDial' => true, 'invalidDestination' => '', 'timeoutDestination' => '', 'entries' => []]],
    ['type' => 'announcement', 'ref' => '3', 'isNew' => false, 'data' => ['id' => 3, 'description' => 'Hello', 'recording' => 7, 'destination' => 'new:a']],
]);
check($result['status'] === 500 && FreePBX::$modules['Ivr']->called('delete') === [[11]], 'second pass failure left the new IVR');
check(FreePBX::$modules['Database']->transactions === ['begin', 'rollback'], 'second pass was not rolled back');
check(!str_contains(file_get_contents($log), 'topsecret'), 'an exception message was logged');

// Inbound routes: same key edits properties only, a new key renames the route keeping its other fields.
fixture();
$route = ['extension' => '0721', 'cidnum' => '', 'description' => 'Main line', 'alertinfo' => 'ring1', 'grppre' => 'M:', 'destination' => 'ext-queues,401,1'];
$result = save([['type' => 'inboundRoute', 'ref' => '0721/', 'isNew' => false, 'data' => $route]]);
check($result['status'] === 200 && FreePBX::$modules['Core']->called('editDID') === [], 'unchanged key must not rename');
check(FreePBX::$modules['Core']->called('editDIDProperties') === [[array_merge(['extension' => '0721', 'cidnum' => ''],
    array_diff_key($route, ['extension' => 1, 'cidnum' => 1]))]], 'route properties');
fixture();
$result = save([['type' => 'inboundRoute', 'ref' => '0721/', 'isNew' => false, 'data' => array_merge($route, ['extension' => '0722', 'cidnum' => '333'])]]);
check($result['status'] === 200 && (array) $result['body']['refs'] === ['0721/' => '0722/333'], 'rename refs');
[$oldExtension, $oldCidnum, $renamed] = FreePBX::$modules['Core']->called('editDID')[0];
check($oldExtension === '0721' && $oldCidnum === '' && $renamed['extension'] === '0722' && $renamed['cidnum'] === '333', 'rename keys');
check($renamed['mohclass'] === 'jazz' && $renamed['privacyman'] === '1' && $renamed['indication_zone'] === 'it' && $renamed['delay_answer'] === '2', 'rename lost fields');
check($renamed['description'] === 'Main line' && $renamed['destination'] === 'ext-queues,401,1' && !isset($renamed[0]), 'rename values');
$moved = FreePBX::$modules['Database']->statements;
check(count($moved) === 4 && array_unique(array_map(fn($statement) => json_encode($statement[1]), $moved)) === ['["0722","333","0721",""]'], 'route settings not moved');
check(preg_match('/language_incoming/', $moved[0][0]) && preg_match('/fax_incoming/', $moved[1][0]) && preg_match("/callrecording_module.*display. = 'did'/", $moved[2][0]) && preg_match('/offhour/', $moved[3][0]), 'route settings tables');
check(FreePBX::$modules['Database']->transactions === ['begin', 'commit'], 'rename not transactional');
check(array_keys($kvstore['visualplanLayout']) === ['0722/333'] && json_decode($kvstore['visualplanLayout']['0722/333'], true)['ivr:1'] === ['x' => 10, 'y' => -20], 'layout not moved with the route');
fixture();
FreePBX::$modules['Database']->missingTables = ['fax_incoming'];
check(save([['type' => 'inboundRoute', 'ref' => '0721/', 'isNew' => false, 'data' => array_merge($route, ['extension' => '0722'])]])['status'] === 200, 'a missing module table broke the rename');
check(count(FreePBX::$modules['Database']->statements) === 3, 'other route settings not moved');
fixture();
FreePBX::$modules['Core']->methods['editDID'] = false;
check(save([['type' => 'inboundRoute', 'ref' => '0721/', 'isNew' => false, 'data' => array_merge($route, ['extension' => '0722'])]])['status'] === 500, 'failed rename accepted');
check(FreePBX::$modules['Database']->transactions === ['begin', 'rollback'] && FreePBX::$modules['Database']->statements === [], 'failed rename not rolled back');
fixture();
$result = save([['type' => 'inboundRoute', 'ref' => 'n', 'isNew' => true, 'data' => array_merge($route, ['extension' => '0730'])]]);
$added = FreePBX::$modules['Core']->called('addDID')[0][0];
check($added['mohclass'] === 'default' && $added['ringing'] === 'CHECKED' && $added['alertinfo'] === 'ring1' && $added['grppre'] === 'M:', 'new route defaults');

// Updates keep every field the visual plan does not edit.
fixture();
$queue['name'] = 'Help desk';
$queue['staticMembers'][] = ['extension' => '205', 'penalty' => 1];
$queue['dynamicMembers'] = ['204', '206'];
$queue['ringing'] = 'ring';
$queue['maxWait'] = 120;
$_REQUEST = ['action' => 'unrelated'];
$result = save([['type' => 'queue', 'ref' => '401', 'isNew' => false, 'data' => $queue]]);
check($result['status'] === 200, 'queue update failed: ' . json_encode($result['body']));
check(called('queues_del') === [['401']], 'queue must be replaced');
$add = called('queues_add')[0];
check($add[1] === 'Help desk' && $add[2] === 'secret' && $add[3] === 'Q:' && $add[5] === '3' && $add[7] === 7 && $add[8] === '120', 'queue config: ' . json_encode($add));
check($add[6] === ['Local/201@from-queue/n,0', 'PJSIP/202,3', 'Local/205@from-queue/n,1'], 'static members: ' . json_encode($add[6]));
check($add[9] === 'ring2' && $add[10] === '2' && $add[14] === ['204,0', '206,0'] && $add[15] === 'yes', 'queue options: ' . json_encode($add));
check($queueRequest['retry'] === '7' && $queueRequest['wrapuptime'] === '10' && $queueRequest['servicelevel'] === '120', 'queue details lost');
check($queueRequest['cron_schedule'] === 'daily' && $queueRequest['rtone'] === '2' && $queueRequest['announcemenu'] === '1', 'queue schedule');
check($queueRequest['music'] === 'default' && $queueRequest['answered_elsewhere'] === '1' && $queueRequest['action'] === 'edit', 'queue request');
check($queueRequest['eventwhencalled'] === 'yes' && $queueRequest['announceposition'] === 'yes' && $queueRequest['callback'] === 'none', 'queue events');
check($_REQUEST === ['action' => 'unrelated'], 'request was not restored');
check(FreePBX::$modules['Queueoptions']->called('setLazyMembers') === [['401', true]], 'lazy members not restored');
check(FreePBX::$modules['Queueoptions']->called('logoutUnlistedDynamicMembers') === [['401']] && $logoutRequest['account'] === '401', 'removed agents not logged out');
fixture();
$astman = null;
check(save([['type' => 'queue', 'ref' => '401', 'isNew' => false, 'data' => $queue]])['status'] === 500 && called('queues_del') === [], 'queue deleted without the Asterisk manager');

fixture();
$options['joinAnnouncement'] = 8;
$options['maxWaitEnabled'] = true;
$result = save([['type' => 'queueOptions', 'ref' => '9', 'isNew' => false, 'data' => $options]]);
[$sql, $row] = FreePBX::$modules['Database']->statements[0];
check($result['status'] === 200 && str_starts_with($sql, 'REPLACE INTO `queueoptions`'), 'queue options not replaced');
$row = array_combine(array_merge(['id'], VISUALPLAN_QUEUE_OPTIONS_COLUMNS), $row);
check($row['id'] === 9 && $row['VQ_JOINMSG'] === 'custom/bye' && $row['VQ_MAXWAIT_ENABLED'] === 1, 'queue options values: ' . json_encode($row));
check($row['VQ_RETRY'] === 1 && $row['VQ_GOSUB'] === 'sub' && $row['VQ_CONFIRMMSG'] === 'confirm' && $row['VQ_DEST'] === 'queueexit-8,${EXTEN},1', 'queue options lost fields');
fixture();
save([['type' => 'queueOptions', 'ref' => '9', 'isNew' => false, 'data' => array_merge($options, ['destination' => '', 'failoverDestination' => ''])]]);
$row = array_combine(array_merge(['id'], VISUALPLAN_QUEUE_OPTIONS_COLUMNS), FreePBX::$modules['Database']->statements[0][1]);
check($row['DEST'] === VISUALPLAN_HANGUP && $row['VQ_DEST'] === VISUALPLAN_HANGUP, 'empty queue options exits');
fixture();
$exit = ['id' => null, 'name' => 'Out'] + array_fill_keys(array_keys(VISUALPLAN_QUEUE_EXIT_COLUMNS), '');
$exit['continueDestination'] = 'ivr-1,s,1';
$did = ['id' => 7, 'prefix' => '2', 'root' => '0721', 'varlength' => 2, 'timeout' => 15, 'timeoutDestination' => '',
    'busyDestination' => 'ivr-1,s,1', 'unavailableDestination' => ''];
check(save([['type' => 'queueExit', 'ref' => 'e', 'isNew' => true, 'data' => $exit],
    ['type' => 'directDid', 'ref' => '7', 'isNew' => false, 'data' => $did]])['status'] === 200, 'exits not saved');
[$insert, $replace, $directDid] = FreePBX::$modules['Database']->statements;
check(array_slice($insert[1], 1) === array_fill(0, 7, VISUALPLAN_HANGUP), 'new queue exit without hangup exits');
check(array_slice($replace[1], 2) === array_merge(array_fill(0, 6, VISUALPLAN_HANGUP), ['ivr-1,s,1']), 'queue exit exits: ' . json_encode($replace));
check(array_slice($directDid[1], 2, 3) === [VISUALPLAN_HANGUP, 'ivr-1,s,1', VISUALPLAN_HANGUP], 'direct did exits');
fixture();
$external = array_merge(QUEUE_OPTIONS_9, ['VQ_JOINMSG' => 'custom/external']);
FreePBX::$modules['Queueoptions']->methods['queueoptions_get'] = fn($id = false) => $id === false ? [$external] : $external;
save([['type' => 'queueOptions', 'ref' => '9', 'isNew' => false, 'data' => array_merge($options, ['joinAnnouncement' => null])]]);
check(FreePBX::$modules['Database']->statements[0][1][4] === 'custom/external', 'a join message that is not a recording was dropped');

fixture();
$condition = $data['timeConditions'][0];
$condition['trueDestination'] = 'app-blackhole,hangup,1';
save([['type' => 'timeCondition', 'ref' => '4', 'isNew' => false, 'data' => $condition]]);
[$id, $post] = FreePBX::$modules['Timeconditions']->called('editTimeCondition')[0];
check($id === 4 && $post['dest0'] === 'app-blackhole,hangup,1' && $post['dest1'] === 'app-announcement-3,s,1' && $post['time'] === 5, 'time condition values');
check($post['timezone'] === 'Europe/Rome' && $post['calendar-id'] === 'cal' && $post['calendar-group'] === 'group' && $post['invert_hint'] === '1', 'time condition lost fields');
check($post['fcc_password'] === '42' && $post['deptname'] === 'Sales' && $post['daynight_ref'] === '0,timeday' && $post['tcstate_new'] === 'unchanged', 'time condition hooks');

fixture();
save([['type' => 'callFlowControl', 'ref' => '0', 'isNew' => false, 'data' => array_merge($data['callFlowControls'][0], ['state' => 'DAY'])],
    ['type' => 'callFlowControl', 'ref' => 'f', 'isNew' => true, 'data' => ['id' => '3', 'name' => 'New', 'normalDestination' => '', 'overrideDestination' => '']]]);
[[$post, $code], [$added]] = FreePBX::$modules['Daynight']->called('edit');
check($code === '0' && $post['action'] === 'edit' && $post['password'] === '1234' && $post['day_recording_id'] === '7', 'call flow lost fields');
check($post['state'] === 'NIGHT', 'a stale state from the request overwrote the current one');
check($added['action'] === 'add' && $added['state'] === 'DAY', 'a new call flow must start in DAY');

fixture();
save([['type' => 'ringGroup', 'ref' => '600', 'isNew' => false, 'data' => array_merge($data['ringGroups'][0], ['description' => 'New'])]]);
$group = FreePBX::$modules['Ringgroups']->called('add')[0];
check(FreePBX::$modules['Ringgroups']->called('delete') === [['600']] && $group[5] === 'New' && $group[6] === 'RG:', 'ring group values');
check($group[15] === 'fixed' && $group[16] === '123' && $group[18] === 'force' && $group[21] === '2', 'ring group lost fields');
fixture();
FreePBX::$modules['Ringgroups']->methods['add'] = fn() => throw new RuntimeException('Cannot connect to Asterisk Manager');
check(save([['type' => 'ringGroup', 'ref' => '600', 'isNew' => false, 'data' => $data['ringGroups'][0]]])['status'] === 500, 'failed ring group accepted');
check(FreePBX::$modules['Database']->transactions === ['begin', 'rollback'], 'ring group delete not rolled back');

fixture();
save([['type' => 'ivr', 'ref' => '1', 'isNew' => false, 'data' => array_merge($ivr, ['name' => 'Menu', 'entries' => [
    ['selection' => '1', 'destination' => 'ext-queues,401,1'], ['selection' => '9', 'destination' => 'app-blackhole,hangup,1']]])]]);
check($ivrs[1]['directdial'] === 'from-ivr-directory-2' && $ivrs[1]['timeout_loops'] === '5' && $ivrs[1]['retvm'] === 'on', 'ivr lost fields');
check(FreePBX::$modules['Ivr']->called('saveEntries')[0][1]['ivr_ret'] === [1, 0], 'ivr return flags lost');
save([['type' => 'ivr', 'ref' => '1', 'isNew' => false, 'data' => array_merge($ivr, ['directDial' => false])]]);
check($ivrs[1]['directdial'] === '', 'direct dial not turned off');
save([['type' => 'ivr', 'ref' => '1', 'isNew' => false, 'data' => array_merge($ivr, ['directDial' => true])]]);
check($ivrs[1]['directdial'] === 'ext-local', 'direct dial not turned on');

fixture();
save([['type' => 'cqr', 'ref' => '2', 'isNew' => false, 'data' => array_merge($data['cqrs'][0], ['name' => 'Clients'])]]);
$details = called('nethcqr_save_details')[0][0];
check($details['id_cqr'] === 2 && $details['name'] === 'Clients' && $details['db_pass'] === 'dbsecret' && $details['query'] === 'SELECT 1', 'cqr lost fields');
check($details['use_code'] === 'on' && $details['use_workphone'] === '' && $details['code_length'] === '6', 'cqr flags');

fixture();
$result = save([['type' => 'voicemail', 'ref' => 'vm:202', 'isNew' => true, 'data' => ['extension' => '202']],
    ['type' => 'voicemail', 'ref' => '201', 'isNew' => true, 'data' => ['extension' => '201']]]);
$created = FreePBX::$modules['Voicemail']->called('processQuickCreate');
check($result['status'] === 200 && count($created) === 1 && $created[0][1] === '202' && $created[0][2]['email'] === 'bob@example.com', 'voicemail');
check((array) $result['body']['refs'] === ['vm:202' => '202', '201' => '201'], 'voicemail refs');
check(codes(save([['type' => 'voicemail', 'ref' => 'vm:999', 'isNew' => true, 'data' => ['extension' => '999']]])) === ['voicemail:vm:999:extension:not_found'], 'voicemail error ref');

// The Asterisk DB is written after the database and restored when the save fails.
fixture();
$sequence = [];
FreePBX::$modules['Ivr']->methods['saveEntries'] = function () use (&$sequence) { $sequence[] = 'ivr'; return true; };
$functions['queues_del'] = function ($number) use (&$sequence) { $sequence[] = 'queue'; $GLOBALS['astman']->database_deltree('QPENALTY/' . $number); };
$functions['queues_add'] = function ($number, ...$args) {
    foreach ($args[13] as $member) $GLOBALS['astman']->database_put('QPENALTY/' . $number . '/agents', explode(',', $member)[0], '0');
    return true;
};
FreePBX::$modules['Daynight']->methods['edit'] = function ($post, $code) {
    $GLOBALS['astman']->database_put('DAYNIGHT', 'C' . $code, $post['state']);
    $GLOBALS['astman']->database_put('CustomDevstate', 'DAYNIGHT' . $code, 'NOT_INUSE');
};
FreePBX::$modules['Ringgroups']->methods['add'] = function ($number) {
    $GLOBALS['astman']->database_put('RINGGROUP/' . $number, 'changecid', 'default');
    throw new RuntimeException('Cannot connect to Asterisk Manager');
};
$result = save([
    ['type' => 'queue', 'ref' => '401', 'isNew' => false, 'data' => array_merge($queue, ['dynamicMembers' => ['209']])],
    ['type' => 'ivr', 'ref' => '1', 'isNew' => false, 'data' => $ivr],
    ['type' => 'callFlowControl', 'ref' => 'f', 'isNew' => true, 'data' => ['id' => '3', 'name' => 'New', 'normalDestination' => '', 'overrideDestination' => '']],
    ['type' => 'callFlowControl', 'ref' => '0', 'isNew' => false, 'data' => $data['callFlowControls'][0]],
    ['type' => 'voicemail', 'ref' => 'vm:202', 'isNew' => true, 'data' => ['extension' => '202']],
    ['type' => 'ringGroup', 'ref' => 'g', 'isNew' => true, 'data' => ['id' => '700', 'description' => 'Team', 'members' => ['201'],
        'strategy' => 'ringall', 'ringTime' => 20, 'destination' => '']],
]);
check($result['status'] === 500 && $sequence === ['ivr', 'queue'], 'the Asterisk DB was written before the database: ' . json_encode($sequence));
$astdb = $astman->db;
ksort($astdb);
$expected = ASTDB;
ksort($expected);
check($astdb === $expected, 'Asterisk DB not restored: ' . json_encode($astdb));
check(FreePBX::$modules['Voicemail']->called('delMailbox') === [['202']], 'created mailbox not removed');
check(FreePBX::$modules['Database']->transactions === ['begin', 'rollback'], 'database not rolled back');

// Recording upload.
fixture();
$upload = visualplan_upload_recording(null, ' ');
check($upload['status'] === 422 && codes($upload) === ['::name:required', '::file:required'], 'empty upload accepted');
$spool = sys_get_temp_dir() . '/visualplan-spool-' . getmypid();
mkdir($spool . '/tmp', 0700, true);
register_shutdown_function(fn() => @rmdir($spool . '/tmp') && @rmdir($spool));
class UploadedFile {
    public function __construct(private string $name, private string $content, private int $error = UPLOAD_ERR_OK) {}
    public function getError() { return $this->error; }
    public function getSize() { return strlen($this->content); }
    public function getClientFilename() { return $this->name; }
    public function moveTo($path) { file_put_contents($path, $this->content); }
}
FreePBX::$modules['Config'] = new Module(['get' => $spool]);
FreePBX::$modules['Soundlang'] = new Module(['getLanguage' => 'it']);
FreePBX::$modules['Recordings']->methods['convertFiles'] = fn($input) => ['status' => true, 'name' => $input['name']];
FreePBX::$modules['Recordings']->methods['addRecording'] = '15';
check(visualplan_upload_recording(new UploadedFile('a.ogg', 'OggS'), 'A')['body']['errors'][0]['field'] === 'file', 'wrong format accepted');
check(visualplan_upload_recording(new UploadedFile('a.wav', 'not audio data'), 'A')['status'] === 422, 'fake wav accepted');
$upload = visualplan_upload_recording(new UploadedFile('hello.WAV', 'RIFF0000WAVEfmt '), 'Hello & bye');
check($upload === ['status' => 200, 'body' => ['id' => 15, 'name' => 'Hello & bye', 'description' => '']], 'upload: ' . json_encode($upload));
$convert = FreePBX::$modules['Recordings']->called('convertFiles')[0][0];
check($convert['lang'] === 'it' && $convert['temporary'] === 1 && preg_match('#^custom/Hello-bye-\d+$#', $convert['name']), 'convert: ' . json_encode($convert));
check(FreePBX::$modules['Recordings']->called('addRecording')[0] === ['Hello &amp; bye', '', $convert['name'], 0, '', 'it'], 'recording row');
check(glob($spool . '/tmp/*') === [], 'temporary upload left behind');

echo "visualplan REST tests passed\n";
