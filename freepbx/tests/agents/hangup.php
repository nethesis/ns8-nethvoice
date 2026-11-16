<?php
// Additive, opt-in hangup publication; disposable database only.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\Schema;
use NethVoice\Agents\PublishedContract;
$db=new PDO(getenv('M0_TEST_DSN'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$before=$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN);
$drafts=$db->query('SELECT definition_json FROM asterisk.voice_agent_drafts ORDER BY agent_id')->fetchAll(PDO::FETCH_COLUMN);
Schema::install($db);Schema::install($db);
assert($before===$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN));
assert($drafts===$db->query('SELECT definition_json FROM asterisk.voice_agent_drafts ORDER BY agent_id')->fetchAll(PDO::FETCH_COLUMN));
$draft=Service::emptyDraft();assert($draft['contract_version']===8);
$binding=$draft['tool_bindings'][3];assert($binding['tool_id']==='telephony.hangup' && !$binding['enabled']);
assert($binding['config']['playback_timeout_seconds']===5);
// One current catalog; installation does not enable an agent binding.
assert($db->query("SELECT COUNT(*) FROM asterisk.voice_agent_runtime_tools WHERE tool_id='telephony.hangup'")->fetchColumn()===1);
assert($db->query("SELECT COUNT(*) FROM asterisk.voice_agent_runtime_tools")->fetchColumn()===5);
$manifest=$db->query("SELECT manifest_json FROM asterisk.voice_agent_runtime_tools WHERE tool_id='telephony.hangup' AND tool_version=1")->fetchColumn();
assert(json_decode($manifest,true)===json_decode(file_get_contents(__DIR__.'/../../var/www/html/freepbx/rest/lib/agents/contracts/tools-v5.json'),true)[3]);
$snapshot=json_decode(file_get_contents(__DIR__.'/../../var/www/html/freepbx/rest/lib/agents/contracts/published-v8.example.json'),true);
PublishedContract::validate($snapshot);
foreach ([0,11,1.0,true,'5'] as $bad) {
 $invalid=$snapshot;$invalid['tool_bindings'][3]['config']['playback_timeout_seconds']=$bad;
 try { PublishedContract::validate($invalid); throw new Exception('invalid hangup accepted'); }
 catch (InvalidArgumentException $expected) {}
}
$snapshot['contract_version']=7;
try { PublishedContract::validate($snapshot); throw new Exception('old snapshot broadened'); }
catch (InvalidArgumentException $expected) {}
echo "Hangup catalog, disabled per-agent defaults, bounded settings and immutable historical publications passed\n";
