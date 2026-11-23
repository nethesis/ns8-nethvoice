<?php
// Run with: php freepbx/tests/pin_routing_test.php
set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
interface BMO {}
if (!function_exists('_')) { function _($value) { return $value; } }
class FreePBX {
    public static $database;
    public static function Database() { return self::$database; }
}
class Database {
    public $queries = [];
    public $row = false;
    private $sql;
    public function prepare($sql) { $this->sql = $sql; return $this; }
    public function execute($args) { $this->queries[] = [$this->sql, $args]; }
    public function fetch($mode) { return $this->row; }
}
require __DIR__.'/../var/www/html/freepbx/admin/modules/pin/Pin.class.php';
require __DIR__.'/../var/www/html/freepbx/admin/modules/pin/functions.inc.php';
$db = FreePBX::$database = new Database();
$pin = new \FreePBX\modules\Pin();

// Cover old forms submitting an empty string, new forms, and enable/disable.
foreach (['' => 0, '0' => 0, '1' => 1] as $value => $expected) {
    $db->queries = [];
    $_REQUEST = ['id' => '42', 'EnablePIN' => (string) $value];
    check($pin->doConfigPageInit('routing') === true, 'Route save was skipped');
    check($db->queries === [
        ['DELETE FROM `pin_protected_routes` WHERE `route_id` = ?', ['42']],
        ['INSERT INTO `pin_protected_routes` (`route_id`,`enabled`) VALUES (?,?)', ['42', $expected]],
    ], 'Route save must bind a numeric PIN flag for '.var_export($value, true));
}

// An unrelated route submission must preserve the existing PIN setting.
$db->queries = [];
$_REQUEST = ['id' => '42'];
$pin->doConfigPageInit('routing');
check($db->queries === [], 'Missing PIN field changed route protection');

foreach ([false, ['enabled' => '0'], ['enabled' => '1']] as $row) {
    $db->row = $row;
    $_REQUEST = ['id' => '42', 'view' => 'form'];
    $html = pin_hook_core('42', 'routing');
    foreach (['no' => '0', 'yes' => '1'] as $option => $value) {
        check(preg_match('/<input[^>]*id="EnablePIN'.$option.'"[^>]*>/', $html, $matches) === 1,
            'Missing PIN option '.$option);
        check(strpos($matches[0], 'value="'.$value.'"') !== false, 'Non-numeric PIN form value');
        $selected = $value === (string) ($row['enabled'] ?? '0');
        check((strpos($matches[0], 'CHECKED') !== false) === $selected, 'Wrong PIN selection');
    }
}
echo "PASS: numeric route PIN flags, legacy empty values, missing fields and form defaults\n";
