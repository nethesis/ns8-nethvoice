#!/usr/bin/env php
<?php
// Run in the FreePBX image (or mount REST at /var/www/html/freepbx/rest).
// Usage: php recallonbusy_return_test.php <core-dir> <framework-dir>
if ($argc !== 3) { exit(2); }
$framework = is_file($argv[2].'/admin/libraries/extensions.class.php')
    ? $argv[2] : $argv[2].'/amp_conf/htdocs';
require $framework.'/admin/libraries/extensions.class.php';
interface BMO {}
class FreePBX_Helpers {}
class FreePBX {
    public static function Core() { return new self(); }
    public static function Modules() { return new self(); }
    public function getAllUsers() { return ['201' => []]; }
    public function moduleHasMethod(...$args) { return false; }
}
require __DIR__.'/../var/www/html/freepbx/admin/modules/recallonbusy/Recallonbusy.class.php';
class TestRecallonbusy extends FreePBX\modules\Recallonbusy {
    public string $default = 'enabled';
    public function getConfig($key) { return $this->default; }
}
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
$core = file_get_contents($argv[1].'/functions.inc.php');
check(str_contains($core, "new ext_macro('exten-vm',"), 'core no longer calls exten-vm through the framework adapter');
check((new ext_macro('exten-vm', 'novm,201'))->output() === 'Gosub(macro-exten-vm,s,1(novm,201))', 'Recall exit context is no longer a Gosub');
$hook = new TestRecallonbusy();
foreach (['enabled', 'disabled'] as $default) {
    $hook->default = $default;
    $ext = new extensions();
    $ext->add('ext-local', '201', 'dest', new ext_noop('destination'));
    for ($i = 0; $i < 25; $i++) { $ext->add('macro-exten-vm', 's', '', new ext_noop($i)); }
    $hook->doDialplanHook($ext, 'asterisk', 100);
    $commands = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['macro-exten-vm'][' s ']);
    check(str_ends_with($commands[20], '?Return())'), 'busy exit is not a subroutine Return');
    check(str_contains($commands[20], '${DIALSTATUS}') && str_contains($commands[20], '${DB(ROBconfig/${AMPUSER})}'), 'busy exit lost its eligibility checks');
    $recall = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['recall-on-busy'][' s ']);
    check($recall === ['AGI(recallonbusy_set.php,${EXTTOCALL})', 'Return()'], 'recall subroutine no longer returns to its caller');
}
echo "PASS: RecallOnBusy returns from the FreePBX 17 Gosub context\n";
