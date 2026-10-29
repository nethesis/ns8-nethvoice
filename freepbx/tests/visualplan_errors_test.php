<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run with: php freepbx/tests/visualplan_errors_test.php
$directory = __DIR__ . '/../var/www/html/freepbx/admin/modules/visualplan/htdocs';
$source = file_get_contents($directory . '/visualize.php');
eval(substr($source, strpos($source, 'function nethvplan_splitIncomingId(')));
$start = strpos($source, '$data = array(');
$loadData = substr($source, $start, strpos($source, '// INITIALIZE DRAW2D OBJECT COMPONENTS') - $start);
$start = strpos($source, '// INITIALIZE DRAW2D OBJECT COMPONENTS');
eval(substr($source, $start, strpos($source, '// START HANDLING REQUESTS') - $start));
$start = strpos($source, '// START HANDLING REQUESTS');
$handleRequests = substr($source, $start, strpos($source, 'function nethvplan_splitIncomingId(') - $start);
$translation = substr(file_get_contents($directory . '/i18n/en.js'), 0, -1);
$langArray = json_decode(explode('=', $translation, 2)[1], true, 512, JSON_THROW_ON_ERROR);
$log = tempnam(sys_get_temp_dir(), 'visualplan-errors-');
ini_set('error_log', $log);
register_shutdown_function(fn() => unlink($log));
$errorHandler = function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
};
set_error_handler($errorHandler);
function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
class FreePBX {
    public static array $rows;
    public static array $failures = [];
    private string $module;
    public static function __callStatic($module, $args) {
        $instance = new self();
        $instance->module = $module;
        return $instance;
    }
    public function __call($method, $args) { return self::read($this->module . '.' . $method); }
    public static function read($name) {
        if (isset(self::$failures[$name])) throw new RuntimeException('private database secret');
        return self::$rows[$name];
    }
}
function ivr_get_entries($id) { return FreePBX::read('ivr_get_entries'); }
function nethcqr_get_details() { return FreePBX::read('nethcqr_get_details'); }
function nethcqr_get_entries($id) { return FreePBX::read('nethcqr_get_entries'); }
function ringgroups_get($id) { return FreePBX::read('ringgroups_get'); }
function queues_get($id) { return FreePBX::read('queues_get'); }
function daynight_list() { return FreePBX::read('daynight_list'); }
function daynight_get_obj($id) { return FreePBX::read('daynight_get_obj'); }
function daynight_get_avail() { return FreePBX::read('daynight_get_avail'); }
FreePBX::$rows = [
    'Core.getAllDIDs' => [['extension' => '123', 'cidnum' => '', 'destination' => 'app-daynight,0,1', 'description' => 'Main route']],
    'Core.listUsers' => [['201', 'Alice', 'yes'], ['912345', 'Hidden user', 'novm']],
    'Ivr.getDetails' => [['id' => '1', 'name' => 'IVR', 'description' => 'Menu', 'announcement' => '7', 'invalid_destination' => 'app-announcement-1,s,1', 'timeout_destination' => 'nethcqr,1,1']],
    'ivr_get_entries' => [['selection' => '1', 'dest' => 'from-did-direct,201,1'], ['selection' => '2', 'dest' => 'app-blackhole,hangup,1']],
    'nethcqr_get_details' => [['id_cqr' => '1', 'name' => 'Query', 'description' => 'Customer', 'announcement' => '7', 'default_destination' => 'ext-group,1,1']],
    'nethcqr_get_entries' => [['position' => '1', 'condition' => 'Match', 'destination' => 'ext-local,vmb201,1']],
    'Timeconditions.listTimeconditions' => [['timeconditions_id' => '1', 'displayname' => 'Hours', 'time' => '1', 'truegoto' => 'ivr-1,s,1', 'falsegoto' => 'ext-group,1,1']],
    'Timeconditions.listTimegroups' => [['1', 'Weekdays']],
    'Recordings.getAllRecordings' => [['7', 'Welcome', '', 'Greeting']],
    'Announcement.getAnnouncements' => [['announcement_id' => '1', 'description' => 'Greeting', 'recording_id' => '7', 'post_dest' => 'ext-queues,1,1']],
    'Ringgroups.listRinggroups' => [['grpnum' => '1']],
    'ringgroups_get' => ['description' => 'Team', 'grplist' => '201', 'postdest' => 'from-did-direct,201,1', 'strategy' => 'ringall', 'grptime' => '20'],
    'Conferences.listConferences' => [['2', 'Meeting']],
    'Queues.listQueues' => [['1']],
    'queues_get' => ['name' => 'Support', 'goto' => 'from-did-direct,201,1', 'member' => ['201'], 'dynmembers' => '', 'strategy' => 'ringall', 'maxwait' => '0', 'timeout' => '10'],
    'daynight_list' => [['ext' => '0']],
    'daynight_get_obj' => ['fc_description' => 'Switch', 'day' => 'timeconditions,1,1', 'night' => 'ext-meetme,2,1'],
    'daynight_get_avail' => ['0'],
];
function request($query) {
    global $data, $loadErrors, $handleRequests, $widgets, $connections, $destArray;
    $widgets = $connections = $destArray = [];
    $_GET = $query;
    http_response_code(200);
    ob_start();
    eval($handleRequests);
    return json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
}
function graph($data) {
    global $widgets, $connections;
    $widgets = $connections = [];
    nethvplan_explore($data, 'app-daynight,0,1', []);
    $nodes = array_column($widgets, null, 'id');
    foreach ($connections as $edge) {
        foreach (['source', 'target'] as $end) {
            check(isset($nodes[$edge[$end]['node']]), "Missing $end node");
            $ports = array_map(fn($entity) => $entity['type'] . '_' . $entity['id'], $nodes[$edge[$end]['node']]['entities']);
            check(in_array($edge[$end]['port'], $ports, true), "Missing $end port");
        }
    }
    json_encode(array_merge($widgets, $connections), JSON_THROW_ON_ERROR);
    return $nodes;
}
eval($loadData);
$healthy = $data;
$nodes = graph($data);
check(count($nodes) === 11, 'Healthy graph lost a block type');
check(!isset($data['from-did-direct']['912345']), 'Hidden extension is visible');
foreach ($nodes as $node) check(empty($node['userData']['visualplanError']), 'Healthy block marked as failed');

