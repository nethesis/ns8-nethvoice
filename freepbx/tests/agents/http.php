<?php
// Exercise the actual Slim routes and Wizard middleware on a disposable DB.
require getenv('M0_REST_AUTOLOAD') ?: '/var/www/html/freepbx/rest/vendor/autoload.php';
$root=__DIR__.'/../../var/www/html/freepbx/rest';
require $root.'/lib/JsonResponse.php';
require $root.'/lib/AuthMiddleware.php';
$db=new PDO(getenv('M0_TEST_DSN').';dbname=asterisk','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE IF NOT EXISTS ampusers (username VARCHAR(100) PRIMARY KEY,password_sha1 VARCHAR(100),sections VARCHAR(100))');
$q=$db->prepare('INSERT INTO ampusers VALUES (?,?,?) ON DUPLICATE KEY UPDATE password_sha1=VALUES(password_sha1),sections=VALUES(sections)');
$q->execute(['http-admin','synthetic-password-hash','*']);
class FreePBX {
    public static function Database() { return $GLOBALS['db']; }
    public static function Satellite() { return new class {
        public function agentExtensions() { return [['id'=>'extension:203','name'=>'Test extension']]; }
        public function agentTrunkExists($row) { return true; }
        public function agentTrunkReady($row) { return true; }
        public function agentTrunk($operation,$binding,$previous) { return 9002; }
        public function applyAgentDialplan() { return true; }
        public function agentDestinationInUse($id) { return false; }
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
[$status]=api('GET','/profiles',null,['Secretkey'=>'wrong']); assert($status===403);
[$status]=api('GET','/catalog',null,['Origin'=>'https://cross-site.example']); assert($status===403);
[$status]=api('POST','/profiles',['expected_revision'=>0,'profile'=>['name'=>'HTTP agent','draft'=>[]]]); assert($status===403);
[$status]=api('POST','/profiles',['expected_revision'=>0,'profile'=>'invalid'],$csrf); assert($status===422);
[$status]=api('POST','/profiles',['expected_revision'=>false,'profile'=>['name'=>'HTTP agent','draft'=>[]]],$csrf); assert($status===422);
[$status]=api('POST','/profiles',['expected_revision'=>0,'profile'=>[],'unexpected'=>true],$csrf); assert($status===422);
[$status,$catalog]=api('GET','/catalog'); assert($status===200 && count($catalog['tools'])===2);
[$status,$profiles]=api('GET','/profiles'); assert($status===200 && count($profiles['items'])>=2);
$draft=['provider_binding_id'=>null,'conversation'=>['language'=>'en','voice'=>'test_voice','greeting'=>'Hello','instructions'=>'Synthetic HTTP test'],'tool_bindings'=>[['tool_id'=>'telephony.transfer','tool_version'=>2,'enabled'=>true,'config'=>['approved_destination_ids'=>['extension:203']]]],'fallback_destination_id'=>'extension:203','max_call_duration_seconds'=>60];
[$status,$created]=api('POST','/profiles',['expected_revision'=>0,'profile'=>['name'=>'HTTP agent','draft'=>$draft]],$csrf); assert($status===200 && $created['kind']==='custom');
[$status]=api('POST','/profiles/'.$created['agent_id'].'/publish',['expected_revision'=>$created['revision']],$csrf); assert($status===422);
[$status]=api('PUT','/profiles/'.$created['agent_id'],['expected_revision'=>0,'profile'=>['name'=>'Stale','draft'=>$draft]],$csrf); assert($status===409);
[$status,$runs]=api('GET','/runs'); assert($status===200 && isset($runs['items'],$runs['has_more']));
[$status]=api('GET','/runs?page=0'); assert($status===422);
[$status,$removed]=api('DELETE','/profiles/'.$created['agent_id'],['expected_revision'=>$created['revision']],$csrf); assert($status===200 && $removed['removed']);
echo "HTTP authentication, CSRF, envelopes, CRUD, revision conflicts and monitoring passed\n";
