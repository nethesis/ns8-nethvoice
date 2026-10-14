<?php
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
$db=new PDO('mysql:host=127.0.0.1;port='.getenv('VOICE_AGENT_RESTORE_PORT'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
\NethVoice\Agents\Schema::install($db);
assert((int)$db->query('SELECT MAX(version) FROM asterisk.voice_agent_schema')->fetchColumn()===9);
assert((int)$db->query("SELECT COUNT(*) FROM asterisk.voice_agent_agents WHERE kind='builtin' AND removed=0")->fetchColumn()===1);
assert($db->query("SELECT name FROM asterisk.voice_agent_agents WHERE agent_id='receptionist'")->fetchColumn()==='Test Receptionist');
assert((int)$db->query("SELECT COUNT(*) FROM asterisk.voice_agent_versions WHERE agent_id='receptionist'")->fetchColumn()===4);
assert($db->query("SELECT JSON_UNQUOTE(JSON_EXTRACT(definition_json,'$.fallback_destination_id')) FROM asterisk.voice_agent_versions WHERE agent_id='receptionist' AND workflow_version=4")->fetchColumn()==='native:ivr-7,s,1');
$encoded=$db->query("SELECT secrets_encrypted FROM asterisk.voice_agent_bindings WHERE JSON_UNQUOTE(JSON_EXTRACT(settings_json,'$.openai_project_id'))='proj_test'")->fetchColumn();
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
$secrets=json_decode((new \NethVoice\Agents\SecretStore())->decryptSecret($encoded),true);
assert($secrets['api_key']==='synthetic-api');
$q=$db->prepare("UPDATE asterisk.voice_agent_versions SET definition_json='{}' WHERE agent_id='receptionist' AND workflow_version=1");
try { $q->execute(); throw new RuntimeException('restored_immutable_version_modified'); }
catch (PDOException $error) { assert($error->getCode()==='45000'); }
echo "Restored drafts, immutable versions, identities and encrypted credentials passed\n";
