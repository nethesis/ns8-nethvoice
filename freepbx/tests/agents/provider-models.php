<?php
// Synthetic catalog responses only: never contacts a provider.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/ProviderCatalog.php';
use NethVoice\Agents\ProviderCatalog;
function ensure($condition, string $name): void { if (!$condition) throw new RuntimeException($name); }
$catalog=new ProviderCatalog(fn($provider,$key)=>['data'=>[
    ['id'=>'gpt-realtime-2.1'],['id'=>'gpt-realtime-2'],['id'=>'gpt-live-1'],
    ['id'=>'gpt-4o-mini-transcribe'],['id'=>'grok-voice-3.0'],['id'=>'gpt-realtime-2.1'],
]]);
$models=$catalog->models('openai','synthetic-key');
ensure(array_column($models['items'],'id')===['gpt-realtime-2.1','gpt-realtime-2','gpt-live-1'],'compatible_models_only');
ensure($models['source']==='provider_api','live_source');
ensure(!str_contains(json_encode($models),'synthetic-key'),'key_hidden');
$empty=new ProviderCatalog(fn()=>['data'=>[]]);
ensure($empty->models('openai','synthetic-key')['items']===[],'empty_is_not_fallback');
$outage=new ProviderCatalog(fn()=>throw new RuntimeException('synthetic sensitive upstream response'));
$fallback=$outage->models('openai','synthetic-key');
ensure($fallback['source']==='adapter_catalog' && $fallback['discovery_error']==='provider_catalog_unavailable','visible_fallback');
ensure(!str_contains(json_encode($fallback),'sensitive'),'safe_failure');
$managed=$catalog->models('grok','synthetic-key');
ensure($managed['selection']==='provider_managed' && array_column($managed['items'],'id')===['provider-default'],'sip_model_is_provider_managed');
$rejected=new ProviderCatalog(fn()=>throw new RuntimeException('provider_credentials_rejected',422));
try { $rejected->models('openai','synthetic-key');throw new LogicException('credentials_accepted'); }
catch (RuntimeException $error) { ensure($error->getMessage()==='provider_credentials_rejected','rejected_credentials_are_not_fallback'); }
foreach (['',"synthetic\r\nheader"] as $key) {
    try { $catalog->models('openai',$key);throw new LogicException('invalid_key_accepted'); }
    catch (RuntimeException $error) { ensure($error->getMessage()==='provider_credentials_unavailable','invalid_key_denied'); }
}
$malformed=new ProviderCatalog(fn()=>['data'=>['not-a-model']]);
ensure($malformed->models('openai','synthetic-key')['source']==='adapter_catalog','malformed_response_fallback');
foreach (['grok-voice-3.0','gpt-realtime-2.1?secret',''] as $invalid) {
    try { ProviderCatalog::validateModel('openai',$invalid); throw new LogicException('accepted_invalid_model'); }
    catch (RuntimeException $error) { ensure($error->getMessage()==='invalid_provider_model','safe_validation'); }
}
echo "Provider model catalogs passed\n";
