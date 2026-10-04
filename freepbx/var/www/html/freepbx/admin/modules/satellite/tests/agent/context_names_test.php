<?php
require_once __DIR__ . '/../../lib/AgentContextSource.php';
class NamedDirectoryStatement {
    public function execute($values = array()) {}
    public function fetchAll($mode = null) {
        return array(array('resource_key'=>'extension:201','description'=>'Sales contact','synonyms'=>'["sales"]','internal_allowed'=>1,'external_allowed'=>0));
    }
}
class NamedDirectoryDatabase {
    public function prepare($sql) { return new NamedDirectoryStatement(); }
}
class NamedDirectoryCore {
    public function listUsers($all = false) { return array(array('201','Alice &amp; Example'),array('202','')); }
}
class NamedDirectoryQueues {
    public function listQueues() { return array(array('600','Customer &amp; Support')); }
}
class NamedDirectoryIvr {
    public function getDetails() { return array(array('id'=>'5','name'=>'Sales &amp; Menu')); }
}
$pbx = (object) array('Database'=>new NamedDirectoryDatabase(),'Core'=>new NamedDirectoryCore(),'Queues'=>new NamedDirectoryQueues(),'Ivr'=>new NamedDirectoryIvr());
$rows = (new AgentContextSource($pbx))->directory();
$rows = array_column($rows, null, 'id');
$expected = array('extension:201'=>'Alice & Example','extension:202'=>'Extension 202','queue:600'=>'Customer & Support','ivr:5'=>'Sales & Menu');
foreach ($expected as $id=>$name) {
    if ($rows[$id]['name'] !== $name) { throw new RuntimeException('Incorrect native display name'); }
}
if (!$rows['extension:201']['internal_allowed'] || $rows['extension:201']['external_allowed'] || $rows['extension:201']['synonyms'] !== array('sales')) {
    throw new RuntimeException('Directory policy or aliases changed');
}
if ($rows['queue:600']['target'] !== array('context'=>'ext-queues','exten'=>'600','priority'=>1) || $rows['ivr:5']['target'] !== array('context'=>'ivr-5','exten'=>'s','priority'=>1)) {
    throw new RuntimeException('Trusted routing target changed');
}
echo "Native names, directory visibility and routing targets passed\n";
