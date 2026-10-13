<?php
// Disposable MariaDB only; synthetic identities and credentials.
require_once __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/Service.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\Schema;
$db = new PDO('mysql:host=127.0.0.1;port=' . getenv('M0_TEST_PORT'), 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$native = new class {
    public int $reloads = 0;
    public bool $applyOk=true;
    public function extensions(): array { return [['id'=>'extension:203','name'=>'Test extension']]; }
    public function provision(string $operation, array $binding, ?array $previous): int { return 9001; }
    public function apply(): bool { $this->reloads++; return $this->applyOk; }
    public function inUse(string $id): bool { return false; }
};
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
$service = new Service($db, $native);
function check($condition, $name) { if (!$condition) throw new RuntimeException($name); }
function denied(callable $call, string $code) {
    try { $call(); } catch (Throwable $error) { check($error->getMessage() === $code, $code); return; }
    throw new RuntimeException('expected_' . $code);
}
$internal = $service->get('internal');
$external = $service->get('external');
check($internal['kind'] === 'builtin' && !$internal['enabled'], 'seed_disabled');
check($external['draft']['enabled_tools'] === [], 'deny_by_default');
denied(fn() => $service->publish('internal', $internal['revision'], 'test-admin'), 'provider_required');
$trunk = $service->saveTrunk(null, ['name'=>'Test provider','provider'=>'openai', 'openai_project_id'=>'proj_test', 'api_key'=>'synthetic-api', 'webhook_secret'=>'whsec_' . base64_encode('synthetic-webhook')], 0, 'test-admin');
check($trunk['api_key_configured'] && !str_contains(json_encode($trunk), 'synthetic-api'), 'secret_not_returned');
$draft = $internal['draft'];
$draft['conversation']['voice'] = 'test_voice';
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
echo "Agent configuration services passed\n";
