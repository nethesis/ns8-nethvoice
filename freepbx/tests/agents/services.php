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
    public function inUse(string $id): bool { return false; }
};
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
$service = new Service($db, $native);
function check($condition, $name) { if (!$condition) throw new RuntimeException($name); }
function denied(callable $call, string $code) {
    try { $call(); } catch (Throwable $error) { check($error->getMessage() === $code, $code.": got ".$error->getMessage()); return; }
    throw new RuntimeException('expected_' . $code);
}
$internal = $service->get('internal');
$external = $service->get('external');
check($internal['kind'] === 'builtin' && !$internal['enabled'], 'seed_disabled');
check($external['draft']['enabled_tools'] === [], 'deny_by_default');
check($external['draft']['conversation']['language']==='it','freepbx_language_default');
putenv('OPENAI_API_KEY=synthetic-environment-key');
$envTrunk=$service->saveTrunk(null,['name'=>'Environment provider','provider'=>'openai','openai_project_id'=>'proj_env','api_key'=>'','webhook_secret'=>'whsec_'.base64_encode('synthetic-webhook')],0,'test-admin');
check($envTrunk['api_key_source']==='environment','environment_key_supported');
check(!str_contains(json_encode($envTrunk),'synthetic-environment-key'),'environment_key_hidden');
denied(fn() => $service->publish('internal', $internal['revision'], 'test-admin'), 'provider_required');
$trunk = $service->saveTrunk(null, ['name'=>'Test provider','provider'=>'openai', 'openai_project_id'=>'proj_test', 'api_key'=>'synthetic-api', 'webhook_secret'=>'whsec_' . base64_encode('synthetic-webhook')], 0, 'test-admin');
check($trunk['api_key_configured'] && !str_contains(json_encode($trunk), 'synthetic-api'), 'secret_not_returned');
$draft = $internal['draft'];
$draft['conversation']['voice'] = 'ash';
$draft['conversation']['instructions'] = 'Synthetic test agent';
$draft['provider_binding_id'] = $trunk['binding_id'];
$draft['fallback_destination_id'] = 'extension:203';
$draft['enabled_tools'] = ['directory.find_destinations','telephony.transfer'];
$draft['approved_destination_ids'] = ['extension:203'];
$saved = $service->save('internal', ['name'=>'Test internal','draft'=>$draft], $internal['revision'], 'test-admin');
denied(fn() => $service->save('internal', ['name'=>'Stale','draft'=>$draft], $internal['revision'], 'test-admin'), 'revision_conflict');
Schema::install($db);
check($service->get('internal')['name'] === 'Test internal', 'seed_does_not_reset');
$published = $service->publish('internal', $saved['revision'], 'test-admin');
$enabled = $service->enable('internal', true, $published['revision'], 'test-admin');
check($enabled['routable'], 'ready_destination');
check($service->get('external')['draft']['enabled_tools'] === [], 'independent_grants');
$reloads = $native->reloads;
$draft['conversation']['instructions'] = 'Updated synthetic instructions';
$saved = $service->save('internal', ['name'=>'Test internal','draft'=>$draft], $enabled['revision'], 'test-admin');
$published = $service->publish('internal', $saved['revision'], 'test-admin');
check($native->reloads === $reloads, 'prompt_does_not_reload');
check($published['workflow_version'] === 2, 'immutable_versions');
denied(fn() => $service->remove('internal', $published['revision'], 'test-admin'), 'builtin_protected');
denied(fn() => $service->removeTrunk($trunk['binding_id'], $trunk['revision'], 'test-admin'), 'trunk_in_use');
$draft['approved_destination_ids'] = ['extension:999'];
denied(fn() => $service->save('internal', ['name'=>'Test internal','draft'=>$draft], $published['revision'], 'test-admin'), 'destination_unavailable');
$disabled = $service->enable('internal', false, $published['revision'], 'test-admin');
check(!$disabled['routable'], 'disable_destination');
check($db->query("SELECT COUNT(*) FROM asterisk.voice_agent_audit WHERE agent_id='internal'")->fetchColumn() >= 6, 'audited_changes');
$native->applyOk=false;
$failed=$service->enable('internal',true,$disabled['revision'],'test-admin');
check($failed['sync_status']==='error' && !$failed['routable'],'failed_reload_not_routable');
$native->applyOk=true;
check($service->synchronize('test-admin')['sync_status']==='synced','sync_retry');
$retried=$service->get('internal');
check($retried['routable'],'retry_routable');
$service->enable('internal',false,$retried['revision'],'test-admin');
check($db->query("SELECT COUNT(*) FROM asterisk.voice_agent_audit WHERE action='native_sync_failed'")->fetchColumn()===1,'retry_audited');
$agent=$service->get('internal');
$originalInstructions=$agent['published']['conversation']['instructions'];
$unpublished=$agent['draft'];$unpublished['conversation']['instructions']='Do not publish this draft from VisualPlan';
$agent=$service->save('internal',['name'=>$agent['name'],'draft'=>$unpublished],$agent['revision'],'test-admin');
$service->setFallbacks(['internal'=>['expected_revision'=>$agent['revision'],'destination_id'=>'native:ivr-7,s,1']],'test-admin');
$agent=$service->get('internal');
check($agent['published']['fallback_destination_id']==='native:ivr-7,s,1','native_fallback_published');
check($agent['published']['conversation']['instructions']===$originalInstructions,'fallback_does_not_publish_draft');
check($agent['draft']['conversation']['instructions']===$unpublished['conversation']['instructions'],'draft_preserved');
$native->exists=false;
check(!$service->get('internal')['routable'],'native_drift_not_routable');
check($service->trunks()[0]['sync_status']==='error','native_drift_visible');
check($service->synchronize('test-admin')['sync_status']==='synced','missing_native_recovered');
echo "Agent configuration services passed\n";
