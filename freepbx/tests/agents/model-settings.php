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
    public function defaultLanguage(): string { return 'en'; }
    public function trunkReady(array $row): bool { return true; }
    public function trunkExists(array $row): bool { return true; }
    public function provision(string $operation,array $binding,?array $previous): int { return 9003; }
    public function apply(): bool { $this->reloads++;return true; }
    public function directory(): array { return ['items'=>[]]; }
    public function extensions(): array { return [['id'=>'extension:203','name'=>'Test extension']]; }
    public function destination(string $id): string { return 'app-blackhole,hangup,1'; }
};
$keys=[];$available=['gpt-realtime-2.1','gpt-realtime-2','gpt-live-1','gpt-6-luna','gpt-6-sol'];
$catalog=new ProviderCatalog(function($provider,$key) use (&$keys,&$available) {
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
$available=[];
rejected(fn()=>$service->publish($edited['agent_id'],$edited['revision'],'synthetic-admin'),'provider_model_unavailable');
$available=['gpt-live-1'];
rejected(fn()=>$service->publish($edited['agent_id'],$edited['revision'],'synthetic-admin'),'backend_model_unavailable');
$input['api_key']='';$reloads=$native->reloads;
$trunk=$service->saveTrunk($trunk['binding_id'],$input,$trunk['revision'],'synthetic-admin');
ensure($native->reloads===$reloads,'credential_edit_not_model_edit');
echo "Agent conversation isolation, publication, discovery, permissions and no-reload behavior passed\n";
