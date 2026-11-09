<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the real VisualPlan queue save and Queue Options persistence without a PBX.
interface BMO {}
require __DIR__ . '/../var/www/html/freepbx/admin/modules/queueoptions/Queueoptions.class.php';
$source = file_get_contents(__DIR__ . '/../var/www/html/freepbx/admin/modules/visualplan/htdocs/create.php');
eval(substr($source, strpos($source, 'function nethvplan_randomPassword(')));

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
class FreePBX {
    public static array $queues = [];
    public static function Queueoptions() { return new FreePBX\modules\Queueoptions(); }
    public static function Database() { return new self(); }
    public function prepare($sql) {
        return new class($sql) {
            public function __construct(private string $sql) {}
            public function execute($args) {
                $id = (string) $args[0];
                if (str_starts_with($this->sql, 'DELETE')) unset(FreePBX::$queues[$id]['lazymembers']);
                elseif (str_starts_with($this->sql, 'INSERT')) FreePBX::$queues[$id]['lazymembers'] = 'yes';
                else throw new RuntimeException('Unexpected persistence query');
            }
        };
    }
}
function needreload() {}
function queues_get($id) { return FreePBX::$queues[$id] ?? []; }
function queues_del($id) { unset(FreePBX::$queues[$id]); }
function queues_add($id, $name, $password, $prefix, $dest, $announce, $members, $join, $maxwait, ...$rest) {
    // FreePBX 17.0.4 queues_add whitelists fields; lazymembers is not one of them.
    FreePBX::$queues[$id] = ['name' => $name, 'strategy' => $_REQUEST['strategy'],
        'timeout' => $_REQUEST['timeout'], 'retry' => $_REQUEST['retry'] ?? '5', 'member' => $members];
}
function save_queue($id) {
    $value = ['id' => 'ext-queues%' . $id, 'userData' => [
        'name' => 'Test queue', 'extension' => $id, 'staticExt' => "201,0\n202,1", 'dynamicExt' => '',
        'strategy' => 'ringall', 'timeout' => '4', 'maxwait' => '60'],
        'entities' => array_fill(0, 9, ['id' => 'test-output'])];
    nethvplan_switchCreate('ext-queues', $value, []);
}
$currentCreated = $returnedIdArray = [];
foreach (['yes', 'no', null] as $lazy) {
    FreePBX::$queues['600'] = ['name' => 'Test queue', 'retry' => '1'];
    if ($lazy !== null) FreePBX::$queues['600']['lazymembers'] = $lazy;
    $_REQUEST = [];
    save_queue('600');
    save_queue('600');
    check((queues_get('600')['lazymembers'] ?? 'no') === ($lazy === 'yes' ? 'yes' : 'no'), 'VisualPlan lost Lazy Members');
    check(queues_get('600')['retry'] === '1', 'VisualPlan changed retry');
    check(queues_get('600')['member'] === ['Local/201@from-queue/n,0', 'Local/202@from-queue/n,1'], 'VisualPlan changed members/penalties');
}
// A following new widget must not inherit a previous queue's setting.
FreePBX::$queues['600']['lazymembers'] = 'yes';
save_queue('600');
save_queue('601');
check(!isset(queues_get('601')['lazymembers']), 'New queue inherited Lazy Members');
// The ordinary queue form must share the same persistence path and support disabling.
foreach (['1' => 'yes', '' => 'no'] as $posted => $expected) {
    $_REQUEST = ['action' => 'add', 'account' => '600', 'extdisplay' => '600', 'LazyMembers' => $posted];
    FreePBX::Queueoptions()->doConfigPageInit('queues');
    check((queues_get('600')['lazymembers'] ?? 'no') === $expected, 'Queue form did not save Lazy Members');
}
echo "PASS: VisualPlan preserves Lazy Members, queue options and member penalties\n";
