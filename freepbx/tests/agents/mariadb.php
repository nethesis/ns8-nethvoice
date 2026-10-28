<?php
// Disposable databases only: never point this test at a PBX installation.
require __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/Schema.php';
require __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/PublishedContract.php';
$dsn = getenv('M0_TEST_DSN');
if (!$dsn) throw new RuntimeException('M0_TEST_DSN_required');
$db = new PDO($dsn, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($db->query('SHOW DATABASES LIKE "asterisk"')->fetchColumn()) throw new RuntimeException('fresh_disposable_database_required');
$db->exec('CREATE DATABASE asterisk');
$db->exec('CREATE DATABASE asteriskcdrdb');
$db->exec('CREATE TABLE asterisk.users (extension VARCHAR(20) PRIMARY KEY, name VARCHAR(100))');
$db->exec('CREATE TABLE asterisk.userman_users (username VARCHAR(100),default_extension VARCHAR(20))');
$db->exec("INSERT INTO asterisk.users VALUES ('203','Test extension')");
$db->exec("INSERT INTO asterisk.userman_users VALUES ('test','203')");
\NethVoice\Agents\Schema::install($db);
assert($db->query("SELECT agent_id FROM asterisk.voice_agent_agents WHERE kind='builtin' ORDER BY agent_id")->fetchAll(PDO::FETCH_COLUMN)===['consultation_assistant','receptionist']);
$seedPrompt=fn()=>$db->query("SELECT JSON_UNQUOTE(JSON_EXTRACT(definition_json,'$.conversation.instructions')) FROM asterisk.voice_agent_drafts WHERE agent_id='receptionist'")->fetchColumn();
assert($seedPrompt()===\NethVoice\Agents\ReceptionistDefaults::INSTRUCTIONS);
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
$seed=json_decode($db->query("SELECT definition_json FROM asterisk.voice_agent_drafts WHERE agent_id='receptionist'")->fetchColumn(),true);
assert($seed===\NethVoice\Agents\Service::receptionistDraft());

// Every repeat preserves administrator edits, even an intentionally blank prompt.
$db->exec("UPDATE asterisk.voice_agent_drafts SET definition_json=JSON_SET(definition_json,'$.conversation.instructions','Operator prompt') WHERE agent_id='receptionist'");
\NethVoice\Agents\Schema::install($db);
assert($seedPrompt()==='Operator prompt');
$db->exec("UPDATE asterisk.voice_agent_drafts SET definition_json=JSON_SET(definition_json,'$.conversation.instructions','') WHERE agent_id='receptionist'");
\NethVoice\Agents\Schema::install($db);
assert($seedPrompt()==='');
// Restore the canonical seed for subsequent service tests through an explicit test write.
$q=$db->prepare("UPDATE asterisk.voice_agent_drafts SET definition_json=? WHERE agent_id='receptionist'");
$q->execute([json_encode(\NethVoice\Agents\Service::receptionistDraft(),JSON_THROW_ON_ERROR)]);
// An older installation gains the internal builtin without changing custom assistants.
$assistant=\NethVoice\Agents\Service::consultationDraft();
$db->exec("DELETE FROM asterisk.voice_agent_drafts WHERE agent_id='consultation_assistant'");
$db->exec("DELETE FROM asterisk.voice_agent_agents WHERE agent_id='consultation_assistant'");
$db->exec("INSERT INTO asterisk.voice_agent_agents (agent_id,name,destination_id) VALUES ('custom_consultation','Custom assistant','agent:custom_consultation')");
$q=$db->prepare('INSERT INTO asterisk.voice_agent_drafts (agent_id,definition_json) VALUES (?,?)');
$q->execute(['custom_consultation',json_encode($assistant,JSON_THROW_ON_ERROR)]);
\NethVoice\Agents\Schema::install($db);
\NethVoice\Agents\Schema::install($db);
$readAssistant=fn()=>json_decode($db->query("SELECT definition_json FROM asterisk.voice_agent_drafts WHERE agent_id='consultation_assistant'")->fetchColumn(),true);
assert($readAssistant()===$assistant);
assert($db->query("SELECT definition_json FROM asterisk.voice_agent_drafts WHERE agent_id='custom_consultation'")->fetchColumn()===json_encode($assistant,JSON_THROW_ON_ERROR));
assert((int)$db->query("SELECT enabled FROM asterisk.voice_agent_agents WHERE agent_id='consultation_assistant'")->fetchColumn()===0);
// Preserve edits and intentional blanks, including settings outside the prompt.
foreach (['Private operator prompt',''] as $prompt) {
    $edited=$assistant;$edited['conversation']['instructions']=$prompt;$edited['conversation']['language']='fr';
    $q=$db->prepare("UPDATE asterisk.voice_agent_drafts SET definition_json=? WHERE agent_id='consultation_assistant'");
    $q->execute([json_encode($edited,JSON_THROW_ON_ERROR)]);
    \NethVoice\Agents\Schema::install($db);
    assert($readAssistant()===$edited);
}
$q->execute([json_encode($assistant,JSON_THROW_ON_ERROR)]);
$db->exec("DELETE FROM asterisk.voice_agent_drafts WHERE agent_id='custom_consultation'");
$db->exec("DELETE FROM asterisk.voice_agent_agents WHERE agent_id='custom_consultation'");
$snapshot = json_decode(file_get_contents(__DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/contracts/published-v8.example.json'), true);
\NethVoice\Agents\PublishedContract::validate($snapshot);
$db->exec("INSERT INTO asterisk.voice_agent_agents (agent_id, name, destination_id) VALUES ('basic_voice', 'Synthetic', 'agent:basic_voice')");
$stmt = $db->prepare('INSERT INTO asterisk.voice_agent_versions (agent_id, workflow_version, definition_json) VALUES (?, ?, ?)');
$stmt->execute(['basic_voice', 1, json_encode($snapshot)]);
\NethVoice\Agents\Schema::install($db);
assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_versions')->fetchColumn() === 1);
assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_published')->fetchColumn() === 0);
$db->exec("UPDATE asterisk.voice_agent_agents SET enabled=1, active_workflow_version=1,sync_status='synced' WHERE agent_id='basic_voice'");
assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_published')->fetchColumn() === 1);
function denied(callable $fn): void {
    try { $fn(); } catch (PDOException $e) { return; }
    throw new RuntimeException('operation_should_be_denied');
}
denied(fn() => $db->exec("UPDATE asterisk.voice_agent_versions SET workflow_version=2"));
denied(fn() => $db->exec('DELETE FROM asterisk.voice_agent_versions'));
// Accounts are only for this isolated test. Actual passwords are provisioned separately.
foreach (['m0_reader', 'm0_writer'] as $user) $db->exec("CREATE USER '$user'@'%' IDENTIFIED BY ''");
$db->exec("GRANT SELECT ON asterisk.voice_agent_published TO 'm0_reader'@'%'");
foreach (['voice_agent_runtime_bindings','voice_agent_extension_directory','voice_agent_runtime_tools','voice_agent_queue_directory','voice_agent_ivr_directory','voice_agent_ivr_branches'] as $view) $db->exec("GRANT SELECT ON asterisk.$view TO 'm0_reader'@'%'");
$db->exec("GRANT SELECT, INSERT ON asteriskcdrdb.voice_agent_runs TO 'm0_writer'@'%'");
$db->exec("GRANT UPDATE (provider_call_id, ended_at, outcome, error_code) ON asteriskcdrdb.voice_agent_runs TO 'm0_writer'@'%'");
$db->exec("GRANT SELECT, INSERT ON asteriskcdrdb.voice_agent_run_events TO 'm0_writer'@'%'");
$reader = new PDO($dsn, 'm0_reader', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$writer = new PDO($dsn, 'm0_writer', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
assert((int)$reader->query('SELECT COUNT(*) FROM asterisk.voice_agent_published')->fetchColumn() === 1);
denied(fn() => $reader->query('SELECT * FROM asterisk.voice_agent_drafts'));
denied(fn() => $reader->exec("UPDATE asterisk.voice_agent_agents SET enabled=0"));
denied(fn() => $reader->exec("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id) VALUES ('bad')"));
denied(fn() => $writer->query('SELECT * FROM asterisk.voice_agent_published'));
$run = '00000000-0000-4000-8000-000000000001';
$event = '00000000-0000-4000-8000-000000000002';
$writer->exec("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id, agent_id, workflow_version, retention_until) VALUES ('$run', 'basic_voice', 1, NOW() + INTERVAL 7 DAY)");
$writer->exec("INSERT IGNORE INTO asteriskcdrdb.voice_agent_run_events (event_id, run_id, event_type) VALUES ('$event', '$run', 'admitted')");
$writer->exec("INSERT IGNORE INTO asteriskcdrdb.voice_agent_run_events (event_id, run_id, event_type) VALUES ('$event', '$run', 'admitted')");
assert((int)$writer->query('SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_run_events')->fetchColumn() === 1);
$writer->exec("UPDATE asteriskcdrdb.voice_agent_runs SET outcome='completed', ended_at=NOW() WHERE run_id='$run'");
denied(fn() => $writer->exec("UPDATE asteriskcdrdb.voice_agent_runs SET agent_id='other'"));
denied(fn() => $writer->exec('DELETE FROM asteriskcdrdb.voice_agent_run_events'));
denied(fn() => $writer->exec("INSERT INTO asteriskcdrdb.voice_agent_run_events (event_id, run_id, event_type) VALUES ('00000000-0000-4000-8000-000000000003', '$run', 'arbitrary_payload')"));
denied(fn() => $db->exec("UPDATE asterisk.voice_agent_builtin_tools SET tool_version=2"));
denied(fn() => $db->exec("DELETE FROM asterisk.voice_agent_builtin_tools"));
echo "PASS: baseline twice, preserved versions, immutable publication, least privileges, bounded idempotent events\n";