// Every renderer, including the inbound route and built-in Hangup, has the same boundary.
$ids = ['incoming' => '123 / ', 'from-did-direct' => '201', 'ext-local' => 'vmb201', 'ext-meetme' => '2', 'app-blackhole' => 'hangup', 'app-announcement' => '1', 'app-daynight' => '0', 'timeconditions' => '1', 'ivr' => '1', 'cqr' => '1', 'ext-queues' => '1', 'ext-group' => '1'];
foreach ($ids as $type => $id) {
    $data = $healthy;
    $data[$type][$id]['load_error'] = true;
    $widget = nethvplan_bindData($data, $type, $id);
    check($widget['bgColor'] === '#c0392b' && $widget['userData']['visualplanError'], "$type: no error placeholder");
    $nodes = graph($data);
    check(isset($nodes['ext-meetme%2'], $nodes['from-did-direct%201']), "$type: lost other branches");
}
foreach (['from-did-direct', 'ext-meetme', 'app-announcement', 'app-daynight', 'timeconditions', 'ivr', 'cqr', 'ext-queues', 'ext-group'] as $type) {
    $data = $healthy;
    unset($data[$type][$ids[$type]]);
    $nodes = graph($data);
    check(!empty($nodes[$type . '%' . $ids[$type]]['userData']['visualplanError']), "$type: stale destination disappeared");
}

// Real warnings and TypeErrors from individual fields must preserve readable exits.
foreach (['timegroup', 'members', 'description', 'invalid_utf8', 'bad_destination'] as $failure) {
    $data = $healthy;
    $type = 'ext-group';
    if ($failure === 'timegroup') { $data['timegroups'] = []; $type = 'timeconditions'; }
    elseif ($failure === 'members') { $data['ext-queues']['1']['members'] = null; $type = 'ext-queues'; }
    elseif ($failure === 'description') unset($data['ext-group']['1']['description']);
    elseif ($failure === 'invalid_utf8') $data['ext-group']['1']['description'] = "\xB1";
    else $data['ext-group']['1']['postdest'] = ['invalid'];
    $nodes = graph($data);
    check(!empty($nodes[$type . '%1']['userData']['visualplanError']), "$failure: rendering failure escaped");
    check(isset($nodes['ext-meetme%2']), "$failure: lost sibling branch");
}

// Failure of any module list or detail lookup cannot prevent other modules from loading.
$affected = [
    'Core.getAllDIDs' => 'incoming%123 / ', 'Core.listUsers' => 'from-did-direct%201',
    'Ivr.getDetails' => 'ivr%1', 'ivr_get_entries' => 'ivr%1',
    'nethcqr_get_details' => 'cqr%1', 'nethcqr_get_entries' => 'cqr%1',
    'Timeconditions.listTimeconditions' => 'timeconditions%1', 'Timeconditions.listTimegroups' => 'timeconditions%1',
    'Recordings.getAllRecordings' => 'app-announcement%1', 'Announcement.getAnnouncements' => 'app-announcement%1',
    'Ringgroups.listRinggroups' => 'ext-group%1', 'ringgroups_get' => 'ext-group%1',
    'Conferences.listConferences' => 'ext-meetme%2', 'Queues.listQueues' => 'ext-queues%1', 'queues_get' => 'ext-queues%1',
    'daynight_list' => 'app-daynight%0', 'daynight_get_obj' => 'app-daynight%0',
];
foreach (array_keys(FreePBX::$rows) as $method) {
    FreePBX::$failures = [$method => true];
    eval($loadData);
    $response = request(['id' => '123 / ']);
    check(count($response) > 0, "$method: empty response");
    $nodes = array_column(array_filter($response, fn($item) => $item['type'] === 'Base'), null, 'id');
    if (isset($affected[$method])) {
        check(!empty($nodes[$affected[$method]]['userData']['visualplanError']), "$method: failed block was not marked");
    }
    if ($method !== 'Core.getAllDIDs') {
        check(isset($nodes['incoming%123 / ']), "$method: lost inbound route");
    }
}
FreePBX::$failures = [];

