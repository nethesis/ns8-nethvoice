<?php
// Exercise the shipped transport gate in a separate PHP process with the flag unset.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';

use NethVoice\Agents\Preview;
use NethVoice\Agents\ProviderCatalog;
use NethVoice\Agents\Service;

assert(Preview::enabled() && !Preview::sipEnabled());
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
putenv('OPENAI_API_KEY=synthetic-preview-key');
putenv('NETHVOICE_HOST=pbx.example');
$db=new PDO(getenv('M0_TEST_DSN').';dbname=asterisk','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$native=new class {
    public function defaultLanguage(): string { return 'en'; }
    public function extensions(): array { return []; }
    public function directory(): array { return ['items'=>[]]; }
    public function destination(string $id): string { assert($id==='hangup'); return 'app-blackhole,hangup,1'; }
    public function trunkReady(array $row): bool { return true; }
    public function apply(): bool { return true; }
};
$catalog=new ProviderCatalog(fn()=>['data'=>[['id'=>'gpt-live-1'],['id'=>'gpt-realtime-2']]]);
$service=new Service($db,$native,$catalog);
$previewCatalog=$service->catalog();
assert($previewCatalog['providers']===['openai'] && $previewCatalog['grok_webhook_url']===null);
assert($previewCatalog['openai_webhook_url']==='https://pbx.example/satellite-webhooks/openai');
assert(array_column($service->models(['provider'=>'openai'])['items'],'id')===['gpt-live-1']);
$trunk=$service->saveTrunk(null,['name'=>'Default preview trunk','provider'=>'openai'],0,'preview-default');
assert($trunk['freepbx_trunk_id']===null && $trunk['sync_status']==='synced');
$draft=Service::emptyDraft();
$draft['provider_binding_id']=$trunk['binding_id'];
$draft['conversation']['instructions']='Synthetic preview test.';
$draft['conversation']['voice']='marin';
$draft['conversation']['model']='gpt-live-1';
$draft['conversation']['options']=array_column(ProviderCatalog::capabilities('openai')['models'],null,'id')['gpt-live-1']['defaults'];
$agent=$service->save(null,['name'=>'Default preview agent','draft'=>$draft],0,'preview-default');
$published=$service->publish($agent['agent_id'],$agent['revision'],'preview-default');
assert($published['routable']);
$draft['conversation']['model']='gpt-realtime-2';
$draft['conversation']['options']=null;
$agent=$service->save($agent['agent_id'],['name'=>$agent['name'],'draft'=>$draft],$published['revision'],'preview-default');
foreach ([fn()=>$service->publish($agent['agent_id'],$agent['revision'],'preview-default'),
          fn()=>$service->configureWebhook($trunk['binding_id'],$trunk['revision'],'preview-default'),
          fn()=>$service->saveTrunk(null,['name'=>'Grok','provider'=>'grok'],0,'preview-default')] as $work) {
    try { $work(); assert(false); }
    catch (RuntimeException $error) { assert($error->getMessage()==='sip_lab_required' && $error->getCode()===409); }
}
assert($service->get($agent['agent_id'])['published']['conversation']['model']==='gpt-live-1');
echo "Default preview publishes Live without a SIP trunk and rejects lab-only operations\n";
