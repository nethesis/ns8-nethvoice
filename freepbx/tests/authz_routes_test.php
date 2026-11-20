<?php
// SPDX-License-Identifier: GPL-3.0-or-later

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/AuthMiddleware.php';
require __DIR__ . '/../../tancredi/usr/share/tancredi/src/Entity/NethVoiceAuth.php';

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\StreamFactory;
use Slim\Psr7\Response;
use Tancredi\Entity\NethVoiceAuth;

const SECRET = 'server-secret';
const TANCREDI_SECRET = 'tancredi-secret';
const INTENTS = ['public', 'superadmin', 'lookup', 'dashboard', 'users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];
const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'any', 'map', 'group', 'redirect'];

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

function loadJson(string $file): array {
    $data = json_decode((string) file_get_contents($file), true);
    check(is_array($data), "$file is not valid JSON: " . json_last_error_msg());
    return $data;
}

$spec = loadJson(__DIR__ . '/authz/routes.json');
$scenarios = loadJson(__DIR__ . '/authz/scenarios.json');
$personas = $spec['personas'];

class FreePBX {
    public static array $users = [];
    public static function Database() { return new TestDatabase(); }
}

class TestDatabase {
    private $row = false;
    public function prepare($sql) {
        check($sql === 'SELECT * FROM ampusers WHERE username = ?', "unexpected query: $sql");
        return $this;
    }
    public function execute($args) {
        $sections = FreePBX::$users[$args[0]] ?? null;
        $this->row = $sections === null ? false : ['username' => $args[0], 'password_sha1' => sha1($args[0]), 'sections' => $sections];
    }
    public function fetch($mode) { return $this->row; }
}

class FixtureLookup implements NethvoiceLimitedAdminLookup
{
    public function __construct(private array $fixture) {}

    public function builtinDbConnections(): array {
        return array_values(array_filter(array_values($this->fixture['db_connections'] ?? []), 'nethvoiceIsBuiltinDbConnection'));
    }

    public function dbConnection(int $id): ?array {
        return $this->fixture['db_connections'][(string) $id] ?? null;
    }

    public function customerCard(int $id): ?array {
        return $this->fixture['customer_cards'][(string) $id] ?? null;
    }

    public function phonebookSource(string $id): ?array {
        return $this->fixture['phonebook_sources'][$id] ?? null;
    }

    public function cardTemplateExists(string $name): bool {
        return in_array($name, $this->fixture['card_templates'] ?? [], true);
    }
}

class TestTancrediAuth extends NethVoiceAuth
{
    protected function findUser(string $username): array {
        $sections = FreePBX::$users[$username] ?? null;
        return $sections === null ? [] : [['username' => $username, 'password_sha1' => sha1($username), 'sections' => $sections]];
    }
}

class FixedHandler implements RequestHandlerInterface
{
    public function __construct(private ?string $body) {}

    public function handle(ServerRequestInterface $request): ResponseInterface {
        $response = new Response(200);
        $response->getBody()->write($this->body ?? '{}');
        return $response->withHeader('Content-Type', 'application/json');
    }
}

