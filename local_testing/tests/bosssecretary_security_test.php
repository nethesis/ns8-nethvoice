<?php
require __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/bosssecretary/functions.inc.php';
class FreePBX {
    public static array $calls = [];
    public static function Database() { return new self(); }
    public function prepare($sql) { return new Statement($sql); }
}
class Statement {
    public function __construct(private string $sql) {}
    public function execute($params) { FreePBX::$calls[] = [$this->sql, $params]; return true; }
    public function fetchColumn() { return '1'; }
}
function sql($sql) { return true; }
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
$malicious = "1' OR '1'='1";
check(bosssecretary_group_delete($malicious) === false, 'non-numeric group ID accepted');
check(FreePBX::$calls === [], 'invalid delete reached database');
check(bosssecretary_extract_group_from_request('bsgroup-'.$malicious) === '', 'request group parser accepted SQL');
$errors = bosssecretary_group_edit('1', '<script>alert(1)</script>', ['201'], ['202'], [$malicious]);
check($errors === [], 'valid edit failed');
$chief = array_values(array_filter(FreePBX::$calls, fn($call) => str_contains($call[0], 'INSERT INTO bosssecretary_chief')));
check(count($chief) === 1 && $chief[0][0] === 'INSERT INTO bosssecretary_chief VALUES (?, ?)' && $chief[0][1] === ['1', $malicious], 'chief input was interpolated into SQL');
FreePBX::$calls = [];
check(bosssecretary_group_delete('1'), 'valid group deletion failed');
foreach (FreePBX::$calls as [$sql, $params]) {
    check(str_contains($sql, '?'), 'group deletion does not use bound parameters');
    check($params === ['1'], 'group deletion changed another ID');
}
echo "PASS: Boss Secretary rejects injected IDs and binds chief/group mutations\n";
