#!/usr/bin/env php
<?php
// Usage: php paging_transfer_test.php <patched-paging-dir> <core-dir> <framework-dir>
if ($argc !== 4) { exit(2); }
define('FREEPBX_IS_AUTH', true);
define('DB_FETCHMODE_ASSOC', 2);
$framework = is_file($argv[3].'/admin/libraries/extensions.class.php')
    ? $argv[3] : $argv[3].'/amp_conf/htdocs';
require $framework.'/admin/libraries/extensions.class.php';
require $argv[1].'/functions.inc.php';
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
function freepbx_trim($value) { return trim($value ?? ''); }
class featurecode {
    public function __construct(...$args) {}
    public function getCodeActive() { return ''; }
}
class DB {
    public bool $withGroup = true;
    public static function IsError($value) { return false; }
    public function getAll($sql, $mode) {
        if (str_contains($sql, 'FROM paging_config') && $this->withGroup) {
            return [['page_group' => '600', 'force_page' => 0, 'duplex' => 0, 'announcement' => 'beep', 'volume' => 0]];
        }
        return [];
    }
    public function getCol($sql) { return ['201', '202']; }
}
class conferences_conf {
    public function addConfUser(...$args) {}
}
class FreePBX {
    public static function Paging() { return new self(); }
    public static function Modules() { return new self(); }
    public function moduleHasMethod(...$args) { return false; }
    public function getDropSilence() { return false; }
}
class TestManager {
    public function database_get(...$args) { return 0; }
}
$db = new DB();
$conferences_conf = new conferences_conf();
$astman = new TestManager();
$amp_conf = ['ASTCONFAPP' => 'app_confbridge'];
$version = '22.10.0';
$chan_dahdi = false;
$ext = new extensions();
paging_get_config('asterisk');
check(in_array('ext-paging', array_column($ext->_includes['from-internal-additional'] ?? [], 'include'), true), 'paging missing from transfer-accessible dialplan');
check(!in_array('ext-paging', array_column($ext->_includes['from-internal-noxfer-additional'] ?? [], 'include'), true), 'paging remains restricted to ordinary calls');
$commands = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['ext-paging'][' 600 ']);
check($commands === ['Goto(app-pagegroups,600,1)'], 'paging group destination changed');
$page = implode("\n", array_map(fn($step) => $step['cmd']->output(), $ext->_exts['app-pagegroups'][' 600 ']));
check(str_contains($page, 'Set(PAGE_MEMBERS=201-202)') && str_contains($page, 'AGI(page.agi)'), 'ordinary paging lost its members or AGI');
foreach ($ext->_exts as $extensions) {
    foreach ($extensions as $steps) {
        foreach ($steps as $step) {
            check(!preg_match('/(?:^|\?)Macro(?:Exit)?\(/i', $step['cmd']->output()), 'unsupported Macro generated');
        }
    }
}
// Core's installed include chain makes the generated paging include visible to
// both ordinary calls and blind transfers, independently of transfer callbacks.
$core = file_get_contents($argv[2].'/etc/extensions.conf');
foreach (['from-internal' => 'from-internal-xfer', 'from-internal-xfer' => 'from-internal-additional'] as $from => $to) {
    check(preg_match('/\['.preg_quote($from, '/').'\]([^\[]*)/', $core, $match) === 1, 'missing core context '.$from);
    check(str_contains($match[1], 'include => '.$to), 'broken core include chain from '.$from);
}
$db->withGroup = false;
$ext = new extensions();
paging_get_config('asterisk');
check(!in_array('ext-paging', array_column($ext->_includes['from-internal-additional'] ?? [], 'include'), true), 'empty paging configuration exposes a group');
echo "PASS: paging generation and ordinary/blind-transfer include paths\n";
