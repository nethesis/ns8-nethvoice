#!/usr/bin/env php
<?php
// Exercise the transfer profile hook with the FreePBX dialplan builder.
// Usage: php transfer_profile_test.php <framework-directory>
if ($argc !== 2) {
    fwrite(STDERR, "Usage: php $argv[0] <framework-directory>\n");
    exit(2);
}
require $argv[1] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
require __DIR__ . '/../var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php';
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
function commands($ext, $context, $extension) {
    return array_map(fn($step) => $step['cmd']->output(), $ext->_exts[$context][' '.$extension.' ']);
}
$ext = new extensions();
// Same transfer destination as FreePBX 17 Core.
$dest = 'from-internal-xfer-dest';
$ext->add($dest, '71', '', new ext_goto('1', '71', 'from-internal-xfer'));
foreach (['_X.', '_*X.', '_#X.'] as $pattern) {
    $ext->add($dest, $pattern, '', new ext_dial('Local/${EXTEN}@from-internal-xfer/n', ',${DIAL_OPTIONS}'));
    $ext->add($dest, $pattern, '', new ext_hangup(''));
}
$ext->add($dest, 'h', '', new ext_hangup(''));
foreach (['app-cf-on', 'ext-group', 'ext-local', 'outbound-allroutes'] as $include) {
    $ext->addInclude('from-internal-additional', $include);
}
$ext->addInclude('outbound-allroutes', 'outrt-1');

nethcti3_configure_transfer_profile($ext);
foreach (['_X.', '_*X.', '_#X.'] as $pattern) {
    check(commands($ext, $dest, $pattern) === [
        'Gosub(func-nethvoice-transfer-context,s,1(${EXTEN}))',
        'Dial(Local/${EXTEN}@${NETHVOICE_TRANSFER_CONTEXT}/n,,${DIAL_OPTIONS})',
        'Hangup()',
    ], 'transfer destination does not resolve the transferer profile');
}
check(commands($ext, $dest, '71') === ['Goto(from-internal-xfer,71,1)'], 'other transfer destinations changed');
$internal = array_column($ext->_includes['nethvoice-xfer-internal'], 'include');
check($internal === ['from-internal-custom', 'app-cf-on', 'ext-group', 'ext-local'], 'internal destinations include the outbound routes');
$sub = commands($ext, 'func-nethvoice-transfer-context', 's');
check($sub[0] === 'Set(NETHVOICE_TRANSFER_CONTEXT=from-internal-xfer)', 'transfers lose the default transfer context');
check(str_contains($sub[1], 'DIALPLAN_EXISTS(nethvoice-xfer-internal,${ARG1},1)'), 'internal transfers use the profile');
check(str_contains($sub[2], '${TRANSFERERNAME}') && str_contains($sub[2], '${BLINDTRANSFER}'), 'transferer is not resolved');
check(in_array('Gosub(func-nethvoice-forward-context,s,1(${owner}))', $sub, true), 'transferer profile is not resolved');
check(str_contains(end($sub), 'Return()'), 'resolver does not return');

$before = $ext->_exts;
nethcti3_configure_transfer_profile($ext);
check($ext->_exts == $before, 'repeated hook changed the dialplan');
$ext = new extensions();
nethcti3_configure_transfer_profile($ext);
check(!isset($ext->_exts['func-nethvoice-transfer-context']), 'missing Core transfer dial must leave the dialplan intact');
echo "PASS: external transfers resolve the transferer profile, internal ones keep the transfer context\n";