// A failed record leaves subsequent records and any known exits intact.
$rows = [['id' => '1', 'destination' => 'app-blackhole,hangup,1'], ['id' => '2', 'name' => 'Healthy']];
$blocks = nethvplan_loadRows('example', fn() => $rows, 'id', function ($row, &$block) {
    if ($row['id'] === '1') trigger_error('private database secret', E_USER_WARNING);
    $block['name'] = $row['name'];
});
check($blocks['1']['load_error'] && $blocks['1']['destination'] === 'app-blackhole,hangup,1', 'Lost failed record or known exit');
check($blocks['2']['name'] === 'Healthy', 'Stopped loading after one record failed');
$currentHandler = set_error_handler($errorHandler);
check($currentHandler === $errorHandler, 'Error handler not restored');
restore_error_handler();

// Existence checks must reject failed and incomplete lists, including failed detail rows.
$data['example'] = $blocks;
request(['readData' => 'example']);
check(http_response_code() === 503, 'Partially loaded records accepted as an existence check');
$data = $healthy;
$loadErrors = [];
check(request(['readData' => 'ext-group']) === $healthy['ext-group'], 'Healthy lookup changed');
check(http_response_code() === 200, 'Healthy lookup rejected');
foreach (['Ringgroups.listRinggroups' => 'ext-group', 'ringgroups_get' => 'ext-group', 'daynight_get_avail' => 'codeavailable'] as $method => $type) {
    FreePBX::$failures = [$method => true];
    eval($loadData);
    $response = request(['readData' => $type]);
    check(http_response_code() === 503 && ($response['error'] ?? '') === 'visualplan_data_unavailable', "$method: failed lookup accepted as an existence check");
    check(request(['readData' => 'ext-meetme']) === $healthy['ext-meetme'], "$method: unrelated lookup failed");
    check(http_response_code() === 200, "$method: unrelated lookup rejected");
}
FreePBX::$failures = [];
$groupRows = FreePBX::$rows['Ringgroups.listRinggroups'];
FreePBX::$rows['Ringgroups.listRinggroups'][] = [];
eval($loadData);
request(['readData' => 'ext-group']);
check(http_response_code() === 503, 'List with an unidentified record accepted as complete');
FreePBX::$rows['Ringgroups.listRinggroups'] = $groupRows;

// A source that fails after palette selection must replace the cached healthy source.
$data = $healthy;
$loadErrors = [];
$cachedSource = request(['getAll' => 'ext-group'])[0];
$childQuery = ['getChild' => base64_encode($cachedSource['id']), 'getChildDest' => base64_encode($healthy['ext-group']['1']['postdest'] . '|')];
foreach (['list', 'details', 'render'] as $failure) {
    FreePBX::$failures = $failure === 'list' ? ['Ringgroups.listRinggroups' => true] : ($failure === 'details' ? ['ringgroups_get' => true] : []);
    eval($loadData);
    if ($failure === 'render') unset($data['ext-group']['1']['description']);
    $children = request($childQuery);
    check(!empty($children[$cachedSource['id']]['userData']['visualplanError']), "$failure: child response discarded failed source");
    $merged = array_merge([$cachedSource['id'] => $cachedSource], $children);
    check($merged[$cachedSource['id']]['bgColor'] === '#c0392b', "$failure: cached source still appears healthy");
    $failedSourceGraph = array_values($merged);
}
FreePBX::$failures = [];
$data = $healthy;
$children = request($childQuery);
check($children[$cachedSource['id']] == $cachedSource, 'Healthy child expansion changed source');
$data['ext-group']['1']['postdest'] = 'ext-meetme,2,1';
$children = request($childQuery);
check(isset($children['ext-meetme%2']), 'Child expansion follows stale palette exits');
check(!isset($children['from-did-direct%201']), 'Child expansion includes obsolete destination');

