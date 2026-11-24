<?php
// Mocked provider responses only; never uses an OpenAI account.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/OpenAiWebhook.php';
use NethVoice\Agents\OpenAiWebhook;
function ensure($condition,string $name): void { if (!$condition) throw new RuntimeException($name); }
function denied(callable $call,string $code): void {
    try { $call(); } catch (Throwable $error) { ensure($error->getMessage()===$code,'expected '.$code.', got '.$error->getMessage());return; }
    throw new LogicException('expected '.$code);
}
$url='https://pbx.example/satellite-webhooks/openai';
$secret='whsec_'.base64_encode('synthetic-webhook-secret');
$endpoint=['id'=>'we_test','name'=>'NethVoice test','url'=>$url,'event_types'=>['realtime.call.incoming'],'signing_secret_hint'=>'hint'];
$requests=[];
$provider=new OpenAiWebhook(function($method,$query,$key,$data) use (&$requests,$endpoint,$secret) {
    $requests[]=[$method,$query,$key,$data];
    if ($method==='POST') return ['status'=>200,'body'=>json_encode($endpoint+['signing_secret'=>$secret])];
    return ['status'=>200,'body'=>json_encode(['data'=>[$endpoint],'has_more'=>false])];
});
ensure($provider->endpoints('synthetic-api')===[$endpoint],'list');
ensure($provider->create('synthetic-api','NethVoice test',$url)['signing_secret']===$secret,'create');
ensure($requests[1]===['POST','','synthetic-api',['name'=>'NethVoice test','url'=>$url,'event_types'=>['realtime.call.incoming']]],'documented_request_only');
foreach ([401=>'provider_credentials_rejected',403=>'webhook_permission_denied',429=>'webhook_provider_rejected',500=>'webhook_provider_unavailable',0=>'webhook_provider_unavailable'] as $status=>$code) {
    $bad=new OpenAiWebhook(fn()=>['status'=>$status,'body'=>'sensitive-provider-error synthetic-api '.$secret]);
    denied(fn()=>$bad->endpoints('synthetic-api'),$code);
    denied(fn()=>$bad->create('synthetic-api','NethVoice test',$url),$code);
}
$timeout=new OpenAiWebhook(fn()=>throw new RuntimeException('timeout with sensitive headers synthetic-api '.$secret));
denied(fn()=>$timeout->endpoints('synthetic-api'),'webhook_provider_unavailable');
foreach (['not-json','null','[]',json_encode(['data'=>[$endpoint]]),json_encode(['data'=>[['id'=>'x']],'has_more'=>false]),json_encode(['data'=>[$endpoint],'has_more'=>true,'last_id'=>'not_in_page'])] as $body) {
    $bad=new OpenAiWebhook(fn()=>['status'=>200,'body'=>$body]);
    denied(fn()=>$bad->endpoints('synthetic-api'),'webhook_provider_response_invalid');
}
foreach ([array_diff_key($endpoint,['url'=>true]),$endpoint+['signing_secret'=>'bad'],$endpoint+['signing_secret'=>"whsec_\n".base64_encode('synthetic-webhook-secret')],array_replace($endpoint,['url'=>'https://unrelated.example','signing_secret'=>$secret])] as $response) {
    $bad=new OpenAiWebhook(fn()=>['status'=>200,'body'=>json_encode($response)]);
    denied(fn()=>$bad->create('synthetic-api','NethVoice test',$url),'webhook_provider_response_invalid');
}
$pages=0;
$paged=new OpenAiWebhook(function($method,$query) use (&$pages,$endpoint) {
    $pages++;
    ensure($query===($pages===1?'?limit=100':'?limit=100&after=we_test'),'cursor');
    return ['status'=>200,'body'=>json_encode(['data'=>[$pages===1?$endpoint:array_replace($endpoint,['id'=>'we_second'])],'has_more'=>$pages===1,'last_id'=>'we_test'])];
});
ensure(count($paged->endpoints('synthetic-api'))===2 && $pages===2,'all_pages_inspected');
$repeat=new OpenAiWebhook(fn()=>['status'=>200,'body'=>json_encode(['data'=>[$endpoint],'has_more'=>true,'last_id'=>'we_test'])]);
denied(fn()=>$repeat->endpoints('synthetic-api'),'webhook_provider_response_invalid');
foreach (['',"synthetic\r\nheader"] as $key) denied(fn()=>$provider->endpoints($key),'provider_credentials_unavailable');
foreach (['','http://pbx.example','pbx.example/path','pbx.example:8443',"pbx.example\n",'localhost'] as $host) {
    putenv('NETHVOICE_HOST='.$host);denied(fn()=>OpenAiWebhook::callbackUrl(),'webhook_url_unavailable');
}
putenv('NETHVOICE_HOST=PBX.example');ensure(OpenAiWebhook::callbackUrl()===$url,'server_configuration_url');
echo "OpenAI webhook API validation, pagination, permissions, timeouts and redaction passed\n";
