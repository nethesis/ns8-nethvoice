<?php
// Run last against the disposable fixture DB, after its backup/restore checks.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/DevelopmentReset.php';
use NethVoice\Agents\DevelopmentReset;
use NethVoice\Agents\Service;
$db=new PDO('mysql:host=127.0.0.1;port='.getenv('M0_TEST_PORT'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$native=new class {
    public bool $referenced=true;
    public function inUse(string $id): bool { return $this->referenced; }
    public function defaultLanguage(): string { return 'it'; }
    public function apply(): bool { return true; }
};
$reset=new DevelopmentReset($db,$native);
$bindings=$db->query('SELECT * FROM asterisk.voice_agent_bindings ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
$tools=$db->query('SELECT * FROM asterisk.voice_agent_builtin_tools ORDER BY tool_id,tool_version')->fetchAll(PDO::FETCH_ASSOC);
try { $reset->clear('wrong');throw new LogicException('reset_without_confirmation'); }
catch (RuntimeException $e) { assert($e->getMessage()==='development_reset_confirmation_required'); }
try { $reset->inspect();throw new LogicException('orphaned_custom_destination'); }
catch (RuntimeException $e) { assert($e->getMessage()==='agent_in_use'); }
$native->referenced=false;
$db->exec('CREATE TABLE asteriskcdrdb.cdr (fixture_id INT PRIMARY KEY, fixture_value VARCHAR(20))');
$db->exec("INSERT INTO asteriskcdrdb.cdr VALUES (1,'preserve-native-cdr')");
$db->exec('CREATE TABLE asterisk.unrelated_reset_test (id INT PRIMARY KEY, note VARCHAR(20))');
$db->exec("INSERT INTO asterisk.unrelated_reset_test VALUES (1,'preserve')");
$result=$reset->clear('clear-development-agent-data:nethvoice57');
assert($result['reset'] && !$result['receptionist_enabled'] && !$result['receptionist_published']);
assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_agents')->fetchColumn()===1);
assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_versions')->fetchColumn()===0);
assert($db->query('SELECT * FROM asterisk.voice_agent_bindings ORDER BY id')->fetchAll(PDO::FETCH_ASSOC)===$bindings);
assert($db->query('SELECT * FROM asterisk.voice_agent_builtin_tools ORDER BY tool_id,tool_version')->fetchAll(PDO::FETCH_ASSOC)===$tools);
assert($db->query('SELECT note FROM asterisk.unrelated_reset_test')->fetchColumn()==='preserve');
assert($db->query('SELECT fixture_value FROM asteriskcdrdb.cdr')->fetchColumn()==='preserve-native-cdr');
$draft=json_decode($db->query("SELECT definition_json FROM asterisk.voice_agent_drafts WHERE agent_id='receptionist'")->fetchColumn(),true);
assert($draft['conversation']['model']===null && $draft['conversation']['options']===null && $draft['conversation']['language']==='it');
assert($draft['conversation']['instructions']===Service::receptionistDraft()['conversation']['instructions']);
assert(str_contains($draft['conversation']['instructions'],'You are the Receptionist'));
assert($draft['tool_bindings'][0]['enabled'] && !$draft['tool_bindings'][1]['enabled']);
assert((int)$db->query("SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='asterisk' AND TRIGGER_NAME LIKE 'voice_agent_versions_no_%'")->fetchColumn()===2);
assert((int)$db->query('SELECT @@FOREIGN_KEY_CHECKS')->fetchColumn()===1);
echo "Development reset boundaries, reference denial, retained credentials/catalog and immutable triggers passed\n";
