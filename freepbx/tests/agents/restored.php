<?php
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
$db=new PDO('mysql:host=127.0.0.1;port='.getenv('VOICE_AGENT_RESTORE_PORT'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
\NethVoice\Agents\Schema::install($db);
assert($db->query('SELECT format FROM asterisk.voice_agent_installation')->fetchColumn()==='alpha-v8');
assert((int)$db->query("SELECT COUNT(*) FROM asterisk.voice_agent_agents WHERE kind='builtin' AND removed=0")->fetchColumn()===2);
assert($db->query("SELECT name FROM asterisk.voice_agent_agents WHERE agent_id='receptionist'")->fetchColumn()==='Test Receptionist');
assert((int)$db->query("SELECT COUNT(*) FROM asterisk.voice_agent_versions WHERE agent_id='receptionist'")->fetchColumn()===5);
assert($db->query("SELECT JSON_UNQUOTE(JSON_EXTRACT(definition_json,'$.fallback_destination_id')) FROM asterisk.voice_agent_versions WHERE agent_id='receptionist' AND workflow_version=5")->fetchColumn()==='native:ivr-7,s,1');
$encoded=$db->query("SELECT secrets_encrypted FROM asterisk.voice_agent_bindings WHERE JSON_UNQUOTE(JSON_EXTRACT(settings_json,'$.openai_project_id'))='proj_test'")->fetchColumn();
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
$secrets=json_decode((new \NethVoice\Agents\SecretStore())->decryptSecret($encoded),true);
assert($secrets['api_key']==='synthetic-api');
assert($db->query("SELECT JSON_UNQUOTE(JSON_EXTRACT(v.definition_json,'$.conversation.model')) FROM asterisk.voice_agent_versions v JOIN asterisk.voice_agent_agents a ON a.agent_id=v.agent_id WHERE a.name='Model agent' AND v.workflow_version=1")->fetchColumn()==='gpt-live-1');
$q=$db->prepare("UPDATE asterisk.voice_agent_versions SET definition_json='{}' WHERE agent_id='receptionist' AND workflow_version=1");
try { $q->execute(); throw new RuntimeException('restored_immutable_version_modified'); }
catch (PDOException $error) { assert($error->getCode()==='45000'); }
assert($db->query("SELECT JSON_UNQUOTE(JSON_EXTRACT(definition_json,'$.contract_version')) FROM asterisk.voice_agent_drafts WHERE agent_id='receptionist'")->fetchColumn()==='8');
assert((int)$db->query('SELECT COUNT(*) FROM asterisk.voice_agent_queue_directory')->fetchColumn()===1);
echo "Restored drafts, immutable versions, identities and encrypted credentials passed\n";
