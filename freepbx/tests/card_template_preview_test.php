<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check that a template body is rendered by the CTI server with the sample results and only for superadmin.

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

check(isset($app->routes['POST /cti/customer_card/template/preview']), 'POST /cti/customer_card/template/preview is not registered');
check(NETHVOICE_ROUTE_RULES['POST /cti/customer_card/template/preview'] === NETHVOICE_SUPERADMIN, 'the template preview is not reserved to superadmin');

function render($data, $answer, array &$sent = []): array {
    $send = function (string $path, array $body) use ($answer, &$sent) {
        $sent[] = [$path, json_encode($body)];
        return $answer;
    };
    [$status, $body] = ctiCardTemplatePreviewResponse($data, $send);
    return [$status, json_encode($body, JSON_UNESCAPED_UNICODE)];
}

$code = "<% results.forEach(function (row) { %><p><%= row.city %></p><% }) %>";
$valid = ['html' => base64_encode($code), 'results' => [['city' => 'Forlì', 'total' => 12.5], []]];

$sent = [];
[$status, $json] = render($valid, ['status' => 200, 'body' => '{"html":"PHA+Rm9ybMOsPC9wPg==","stack":"/app/plugins"}'], $sent);
check($status === 200 && $json === '{"html":"PHA+Rm9ybMOsPC9wPg=="}', "the rendered card was not returned: $status $json");
check($sent === [['/custcard/render', json_encode(['template' => base64_encode($code), 'results' => [['city' => 'Forlì', 'total' => 12.5], new stdClass()]])]], 'the CTI server received ' . json_encode($sent));

[$status, $json] = render(['results' => [['name' => 'Ana']]] + $valid, ['status' => 200, 'body' => '{"html":""}'], $sent);
check($status === 200 && $json === '{"html":""}', "an empty card was not returned: $status $json");

[$status, $json] = render($valid, ['status' => 422, 'body' => json_encode(['error' => "ejs:1\n >> 1| <%= missing %>\n\nmissing is not defined"])]);
check($status === 422 && $json === json_encode(['message' => CTI_TEMPLATE_PREVIEW_ERROR, 'error' => "ejs:1\n >> 1| <%= missing %>\n\nmissing is not defined"], JSON_UNESCAPED_UNICODE), "a render error answered $status $json");

foreach ([
    'a server error' => ['status' => 500, 'body' => '{"message":"Error: spawn /usr/local/bin/node EAGAIN"}'],
    'a refused key' => ['status' => 403, 'body' => '{"error":"forbidden /app"}'],
    'a render error without text' => ['status' => 422, 'body' => '{"error":["/app/plugins"]}'],
    'an answer without html' => ['status' => 200, 'body' => '{"error":"/app/plugins"}'],
    'an answer that is not JSON' => ['status' => 200, 'body' => '/app/plugins'],
] as $label => $answer) {
    [$status, $json] = render($valid, $answer);
    check($status === 502 && $json === json_encode(['message' => CTI_PREVIEW_FAILED]), "$label answered $status $json");
}

[$status, $json] = render($valid, null);
check($status === 503 && $json === json_encode(['message' => CTI_PREVIEW_UNREACHABLE]), "an unreachable CTI server answered $status $json");

foreach ([
    'no body' => null,
    'a text body' => 'PHA+',
    'no template' => ['results' => []],
    'an empty template' => ['html' => ''] + $valid,
    'a blank template' => ['html' => base64_encode("  \n")] + $valid,
    'a template that is not base64' => ['html' => '<p><%= 1 %></p>'] + $valid,
    'a template that is not text' => ['html' => ['PHA+']] + $valid,
    'a template too large' => ['html' => base64_encode(str_repeat('x', CTI_TEMPLATE_PREVIEW_MAX_BYTES + 1))] + $valid,
    'no results' => ['html' => $valid['html']],
    'results that are an object' => ['results' => ['name' => 'Ana']] + $valid,
    'results with a list row' => ['results' => [['Ana', 'Rossi']]] + $valid,
    'results with a text row' => ['results' => ['Ana']] + $valid,
    'results too large' => ['results' => [['notes' => str_repeat('x', CTI_TEMPLATE_PREVIEW_MAX_RESULTS_BYTES)]]] + $valid,
] as $label => $data) {
    $sent = [];
    [$status, $json] = render($data, ['status' => 200, 'body' => '{"html":"PHA+"}'], $sent);
    check($status === 400 && $json === json_encode(['message' => CTI_TEMPLATE_PREVIEW_INVALID]), "$label answered $status $json");
    check($sent === [], "$label reached the CTI server");
}

$request = (new ServerRequestFactory())->createServerRequest('POST', '/freepbx/rest')
    ->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, [NETHVOICE_SUPERADMIN])
    ->withParsedBody(['html' => base64_encode('<p></p>'), 'results' => 'x']);
$response = $app->routes['POST /cti/customer_card/template/preview']($request, (new ResponseFactory())->createResponse(), []);
check($response->getStatusCode() === 400 && $response->getHeaderLine('Content-Type') === 'application/json;charset=utf-8', 'the route does not answer with JSON');
check(json_decode((string) $response->getBody(), true) === ['message' => CTI_TEMPLATE_PREVIEW_INVALID], 'the route answered ' . $response->getBody());

echo "PASS: template preview through the CTI server, superadmin only, input checks and render errors\n";