// Incomplete day/night details must retain readable exits and reject saving after expansion.
$daynightDetails = FreePBX::$rows['daynight_get_obj'];
$data = $healthy;
$loadErrors = [];
$cachedDaynight = request(['getAll' => 'app-daynight'])[0];
$incompleteDetails = [[], ['state' => 'DAY']];
foreach (['day', 'night'] as $field) {
    $partial = $daynightDetails;
    unset($partial[$field]);
    $incompleteDetails[] = $partial;
    foreach ([null, false, 0, []] as $invalid) {
        $incompleteDetails[] = array_replace($daynightDetails, [$field => $invalid]);
    }
}
$failedDaynightGraphs = [];
foreach ($incompleteDetails as $index => $details) {
    FreePBX::$rows['daynight_get_obj'] = $details;
    eval($loadData);
    check(!empty($data['app-daynight']['0']['load_error']), "Day/night case $index: incomplete details accepted");
    request(['readData' => 'app-daynight']);
    check(http_response_code() === 503, "Day/night case $index: incomplete existence check accepted");
    graph($data);
    $children = request(['getChild' => base64_encode($cachedDaynight['id'])]);
    $merged = array_merge([$cachedDaynight['id'] => $cachedDaynight], $children);
    $source = $merged[$cachedDaynight['id']];
    check($source['bgColor'] === '#c0392b' && !empty($source['userData']['visualplanError']), "Day/night case $index: cached source still healthy");
    $destinations = array_column(array_filter($source['entities'], fn($entity) => $entity['type'] === 'output'), 'destination');
    foreach (['day' => 'timeconditions%1', 'night' => 'ext-meetme%2'] as $field => $target) {
        if (!is_string($details[$field] ?? null)) continue;
        check(in_array($details[$field], $destinations, true) && isset($children[$target]), "Day/night case $index: readable $field flow lost");
    }
    $failedDaynightGraphs[] = array_values($merged);
}
foreach ([['', ''], ['', $daynightDetails['night']], [$daynightDetails['day'], '']] as [$day, $night]) {
    FreePBX::$rows['daynight_get_obj'] = array_replace($daynightDetails, ['day' => $day, 'night' => $night]);
    eval($loadData);
    $source = request(['getAll' => 'app-daynight'])[0];
    check(empty($source['userData']['visualplanError']), 'Explicitly empty day/night flow rejected');
    check(array_column(array_filter($source['entities'], fn($entity) => $entity['type'] === 'output'), 'destination') === [$day, $night], 'Explicitly empty day/night flow changed');
    request(['readData' => 'app-daynight']);
    check(http_response_code() === 200, 'Valid day/night existence check rejected');
}
FreePBX::$rows['daynight_get_obj'] = $daynightDetails;

// Cover palette and child expansion, plus a cyclic route and malformed destinations.
$data = $healthy;
$data['timegroups'] = [];
$palette = request(['getAll' => 'timeconditions']);
check($palette[0]['userData']['visualplanError'], 'Palette did not return error block');
$children = request(['getChild' => base64_encode('app-daynight%0'), 'getChildDest' => base64_encode('timeconditions,1,1|ext-meetme,2,1|')]);
check(count($children) > 3, 'Child expansion failed');
$loadErrors['ext-group'] = true;
$data['ext-group'] = [];
check(request(['getAll' => 'ext-group'])[0]['userData']['visualplanError'], 'Failed list has no palette placeholder');
$data = $healthy;
$data['ext-group']['1']['postdest'] = 'ext-group,1,1';
graph($data);
$data['app-daynight']['0']['green_flow'] = 'ivr-';
check(graph($data)['ivr%']['userData']['visualplanError'], 'Malformed destination not marked');
check(!str_contains(file_get_contents($log), 'private database secret'), 'Exception details leaked into logs');

// Run the save preflight in a separate process because it deliberately exits on errors.
$create = file_get_contents($directory . '/create.php');
$start = strpos($create, '$widgetArray =');
$preflight = substr($create, $start, strpos($create, '$connectionArray =', $start) - $start);
$payloads = [
    [['type' => 'Base', 'userData' => []]],
    [['type' => 'Base', 'userData' => []], ['type' => 'Base', 'userData' => ['visualplanError' => true]]],
    $failedSourceGraph,
    ...$failedDaynightGraphs,
];
foreach ($payloads as $index => $payload) {
    $script = '$jsonArray = json_decode($argv[1], true);' . $preflight . 'echo "accepted";';
    $process = proc_open([PHP_BINARY, '-r', $script, json_encode($payload)], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $output = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    check(proc_close($process) === 0 && $errors === '', 'Save preflight failed');
    check($output === ($index > 0 ? '{"error":"visualplan_error_blocks"}' : 'accepted'), 'Unsafe save accepted or healthy save rejected');
}
echo "PASS: all block types isolate load and rendering failures; connections, siblings and request paths survive\n";
