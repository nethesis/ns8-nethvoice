<?php
require __DIR__ . '/../var/www/html/freepbx/rest/vendor/autoload.php';
require __DIR__ . '/../var/www/html/freepbx/rest/lib/AuthMiddleware.php';
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
class FreePBX {
    public static function Database() { return new TestDatabase(); }
}
class TestDatabase {
    public function prepare($sql) { return $this; }
    public function execute($args) {}
    public function fetch($mode) { return ['username' => 'admin', 'password_sha1' => 'test']; }
}
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
$app = AppFactory::create();
$app->setBasePath('/freepbx/rest');
foreach (['/users/{all}', '/trunks/{id}', '/cti/customer_card/template/{name}'] as $route) {
    $app->map(['GET', 'PUT', 'DELETE'], $route, fn($req, $res) => $res->withStatus(200));
}
$app->get('/testauth', fn($req, $res) => $res->withStatus(200));
$app->addRoutingMiddleware();
$app->add(new AuthMiddleware('server-secret', $app->getResponseFactory()));
$app->addErrorMiddleware(false, false, false);
$factory = new ServerRequestFactory();
foreach (['/users/testauth', '/trunks/testauth', '/cti/customer_card/template/testauth', '/missing', '/testauth/', '/users/false'] as $path) {
    foreach (['GET', 'PUT', 'DELETE'] as $method) {
        $request = $factory->createServerRequest($method, '/freepbx/rest'.$path);
        check($app->handle($request)->getStatusCode() === 403, "$method $path bypasses authentication");
    }
}
check($app->handle($factory->createServerRequest('GET', '/freepbx/rest/testauth'))->getStatusCode() === 200, 'exact testauth route must remain public');
check($app->handle($factory->createServerRequest('OPTIONS', '/freepbx/rest/users/false'))->getStatusCode() === 204, 'preflight must not reach routing');
$request = $factory->createServerRequest('GET', '/freepbx/rest/users/false')->withHeader('User', 'admin');
check($app->handle($request->withHeader('Secretkey', 'wrong'))->getStatusCode() === 403, 'wrong secret accepted');
check($app->handle($request->withHeader('Secretkey', sha1('admintestserver-secret')))->getStatusCode() === 200, 'valid credentials rejected');
echo "PASS: REST exact authentication exemption, credential checks and preflight\n";
