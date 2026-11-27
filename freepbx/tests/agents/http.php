<?php
putenv('VOICE_AGENT_ENABLED=true');
// Exercise the actual Slim routes and Wizard middleware on a disposable DB.
require getenv('M0_REST_AUTOLOAD') ?: '/var/www/html/freepbx/rest/vendor/autoload.php';
$root=__DIR__.'/../../var/www/html/freepbx/rest';
require $root.'/lib/JsonResponse.php';
require $root.'/lib/AuthMiddleware.php';
$db=new PDO(getenv('M0_TEST_DSN').';dbname=asterisk','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE IF NOT EXISTS ampusers (username VARCHAR(100) PRIMARY KEY,password_sha1 VARCHAR(100),sections VARCHAR(100))');
$q=$db->prepare('INSERT INTO ampusers VALUES (?,?,?) ON DUPLICATE KEY UPDATE password_sha1=VALUES(password_sha1),sections=VALUES(sections)');
$q->execute(['http-admin','synthetic-password-hash','*']);
$q->execute(['http-viewer','synthetic-viewer-hash','devices']);
$db->exec('CREATE TEMPORARY TABLE timeconditions (timeconditions_id INT, truegoto VARCHAR(100), falsegoto VARCHAR(100))');
$db->exec("INSERT INTO timeconditions VALUES (5,'ivr-1,s,1','voice-agent-consultation_assistant,s,1')");
$db->exec('CREATE TEMPORARY TABLE ivr_details (id INT, invalid_destination VARCHAR(100), timeout_destination VARCHAR(100))');
$db->exec("INSERT INTO ivr_details VALUES (1,'app-blackhole,hangup,1','timeconditions,5,1')");
$db->exec('CREATE TEMPORARY TABLE ivr_entries (ivr_id INT, dest VARCHAR(100))');
$db->exec("INSERT INTO ivr_entries VALUES (1,'voice-agent-receptionist,s,1')");
class FreePBX {
    public static ?array $referencedAgentIds=['receptionist'=>true,'consultation_assistant'=>true];
    public static ?array $inboundRoutes=[];
    public static int $routeInventoryReads=0;
    public static function Database() { return $GLOBALS['db']; }
    public static function Core() { return new class {
        public function getAllDIDs($sort): array {
            assert($sort==='extension');
            return FreePBX::$inboundRoutes ?? throw new RuntimeException('fixture_inbound_unavailable');
        }
    }; }
    public static function Satellite() { return new class {
        public function agentDirectory() { return ['items'=>[['id'=>'extension:203','type'=>'extension','name'=>'Test extension','description'=>'','available'=>true,'native_destination'=>'from-did-direct,203,1']],'modules'=>['extension'=>true,'queue'=>false,'ivr'=>false]]; }
        public function agentExtensions() { return [['id'=>'extension:203','name'=>'Test extension']]; }
        public function agentTrunkExists($row) { return true; }
        public function agentTrunkReady($row) { return true; }
        public function agentTrunk($operation,$binding,$previous) { return 9002; }
        public function applyAgentDialplan() { return true; }
        public function agentDestinationInUse($id) { return false; }
        public function referencedAgentIds(): array {
            FreePBX::$routeInventoryReads++;
            return FreePBX::$referencedAgentIds ?? throw new RuntimeException('fixture_inventory_unavailable');
        }
    }; }
}
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
$app=\Slim\Factory\AppFactory::create();
$app->setBasePath('/freepbx/rest');
$app->addBodyParsingMiddleware();
$app->add(new AuthMiddleware('synthetic-http-secret',$app->getResponseFactory()));
$app->addRoutingMiddleware();
require $root.'/modules/agents.php';
function api(string $method,string $path,?array $body=null,array $headers=[]): array {
    $request=(new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest($method,'https://pbx.example/freepbx/rest/agents'.$path);
    $headers+=['User'=>'http-admin','Secretkey'=>sha1('http-admin'.'synthetic-password-hash'.'synthetic-http-secret'),'Content-Type'=>'application/json','Origin'=>'https://pbx.example'];
    foreach ($headers as $name=>$value) $request=$request->withHeader($name,$value);
    if ($body!==null) $request->getBody()->write(json_encode($body));
    $response=$GLOBALS['app']->handle($request);
    return [$response->getStatusCode(),json_decode((string)$response->getBody(),true)];
}
[$status,$access]=api('GET','/access'); assert($status===200 && in_array('tools',$access['capabilities'],true));
$csrf=['X-Agents-CSRF'=>$access['csrf']];
[$status]=api('POST','/trunks/models',['provider'=>'grok']); assert($status===403);
[$status]=api('POST','/trunks/models',['provider'=>'grok'],$csrf+['Secretkey'=>'wrong']); assert($status===403);
[$status]=api('POST','/trunks/models',['provider'=>'grok'],$csrf+['Origin'=>'https://cross-site.example']); assert($status===403);
[$status]=api('POST','/trunks/models',['provider'=>'grok','unexpected'=>true],$csrf); assert($status===422);
[$status,$models]=api('POST','/trunks/models',['provider'=>'grok'],$csrf); assert($status===200 && $models['source']==='provider_managed');
assert(!str_contains(json_encode($models),'api_key'));
[$status,$error]=api('POST','/trunks/models',['provider'=>'openai','test'=>true,'openai_project_id'=>"proj_header\r\nx-bad"],$csrf);
assert($status===422 && $error===['error'=>'invalid_provider_configuration','field'=>'openai_project_id']);
foreach ([['provider'=>'openai'],['provider'=>'grok','test'=>true]] as $options) {
    [$status,$error]=api('POST','/trunks/models',$options+['openai_project_id'=>'proj_only_for_openai_tests'],$csrf);
    assert($status===422 && $error===['error'=>'invalid_fields','field'=>'openai_project_id']);
}
[$status,$error]=api('POST','/trunks',['expected_revision'=>0,'trunk'=>['name'=>'HTTP trunk','provider'=>'openai','openai_project_id'=>'submitted-project']],$csrf);
assert($status===422 && $error===['error'=>'invalid_provider_configuration','field'=>'openai_project_id']);
// The configuration action uses the same administrator, CSRF and envelope protections.
$webhookPath='/trunks/trunk_unknown/configure-webhook';
foreach ([[],['Secretkey'=>'wrong'],['Origin'=>'https://cross-site.example']] as $headers) {
    [$status]=api('POST',$webhookPath,['expected_revision'=>1],$headers ? $headers+$csrf : []);assert($status===403);
}
[$status]=api('POST',$webhookPath,['expected_revision'=>1],$csrf+['User'=>'http-viewer','Secretkey'=>sha1('http-viewer'.'synthetic-viewer-hash'.'synthetic-http-secret')]);assert($status===403);
foreach (['api_key','url','openai_project_id','signing_secret'] as $field) {
    [$status]=api('POST',$webhookPath,['expected_revision'=>1,$field=>'must-not-be-accepted'],$csrf);assert($status===422);
}
[$status]=api('POST',$webhookPath,['expected_revision'=>false],$csrf);assert($status===422);
[$status]=api('POST',$webhookPath,['expected_revision'=>1],$csrf);assert($status===404);
[$status]=api('GET','/profiles',null,['Secretkey'=>'wrong']); assert($status===403);
[$status]=api('GET','/catalog',null,['Origin'=>'https://cross-site.example']); assert($status===403);
[$status]=api('POST','/profiles',['expected_revision'=>0,'profile'=>['name'=>'HTTP agent','draft'=>[]]]); assert($status===403);
[$status]=api('POST','/profiles',['expected_revision'=>0,'profile'=>'invalid'],$csrf); assert($status===422);
[$status]=api('POST','/profiles',['expected_revision'=>false,'profile'=>['name'=>'HTTP agent','draft'=>[]]],$csrf); assert($status===422);
[$status]=api('POST','/profiles',['expected_revision'=>0,'profile'=>[],'unexpected'=>true],$csrf); assert($status===422);
[$status,$catalog]=api('GET','/catalog'); assert($status===200 && count($catalog['tools'])===5 && $catalog['draft_defaults']['contract_version']===8);
try { api('POST','/profiles/receptionist/enabled',['expected_revision'=>1,'enabled'=>true],$csrf); assert(false); } catch (\Slim\Exception\HttpNotFoundException $expected) {}
[$status,$profiles]=api('GET','/profiles'); assert($status===200 && count($profiles['items'])>=2);
$usage=array_column($profiles['items'],'in_use','agent_id');
assert($usage['receptionist']===true && $usage['consultation_assistant']===false && FreePBX::$routeInventoryReads===1);
assert(array_column($profiles['items'],'inbound_route_in_use','agent_id')['receptionist']===false);
FreePBX::$referencedAgentIds=[];
foreach (['voice-agent-receptionist,s,1','timeconditions,5,1'] as $destination) {
    FreePBX::$inboundRoutes=[['destination'=>$destination]];
    [$status,$profiles]=api('GET','/profiles');
    $usage=array_column($profiles['items'],'inbound_route_in_use','agent_id');
    assert($status===200 && $usage['receptionist']===true && $usage['consultation_assistant']===false);
}
FreePBX::$inboundRoutes=null;
[$status,$profiles]=api('GET','/profiles');
assert($status===200 && array_column($profiles['items'],'in_use','agent_id')['receptionist']===false);
assert(array_column($profiles['items'],'inbound_route_in_use','agent_id')['receptionist']===null);
FreePBX::$inboundRoutes=[];
FreePBX::$referencedAgentIds=null;
[$status,$profiles]=api('GET','/profiles');
assert($status===200 && array_column($profiles['items'],'in_use','agent_id')['receptionist']===null);
$draft=\NethVoice\Agents\Service::emptyDraft();
$draft['conversation']=['language'=>'en','voice'=>'marin','greeting'=>'Hello','instructions'=>'Synthetic HTTP test','model'=>'gpt-realtime-2.1','options'=>null];
$draft['max_call_duration_seconds']=60;
[$status,$error]=api('POST','/profiles',['expected_revision'=>0,'profile'=>['name'=>'','draft'=>$draft]],$csrf);
assert($status===422 && $error===['error'=>'invalid_field','field'=>'name']);
$badDraft=$draft;$badDraft['conversation']['language']='submitted-language';
[$status,$error]=api('POST','/profiles',['expected_revision'=>0,'profile'=>['name'=>'HTTP agent','draft'=>$badDraft]],$csrf);
assert($status===422 && $error===['error'=>'invalid_configuration','field'=>'draft.conversation.language']);
$badDraft=$draft;$badDraft['conversation']['private-input']='private-value';
[$status,$error]=api('POST','/profiles',['expected_revision'=>0,'profile'=>['name'=>'HTTP agent','draft'=>$badDraft]],$csrf);
assert($status===422 && $error===['error'=>'invalid_configuration','field'=>'draft.conversation']);
[$status,$created]=api('POST','/profiles',['expected_revision'=>0,'profile'=>['name'=>'HTTP agent','draft'=>$draft]],$csrf); assert($status===200 && $created['kind']==='custom');
[$status,$error]=api('POST','/profiles/'.$created['agent_id'].'/publish',['expected_revision'=>$created['revision']],$csrf);
assert($status===422 && $error===['error'=>'provider_required','field'=>'draft.provider_binding_id']);
$badDraft=array_replace($draft,['fallback_destination_id'=>'extension:203']);
[$status,$error]=api('PUT','/profiles/'.$created['agent_id'],['expected_revision'=>$created['revision'],'profile'=>['name'=>'HTTP agent','draft'=>$badDraft]],$csrf);
assert($status===422 && $error===['error'=>'fallback_managed_by_visualplan','field'=>'draft.fallback_destination_id']);
[$status,$savedProfile]=api('GET','/profiles/'.$created['agent_id']);
assert($status===200 && $savedProfile['revision']===$created['revision'] && $savedProfile['draft']['fallback_destination_id']==='hangup');
[$status]=api('PUT','/profiles/'.$created['agent_id'],['expected_revision'=>0,'profile'=>['name'=>'Stale','draft'=>$draft]],$csrf); assert($status===409);
[$status]=api('GET','/destinations',null,['Secretkey'=>'wrong']); assert($status===403);
[$status,$destinations]=api('GET','/destinations?limit=1'); assert($status===200 && count($destinations['items'])===1);
[$status]=api('GET','/destinations?limit=101'); assert($status===422);
[$status,$runs]=api('GET','/runs'); assert($status===200 && isset($runs['items'],$runs['has_more']));
[$status]=api('POST','/runs/search',['query'=>'5550159']); assert($status===403);
[$status]=api('POST','/runs/search',['query'=>'5550159'],$csrf+['Origin'=>'https://cross-site.example']); assert($status===403);
[$status]=api('POST','/runs/search',['query'=>'5550159'],$csrf+['Secretkey'=>'wrong']); assert($status===403);
[$status]=api('POST','/runs/search',['query'=>'5550159'],$csrf+['User'=>'http-viewer','Secretkey'=>sha1('http-viewer'.'synthetic-viewer-hash'.'synthetic-http-secret')]); assert($status===403);
[$status]=api('POST','/runs/search',['query'=>['5550159']],$csrf); assert($status===422);
[$status,$runs]=api('POST','/runs/search',['query'=>'5550159'],$csrf);
assert($status===200 && count($runs['items'])===1 && $runs['items'][0]['caller_number']==='+12025550159');
[$status,$runs]=api('GET','/runs?query=5550159'); assert($status===200 && $runs['items']===[]);
[$status]=api('GET','/runs?page=0'); assert($status===422);
[$status,$removed]=api('DELETE','/profiles/'.$created['agent_id'],['expected_revision'=>$created['revision']],$csrf); assert($status===200 && $removed['removed']);
foreach (['/monitoring/summary','/monitoring/health'] as $path) {
    [$status]=api('GET',$path,null,['Secretkey'=>'wrong']); assert($status===403);
    [$status,$result]=api('GET',$path); assert($status===200);
}
[$status]=api('GET','/monitoring/summary?provider[]=openai'); assert($status===422);
[$status]=api('GET','/monitoring/summary?phase=tool'); assert($status===422);
[$status]=api('GET','/runs?phase=arbitrary'); assert($status===422);
[$status]=api('GET','/runs?query='.rawurlencode("%_' OR 1=1 --")); assert($status===200);
[$status]=api('GET','/runs/77777777-7777-4777-a777-777777777777/trace'); assert($status===200);
[$status]=api('GET','/runs/77777777-7777-4777-a777-777777777777/trace?cursor=bad'); assert($status===422);
[$status]=api('GET','/runs/77777777-7777-4777-a777-777777777777/trace',null,['Secretkey'=>'wrong']); assert($status===403);
echo "HTTP authentication, CSRF, envelopes, CRUD, revision conflicts and monitoring passed\n";
