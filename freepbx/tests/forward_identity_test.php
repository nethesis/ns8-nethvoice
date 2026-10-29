#!/usr/bin/env php
<?php
// Exercise the actual Core generator and FreePBX dialplan builder.
// Usage: php forward_identity_test.php <core-directory> <framework-directory>
if ($argc !== 3) {
    fwrite(STDERR, "Usage: php $argv[0] <core-directory> <framework-directory>\n");
    exit(2);
}
require $argv[2] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
require $argv[1] . '/Dialplan/macroDialone.php';
require __DIR__ . '/../var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php';
class FreePBX {
    public static function Config() { return new self(); }
    public function get($key) { return 'none'; }
}
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
$ext = new extensions();
$chan_dahdi = false;
FreePBX\modules\Core\Dialplan\macroDialone::add($ext);
$before = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['macro-dial-one'][' cf ']);
nethcti3_configure_forward_identity($ext);
$steps = $ext->_exts['macro-dial-one'][' cf '];
$after = array_map(fn($step) => $step['cmd']->output(), $steps);
check($after[1] === $before[1] && str_contains($after[1], '?Return()'), 'forward loop check was changed');
check($after[2] === 'Set(NETHVOICE_CF_DEST=${DB(CF/${DEXTEN})})', 'forward destination was not read explicitly');
check(str_contains($after[3], '${CFIGNORE}') && str_contains($after[3], '${NETHVOICE_CF_DEST:0:2}') && str_contains($after[3], '${DB(AMPUSER/${NETHVOICE_CF_DEST}/cidnum)}'), 'forward identity exclusions are missing');
check(array_merge(array_slice($after, 0, 2), array_slice($after, 4)) === $before, 'unrelated Core instructions changed');
nethcti3_configure_forward_identity($ext);
check(count($ext->_exts['macro-dial-one'][' cf ']) === count($steps), 'repeated hook duplicated instructions');
nethcti3_configure_forward_progress($ext);
$progress = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['macro-dial-one'][' cf ']);
$forwardReturn = array_search('ExecIf($["${DEXTEN}"!=""]?Return())', $progress, true);
check($progress[$forwardReturn-2] === 'Answer' && $progress[$forwardReturn-1] === 'Ringing()', 'TIM progress must precede the forwarding return');
check(array_merge(array_slice($progress, 0, $forwardReturn-2), array_slice($progress, $forwardReturn)) === $after, 'progress response changed another instruction');
nethcti3_configure_forward_progress($ext);
check(count($ext->_exts['macro-dial-one'][' cf ']) === count($progress), 'repeated progress hook duplicated instructions');
$ext->_exts['macro-dial-one'][' cf '] = [];
nethcti3_configure_forward_identity($ext);
nethcti3_configure_forward_progress($ext);
check($ext->_exts['macro-dial-one'][' cf '] === [], 'missing anchors must leave the rest of the dialplan intact');
echo "PASS: Core loop guard, forwarding identity and TIM progress order\n";
