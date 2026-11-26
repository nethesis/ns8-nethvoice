#!/usr/bin/env php
<?php
// Exercise the actual Core generator and FreePBX dialplan builder.
// Usage: php forward_progress_test.php <core-directory> <framework-directory>
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
function cf_steps($ext) {
    return array_map(fn($step) => $step['cmd']->output(), $ext->_exts['macro-dial-one'][' cf ']);
}
$ext = new extensions();
$chan_dahdi = false;
FreePBX\modules\Core\Dialplan\macroDialone::add($ext);
// Same order as nethcti3_get_config(): the identity hook runs before the progress one.
nethcti3_configure_forward_identity($ext);
$before = cf_steps($ext);
nethcti3_configure_forward_progress($ext);
$steps = $ext->_exts['macro-dial-one'][' cf '];
$after = cf_steps($ext);
$forwardReturn = array_search('ExecIf($["${DEXTEN}"!=""]?Return())', $after, true);
check($forwardReturn !== false, 'Core forwarding return is missing');
// TIM trunks (#7321) need the answer and ringing only when the forward applies (CFIGNORE empties DEXTEN),
// and Local channels (queue members, ring groups) must not be answered before the forward target answers.
$condition = '$["${DEXTEN}"!="" & "${CHANNEL(channeltype)}"!="Local"]';
check($after[$forwardReturn-2] === "ExecIf($condition?Answer())", 'answer must be conditional and precede the forwarding return');
check($after[$forwardReturn-1] === "ExecIf($condition?Ringing())", 'ringing must be conditional and precede the forwarding return');
check($steps[$forwardReturn-2]['tag'] === 'nethvoice-cf-answer', 'answer step lost the idempotency tag');
check(!in_array('Answer', $after, true) && !in_array('Ringing()', $after, true), 'unconditional progress left in the forwarding path');
check(array_merge(array_slice($after, 0, $forwardReturn-2), array_slice($after, $forwardReturn)) === $before, 'progress response changed another instruction');
nethcti3_configure_forward_progress($ext);
check(cf_steps($ext) === $after, 'repeated progress hook changed the forwarding path');
$ext->_exts['macro-dial-one'][' cf '] = [];
nethcti3_configure_forward_progress($ext);
check($ext->_exts['macro-dial-one'][' cf '] === [], 'missing anchor must leave the rest of the dialplan intact');
echo "PASS: TIM progress only on applied forwards of non-Local channels\n";
