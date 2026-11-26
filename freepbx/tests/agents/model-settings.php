<?php
// Disposable MariaDB + injected catalog transport; no vendor requests.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\ProviderCatalog;
$db=new PDO('mysql:host=127.0.0.1;port='.getenv('M0_TEST_PORT'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
putenv('OPENAI_API_KEY=synthetic-environment-key');
$native=new class {
    public int $reloads=0;
    public array $provisions=[];
    public function defaultLanguage(): string { return 'en'; }
    public function trunkReady(array $row): bool { return true; }
    public function trunkExists(array $row): bool { return !empty($row['freepbx_trunk_id']); }
    public function provision(string $operation,array $binding,?array $previous): int { $this->provisions[]=$operation; return 9003; }
    public function apply(): bool { $this->reloads++;return true; }
    public function directory(): array { return ['items'=>[]]; }
    public function extensions(): array { return [['id'=>'extension:203','name'=>'Test extension']]; }
    public function destination(string $id): string { return 'app-blackhole,hangup,1'; }
};
$keys=[];$available=['gpt-realtime-2.1','gpt-realtime-2','gpt-live-1','gpt-6-luna','gpt-6-sol'];
$discoveryError=null;
$catalog=new ProviderCatalog(function($provider,$key) use (&$keys,&$available,&$discoveryError) {
    if ($discoveryError!==null) throw new RuntimeException($discoveryError);
    $keys[]=$key;return ['data'=>array_map(fn($id)=>['id'=>$id],$available)];
});
$service=new Service($db,$native,$catalog);
function ensure($condition,string $name): void { if (!$condition) throw new RuntimeException($name); }
function rejected(callable $work,string $code): void {
    try { $work();throw new LogicException('expected_'.$code); }
    catch (RuntimeException $error) { ensure($error->getMessage()===$code,'unexpected_error_'.$error->getMessage()); }
}
$service->models(['provider'=>'openai','api_key'=>'']);
ensure(end($keys)==='synthetic-environment-key','environment_discovery');
$input=['name'=>'Model test','provider'=>'openai','openai_project_id'=>'proj_models','api_key'=>'synthetic-stored-key','webhook_secret'=>'whsec_'.base64_encode('synthetic-webhook-secret')];
rejected(fn()=>$service->saveTrunk(null,$input+['model'=>'gpt-realtime-2'],0,'synthetic-admin'),'invalid_fields');
$trunk=$service->saveTrunk(null,$input,0,'synthetic-admin');
ensure(!array_key_exists('model',$trunk) && !isset($trunk['effective_model']),'trunk_has_no_conversation_model');
$service->models(['provider'=>'openai','binding_id'=>$trunk['binding_id']]);
ensure(end($keys)==='synthetic-stored-key','stored_discovery');
$service->models(['provider'=>'openai','binding_id'=>$trunk['binding_id'],'api_key'=>'synthetic-unsaved-key']);
ensure(end($keys)==='synthetic-unsaved-key','unsaved_key_precedence');
rejected(fn()=>$service->models(['provider'=>'grok','binding_id'=>$trunk['binding_id']]),'invalid_provider');
$draft=Service::emptyDraft();
$draft['provider_binding_id']=$trunk['binding_id'];
$draft['conversation']=['language'=>'en','voice'=>'marin','greeting'=>'Hello','instructions'=>'Speak briefly.','model'=>'gpt-live-1','options'=>ProviderCatalog::capabilities('openai')['models'][4]['defaults']];
$draft['fallback_destination_id']='hangup';
$first=$service->save(null,['name'=>'Model agent','draft'=>$draft],0,'synthetic-admin');
$first=$service->publish($first['agent_id'],$first['revision'],'synthetic-admin');
ensure($first['published']['contract_version']===8,'agent_publication_v8');
$draft['conversation']['model']='gpt-realtime-2';$draft['conversation']['voice']='ash';$draft['conversation']['options']=null;
$second=$service->save(null,['name'=>'Independent model','draft'=>$draft],0,'synthetic-admin');
$second=$service->publish($second['agent_id'],$second['revision'],'synthetic-admin');
ensure($second['published']['provider_binding_id']===$first['published']['provider_binding_id'],'same_trunk');
ensure($first['published']['conversation']['model']==='gpt-live-1' && $second['published']['conversation']['model']==='gpt-realtime-2','independent_models');
$modelId=$first['agent_id'];
$before=$db->query("SELECT definition_json FROM asterisk.voice_agent_versions WHERE agent_id='$modelId'")->fetchColumn();
$reloads=$native->reloads;
$draft=$first['draft'];$draft['conversation']['options']['reasoning_effort']='high';$draft['conversation']['voice']='quartz';
$edited=$service->save($first['agent_id'],['name'=>$first['name'],'draft'=>$draft],$first['revision'],'synthetic-admin');
$edited=$service->publish($edited['agent_id'],$edited['revision'],'synthetic-admin');
ensure($native->reloads===$reloads,'conversation_only_does_not_reload');
ensure($db->query("SELECT definition_json FROM asterisk.voice_agent_versions WHERE agent_id='$modelId' AND workflow_version=1")->fetchColumn()===$before,'publication_immutable');
$bad=$draft;$bad['conversation']['options']['tools']=['arbitrary'];
rejected(fn()=>$service->save($first['agent_id'],['name'=>$first['name'],'draft'=>$bad],$edited['revision'],'synthetic-admin'),'invalid_configuration');
foreach (['provider_catalog_unavailable','provider_permission_denied'] as $error) {
    $discoveryError=$error;
    rejected(fn()=>$service->models(['provider'=>'openai','binding_id'=>$trunk['binding_id'],'test'=>true]),$error);
    $edited=$service->publish($edited['agent_id'],$edited['revision'],'synthetic-admin');
    ensure($edited['published']['conversation']['model']==='gpt-live-1','publish_does_not_require_discovery');
}
$discoveryError=null;
$available=['gpt-live-1'];
$proof=$db->prepare('UPDATE asterisk.voice_agent_bindings SET webhook_verified_at=NOW(),webhook_verified_key_generation=? WHERE binding_id=?');
$crypto=new \NethVoice\Agents\SecretStore();
$markVerified=fn(string $id,string $key)=>$proof->execute([$crypto->webhookKeyGeneration('openai',$key),$id]);
$projection=$db->prepare('SELECT runtime_secrets_encrypted,webhook_verified_at FROM asterisk.voice_agent_bindings WHERE binding_id=?');
$readProjection=function(string $id) use ($projection): array {
    $projection->execute([$id]);
    return $projection->fetch(PDO::FETCH_ASSOC);
};
$markVerified($trunk['binding_id'],'synthetic-stored-key');
$input['api_key']='';$reloads=$native->reloads;
$trunk=$service->saveTrunk($trunk['binding_id'],$input,$trunk['revision'],'synthetic-admin');
ensure($native->reloads===$reloads,'credential_edit_not_model_edit');
ensure($trunk['webhook_status']==='verified','unchanged_key_stays_verified');
$service->models(['provider'=>'openai','binding_id'=>$trunk['binding_id'],'credential_mode'=>'dedicated','test'=>true]);
ensure(end($keys)==='synthetic-stored-key','blank_edit_preserves_dedicated_key');
$trunk=$service->saveTrunk($trunk['binding_id'],array_replace($input,['api_key'=>'synthetic-new-dedicated']),$trunk['revision'],'synthetic-admin');
ensure($trunk['webhook_status']==='manual' && $readProjection($trunk['binding_id'])['webhook_verified_at']===null,'dedicated_rotation_clears_verification');
$markVerified($trunk['binding_id'],'synthetic-new-dedicated');
$dedicated=$service->saveTrunk(null,array_replace($input,['name'=>'Other trunk','api_key'=>'synthetic-independent-key']),0,'synthetic-admin');
$markVerified($dedicated['binding_id'],'synthetic-independent-key');
$dedicatedBefore=$readProjection($dedicated['binding_id']);
$input['credential_mode']='inherit';
$trunk=$service->saveTrunk($trunk['binding_id'],$input,$trunk['revision'],'synthetic-admin');
ensure($trunk['api_key_source']==='environment','explicit_switch_clears_dedicated_key');
ensure($trunk['webhook_status']==='manual','switching_to_a_different_inherited_key_clears_verification');
ensure(in_array('Model agent',$service->inheritedAgents(),true),'published_inherited_agent_listed');
$service->models(['provider'=>'openai','binding_id'=>$trunk['binding_id'],'credential_mode'=>'inherit','test'=>true]);
ensure(end($keys)==='synthetic-environment-key','inheritance_effective');
$markVerified($trunk['binding_id'],'synthetic-environment-key');
$before=$readProjection($trunk['binding_id']);
$service->reconcileWebhookKeys();
ensure($readProjection($trunk['binding_id'])===$before,'unchanged_inherited_key_preserves_generation');
putenv('OPENAI_API_KEY=synthetic-rotated-environment-key');
$service->reconcileWebhookKeys();
$after=$readProjection($trunk['binding_id']);
ensure($after['webhook_verified_at']===null && $after['runtime_secrets_encrypted']!==$before['runtime_secrets_encrypted'],'inherited_key_retires_old_verification_and_runtime_generation');
ensure($readProjection($dedicated['binding_id'])===$dedicatedBefore,'inherited_rotation_ignores_dedicated_trunks');
$service->reconcileWebhookKeys();
ensure($readProjection($trunk['binding_id'])===$after,'rotation_is_idempotent');
$status=fn()=>array_column($service->trunks(),'webhook_status','binding_id')[$trunk['binding_id']];
$markVerified($trunk['binding_id'],'synthetic-environment-key');
ensure($status()==='manual','old_runtime_cannot_verify_new_inherited_key');
$service->reconcileWebhookKeys();
ensure($readProjection($trunk['binding_id'])['webhook_verified_at']===null,'same_generation_retry_clears_old_key_proof');
putenv('OPENAI_API_KEY=synthetic-environment-key');
$trunk=$service->saveTrunk($trunk['binding_id'],$input,$trunk['revision'],'synthetic-admin');
putenv('OPENAI_API_KEY=synthetic-rotated-environment-key');
$markVerified($trunk['binding_id'],'synthetic-rotated-environment-key');
ensure($status()==='verified','actual_new_key_can_be_verified');
$service->reconcileWebhookKeys();
ensure($status()==='verified','stale_configuration_marker_does_not_clear_matching_runtime_proof');
$legacy=$service->saveTrunk(null,array_replace($input,['credential_mode'=>'dedicated','name'=>'Legacy verification','api_key'=>'synthetic-legacy-key']),0,'synthetic-admin');
$legacySecrets=$crypto->encryptSecret(json_encode(['api_key'=>'synthetic-legacy-key','webhook_secret'=>$input['webhook_secret']]));
$db->prepare('UPDATE asterisk.voice_agent_bindings SET secrets_encrypted=?,webhook_verified_at=NOW() WHERE binding_id=?')->execute([$legacySecrets,$legacy['binding_id']]);
$service->reconcileWebhookKeys();
ensure($readProjection($legacy['binding_id'])['webhook_verified_at']===null,'legacy_timestamp_without_key_proof_is_retired');
$markVerified($legacy['binding_id'],'synthetic-legacy-key');
ensure(array_column($service->trunks(),'webhook_status','binding_id')[$legacy['binding_id']]==='verified','legacy_binding_can_reverify');
putenv('OPENAI_API_KEY');
rejected(fn()=>$service->publish($edited['agent_id'],$edited['revision'],'synthetic-admin'),'provider_credentials_unavailable');
putenv('OPENAI_API_KEY=synthetic-environment-key');
putenv('VOICE_AGENT_SIP_LAB_ENABLED=false');
ensure(array_column($service->models(['provider'=>'openai','binding_id'=>$trunk['binding_id']])['items'],'id')===['gpt-live-1'],'preview_catalog_only_live');
rejected(fn()=>$service->configureWebhook($trunk['binding_id'],$trunk['revision'],'test-admin'),'sip_lab_required');
$provisioned=$native->provisions;
$liveTrunk=$service->saveTrunk(null,['name'=>'Live only','provider'=>'openai'],0,'synthetic-admin');
ensure($liveTrunk['sync_status']==='synced' && !$liveTrunk['freepbx_trunk_id'],'live_binding_without_native_trunk');
ensure($native->provisions===$provisioned,'live_trunk_does_not_provision_sip');
$liveDraft=$edited['draft'];$liveDraft['provider_binding_id']=$liveTrunk['binding_id'];
$live=$service->save(null,['name'=>'Live without project','draft'=>$liveDraft],0,'synthetic-admin');
$live=$service->publish($live['agent_id'],$live['revision'],'synthetic-admin');
ensure($live['routable'] && $native->provisions===$provisioned,'live_publish_without_project');
putenv('VOICE_AGENT_SIP_LAB_ENABLED=true');
$sipDraft=$second['draft'];$sipDraft['provider_binding_id']=$liveTrunk['binding_id'];
$sip=$service->save(null,['name'=>'SIP requires project','draft'=>$sipDraft],0,'synthetic-admin');
rejected(fn()=>$service->publish($sip['agent_id'],$sip['revision'],'synthetic-admin'),'openai_project_required');
rejected(fn()=>$service->configureWebhook($liveTrunk['binding_id'],$liveTrunk['revision'],'test-admin'),'webhook_unsupported');
$updated=$service->saveTrunk($trunk['binding_id'],array_replace($input,['openai_project_id'=>'']),$trunk['revision'],'synthetic-admin');
ensure($updated['sync_status']==='synced' && !$updated['freepbx_trunk_id'] && end($native->provisions)==='delete','retire_old_sip_trunk');
ensure(!$service->get($second['agent_id'])['routable'],'existing_sip_route_uses_fallback_without_project');
echo "Agent conversation isolation, publication, discovery, permissions and no-reload behavior passed\n";
