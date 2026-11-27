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
ensure(!isset($managed['credential_verified']),'static_model_list_does_not_verify_grok_key');
try { $catalog->models('grok','',true); throw new LogicException('missing_grok_credentials_accepted'); }
catch (RuntimeException $error) { ensure($error->getMessage()==='provider_credentials_unavailable','fresh_grok_check_requires_key'); }
$decodeGrok = new ReflectionMethod(ProviderCatalog::class, 'grokVoicesResponse');
foreach ([
    [false,401,'provider_catalog_unavailable'],
    [true,401,'provider_credentials_rejected'],
    [true,403,'provider_permission_denied'],
    [true,503,'provider_catalog_unavailable'],
] as [$received,$status,$reason]) {
    try { $decodeGrok->invoke(null,$received,$status,''); throw new LogicException('failed_response_accepted'); }
    catch (RuntimeException $error) { ensure($error->getMessage()===$reason,'grok_credential_check_reason'); }
}
ensure($decodeGrok->invoke(null,true,200,'{"voices":[{"voice_id":"eve","name":"Eve"}]}')['items']===[['id'=>'eve','label'=>'Eve']],'authenticated_grok_voice_catalog');
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
$decode = new ReflectionMethod(ProviderCatalog::class, 'openAiModelsResponse');
foreach ([
    [401, '{"error":{"code":"invalid_api_key"}}', 'provider_credentials_rejected'],
    [401, '{"error":{"message":"Missing scopes: api.model.read."}}', 'provider_permission_denied'],
    [403, '', 'provider_permission_denied'],
    [401, '', 'provider_catalog_unavailable'],
    [429, '', 'provider_catalog_unavailable'],
] as [$status,$body,$reason]) {
    try { $decode->invoke(null,true,$status,$body);throw new LogicException('failed_response_accepted'); }
    catch (RuntimeException $error) { ensure($error->getMessage()===$reason,'credential_readiness_reason'); }
}
foreach ([400,401,404] as $status) {
    try { $decode->invoke(null,true,$status,'{"error":{"message":"synthetic upstream content"}}',true); assert(false); }
    catch (RuntimeException $error) { ensure($error->getMessage()==='provider_project_unverified','scoped_request_rejected'); }
}
try { $decode->invoke(null,true,401,'{"error":{"code":"invalid_api_key"}}',true); assert(false); }
catch (RuntimeException $error) { ensure($error->getMessage()==='provider_project_unverified','scoped_authentication_can_reject_key_or_project'); }
try { $decode->invoke(null,false,401,'{"error":{"message":"incomplete response',true); assert(false); }
catch (RuntimeException $error) { ensure($error->getMessage()==='provider_catalog_unavailable','partial_transport_failure_cannot_reject_project'); }
$checked=new ProviderCatalog(function($provider,$key,$project) {
    ensure($provider==='openai' && $key==='synthetic-key' && $project==='proj_verified','project_forwarded');
    return ['data'=>[]];
});
$testResult=$checked->models('openai','synthetic-key',true,'proj_verified');
ensure($testResult['project_checked']===true && $testResult['credential_verified']===true,'catalog_access_verified_without_selectable_models');
try { $checked->models('openai','synthetic-key',true,"proj_invalid\r\nheader"); assert(false); }
catch (RuntimeException $error) { ensure($error->getMessage()==='invalid_provider_configuration','invalid_project_rejected_before_request'); }
echo "Provider model catalogs passed\n";
