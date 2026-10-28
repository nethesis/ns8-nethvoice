<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise recording loading and graph rendering without a FreePBX database.
$directory = __DIR__ . '/../var/www/html/freepbx/admin/modules/visualplan/htdocs';
$source = file_get_contents($directory . '/visualize.php');
eval(substr($source, strpos($source, 'function nethvplan_splitIncomingId(')));
$start = strpos($source, '// INITIALIZE DRAW2D OBJECT COMPONENTS');
eval(substr($source, $start, strpos($source, '// START HANDLING REQUESTS', $start) - $start));
$start = strpos($source, "$" . "data['recordings'] = nethvplan_loadRows");
$loadRecordings = substr($source, $start, strpos($source, '// call group', $start) - $start);

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
class FreePBX {
    public static array $announcements;
    public static function Announcement() { return new self(); }
    public static function Recordings() { return new self(); }
    public function getAnnouncements() { return self::$announcements; }
    public function getAllRecordings($indexed) {
        return [['7', 'Welcome &amp; hello', '', 'Test recording']];
    }
}

$hangup = 'app-blackhole,hangup,1';
$cases = ['empty' => '', 'zero' => 0, 'null' => null, 'missing' => null, 'deleted' => '999', 'valid' => '7'];
foreach (['en', 'it'] as $language) {
    // Match the endpoint's translation parser, including its trailing semicolon handling.
    $translation = substr(file_get_contents($directory . '/i18n/' . $language . '.js'), 0, -1);
    $langArray = json_decode(explode('=', $translation, 2)[1], true, 512, JSON_THROW_ON_ERROR);
    foreach ($cases as $name => $recordingId) {
        FreePBX::$announcements = [[
            'announcement_id' => '1', 'description' => 'Test announcement',
            'recording_id' => $recordingId, 'post_dest' => $hangup,
        ]];
        if ($name === 'missing') unset(FreePBX::$announcements[0]['recording_id']);
        $data = ['recordings' => [], 'app-announcement' => []];
        eval($loadRecordings);
        check($data['app-announcement']['1']['rec_name'] === ($name === 'valid' ? 'Welcome &amp; hello' : ''), "$name: wrong recording name loaded");

        foreach (['app-announcement', 'ivr', 'cqr'] as $type) {
            $destination = ['app-announcement' => 'app-announcement-1,s,1', 'ivr' => 'ivr-1,s,1', 'cqr' => 'nethcqr,1,1'][$type];
            $data[$type]['1'] = array_merge($data[$type]['1'] ?? [], [
                'id' => '1', 'name' => 'Test block', 'description' => 'Test block',
                'announcement' => $recordingId, 'invalid_destination' => $hangup,
                'timeout_destination' => $hangup, 'default_destination' => $hangup,
                'selections' => [],
            ]);
            if ($name === 'missing') unset($data[$type]['1']['announcement']);
            $data['app-daynight']['0'] = [
                'name' => 'Two branches', 'ext' => '0', 'control_code' => '*280',
                'green_flow' => $destination, 'red_flow' => 'app-blackhole,busy,1',
            ];
            $widgets = $connections = [];
            nethvplan_explore($data, 'app-daynight,0,1', []);
            $nodes = array_column($widgets, null, 'id');
            $block = $nodes[$type . '%1'];
            $isError = $name === 'deleted' || ($type === 'app-announcement' && $name !== 'valid');
            check(($block['bgColor'] === '#c0392b') === $isError, "$language/$type/$name: wrong error color");
            $expected = $isError ? $langArray['base_recording_error_string']
                : ($name === 'valid' ? 'Welcome & hello' : $langArray['base_no_recording_string']);
            check(str_contains($block['entities'][1]['text'], $expected), "$language/$type/$name: wrong recording label");
            check($block['userData']['announcement'] === (string)$recordingId, "$type/$name: recording ID changed");
            check(isset($nodes['app-blackhole%hangup']), "$type/$name: lost downstream block");
            check(isset($nodes['app-blackhole%busy']), "$type/$name: lost sibling branch");
            check(count($connections) === ($type === 'ivr' ? 4 : 3), "$type/$name: lost connections");
            foreach ($connections as $edge) {
                foreach (['source' => 'output_', 'target' => 'input_'] as $end => $prefix) {
                    $node = $nodes[$edge[$end]['node']];
                    $ports = array_map(fn($entity) => $entity['type'] . '_' . $entity['id'], $node['entities']);
                    check(in_array($edge[$end]['port'], $ports, true), "$type/$name: dangling $end port");
                }
            }
            json_encode(array_merge($widgets, $connections), JSON_THROW_ON_ERROR);
            // The palette and child expansion use the same binder.
            check(nethvplan_bindData($data, $type, '1') === $block, "$type/$name: inconsistent direct rendering");
        }
    }
}
echo "PASS: missing recordings mark affected blocks; downstream and sibling branches render in English and Italian\n";
