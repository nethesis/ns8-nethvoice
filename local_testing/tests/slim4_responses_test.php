#!/usr/bin/env php
<?php
// Run in a disposable PHP container with the REST Composer dependencies.
// Usage: php slim4_responses_test.php [REST vendor/autoload.php]
require $argv[1] ?? __DIR__.'/../../freepbx/var/www/html/freepbx/rest/vendor/autoload.php';
require __DIR__.'/../../freepbx/var/www/html/freepbx/rest/lib/JsonResponse.php';
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Routing\RouteContext;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
class NethCTI {
    public static $row = false;
    public static function Database() { return new self(); }
    public function prepare($sql) {
        check(str_contains($sql, 'FROM `user_nethlink` WHERE `user` = ?'), 'unexpected NethLink query');
        return $this;
    }
    public function execute($parameters) { check($parameters === ['alice'], 'wrong NethLink user'); }
    public function fetch($mode) { check($mode === PDO::FETCH_ASSOC, 'wrong row format'); return self::$row; }
}
function userExists($username) { return $username === 'alice'; }

// Replace the external FreePBX/CTI bootstrap libraries at the include boundary;
// load the actual route files, JSON helper and CSV validation functions unchanged.
$bootstrap = sys_get_temp_dir().'/rest-bootstrap-'.bin2hex(random_bytes(8));
mkdir($bootstrap.'/lib', 0700, true);
foreach (['libExtensions', 'libCTI', 'libMiddleware', 'libUsers'] as $library) {
    file_put_contents($bootstrap.'/lib/'.$library.'.php', '<?php');
}
$includePath = get_include_path();
set_include_path($bootstrap.PATH_SEPARATOR.$includePath);
$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->add(function (ServerRequestInterface $request, RequestHandlerInterface $handler) {
    return $handler->handle($request->withAttribute('route', $request->getAttribute(RouteContext::ROUTE)));
});
$app->addRoutingMiddleware();
require __DIR__.'/../../freepbx/var/www/html/freepbx/rest/modules/nethlink.php';
require __DIR__.'/../../freepbx/var/www/html/freepbx/rest/modules/phonebook.php';
set_include_path($includePath);
foreach (glob($bootstrap.'/lib/*') as $file) { unlink($file); }
rmdir($bootstrap.'/lib'); rmdir($bootstrap);

function response($method, $path, $payload, $status, $body) {
    global $app;
    $request = (new ServerRequestFactory())->createServerRequest($method, 'http://localhost'.$path);
    if ($payload !== null) { $request = $request->withParsedBody($payload); }
    $result = $app->handle($request);
    check($result->getStatusCode() === $status, $path.' status changed');
    check($result->getHeaderLine('Content-Type') === 'application/json;charset=utf-8', $path.' content type changed');
    check((string)$result->getBody() === json_encode($body), $path.' body changed: '.(string)$result->getBody());
}
foreach ([false, ['user' => 'alice', 'extension' => '91201', 'timestamp' => '2026-01-01 12:00:00', 'nethlink_version' => '1.0', 'os_type' => 'Linux', 'os_release' => 'test', 'arch' => 'x86_64']] as $row) {
    NethCTI::$row = $row;
    response('GET', '/nethlink/info/alice', null, 200, $row ?: null);
}
$uploads = '/var/lib/nethvoice/phonebook/uploads';
if (!is_dir($uploads)) { mkdir($uploads, 0700, true); }
$csv = tempnam($uploads, 'slim4-');
try {
    $base = ['owner' => 'alice', 'mapping' => ['Name' => 'name'], 'url' => 'file://'.$csv];
    response('POST', '/phonebook/import-cti', array_replace($base, ['mapping' => ['Phone' => 'cellphone']]), 400,
        ['status' => "Mapping must include the 'name' or 'firstname'/'lastname' destination"]);
    response('POST', '/phonebook/import-cti', array_replace($base, ['url' => 'file:///missing.csv']), 400, ['status' => 'CSV file not found']);
    foreach (["Name;Phone\nAlice;201\n", "Name\tPhone\nAlice\t201\n"] as $data) {
        file_put_contents($csv, $data);
        response('POST', '/phonebook/import-cti', $base, 400, ['status' => 'CSV separator must be a comma']);
        response('POST', '/phonebook/test', ['dbtype' => 'csv', 'cti_import' => true, 'url' => 'file://'.$csv], 400, ['status' => 'CSV separator must be a comma']);
    }
} finally { unlink($csv); }
echo "PASS: Slim 4 NethLink row/null and all migrated phonebook validation responses\n";
