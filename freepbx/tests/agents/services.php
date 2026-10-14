<?php
// Disposable MariaDB only; synthetic identities and credentials.
require_once __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/Service.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\Schema;
$db = new PDO('mysql:host=127.0.0.1;port=' . getenv('M0_TEST_PORT'), 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$native = new class {
    public int $reloads = 0;
    public bool $exists=true;
    public function defaultLanguage(): string { return "it"; }
    public function trunkExists(array $row): bool { return $this->exists; }
    public function trunkReady(array $row): bool { return $this->exists; }
    public function destination(string $id): string { if ($id==="hangup") return "app-blackhole,hangup,1"; if ($id==="extension:203") return "from-did-direct,203,1"; if ($id==="native:ivr-7,s,1") return "ivr-7,s,1"; throw new RuntimeException("destination_unavailable",422); }
    public bool $applyOk=true;
    public function extensions(): array { return [['id'=>'extension:203','name'=>'Test extension']]; }
    public function provision(string $operation, array $binding, ?array $previous): int { $this->exists=true; return 9001; }
    public function apply(): bool { $this->reloads++; return $this->applyOk; }
    public bool $inUse=false;
    public function inUse(string $id): bool { return $this->inUse; }
};
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
$service = new Service($db, $native);
function check($condition, $name) { if (!$condition) throw new RuntimeException($name); }
function denied(callable $call, string $code) {
    try { $call(); } catch (Throwable $error) { check($error->getMessage() === $code, $code.": got ".$error->getMessage()); return; }
    throw new RuntimeException('expected_' . $code);
}
$internal = $service->get('receptionist');
$external = $service->save(null,['name'=>'Independent custom','draft'=>$internal['draft']],0,'test-admin');
check(array_column(array_filter($service->all(),fn($agent)=>$agent['kind']==='builtin'),'agent_id')===['receptionist'],'sole_builtin');
check($internal['kind'] === 'builtin' && !$internal['enabled'], 'seed_disabled');
check(!array_filter($external['draft']['tool_bindings'],fn($binding)=>$binding['enabled']), 'deny_by_default');
check($external['draft']['conversation']['language']==='it','freepbx_language_default');
putenv('OPENAI_API_KEY=synthetic-environment-key');
$envTrunk=$service->saveTrunk(null,['name'=>'Environment provider','provider'=>'openai','openai_project_id'=>'proj_env','api_key'=>'','webhook_secret'=>'whsec_'.base64_encode('synthetic-webhook')],0,'test-admin');
check($envTrunk['api_key_source']==='environment','environment_key_supported');
check(!str_contains(json_encode($envTrunk),'synthetic-environment-key'),'environment_key_hidden');
denied(fn() => $service->publish('receptionist', $internal['revision'], 'test-admin'), 'provider_required');
$trunk = $service->saveTrunk(null, ['name'=>'Test provider','provider'=>'openai', 'openai_project_id'=>'proj_test', 'api_key'=>'synthetic-api', 'webhook_secret'=>'whsec_' . base64_encode('synthetic-webhook')], 0, 'test-admin');
check($trunk['api_key_configured'] && !str_contains(json_encode($trunk), 'synthetic-api'), 'secret_not_returned');
$draft = $internal['draft'];
$draft['conversation']['voice'] = 'ash';
$draft['conversation']['instructions'] = 'Synthetic test agent';
$draft['provider_binding_id'] = $trunk['binding_id'];
$draft['fallback_destination_id'] = 'extension:203';
$draft['tool_bindings'][0]['enabled']=true;
$draft['tool_bindings'][0]['config']['max_results']=5;
$draft['tool_bindings'][1]['enabled']=true;
$draft['tool_bindings'][1]['config']['approved_destination_ids']=['extension:203'];
$saved = $service->save('receptionist', ['name'=>'Test Receptionist','draft'=>$draft], $internal['revision'], 'test-admin');
denied(fn() => $service->save('receptionist', ['name'=>'Stale','draft'=>$draft], $internal['revision'], 'test-admin'), 'revision_conflict');
Schema::install($db);
check($service->get('receptionist')['name'] === 'Test Receptionist', 'seed_does_not_reset');
$published = $service->publish('receptionist', $saved['revision'], 'test-admin');
$enabled = $service->enable('receptionist', true, $published['revision'], 'test-admin');
check($enabled['routable'], 'ready_destination');
check($enabled['published']['contract_version']===4,'typed_publication');
check($service->catalog()['tools']===json_decode(file_get_contents(__DIR__.'/../../var/www/html/freepbx/rest/lib/agents/contracts/tools-v2.json'),true),'immutable_catalog_contract');
check(!array_filter($service->get($external['agent_id'])['draft']['tool_bindings'],fn($binding)=>$binding['enabled']), 'independent_grants');
$reloads = $native->reloads;
$draft['conversation']['instructions'] = 'Updated synthetic instructions';
$saved = $service->save('receptionist', ['name'=>'Test Receptionist','draft'=>$draft], $enabled['revision'], 'test-admin');
$published = $service->publish('receptionist', $saved['revision'], 'test-admin');
check($native->reloads === $reloads, 'prompt_does_not_reload');
$toolDraft=$published['draft'];$toolDraft['tool_bindings'][0]['config']['max_results']=2;
$toolSaved=$service->save('receptionist',['name'=>$published['name'],'draft'=>$toolDraft],$published['revision'],'test-admin');
$toolPublished=$service->publish('receptionist',$toolSaved['revision'],'test-admin');
check($native->reloads===$reloads,'tool_settings_do_not_reload');
// Use the latest revision for subsequent concurrency checks.
$published=$toolPublished;
check($published['workflow_version'] === 3, 'immutable_versions');
denied(fn() => $service->remove('receptionist', $published['revision'], 'test-admin'), 'builtin_protected');
denied(fn() => $service->removeTrunk($trunk['binding_id'], $trunk['revision'], 'test-admin'), 'trunk_in_use');
$draft['tool_bindings'][1]['config']['approved_destination_ids'] = ['extension:999'];
denied(fn() => $service->save('receptionist', ['name'=>'Test Receptionist','draft'=>$draft], $published['revision'], 'test-admin'), 'destination_unavailable');
$disabled = $service->enable('receptionist', false, $published['revision'], 'test-admin');
check(!$disabled['routable'], 'disable_destination');
check($db->query("SELECT COUNT(*) FROM asterisk.voice_agent_audit WHERE agent_id='receptionist'")->fetchColumn() >= 6, 'audited_changes');
$native->applyOk=false;
$failed=$service->enable('receptionist',true,$disabled['revision'],'test-admin');
check($failed['sync_status']==='error' && !$failed['routable'],'failed_reload_not_routable');
$native->applyOk=true;
check($service->synchronize('test-admin')['sync_status']==='synced','sync_retry');
$retried=$service->get('receptionist');
check($retried['routable'],'retry_routable');
$service->enable('receptionist',false,$retried['revision'],'test-admin');
check($db->query("SELECT COUNT(*) FROM asterisk.voice_agent_audit WHERE action='native_sync_failed'")->fetchColumn()===1,'retry_audited');
$agent=$service->get('receptionist');
$originalInstructions=$agent['published']['conversation']['instructions'];
$unpublished=$agent['draft'];$unpublished['conversation']['instructions']='Do not publish this draft from VisualPlan';
$agent=$service->save('receptionist',['name'=>$agent['name'],'draft'=>$unpublished],$agent['revision'],'test-admin');
$service->setFallbacks(['receptionist'=>['expected_revision'=>$agent['revision'],'destination_id'=>'native:ivr-7,s,1']],'test-admin');
$agent=$service->get('receptionist');
check($agent['published']['fallback_destination_id']==='native:ivr-7,s,1','native_fallback_published');
check($agent['published']['conversation']['instructions']===$originalInstructions,'fallback_does_not_publish_draft');
check($agent['draft']['conversation']['instructions']===$unpublished['conversation']['instructions'],'draft_preserved');
$native->exists=false;
check(!$service->get('receptionist')['routable'],'native_drift_not_routable');
check($service->trunks()[0]['sync_status']==='error','native_drift_visible');
check($service->synchronize('test-admin')['sync_status']==='synced','missing_native_recovered');
check($agent['published']['contract_version']===4,'fallback_preserves_v4');
$service->enable('receptionist',true,$agent['revision'],'test-admin');
// An installed legacy seed stays readable; explicit retirement cannot orphan references.
$legacy=json_decode(file_get_contents(__DIR__.'/../../var/www/html/freepbx/rest/lib/agents/contracts/published-v1.example.json'),true);
$legacy['agent_id']='internal';$legacy['destination_id']='agent:internal';
$legacy['provider_binding_id']=$trunk['binding_id'];
$db->exec("INSERT INTO asterisk.voice_agent_agents (agent_id,name,destination_id,kind,enabled,active_workflow_version,sync_status) VALUES ('internal','Legacy test','agent:internal','builtin',1,1,'synced')");
$q=$db->prepare('INSERT INTO asterisk.voice_agent_drafts (agent_id,definition_json) VALUES (?,?)');
$q->execute(['internal',json_encode(array_diff_key($legacy,array_flip(['contract_version','agent_id','destination_id','workflow_version','provider'])))]);
$q=$db->prepare('INSERT INTO asterisk.voice_agent_versions (agent_id,workflow_version,contract_version,definition_json) VALUES (?,1,1,?)');
$encoded=json_encode($legacy);$q->execute(['internal',$encoded]);
check($service->get('internal')['legacy'],'legacy_visible_read_only');
denied(fn()=>$service->publish('internal',1,'test-admin'),'legacy_configuration_read_only');
denied(fn()=>$service->enable('internal',true,1,'test-admin'),'legacy_configuration_read_only');
$native->inUse=true;
denied(fn()=>$service->remove('internal',1,'test-admin'),'agent_in_use');
check($service->get('internal')['enabled'],'legacy_route_preserved');
$native->inUse=false;
$service->remove('internal',1,'test-admin');
check($db->query("SELECT definition_json FROM asterisk.voice_agent_versions WHERE agent_id='internal'")->fetchColumn()===$encoded,'legacy_publication_unchanged');
echo "Agent configuration services passed\n";
