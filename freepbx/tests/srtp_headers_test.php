#!/usr/bin/env php
<?php
// Usage: php srtp_headers_test.php <patched-core-directory> <framework-directory>
if ($argc !== 3) { exit(2); }
require $argv[2] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
require $argv[1] . '/Dialplan/funcSipheaders.php';
require $argv[1] . '/Dialplan/macroDialone.php';

class FreePBX {
    public static function Config() { return new self(); }
    public static function Core() { return new self(); }
    public static function Nethcti3() { return new self(); }
    public function get($key) { return $key === 'ASTSIPDRIVER' ? 'chan_pjsip' : false; }
    public function listTrunks() { return [['trunkid' => '1'], ['trunkid' => '2']]; }
    public function getConfig($key, $id) { return $key === 'disable_srtp_header' && $id === '1' ? 1 : 0; }
}
class TestDatabase {
    public array $extensions = [];
    public function prepare($sql) {
        check($sql === "SELECT extension FROM rest_devices_phones WHERE srtp = 0 AND type = 'physical'", 'unexpected extension query');
        return $this;
    }
    public function execute() {}
    public function fetchAll($mode) { return array_map(fn($extension) => ['extension' => $extension], $this->extensions); }
}
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
function commands($ext, $context) {
    return array_map(fn($step) => $step['cmd']->output(), $ext->_exts[$context][' s ']);
}

// Run the actual header generator without the unrelated CTI configuration file writes.
$source = file_get_contents(__DIR__ . '/../var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php');
$start = strpos($source, '$nethcti3 = \\FreePBX::Nethcti3();', strpos($source, 'function nethcti3_get_config_late('));
$end = strpos($source, '/* Add inboundlookup agi', $start);
check($start !== false && $end !== false, 'cannot locate the header generator');
$generator = substr($source, $start, $end - $start);
$db = new TestDatabase();
$chan_dahdi = false;
$guard = '$["${FROMMACRODIALONE}" = "1" & "${FROMMACRODIALOUTTRUNK}" != "1"';
foreach ([[], ['201', '202']] as $plainExtensions) {
    $db->extensions = $plainExtensions;
    $ext = new extensions();
    FreePBX\modules\Core\Dialplan\funcSipheaders::add($ext);
    FreePBX\modules\Core\Dialplan\macroDialone::add($ext);
    $ext->add('macro-dialout-trunk', 's', 'gocall', new ext_noop('trunk dial'));
    // The trunk hook splices six instructions after gocall.
    for ($i = 0; $i < 6; $i++) {
        $ext->add('macro-dialout-trunk', 's', '', new ext_noop('trunk setup'));
    }
    eval($generator);

    $apply = commands($ext, 'func-apply-sipheaders');
    $headerRules = array_values(array_filter($apply, fn($command) => str_contains($command, 'func-set-sipheader,s,1(isTrunk,')));
    if ($plainExtensions === []) {
        check($headerRules === ['GosubIf(' . $guard . ']?func-set-sipheader,s,1(isTrunk,unset))'], 'all-encrypted installs must clear the inherited trunk header on extension/app legs only');
    } else {
        $match = ' & x${REGEX("^(201|202)$" ${CALLERID(num)})}x = x';
        check($headerRules === [
            'GosubIf(' . $guard . $match . '1x]?func-set-sipheader,s,1(isTrunk,1))',
            'GosubIf(' . $guard . $match . '0x]?func-set-sipheader,s,1(isTrunk,unset))',
        ], 'mixed installs must set the header for plain phones and clear it for encrypted phones/apps, while excluding trunk legs');
    }
    $readHeaders = array_search(true, array_map(fn($command) => str_contains($command, 'Set(SIPHEADERKEYS='), $apply), true);
    check($readHeaders !== false, 'Core header iteration is missing');
    foreach ($headerRules as $rule) {
        check(array_search($rule, $apply, true) < $readHeaders, 'SRTP rules must run before Core reads the inherited headers');
    }

    $dial = commands($ext, 'macro-dial-one');
    $markExtension = array_search('Set(__FROMMACRODIALONE=1)', $dial, true);
    $dialStep = array_search('dial', array_column($ext->_exts['macro-dial-one'][' s '], 'tag'), true);
    check($markExtension !== false && $dial[$markExtension + 1] === 'Set(__FROMMACRODIALOUTTRUNK=0)' && $markExtension + 2 === $dialStep, 'transfers must reset the inherited trunk flag before dialing an extension');
    $trunkRules = array_values(array_filter(commands($ext, 'macro-dialout-trunk'), fn($command) => !str_starts_with($command, 'Noop(')));
    check($trunkRules === [
        'GosubIf($["${DIAL_TRUNK}" = "1"]?func-set-sipheader,s,1(isTrunk,1))',
        'ExecIf($["${DIAL_TRUNK}" = "1"]?Set(__FROMMACRODIALOUTTRUNK=1))',
    ], 'only the trunk with Disable SRTP proxy header enabled must set isTrunk and bypass extension cleanup');
}
echo "PASS: all-encrypted and mixed extension SRTP headers, cleanup order and outbound trunk preservation\n";
