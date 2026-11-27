<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check that the customer card preview goes through the CTI server and returns only the rendered card.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/Permissions.php';

use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class RouteCollector {
    public array $routes = [];
    public function __call($method, $arguments) { $this->routes[strtoupper($method) . ' ' . $arguments[0]] = $arguments[1]; }
}

$app = new RouteCollector();
$cwd = getcwd();
chdir(sys_get_temp_dir());
$level = error_reporting(E_ALL & ~E_WARNING);
require $rest . '/modules/cti.php';
error_reporting($level);
chdir($cwd);

check(isset($app->routes['POST /cti/customer_card/preview']), 'POST /cti/customer_card/preview is not registered');

$templates = sys_get_temp_dir() . '/nethvoice-preview-' . getmypid();
mkdir($templates);
foreach (['identity', 'invoices_custom'] as $template) {
    file_put_contents("$templates/$template.ejs", '<p></p>');
}
register_shutdown_function(function () use ($templates) {
    array_map('unlink', glob("$templates/*.ejs"));
    rmdir($templates);
});

const SQL_ERROR = 'ER_NO_SUCH_TABLE: Table asterisk.ampusers_secret_column does not exist';

function preview($data, $answer, array &$sent = []): array {
    global $templates;
    $send = function (string $path, array $body) use ($answer, &$sent) {
        $sent[] = [$path, $body];
        return $answer;
    };
    [$status, $body] = ctiCustomerCardPreviewResponse($data, $send, [new NethvoiceDatabaseLookup('/nonexistent', $templates), 'cardTemplateExists']);
    return [$status, json_encode($body)];
}

$valid = ['dbconn_id' => 5, 'template' => 'invoices_custom', 'query' => base64_encode("select * from crm where phone = '0123456789'")];

$sent = [];
[$status, $json] = preview($valid, ['status' => 200, 'body' => '{"html":"PHA+QW5uYTwvcD4="}'], $sent);
check($status === 200 && $json === '{"html":"PHA+QW5uYTwvcD4="}', "the preview was not returned: $status $json");
check($sent === [['/custcard/preview', ['dbconn_id' => '5', 'template' => 'invoices_custom', 'query' => $valid['query']]]], 'the CTI server received ' . json_encode($sent));

[$status, $json] = preview(['dbconn_id' => '1', 'template' => 'identity'] + $valid, ['status' => 200, 'body' => '{"html":"PHA+","query":"select 1","rows":[{"password":"x"}]}']);
check($status === 200 && $json === '{"html":"PHA+"}', "fields other than html were returned: $json");

foreach ([
    'a query error' => ['status' => 500, 'body' => json_encode(['code' => 'InternalError', 'message' => SQL_ERROR])],
    'a plain text error' => ['status' => 500, 'body' => SQL_ERROR],
    'a refused key' => ['status' => 401, 'body' => '{"message":"' . SQL_ERROR . '"}'],
    'an answer without html' => ['status' => 200, 'body' => '{"message":"' . SQL_ERROR . '"}'],
    'an html that is not text' => ['status' => 200, 'body' => '{"html":["' . SQL_ERROR . '"]}'],
    'an answer that is not JSON' => ['status' => 200, 'body' => SQL_ERROR],
] as $label => $answer) {
    [$status, $json] = preview($valid, $answer);
    check($status === 502 && $json === json_encode(['message' => CTI_PREVIEW_FAILED]), "$label answered $status $json");
    check(!str_contains($json, 'ampusers') && !str_contains($json, 'ER_'), "$label passed the CTI error text: $json");
}

$queryError = "ER_PARSE_ERROR: You have an error in your SQL syntax near 'FORM crm'";
[$status, $json] = preview($valid, ['status' => 422, 'body' => json_encode(['error' => "  $queryError\n"])]);
check($status === 422 && $json === json_encode(['message' => CTI_PREVIEW_QUERY_FAILED, 'error' => $queryError]), "a query error answered $status $json");
[$status, $json] = preview($valid, ['status' => 422, 'body' => json_encode(['error' => str_repeat('è', CTI_PREVIEW_ERROR_MAX_LENGTH + 10)])]);
check($status === 422 && json_decode($json, true)['error'] === str_repeat('è', CTI_PREVIEW_ERROR_MAX_LENGTH), "a long query error was not cut: $status");
[$status, $json] = preview($valid, ['status' => 422, 'body' => json_encode(['message' => SQL_ERROR])]);
check($status === 502 && $json === json_encode(['message' => CTI_PREVIEW_FAILED]), "a query error without text answered $status $json");

[$status, $json] = preview($valid, null);
check($status === 503 && $json === json_encode(['message' => CTI_PREVIEW_UNREACHABLE]), "an unreachable CTI server answered $status $json");

foreach ([
    'no body' => null,
    'a text body' => 'select 1',
    'no connection' => array_diff_key($valid, ['dbconn_id' => 0]),
    'a connection that is not an id' => ['dbconn_id' => '5 OR 1=1'] + $valid,
    'a negative connection' => ['dbconn_id' => -1] + $valid,
    'no template' => array_diff_key($valid, ['template' => 0]),
    'a template path' => ['template' => '../identity'] + $valid,
    'a template with its extension' => ['template' => 'identity.ejs'] + $valid,
    'a template in capitals' => ['template' => 'Identity'] + $valid,
    'a template of the object prototype' => ['template' => 'constructor'] + $valid,
    'a missing custom template' => ['template' => 'identity_custom'] + $valid,
    'no query' => array_diff_key($valid, ['query' => 0]),
    'an empty query' => ['query' => ''] + $valid,
    'a query that is not base64' => ['query' => 'select * from crm'] + $valid,
    'a query that is not text' => ['query' => ['c2VsZWN0IDE=']] + $valid,
] as $label => $data) {
    $sent = [];
    [$status, $json] = preview($data, ['status' => 200, 'body' => '{"html":"PHA+"}'], $sent);
    check($status === 400 && $json === json_encode(['message' => CTI_PREVIEW_INVALID]), "$label answered $status $json");
    check($sent === [], "$label reached the CTI server");
}

putenv('NETHCTI_SERVER_API_PORT');
unset($_ENV['NETHCTI_SERVER_API_PORT']);
check(ctiServerRequest('/custcard/preview', ['dbconn_id' => '5']) === null, 'a CTI request without the API port must fail without calling the CTI server');

$request = (new ServerRequestFactory())->createServerRequest('POST', '/freepbx/rest')
    ->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, ['integrations'])
    ->withParsedBody(['template' => '../identity'] + $valid);
$response = $app->routes['POST /cti/customer_card/preview']($request, (new ResponseFactory())->createResponse(), []);
check($response->getStatusCode() === 400 && $response->getHeaderLine('Content-Type') === 'application/json;charset=utf-8', 'the route does not answer with JSON');
check(json_decode((string) $response->getBody(), true) === ['message' => CTI_PREVIEW_INVALID], 'the route answered ' . $response->getBody());

echo "PASS: customer card preview through the CTI server, input checks, html only and no CTI error text\n";
