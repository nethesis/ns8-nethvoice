<?php
// Execute both native trunk mutation routes with the real Slim router.
require getenv('M0_REST_AUTOLOAD');
require __DIR__.'/../../var/www/html/freepbx/rest/lib/JsonResponse.php';
class FreePBX {
    public static function Core() { return new class {
        public function getTrunkByID($id) { return ['provider'=>'satellite-agent']; }
        public function deleteTrunk($id) { throw new RuntimeException('managed_trunk_deleted'); }
    }; }
    public static function Database() { throw new RuntimeException('managed_trunk_modified'); }
}
$app=\Slim\Factory\AppFactory::create();
$app->addRoutingMiddleware();
require __DIR__.'/../../var/www/html/freepbx/rest/modules/trunks.php';
foreach (['PATCH','DELETE'] as $method) {
    $request=(new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest($method,'https://pbx.example.org/trunks/9001');
    $request=$request->withParsedBody(['codecs'=>['ulaw']]);
    $response=$app->handle($request);
    assert($response->getStatusCode()===409);
    assert(json_decode((string)$response->getBody(),true)['error']==='managed_by_agents');
}
echo "Native trunk mutations cannot bypass agent ownership\n";
