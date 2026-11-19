<?php
// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later

// Generate the routing portions of the installed Core dialplan for the runtime test.
define('FREEPBX_IS_AUTH', true);
require $argv[1] . '/functions.inc.php';
require $argv[2] . '/extensions.class.php';
set_error_handler(function ($severity, $message) { throw new RuntimeException($message); });

class FreePBX {
    public static function Core() { return new self(); }
    public static function Modules() { return new self(); }
    public function deprecatedFunction() {}
    public function moduleHasMethod($module, $method) { return false; }
    public function getAllRoutes() {
        $routes = [];
        foreach (array_keys(ROUTE_TRUNKS) as $id) {
            $routes[] = [
                'route_id' => $id, 'name' => "Test $id", 'dest' => 'test-failure,s,1',
                'emergency_route' => '', 'intracompany_route' => '', 'mohclass' => '',
                'outcid' => '', 'password' => '', 'notification_on' => '',
            ];
        }
        return $routes;
    }
    public function getRouteEmailByID($id) { return []; }
    public function listTrunks($displayOnly = false) {
        return array_map(fn($trunk) => $trunk + ['tech' => 'pjsip'], TRUNKS);
    }
}

const ROUTE_TRUNKS = [
    101 => [1, 4], 102 => [3, 4], 103 => [1, 2], 104 => [1, 2, 4],
    105 => [5, 4], 106 => [6, 4], 107 => [7, 4], 108 => [8, 4],
];
const TRUNKS = [
    1 => ['disabled' => 'on', 'continue' => 'off', 'failscript' => 'unexpected.agi'],
    2 => ['disabled' => 'on', 'continue' => 'on', 'failscript' => ''],
    3 => ['disabled' => 'off', 'continue' => 'off', 'failscript' => ''],
    4 => ['disabled' => 'off', 'continue' => 'off', 'failscript' => ''],
    5 => ['disabled' => 'off', 'continue' => 'off', 'failscript' => ''],
    6 => ['disabled' => 'off', 'continue' => 'off', 'failscript' => ''],
    7 => ['disabled' => 'off', 'continue' => 'on', 'failscript' => ''],
    8 => ['disabled' => 'on', 'continue' => 'off', 'failscript' => '', 'tech' => 'dundi'],
];

class TestOutboundRouting {
    public function getRouteTrunksById($routeId) { return ROUTE_TRUNKS[$routeId]; }
    public function getRoutePatternsById($routeId) {
        return [['match_pattern_prefix' => '', 'match_pattern_pass' => (string)$routeId,
            'match_cid' => '', 'prepend_digits' => '']];
    }
}
class_alias(TestOutboundRouting::class, 'FreePBX\\modules\\Core\\Components\\Outboundrouting');
class freepbx_conf {
    public static function &create() {
        static $conf;
        $conf ??= new self();
        return $conf;
    }
    public function get_conf_setting($key) { return 'extensions'; }
}

$source = file_get_contents($argv[1] . '/functions.inc.php');
$ext = new extensions();
$ext->_disable_custom_contexts = true;
$version = '22.10.0';
$route = ['notification_on' => ''];
$has_keepcid_cnum = false;
$amp_conf = array_fill_keys([
    'DIVERSIONHEADER', 'AST_APP_VQA', 'OUTBOUND_DIAL_UPDATE',
    'OUTBOUND_CID_UPDATE', 'BLOCK_OUTBOUND_TRUNK_CNAM',
], false);
$amp_conf['NOOPTRACE'] = '1';
foreach (TRUNKS as $id => $trunk) {
    $ext->addGlobal("OUTDISABLE_$id", $trunk['disabled']);
    $ext->addGlobal("OUTFAIL_$id", $trunk['failscript']);
    $ext->addGlobal("OUTPREFIX_$id", $id);
    $ext->addGlobal("OUT_$id", 'PJSIP');
    $ext->addGlobal("OUT_${id}_SUFFIX", $id === 5 ? '@unreachable' : '@test-peer');
    $ext->addGlobal("OUTCID_$id", '555010' . $id);
}
$ext->addGlobal('TRUNK_RING_TIMER', 2);

foreach ([
    ['/* outbound routes */', 'general_generate_indications();'],
    ["if (function_exists('outroutemsg_get'))", "\n\t/*\n\t;-------------------------------------------------------------------------------\n\t; macro-privacy-mgr:"],
    ["\$context = 'macro-outbound-callerid';", '// Combined from-zpatel'],
] as [$first, $next]) {
    $start = strpos($source, $first);
    $end = $start === false ? false : strpos($source, $next, $start);
    if ($end === false) {
        throw new RuntimeException("Core dialplan section changed: $first");
    }
    eval(substr($source, $start, $end - $start));
}

echo $ext->generateConf();
