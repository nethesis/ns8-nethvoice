<?php
// Run against the disposable M0 database with the image's actual PSR7 dependencies.
require getenv('M0_REST_AUTOLOAD');
require __DIR__ . '/../../var/www/html/freepbx/rest/lib/AuthMiddleware.php';
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Server\RequestHandlerInterface;
final class FreePBX {
    public static PDO $db;
    public static function Database() { return self::$db; }
}
FreePBX::$db = new PDO(getenv('M0_TEST_DSN'), 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
FreePBX::$db->exec('CREATE TABLE IF NOT EXISTS asterisk.ampusers (username VARCHAR(64), password_sha1 VARCHAR(40), sections VARCHAR(64))');
FreePBX::$db->exec("INSERT INTO asterisk.ampusers VALUES ('admin', SHA1('synthetic-password'), '*'), ('operator', SHA1('synthetic-password'), '')");
$factory = new Slim\Psr7\Factory\ResponseFactory();
$middleware = new AuthMiddleware('synthetic-config', $factory);
$handler = new class($factory) implements RequestHandlerInterface {
    public function __construct(private $factory) {}
    public function handle(ServerRequestInterface $request): ResponseInterface {
        return $this->factory->createResponse()->withHeader('Verified-Admin', $request->getAttribute('nethvoice_admin') ?? 'none');
    }
};
$requests = new Slim\Psr7\Factory\ServerRequestFactory();
$make = fn() => $requests->createServerRequest('GET', 'http://localhost/freepbx/rest/agents/access');
$hash = fn($user) => sha1($user . sha1('synthetic-password') . 'synthetic-config');
assert($middleware->process($make(), $handler)->getStatusCode() === 403);
foreach (['operator', 'missing'] as $user) {
    $request = $make()->withHeader('User', $user)->withHeader('Secretkey', $hash($user));
    assert($middleware->process($request, $handler)->getStatusCode() === 403);
}
assert($middleware->process($make()->withHeader('User', 'admin')->withHeader('Secretkey', 'wrong'), $handler)->getStatusCode() === 403);
$response = $middleware->process($make()->withHeader('User', 'admin')->withHeader('Secretkey', $hash('admin')), $handler);
assert($response->getStatusCode() === 200 && $response->getHeaderLine('Verified-Admin') === 'admin');
// A numeric-looking SHA1 must never compare equal to a different numeric string.
FreePBX::$db->exec("INSERT INTO asterisk.ampusers VALUES ('a','aroZmOk','*')");
assert(str_starts_with(sha1('aaroZmOk'),'0e'));
$magicMiddleware=new AuthMiddleware('',$factory);
assert($magicMiddleware->process($make()->withHeader('User','a')->withHeader('Secretkey','0e0'),$handler)->getStatusCode()===403);
echo "PASS: Wizard authentication denies missing credentials, wrong keys and non-admin roles\n";
