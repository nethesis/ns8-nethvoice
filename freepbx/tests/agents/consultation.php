<?php
// Additive v9 configuration; all prior v8 publications/drafts remain unchanged.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\Schema;
$db=new PDO(getenv('M0_TEST_DSN'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
putenv('OPENAI_API_KEY=synthetic-environment-key');
$before=$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN);
$drafts=$db->query('SELECT definition_json FROM asterisk.voice_agent_drafts ORDER BY agent_id')->fetchAll(PDO::FETCH_COLUMN);
Schema::install($db);Schema::install($db);
assert($before===$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN));
assert($drafts===$db->query('SELECT definition_json FROM asterisk.voice_agent_drafts ORDER BY agent_id')->fetchAll(PDO::FETCH_COLUMN));
$native=new class {
 public function defaultLanguage():string{return 'en';}
 public function trunkReady(array $row):bool{return true;}
 public function trunkExists(array $row):bool{return true;}
 public function apply():bool{return true;}
 public function inUse(string $id):bool{return false;}
 public function extensions():array{return [['id'=>'extension:203','name'=>'Alice']];}
 public function directory():array{return ['items'=>[['id'=>'extension:203','available'=>true,'type'=>'extension','name'=>'Alice','description'=>'']],'modules'=>['extension'=>true,'queue'=>false]];}
 public function destination(string $id):string{return 'app-blackhole,hangup,1';}
};
$catalog=new \NethVoice\Agents\ProviderCatalog(fn()=>['data'=>array_map(fn($item)=>['id'=>$item['id']],\NethVoice\Agents\ProviderCatalog::capabilities('openai')['models'])]);
$service=new Service($db,$native,$catalog);
$binding=$db->query("SELECT binding_id FROM asterisk.voice_agent_bindings WHERE provider='openai' AND removed=0 AND sync_status='synced' LIMIT 1")->fetchColumn();assert(is_string($binding));
$example=json_decode(file_get_contents(__DIR__.'/../../var/www/html/freepbx/rest/lib/agents/contracts/published-v8.example.json'),true);
$internal=Service::consultationDraft();$internal['provider_binding_id']=$binding;$internal['conversation']=$example['conversation'];$internal['chat_model']='gpt-6-luna';
$assistant=$service->save(null,['name'=>'Synthetic internal assistant','draft'=>$internal],0,'synthetic-admin');
assert(!$assistant['routable'] && $assistant['agent_type']==='consultation');
$assistant=$service->publish($assistant['agent_id'],$assistant['revision'],'synthetic-admin');
assert($assistant['published']['role']==='consultation' && !$assistant['routable']);
assert(!array_filter($assistant['published']['tool_bindings'],fn($b)=>$b['enabled']));
$public=Service::emptyDraft();$public['provider_binding_id']=$binding;$public['conversation']=$example['conversation'];
$public['contract_version']=9;$public['role']='public';$public['chat_model']=null;
$public['consultation']=['mode'=>'attended','phone'=>true,'chat'=>true,'assistant_id'=>$assistant['agent_id']];
foreach($public['tool_bindings'] as &$tool)if($tool['tool_id']==='pbx.transfer')$tool['tool_version']=3;unset($tool);
$agent=$service->save(null,['name'=>'Synthetic attended public agent','draft'=>$public],0,'synthetic-admin');
$agent=$service->publish($agent['agent_id'],$agent['revision'],'synthetic-admin');
assert($agent['published']['contract_version']===9 && $agent['routable']);
assert(!$agent['published']['tool_bindings'][1]['config']['extensions_enabled']);
assert($agent['published']['tool_bindings'][1]['config']['extension_allowlist']===[]);
try{$service->remove($assistant['agent_id'],$assistant['revision'],'synthetic-admin');assert(false);}catch(RuntimeException $error){assert($error->getMessage()==='agent_in_use');}
$invalid=$agent['draft'];$invalid['consultation']['phone']=false;$invalid['consultation']['chat']=false;
try{$service->save($agent['agent_id'],['name'=>$agent['name'],'draft'=>$invalid],$agent['revision'],'synthetic-admin');assert(false);}catch(RuntimeException $error){assert($error->getMessage()==='invalid_configuration');}
try{$service->setFallbacks([$agent['agent_id']=>['expected_revision'=>$agent['revision'],'destination_id'=>'native:voice-agent-'.$assistant['agent_id'].',s,1']],'synthetic-admin');assert(false);}catch(RuntimeException $error){assert($error->getMessage()==='internal_agent_not_public');}
assert(in_array($assistant['agent_id'],array_column($service->catalog()['consultation_assistants'],'agent_id'),true));
Schema::install($db);assert($service->get($agent['agent_id'])['published']===$agent['published']);
echo "V9 consultations: opt-in permissions, internal admission boundary, immutable v8, publication and assistant references passed\n";
