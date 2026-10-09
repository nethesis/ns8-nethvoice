#!/usr/bin/env php
<?php
// Usage: php forward_context_test.php <patched-core-directory> <framework-directory>
if ($argc !== 3) { exit(2); }
require $argv[2] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
require $argv[1] . '/Dialplan/macroDialone.php';
require $argv[1] . '/Dialplan/dialparties.php';
class FreePBX {
    public static function Config() { return new self(); }
    public function get($key) { return 'none'; }
}
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
function commands($ext, $context, $extension) {
    return array_map(fn($step) => $step['cmd']->output(), $ext->_exts[$context][' '.$extension.' ']);
}
$ext = new extensions();
$chan_dahdi = false;
FreePBX\modules\Core\Dialplan\macroDialone::add($ext);
$local = commands($ext, 'macro-dial-one', 'dlocal');
check($local[0] === 'Gosub(func-nethvoice-forward-context,s,1(${EXTTOCALL}))', 'unconditional forward lost the original owner');
check(str_contains($local[1], 'Hangup(21)'), 'unknown forwarding owner is not rejected');
check(str_contains($local[2], '@${NETHVOICE_FORWARD_CONTEXT}/n'), 'timed unconditional forward ignores the profile');
check(in_array('Goto(${NETHVOICE_FORWARD_CONTEXT},${DSTRING},1)', commands($ext, 'macro-dial-one', 'usegoto'), true), 'untimed forward ignores the profile');
$source = file_get_contents($argv[1] . '/functions.inc.php');
$amp_conf = ['DIVERSIONHEADER' => false];
foreach (['macro-exten-vm', 'macro-simple-dial'] as $mcontext) {
    $start = strpos($source, "\t\$mcontext = '$mcontext';");
    $start = strpos($source, "\t\$exten = 'docfu';", $start);
    $end = strpos($source, $mcontext === 'macro-exten-vm' ? '// If we are here it was determined' : "\t\$exten = '_s-.';", $start);
    eval(substr($source, $start, $end-$start));
    foreach (['docfu', 'docfb'] as $extension) {
        $out = commands($ext, $mcontext, $extension);
        check($out[0] === 'Gosub(func-nethvoice-forward-context,s,1(${EXTTOCALL}))', 'conditional forward does not resolve its owner');
        check(str_contains($out[1], 'Hangup(21)'), 'conditional forward falls back for an unknown owner');
        foreach ($out as $command) {
            check(!str_contains($command, '@from-internal/n') && !str_contains($command, "?'from-internal"), 'conditional forward retains unrestricted outbound routing');
        }
        check(str_contains(implode("\n", $out), '@${NETHVOICE_FORWARD_CONTEXT}/n'), 'conditional forward has no profile route');
    }
}
check(str_contains(implode("\n", commands($ext, 'macro-simple-dial', 'docfu')), '@ext-local'), 'internal Follow Me handling changed');
$resolverStart = strpos($source, "\t\$ext->add('func-nethvoice-forward-context'");
$resolverEnd = strpos($source, "\tDialplan\\macroDialone", $resolverStart);
eval(substr($source, $resolverStart, $resolverEnd-$resolverStart));
check(commands($ext, 'func-nethvoice-forward-context', 's')[0] === 'Set(NETHVOICE_FORWARD_CONTEXT=${PJSIP_ENDPOINT(${ARG1},context)})', 'resolver queries the wrong endpoint');

$agiSource = file_get_contents($argv[1] . '/agi-bin/dialparties.agi');
$start = strpos($agiSource, 'function get_dial_string(');
$end = strpos($agiSource, 'function debug(', $start);
eval(substr($agiSource, $start, $end-$start));
function debug($message, $level) {}
function get_var($agi, $variable) { return $agi->values[$variable] ?? ''; }
class TestForwardAgi {
    public array $values = ['PJSIP_ENDPOINT(201,context)' => 'cti-profile-2', 'PJSIP_ENDPOINT(202,context)' => 'cti-profile-3'];
    public function database_get($family, $key) { return ['data' => '', 'result' => 0]; }
    public function set_variable($key, $value) { $this->values[$key] = $value; }
}
$agi = new TestForwardAgi();
foreach (['201' => 'cti-profile-2', '202' => 'cti-profile-3'] as $owner => $context) {
    check(get_dial_string($agi, '1234#', 'FALSE', '601', $owner) === 'Local/1234@'.$context.'/n', 'group forward uses the wrong owner context');
    check(get_dial_string($agi, '1234#', 'TRUE', '601', $owner) === 'Local/RG-601*-1234#@'.$context, 'confirmation lost the owner context');
}
check(get_dial_string($agi, '1234#', 'FALSE', '601', 'missing') === '', 'group forward falls back for a deleted owner');
check(get_dial_string($agi, '1234#', 'FALSE', '601') === 'Local/1234@from-internal/n', 'explicit external group destination changed');

// Run the actual main AGI loop with two different forwarding owners. A stale
// index from the preceding CF loop must not select the context for every leg.
$AGI = $agi;
$ext = ['1234#', '5678#', '9999#'];
$forward_owners = [0 => '201', 1 => '202'];
$kk = 99;
$skipremaining = $mastermode = $cwignore = 0;
$dsarray = $ext_hunt = [];
$use_confirmation = 'FALSE';
$ringgroup_index = '601';
$rgmethod = 'ringall';
$cidnum = '203';
$start = strpos($agiSource, "\$ds = '';\nforeach (");
$end = strpos($agiSource, '} // end foreach ( $ext as $k )', $start);
eval(substr($agiSource, $start, $end-$start+1));
check($ds === 'Local/1234@cti-profile-2/n&Local/5678@cti-profile-3/n&Local/9999@from-internal/n&', 'AGI mixed group members lost their own forwarding context');

$ext = new extensions();
FreePBX\modules\Core\Dialplan\dialparties::add($ext);
$external = implode("\n", commands($ext, 'dialparties-getdialstring', 's'));
check(str_contains($external, 'FORWARD_OWNER') && str_contains($external, '@${NETHVOICE_FORWARD_CONTEXT}'), 'native group forward ignores the owner context');
$unconditional = implode("\n", commands($ext, 'dialparties-checkcfextensions', 's'));
check(str_contains($unconditional, 'HASH(dialparties,CF)}#') && str_contains($unconditional, 'dialparties_FORWARD_OWNER'), 'native unconditional forward loses its target or owner');
$noanswer = implode("\n", commands($ext, 'dialparties-checkcfextension', 'check1-1-1'));
check(str_contains($noanswer, 'FORWARD_OWNER') && str_contains($noanswer, '${HASH(dialparties,EXTCFU)}#'), 'native unavailable forward loses its target or owner');
echo "PASS: unconditional, conditional, untimed and group forwarding contexts\n";
