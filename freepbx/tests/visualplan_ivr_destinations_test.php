<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise the renderer without booting FreePBX or accessing a PBX database.
$source = file_get_contents(__DIR__ . '/../var/www/html/freepbx/admin/modules/visualplan/htdocs/visualize.php');
$start = strpos($source, 'function nethvplan_splitIncomingId(');
eval(substr($source, $start));
$start = strpos($source, '// ivr - ivr-id,s,1');
$end = strpos($source, '// cqr - nethcqr-id,s,1', $start);
$loadIvr = substr($source, $start, $end - $start);
$start = strpos($source, '// INITIALIZE DRAW2D OBJECT COMPONENTS');
$end = strpos($source, '// START HANDLING REQUESTS', $start);
eval(substr($source, $start, $end - $start));

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
class FreePBX {
    public static array $ivr;
    public static function Ivr() { return new self(); }
    public static function Satellite() { return new self(); }
    public function getDetails() { return [self::$ivr]; }
    public function agentDestinations() { return []; }
}
function ivr_get_entries($id) {
    return [['selection' => '1', 'dest' => 'from-did-direct,201,1']];
}
$langArray = array_fill_keys([
    'base_ivr_string', 'base_app_announcement_string', 'base_inv_dest_string',
    'base_time_dest_string', 'base_ivr_suggest_string', 'base_details_string',
    'base_hangup_string', 'base_from_did_direct_string',
], 'Test label');
$hangup = 'app-blackhole,hangup,1';
$cases = [
    'empty' => ['invalid_destination' => '', 'timeout_destination' => ''],
    'null' => ['invalid_destination' => null, 'timeout_destination' => null],
    'missing' => [],
    'whitespace' => ['invalid_destination' => '  ', 'timeout_destination' => "\t"],
    'configured' => ['invalid_destination' => 'from-did-direct,201,1', 'timeout_destination' => 'app-blackhole,busy,1'],
    'mixed' => ['invalid_destination' => '', 'timeout_destination' => 'from-did-direct,201,1'],
];
foreach ($cases as $name => $fields) {
    FreePBX::$ivr = array_merge([
        'id' => '1', 'name' => 'Test IVR', 'description' => 'Test', 'announcement' => '1',
    ], $fields);
    $data = [
        'recordings' => ['1' => ['name' => 'Test recording']],
        'from-did-direct' => ['201' => ['name' => 'Test extension', 'voicemail' => 'novm']],
    ];
    eval($loadIvr);
    foreach (['invalid_destination', 'timeout_destination'] as $field) {
        $expected = trim((string)($fields[$field] ?? '')) === '' ? $hangup : $fields[$field];
        check($data['ivr']['1'][$field] === $expected, "$name: wrong $field default");
    }
    $widgets = $connections = [];
    nethvplan_explore($data, 'ivr-1,s,1', []);
    $nodes = array_column($widgets, null, 'id');
    $outputs = array_column($nodes['ivr%1']['entities'], null, 'id');
    check(count($connections) === 3, "$name: lost IVR connections");
    foreach (['invalid_destination', 'timeout_destination'] as $field) {
        $destination = $data['ivr']['1'][$field];
        check($outputs[$field . '-ivr%1']['destination'] === $destination, "$name: inconsistent output destination");
        [$type, $id] = nethvplan_getDestination($destination);
        $edges = array_values(array_filter($connections, fn($edge) => $edge['source']['port'] === 'output_' . $field . '-ivr%1'));
        check(count($edges) === 1 && $edges[0]['target']['node'] === "$type%$id", "$name: wrong fallback connection");
        check(isset($nodes["$type%$id"]), "$name: fallback widget missing");
    }
    check($data['ivr']['1']['selections']['1']['dest'] === 'from-did-direct,201,1', "$name: selection changed");
}
echo "PASS: IVR empty destinations render as Hangup; configured destinations and selections preserved\n";