function routeInventory(string $modules): array {
    $routes = [];
    foreach (glob($modules . '/*.php') as $module) {
        $tokens = array_values(array_filter(token_get_all(file_get_contents($module)), fn($t) => !is_array($t) || !in_array($t[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)));
        foreach ($tokens as $i => $token) {
            if (!is_array($token) || $token[0] !== T_VARIABLE || $token[1] !== '$app' || !is_array($tokens[$i + 1] ?? null) || $tokens[$i + 1][0] !== T_OBJECT_OPERATOR) {
                continue;
            }
            $verb = strtolower($tokens[$i + 2][1] ?? '');
            if (!in_array($verb, VERBS, true)) {
                continue;
            }
            $pattern = $tokens[$i + 4] ?? null;
            check($tokens[$i + 3] === '(' && in_array($verb, ['get', 'post', 'put', 'patch', 'delete'], true), basename($module) . ': $app->' . $verb . ' cannot be read as a single route');
            check(is_array($pattern) && $pattern[0] === T_CONSTANT_ENCAPSED_STRING && ($tokens[$i + 5] ?? null) === ',', basename($module) . ': $app->' . $verb . ' registers a route whose pattern is not a string literal');
            $key = strtoupper($verb) . ' ' . stripslashes(substr($pattern[1], 1, -1));
            check(!isset($routes[$key]), "$key is registered twice");
            $routes[$key] = basename($module);
        }
    }
    ksort($routes);
    return $routes;
}

function samplePath(string $pattern): string {
    $path = preg_replace('#\[/\{[^}]*\}\]$#', '', $pattern);
    return preg_replace_callback('#\{(\w+)(?::([^}]*))?\}#', function ($m) {
        $regex = $m[2] ?? '';
        if ($regex === '') {
            return $m[1] === 'all' ? 'false' : 'x' . $m[1];
        }
        foreach (array_merge(explode('|', $regex), ['201']) as $candidate) {
            if (preg_match('#^(?:' . $regex . ')$#', $candidate)) {
                return $candidate;
            }
        }
        throw new RuntimeException("no sample value for {$m[0]}");
    }, $path);
}

function expectedAllowed(array $entry, array $persona): bool {
    $intent = (array) $entry['intent'];
    if ($intent === ['public']) {
        return true;
    }
    $grants = $persona['grants'];
    if (!$grants) {
        return false;
    }
    if (in_array('superadmin', $grants, true)) {
        return true;
    }
    if ($intent === ['superadmin']) {
        return false;
    }
    return $intent === ['lookup'] || (bool) array_intersect($intent, $grants);
}

function buildApp(array $routes, NethvoiceLimitedAdminLookup $lookup, array &$handlerJson) {
    $app = AppFactory::create();
    $app->setBasePath('/freepbx/rest');
    $app->addBodyParsingMiddleware();
    foreach (array_keys($routes) as $key) {
        [$method, $pattern] = explode(' ', $key, 2);
        $app->map([$method], $pattern, function ($request, $response) use ($key, &$handlerJson) {
            $payload = array_key_exists('value', $handlerJson)
                ? $handlerJson['value']
                : ['route' => $key, 'body' => $request->getParsedBody(), 'query' => $request->getQueryParams()];
            $response->getBody()->write(json_encode($payload));
            return $response->withHeader('Content-Type', 'application/json;charset=utf-8');
        });
    }
    $app->add(new PermissionMiddleware($app->getResponseFactory(), $lookup));
    $app->addRoutingMiddleware();
    $app->add(new AuthMiddleware(SECRET, $app->getResponseFactory()));
    $app->addErrorMiddleware(false, false, false);
    return $app;
}

function sendRequest($app, array $personas, string $persona, string $method, string $path, $body = null, string $type = 'application/json') {
    $request = (new ServerRequestFactory())->createServerRequest($method, '/freepbx/rest' . $path);
    if (empty($personas[$persona]['anonymous'])) {
        $request = $request->withHeader('User', $persona)->withHeader('Secretkey', sha1($persona . sha1($persona) . SECRET));
    }
    if ($body !== null) {
        $request = $request->withHeader('Content-Type', $type)
            ->withBody((new StreamFactory())->createStream(is_string($body) ? $body : json_encode($body)));
    }
    return $app->handle($request);
}

function checkResponse(array $scenario, ResponseInterface $response, string $label) {
    $status = $response->getStatusCode();
    $body = (string) $response->getBody();
    check($status === $scenario['expect'], "$label: answered $status, expected {$scenario['expect']}: $body");
    if (array_key_exists('json_equals', $scenario)) {
        check(json_decode($body, true) === $scenario['json_equals'], "$label: unexpected body $body");
    }
    foreach ($scenario['body_contains'] ?? [] as $needle) {
        check(str_contains($body, $needle), "$label: the body lacks $needle: $body");
    }
}

foreach ($personas as $name => $persona) {
    check(array_key_exists('grants', $persona) && is_array($persona['grants']), "persona $name has no grants");
    if ($persona['sections'] !== null) {
        FreePBX::$users[$name] = $persona['sections'];
    }
}

$routes = routeInventory($rest . '/modules');
check(count($routes) > 150, 'the route inventory looks incomplete: ' . count($routes) . ' routes');
$missing = array_diff(array_keys($routes), array_keys($spec['routes']));
$stale = array_diff(array_keys($spec['routes']), array_keys($routes));
check(!$missing, "routes with no declared intent in authz/routes.json:\n  " . implode("\n  ", $missing));
check(!$stale, "authz/routes.json names routes that are not registered:\n  " . implode("\n  ", $stale));

foreach ($spec['routes'] as $key => $entry) {
    $intent = (array) ($entry['intent'] ?? []);
    check($intent && !array_diff($intent, INTENTS), "$key: invalid intent " . json_encode($entry['intent'] ?? null));
    check(count($intent) === 1 || !array_intersect($intent, ['public', 'superadmin', 'lookup']), "$key: public, superadmin and lookup cannot be combined with sections");
    check(is_string($entry['reason'] ?? null) && $entry['reason'] !== '', "$key: every intent needs a reason");
    check(!array_key_exists('known_finding', $entry) || (is_string($entry['known_finding']) && $entry['known_finding'] !== ''), "$key: a known finding must be described");
}

$noJson = [];
$app = buildApp($routes, new FixtureLookup([]), $noJson);
$failures = [];
$findings = [];
$checks = 0;
foreach ($spec['routes'] as $key => $entry) {
    [$method, $pattern] = explode(' ', $key, 2);
    $path = samplePath($pattern);
    $reached = json_decode((string) sendRequest($app, $personas, 'admin', $method, $path)->getBody(), true);
    check(($reached['route'] ?? null) === $key, "$key: the sample path $path reaches " . json_encode($reached['route'] ?? null));
    $mismatches = [];
    foreach ($personas as $name => $persona) {
        $response = sendRequest($app, $personas, $name, $method, $path);
        $allowed = $response->getStatusCode() !== 403;
        $checks++;
        if ($allowed !== expectedAllowed($entry, $persona)) {
            $mismatches[] = ($allowed ? 'FAIL-OPEN ' : 'FAIL-CLOSED ') . $name;
        }
    }
    if (isset($entry['known_finding'])) {
        if (!$mismatches) {
            $failures[] = "$key: marked as a known finding but the code now matches the intent; remove known_finding";
        } else {
            $findings[] = "$key [" . implode(', ', $mismatches) . "]: {$entry['known_finding']}";
        }
    } elseif ($mismatches) {
        $failures[] = "$key (intent " . json_encode($entry['intent']) . "): " . implode(', ', $mismatches);
    }
}

$handlerJson = [];
$lookup = new FixtureLookup($scenarios['fixture']);
$scenarioApp = buildApp($routes, $lookup, $handlerJson);
foreach ($scenarios['rest'] as $scenario) {
    $label = 'scenario "' . $scenario['name'] . '"';
    $handlerJson = array_key_exists('handler_json', $scenario) ? ['value' => $scenario['handler_json']] : [];
    try {
        checkResponse($scenario, sendRequest($scenarioApp, $personas, $scenario['as'], $scenario['method'], $scenario['path'], $scenario['body'] ?? null, $scenario['content_type'] ?? 'application/json'), $label);
    } catch (RuntimeException $e) {
        $failures[] = $e->getMessage();
    }
    $checks++;
}

$tancredi = new TestTancrediAuth(['secret' => TANCREDI_SECRET, 'static_token' => 'static-token']);
foreach ($scenarios['tancredi'] as $scenario) {
    $label = 'Tancredi scenario "' . $scenario['name'] . '"';
    $request = (new ServerRequestFactory())->createServerRequest($scenario['method'], 'http://localhost/tancredi/api/v1' . $scenario['path'])
        ->withHeader('User', $scenario['as'])
        ->withHeader('Secretkey', sha1($scenario['as'] . sha1($scenario['as']) . TANCREDI_SECRET));
    $handler = new FixedHandler(array_key_exists('handler_json', $scenario) ? json_encode($scenario['handler_json']) : null);
    try {
        checkResponse($scenario, $tancredi->process($request, $handler), $label);
    } catch (RuntimeException $e) {
        $failures[] = $e->getMessage();
    }
    $checks++;
}

foreach ($findings as $finding) {
    echo "KNOWN FINDING $finding\n";
}
check(!$failures, count($failures) . " authorization expectations failed:\n  " . implode("\n  ", $failures));

printf("PASS: authorization spec, %d routes x %d personas, %d scenarios, %d checks, %d known findings\n",
    count($routes), count($personas), count($scenarios['rest']) + count($scenarios['tancredi']), $checks, count($findings));
