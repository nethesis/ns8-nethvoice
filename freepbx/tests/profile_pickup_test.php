#!/usr/bin/env php
<?php
// Usage: php profile_pickup_test.php <patched-core-directory> <framework-directory>
if ($argc !== 3) { exit(2); }
require $argv[2] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
class FreePBX {
    public static function Core() { return new self(); }
    public function getDevice($id) { return (string) $id === '201' ? ['context' => 'cti-profile-2'] : []; }
}
class featurecode {
    public function __construct($module, $feature) {}
    public function getCodeActive() { return '*80'; }
}
function ringgroups_list($all) { return [['grpnum' => '601']]; }
function ringgroups_get($number) { return ['grplist' => '201-202-1234#']; }
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
$source = file_get_contents($argv[1] . '/functions.inc.php');
$start = strpos($source, "\t\tif (\$fc_pickup != '') {", strpos($source, '// Call pickup using app_pickup'));
$end = strpos($source, " elseif (\$fc_pickup != '')", $start);
check($start !== false && $end !== false, 'cannot locate the Core pickup generator');
$generator = substr($source, $start, $end - $start);
foreach (['**', '**7'] as $fc_pickup) {
    $ext = new extensions();
    $engineinfo = ['raw' => 'Asterisk 22'];
    eval($generator);
    foreach (['_'.$fc_pickup.'.' => strlen($fc_pickup), '_'.$fc_pickup.'*80.' => strlen($fc_pickup.'*80')] as $pattern => $length) {
        $steps = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['app-pickup'][' '.$pattern.' ']);
        $pickup = $steps[2];
        check(str_contains($pickup, '${EXTEN:'.$length.'}@${PJSIP_ENDPOINT(${EXTEN:'.$length.'},context)}'), 'generic pickup lacks the target context');
        check(str_contains($pickup, '${EXTEN:'.$length.'}@PICKUPMARK'), 'PICKUPMARK candidate was lost');
    }
    foreach ([$fc_pickup.'201', $fc_pickup.'*80201'] as $target) {
        $pickup = $ext->_exts['app-pickup'][' '.$target.' '][2]['cmd']->output();
        foreach (['201@cti-profile-2', '601@cti-profile-2', '201@PICKUPMARK', '601@from-internal', '601@from-internal-xfer', '601@ext-group'] as $candidate) {
            check(str_contains($pickup, $candidate), 'missing pickup candidate '.$candidate);
        }
    }
    $missing = $ext->_exts['app-pickup'][' '.$fc_pickup.'202 '][2]['cmd']->output();
    check(!str_contains($missing, '202@&'), 'deleted device produced an empty explicit context');
    check(!isset($ext->_exts['app-pickup'][' '.$fc_pickup.'1234# ']), 'external group destination became a device pickup entry');
}
echo "PASS: profile pickup candidates, intercom and custom feature codes\n";
