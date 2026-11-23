#!/usr/bin/env php
<?php
// Usage: php returnontransfer_settings_test.php <framework-directory>
if ($argc !== 2) { exit(2); }
require $argv[1].'/amp_conf/htdocs/admin/libraries/extensions.class.php';
if (!function_exists('_')) { function _($text) { return $text; } }
interface BMO {}
class FreePBX {
    public static function Modules() { return new self(); }
    public function moduleHasMethod(...$args) { return false; }
}
class TransferConfig {
    public string $context = 'from-internal-xfer';
    public function update($key, $value) { $this->context = $value; }
    public function reset_conf_settings(...$args) { $this->context = 'from-internal-xfer'; }
}
class FreePBX_Helpers {
    public array $settings;
    public object $FreePBX;
    public function __construct(array $settings) {
        $this->settings = $settings;
        $this->FreePBX = (object)['Config' => new TransferConfig()];
    }
    public function getAll() { return $this->settings; }
    public function getConfig($key) { return $this->settings[$key] ?? false; }
    public function setConfig($key, $value) {
        // FreePBX DB_Helper treats boolean false as deletion.
        if ($value === false) { unset($this->settings[$key]); }
        else { $this->settings[$key] = $value; }
    }
}
function needreload() {}
function load_view($file, $data) {
    extract($data);
    ob_start();
    include $file;
    return ob_get_clean();
}
function show_view($file, $data) { echo $data['content']; }
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
function dialplan($module) {
    $ext = new extensions();
    $module->doDialplanHook($ext, 'asterisk', 900);
    return $ext;
}
function page($module) {
    ob_start();
    $module->showPage();
    return ob_get_clean();
}
require __DIR__.'/../var/www/html/freepbx/admin/modules/returnontransfer/Returnontransfer.class.php';
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
$custom = ['timeout' => '27', 'prefix' => 'CUSTOM <callback>', 'alertinfo' => 'ring-answer'];

// A missing enabled key is how previous releases saved disabled callbacks.
$legacy = new FreePBX\modules\Returnontransfer($custom);
check(empty(dialplan($legacy)->_exts), 'Legacy disabled callback generates dialplan');
check(str_contains(page($legacy), 'value="" CHECKED'), 'Legacy disabled state is not shown');
$legacy->install();
check($legacy->settings === $custom + ['enabled' => '0'], 'Install changes legacy custom settings');
$before = $legacy->settings;
$legacy->install();
check($legacy->settings === $before, 'Repeated install changes settings');

// Saving No must retain a disabled value rather than remove the key.
$_REQUEST = ['action' => 'save', 'enabled' => ''] + $custom;
$legacy->doConfigPageInit('returnontransfer');
check(array_key_exists('enabled', $legacy->settings) && !$legacy->settings['enabled'], 'Saving No deletes enabled');
check(empty(dialplan($legacy)->_exts), 'Disabled callback generates dialplan');
check($legacy->FreePBX->Config->context === 'from-internal-xfer', 'Disabling retains callback transfer context');

// Saving Yes must still generate the callback with the configured options.
$_REQUEST['enabled'] = '1';
$legacy->doConfigPageInit('returnontransfer');
check($legacy->FreePBX->Config->context === 'blindxfer_ringback', 'Enabling loses callback transfer context');
$ext = dialplan($legacy);
$commands = array_map(fn($step) => $step['cmd']->output(), $ext->_exts['blindxfer_ringback'][' _X. ']);
check(in_array('Set(timeoutd=27)', $commands, true), 'Custom timeout is lost');
check(in_array('Set(CALLERID(name)=CUSTOM <callback>)', $commands, true), 'Custom prefix is lost');
check(in_array('Set(__ALERT_INFO=ring-answer)', $commands, true), 'Custom Alertinfo is lost');
check(str_contains(page($legacy), 'CUSTOM &lt;callback&gt;'), 'Form loses or fails to escape custom prefix');

// Every missing field must be safe before install, including an empty store.
foreach (['timeout', 'prefix', 'alertinfo'] as $key) {
    $partial = $custom + ['enabled' => '1'];
    unset($partial[$key]);
    $module = new FreePBX\modules\Returnontransfer($partial);
    dialplan($module);
    page($module);
    $module->install();
    check(array_intersect_key($module->settings, $partial) === $partial, 'Install overwrites existing values');
    check(array_key_exists($key, $module->settings), 'Install does not backfill '.$key);
}
$empty = new FreePBX\modules\Returnontransfer([]);
check(empty(dialplan($empty)->_exts), 'Uninitialized settings generate callback dialplan');
page($empty);
$empty->install();
check($empty->settings['enabled'] === '1', 'Fresh install does not enable callback');
check($empty->settings['timeout'] === '15', 'Fresh install loses default timeout');
check($empty->FreePBX->Config->context === 'blindxfer_ringback', 'Fresh install loses transfer context');
dialplan($empty);

// Backfilling timeout must not re-enable callbacks or replace blank fields.
foreach (['0', 0, false] as $disabled) {
    $module = new FreePBX\modules\Returnontransfer(['enabled' => $disabled, 'prefix' => '', 'alertinfo' => '']);
    $module->install();
    check($module->settings['enabled'] === $disabled, 'Install re-enables an existing disabled callback');
    check($module->settings['prefix'] === '' && $module->settings['alertinfo'] === '', 'Install replaces blank fields');
    check(empty(dialplan($module)->_exts), 'Backfilled disabled callback generates dialplan');
    page($module);
}
echo "PASS: transfer callback settings survive disable, reload and upgrade\n";
