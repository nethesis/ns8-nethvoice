<?php
// Run with: php freepbx/tests/nethhotel_web_test.php
set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
$directory = __DIR__.'/../var/www/html/freepbx/admin/modules/nethhotel/htdocs';
$source = file_get_contents($directory.'/functions.inc.php');
// Load the shared functions without bootstrapping FreePBX or a database.
eval(substr($source, strpos($source, 'function nethhotel_log(')));
define('DB_FETCHMODE_ASSOC', 2);
define('ROOMS_CONTEXT', 'hotel');
$options = [['prefix', '0'], ['ext_pattern', 'XXX'], ['internal_call', '1'],
    ['enableclean', '1'], ['groupcalls', '1'], ['externalcalls', '1']];
function sql($query, $mode, $fetch = null) {
    global $options;
    if ($query === 'SELECT * FROM roomsdb.room_groups') return [[1, 'Test group']];
    return str_contains($query, 'SELECT * FROM roomsdb.options') ? $options : [];
}
class DB {
    public static function IsError($value) { return false; }
}
class HotelDatabase {
    public array $queries = [];
    public array $groupRooms = [];
    public array $roomState = [];
    public function query($query) { $this->queries[] = $query; return true; }
    public function getAll($query, $mode) { return $this->groupRooms; }
    public function getRow($query, $mode) {
        if (str_contains($query, 'roomsdb.rooms')) return $this->roomState;
        return ['id' => 1, 'name' => 'Test', 'note' => '', 'groupcalls' => 0, 'roomscalls' => 0, 'externalcalls' => 0];
    }
}
$db = new HotelDatabase();
function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
check(addExtra('88991', '', 0, '88991-1794500000/'), 'Removing a room extra failed');
check(count($db->queries) === 1 && str_contains($db->queries[0], '1794500000'), 'Trailing extra separator must not create a second deletion');
$defaults = getOptions();
check($defaults['internal_call_nocheckin'] === '0', 'Unchecked-in calling must default to disabled');
check($defaults['reception'] === '' && $defaults['clean'] === '0', 'Missing options must have safe defaults');
check($defaults['reception_lang'] === 'en', 'Missing reception language must default to English');
$options[] = ['internal_call_nocheckin', '1'];
$options[] = ['reception_lang', 'it'];
check(getOptions()['internal_call_nocheckin'] === '1' && getOptions()['reception_lang'] === 'it', 'Stored choices must override defaults');

foreach ([false, 1] as $id) {
    $dialog = getGroupsDialog($id);
    check(str_contains($dialog, 'id="add-group-dialog"'), 'Group editor did not render');
    if ($id === 1) check(!str_contains($dialog, 'checked'), 'Disabled group permissions became enabled');
}
$db->groupRooms = [['extension' => '88991']];
foreach ([0, '0', 1, '1'] as $clean) {
    $db->roomState = ['clean' => $clean];
    $html = loadGroups();
    check(str_contains($html, $clean == 0 ? 'checkingroup' : 'needcleangroup'), 'Group state must handle integer and string database values');
    if ($clean == 1) check(str_contains($html, 'class=\'action clean-group\''), 'Dirty group has no cleaning action');
}
$db->groupRooms = [];
$db->roomState = [];

$originalBrand = getenv('BRAND_NAME');
foreach ([false, 'Test & <Hotel>'] as $brand) {
    putenv($brand === false ? 'BRAND_NAME' : 'BRAND_NAME='.$brand);
    ob_start();
    loadRooms(0);
    echo 'after-room-list';
    $html = ob_get_clean();
    check(str_contains($html, '/freepbx/admin/config.php?display=nethhotel'), 'Empty room list has a broken configuration link');
    check(str_contains($html, $brand === false ? 'NethVoice' : 'Test &amp; &lt;Hotel&gt;'), 'Brand is missing or unescaped');
    check(str_ends_with($html, '</div></div>after-room-list'), 'Empty room list terminated the page or left an open container');
}
putenv($originalBrand === false ? 'BRAND_NAME' : 'BRAND_NAME='.$originalBrand);

// Execute the real dispatcher; these requests intentionally have no room tab.
$dispatcher = file_get_contents($directory.'/action.php');
$dispatcher = substr($dispatcher, strpos($dispatcher, '$ntabs ='));
foreach (['gettext', 'getGroupsDialog', 'loadRooms'] as $action) {
    $_REQUEST = ['action' => $action, 'untranslated' => '["Save","Cancel"]'];
    ob_start();
    eval($dispatcher);
    $response = ob_get_clean();
    check($response !== '', "$action returned an empty response");
    if ($action === 'gettext') {
        check(json_decode($response, true, 512, JSON_THROW_ON_ERROR) === ['Save' => _('Save'), 'Cancel' => _('Cancel')], 'Translations are not valid JSON');
    }
}
foreach (['group.php' => '$ext =', 'alarm.php' => '$ntabs =',
    'report.php' => 'echo getReport(', 'filter_history.php' => 'return getHistory('] as $file => $start) {
    $_REQUEST = ['action' => 'detail', 'ext' => '88991'];
    $handler = file_get_contents($directory.'/'.$file);
    ob_start();
    eval(substr($handler, strpos($handler, $start)));
    check(ob_get_clean() !== '', "$file failed without optional parameters");
}
echo "NethHotel web regressions passed\n";
