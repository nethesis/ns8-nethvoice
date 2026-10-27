#!/usr/bin/env php
<?php
// Usage: php missing_device_dial_test.php <patched-core-directory> <framework-directory>
if ($argc !== 3) { exit(2); }
set_error_handler(function ($severity, $message) { throw new RuntimeException($message); });
$source = file_get_contents($argv[1] . '/agi-bin/dialparties.agi');
$start = strpos($source, 'function get_dial_string(');
$end = strpos($source, 'function debug(', $start);
eval(substr($source, $start, $end-$start));
function debug($message, $level) {}
function get_var($agi, $variable) { return $agi->contacts[$variable] ?? ''; }
class TestAgi {
    public array $devices = [];
    public array $dial = [];
    public array $contacts = ['PJSIP_DIAL_CONTACTS(201)' => 'PJSIP/201-contact', 'PJSIP_DIAL_CONTACTS(202)' => 'PJSIP/202-contact'];
    public function database_get($family, $key) {
        if ($family === 'AMPUSER') { return ['data' => implode('&', $this->devices)]; }
        return isset($this->dial[$key]) ? ['data' => $this->dial[$key]] : ['result' => 0];
    }
}
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
$agi = new TestAgi();
$agi->dial = ['201/dial' => 'PJSIP/201', '202/dial' => 'PJSIP/202', 'empty/dial' => ''];
foreach ([['missing','201','202'], ['201','missing','202'], ['201','202','missing'], ['201','empty','202']] as $devices) {
    $agi->devices = $devices;
    check(get_dial_string($agi, '200', 'FALSE', '601') === 'PJSIP/201-contact&PJSIP/202-contact', 'missing device changed valid dial destinations');
    check(get_dial_string($agi, '200', 'TRUE', '601') === 'Local/LC-201@from-internal&Local/LC-202@from-internal', 'missing device changed confirmation destinations');
}
$agi->devices = ['missing','empty'];
check(get_dial_string($agi, '200', 'FALSE', '601') === '', 'all-missing devices produced a dial destination');
check(get_dial_string($agi, '200', 'TRUE', '601') === '', 'all-missing devices produced a confirmation destination');
require $argv[2] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
require $argv[1] . '/Dialplan/dialparties.php';
$ext = new extensions();
FreePBX\modules\Core\Dialplan\dialparties::add($ext);
$steps = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['dialparties-getdialstring'][' internal ']);
$read = array_search('Set(HASH(dialparties,DEVICE_DS)=${DB(DEVICE/${DEVICE}/dial)})', $steps, true);
check($read !== false && $steps[$read+1] === 'GotoIf($["${HASH(dialparties,DEVICE_DS)}"=""]?next)', 'native dialparties lacks the missing-device guard');
check(str_contains($steps[$read+2], 'useconfirmation'), 'native dialparties guard is after confirmation branching');
echo "PASS: missing device positions, all-missing lists and confirmation\n";
