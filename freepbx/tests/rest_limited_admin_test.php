<?php
// SPDX-License-Identifier: GPL-3.0-or-later

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/AuthMiddleware.php';

use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\StreamFactory;

const AMPUSERS = [
    'admin' => '*',
    'boss' => 'nethvoice:superadmin',
    'integrator' => 'nethvoice:integrations',
    'userer' => 'nethvoice:users',
    'phoner' => 'nethvoice:phones',
    'allsections' => 'nethvoice:dashboard;nethvoice:users;nethvoice:trunks;nethvoice:routes;nethvoice:phones;nethvoice:integrations;nethvoice:settings',
];

class FreePBX {
    public static function Database() { return new TestDatabase(); }
}

class TestDatabase {
    private $row = false;
    public function prepare($sql) { return $this; }
    public function execute($args) {
        $this->row = isset(AMPUSERS[$args[0]])
            ? ['username' => $args[0], 'password_sha1' => sha1($args[0]), 'sections' => AMPUSERS[$args[0]]]
            : false;
    }
    public function fetch($mode) { return $this->row; }
}

class NethCTI {
    public static $pdo;
    public static function Database() { return self::$pdo; }
}

class CtiTable {
    public function __construct(public array $connections, public array $cards) {}
    public function prepare($sql) { return new CtiStatement($this, $sql); }
}

class CtiStatement {
    private array $result = [];
    public function __construct(private CtiTable $table, private string $sql) {}
    public function execute($args = []) {
        $this->result = match ($this->sql) {
            'SELECT * FROM user_dbconn WHERE id IN (1, 2)' => array_values(array_intersect_key($this->table->connections, [1 => 1, 2 => 2])),
            'SELECT * FROM user_dbconn WHERE id = ?' => isset($this->table->connections[$args[0]]) ? [$this->table->connections[$args[0]]] : [],
            'SELECT id, query, dbconn_id FROM customer_card WHERE id = ?' => isset($this->table->cards[$args[0]]) ? [$this->table->cards[$args[0]]] : [],
        };
        return true;
    }
    public function fetch($mode = null) { return $this->result[0] ?? false; }
    public function fetchAll($mode = null) { return $this->result; }
}

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

NethCTI::$pdo = new CtiTable(
    [
        1 => ['id' => 1, 'host' => '127.0.0.1', 'port' => '20011', 'type' => 'mysql', 'user' => 'nethcti', 'name' => 'phonebook'],
        2 => ['id' => 2, 'host' => '127.0.0.1', 'port' => '20011', 'type' => 'mysql', 'user' => 'freepbx', 'name' => 'asteriskcdrdb'],
        5 => ['id' => 5, 'host' => '192.0.2.10', 'port' => '3306', 'type' => 'mysql', 'user' => 'crm', 'name' => 'crm'],
        7 => ['id' => 7, 'host' => 'localhost', 'port' => '20011', 'type' => 'mysql', 'user' => 'root', 'name' => 'asterisk'],
        8 => ['id' => 8, 'host' => '127.0.0.1', 'port' => '5432', 'type' => 'postgres', 'user' => 'app', 'name' => 'app'],
    ],
    [
        1 => ['id' => 1, 'query' => 'select * from phonebook', 'dbconn_id' => 1],
        2 => ['id' => 2, 'query' => 'select * from cdr', 'dbconn_id' => 2],
        10 => ['id' => 10, 'query' => 'select * from crm', 'dbconn_id' => 5],
    ]
);

$sourcesDir = sys_get_temp_dir() . '/nethvoice-sources-' . getmypid();
mkdir($sourcesDir);
foreach (['custom_1' => 'csv', 'custom_2' => 'mysql', 'custom_3' => 'mssql', 'custom_4' => 'infinity'] as $sid => $dbtype) {
    file_put_contents("$sourcesDir/$sid.json", json_encode([$sid => ['dbtype' => $dbtype, 'type' => $sid]]));
}
$storedDatabase = ['dbtype' => 'mysql', 'host' => '192.0.2.9', 'port' => '3306', 'user' => 'u', 'password' => 'stored', 'dbname' => 'd', 'query' => 'select 1', 'mapping' => ['n' => 'name'], 'type' => 'DB'];
file_put_contents("$sourcesDir/custom_5.json", json_encode(['custom_5' => $storedDatabase]));
file_put_contents("$sourcesDir/custom_6.json", json_encode(['custom_6' => ['host' => '127.0.0.1', 'port' => '20011'] + $storedDatabase]));
file_put_contents("$sourcesDir/custom_7.json", json_encode(['custom_7' => ['password' => ''] + $storedDatabase]));
$templatesDir = sys_get_temp_dir() . '/nethvoice-templates-' . getmypid();
mkdir($templatesDir);
foreach (['identity', 'table', 'invoices_custom', 'notes_custom'] as $template) {
    file_put_contents("$templatesDir/$template.ejs", '<p></p>');
}
register_shutdown_function(function () use ($sourcesDir, $templatesDir) {
    array_map('unlink', [...glob("$sourcesDir/*.json"), ...glob("$templatesDir/*.ejs")]);
    rmdir($sourcesDir);
    rmdir($templatesDir);
});
$lookup = new NethvoiceDatabaseLookup($sourcesDir, $templatesDir);

$csvRows = [
    ['alice', 'Alice "Al" Smith', '201', 'Secret,1"x', '00391234', 'TRUE', 'FALSE', 'sales|support', 'Standard'],
    ['bob', "Bob\r\nNewline", '202', 'pw2', '', 'FALSE', 'TRUE', '', ''],
    ['carl', 'Càrl ùnicode', '', '', '', 'FALSE', 'FALSE', '', ''],
];
$handle = fopen('php://temp', 'r+');
foreach ($csvRows as $row) {
    fputcsv($handle, $row, ',', '"', '', "\r\n");
}
rewind($handle);
$csv = stream_get_contents($handle);
$voicemails = '{"201":{"mailbox":"201","pwd":"1234","name":"Alice","email":"a@example.com","options":{"attach":"yes"}},"202":{"mailbox":"202","pwd":"9876","name":"Bob","email":"","options":[]}}';
$voicemail = '{"mailbox":"201","pwd":"1234","name":"Alice","options":[]}';
$ldap = '{"ldaps":{"enabled":true,"port":"20014","user":"cn=ldapuser,dc=phonebook,dc=nh","password":"ldap-secret","tls":"ldaps","base":"dc=phonebook,dc=nh"}}';

$fixed = fn(string $body) => function ($req, $res) use ($body) {
    $res->getBody()->write($body);
    return $res->withHeader('Content-Type', 'application/json;charset=utf-8');
};
$echo = fn($req, $res, $args) => jsonResponse($res, ['body' => $req->getParsedBody(), 'query' => $req->getQueryParams(), 'args' => $args]);

$app = AppFactory::create();
$app->setBasePath('/freepbx/rest');
$app->addBodyParsingMiddleware();
$guarded = [
    'GET /mobiles/{username}', 'GET /cti/customer_card', 'POST /cti/customer_card', 'PUT /cti/customer_card/{id}',
    'POST /cti/dbconn', 'PUT /cti/dbconn/{id}', 'POST /phonebook/config[/{id}]', 'DELETE /phonebook/config/{id}',
    'POST /phonebook/syncnow/{id}', 'POST /cti/dbconn/test', 'DELETE /cti/dbconn/{id}', 'DELETE /cti/customer_card/template/{name}',
    'POST /cti/customer_card/preview', 'POST /cti/customer_card/template', 'PUT /cti/customer_card/template/{name}',
];
$registered = [];
foreach (glob($rest . '/modules/*.php') as $module) {
    preg_match_all("/\\\$app->(get|post|put|patch|delete)\\('([^']+)'/", file_get_contents($module), $routes, PREG_SET_ORDER);
    foreach ($routes as [, $method, $pattern]) {
        $registered[] = strtoupper($method) . ' ' . $pattern;
    }
}
foreach ([...$guarded, 'GET /csv/csvexport', 'GET /voicemails', 'GET /voicemails/{extension}', 'GET /phonebook/ldap'] as $route) {
    check(in_array($route, $registered, true), "$route is not a REST route");
}
foreach ($guarded as $route) {
    [$method, $pattern] = explode(' ', $route, 2);
    $app->map([$method], $pattern, $echo);
}
$app->get('/csv/csvexport', $fixed(json_encode(base64_encode($csv))));
$app->get('/voicemails', $fixed($voicemails));
$app->get('/voicemails/{extension}', fn($req, $res, $args) => $fixed($args['extension'] === '201' ? $voicemail : 'null')($req, $res));
$app->get('/phonebook/ldap', $fixed($ldap));
$app->add(new PermissionMiddleware($app->getResponseFactory(), $lookup));
$app->addRoutingMiddleware();
$app->add(new AuthMiddleware('server-secret', $app->getResponseFactory()));
$app->addErrorMiddleware(false, false, false);

function send($app, $user, $method, $path, $body = null, $type = 'application/json') {
    $request = (new ServerRequestFactory())->createServerRequest($method, '/freepbx/rest' . $path)
        ->withHeader('User', $user)
        ->withHeader('Secretkey', sha1($user . sha1($user) . 'server-secret'));
    if ($body !== null) {
        $request = $request->withHeader('Content-Type', $type)
            ->withBody((new StreamFactory())->createStream(is_string($body) ? $body : json_encode($body)));
    }
    return $app->handle($request);
}

function status($app, $user, $method, $path, $body = null, $type = 'application/json') {
    return send($app, $user, $method, $path, $body, $type)->getStatusCode();
}

function expectStatus($app, $want, array $users, $method, $path, $body = null, $type = 'application/json') {
    foreach ($users as $user) {
        $got = status($app, $user, $method, $path, $body, $type);
        check($got === $want, "$user $method $path " . json_encode($body) . " answered $got, expected $want");
    }
}

$superadmins = ['admin', 'boss'];

expectStatus($app, 200, ['userer'], 'GET', '/mobiles/alice.smith-1_2@example.com');
foreach (["a'b", 'a b', 'a"b', 'a\\b', 'a;b', "a'%20OR%20'1'='1"] as $username) {
    expectStatus($app, 400, ['userer'], 'GET', '/mobiles/' . rawurlencode($username));
    expectStatus($app, 200, $superadmins, 'GET', '/mobiles/' . rawurlencode($username));
}

expectStatus($app, 200, ['integrator'], 'GET', '/cti/customer_card?id=1&name=Identity&dbconn_id=1&template=identity');
expectStatus($app, 200, ['integrator'], 'GET', '/cti/customer_card');
foreach (['permission_id=1', '1=1', 'name%20%3D%20name%20OR%201=1%20--%20=x', 'query=x', 'id=1&creation=x'] as $query) {
    expectStatus($app, 400, ['integrator'], 'GET', "/cti/customer_card?$query");
    expectStatus($app, 200, $superadmins, 'GET', "/cti/customer_card?$query");
}

$card = ['name' => 'CRM', 'query' => base64_encode('select * from crm where n = $NUMBER'), 'template' => 'identity', 'dbconn_id' => 5, 'profiles' => [1, 2]];
$response = send($app, 'integrator', 'PUT', '/cti/customer_card/10', $card);
check($response->getStatusCode() === 200, 'a customer card update from the UI was refused');
check(json_decode((string) $response->getBody(), true)['body'] === $card, 'the handler did not receive the request body');
$response = send($app, 'integrator', 'PUT', '/cti/customer_card/10', http_build_query(['name' => 'CRM', 'template' => 'x']), 'application/x-www-form-urlencoded');
check($response->getStatusCode() === 200 && json_decode((string) $response->getBody(), true)['body'] === ['name' => 'CRM', 'template' => 'x'], 'a form encoded update was refused or lost');
foreach ([
    ['permission_id' => 3] + $card,
    ['id' => 3] + $card,
    ["name = 'x', query" => 'y'],
    ['creation' => 'now'],
    ['name' => ['x']] + $card,
    ['query' => null] + $card,
    ['profiles' => '1'] + $card,
    ['dbconn_id' => 'x'] + $card,
    ['dbconn_id' => '5 OR 1=1'] + $card,
    [],
    'not json',
] as $body) {
    expectStatus($app, 400, ['integrator'], 'PUT', '/cti/customer_card/10', $body);
}
expectStatus($app, 400, ['integrator'], 'PUT', '/cti/customer_card/10', '<a/>', 'application/xml');
expectStatus($app, 400, ['integrator'], 'PUT', '/cti/customer_card/10', json_encode($card), 'text/plain');
foreach (['abc', rawurlencode('10 OR 1=1'), '-1'] as $id) {
    expectStatus($app, 400, ['integrator'], 'PUT', "/cti/customer_card/$id", $card);
}
expectStatus($app, 200, $superadmins, 'PUT', '/cti/customer_card/10', ['permission_id' => 3] + $card);

$identity = ['name' => 'Identity', 'query' => base64_encode('select * from phonebook'), 'template' => 'identity', 'dbconn_id' => 1, 'profiles' => [1]];
expectStatus($app, 200, ['integrator'], 'PUT', '/cti/customer_card/1', $identity);
expectStatus($app, 200, ['integrator'], 'PUT', '/cti/customer_card/1', ['name' => 'Who', 'profiles' => []]);
expectStatus($app, 403, ['integrator'], 'PUT', '/cti/customer_card/1', ['query' => base64_encode('select * from asterisk.ampusers')] + $identity);
expectStatus($app, 403, ['integrator'], 'PUT', '/cti/customer_card/1', ['query' => base64_encode('select 1')]);
expectStatus($app, 403, ['integrator'], 'PUT', '/cti/customer_card/1', ['dbconn_id' => 2] + $identity);
foreach ([1, '1', '01', 2, 7] as $dbconn) {
    expectStatus($app, 403, ['integrator'], 'PUT', '/cti/customer_card/10', ['dbconn_id' => $dbconn] + $card);
    expectStatus($app, 403, ['integrator'], 'PUT', '/cti/customer_card/10', ['dbconn_id' => $dbconn]);
    expectStatus($app, 403, ['integrator'], 'POST', '/cti/customer_card', ['dbconn_id' => $dbconn] + $card);
    expectStatus($app, 403, ['integrator'], 'PUT', '/cti/customer_card/99', ['dbconn_id' => $dbconn] + $card);
    expectStatus($app, 200, $superadmins, 'PUT', '/cti/customer_card/10', ['dbconn_id' => $dbconn] + $card);
    expectStatus($app, 200, $superadmins, 'POST', '/cti/customer_card', ['dbconn_id' => $dbconn] + $card);
}
expectStatus($app, 200, ['integrator'], 'PUT', '/cti/customer_card/10', ['dbconn_id' => 8] + $card);
expectStatus($app, 200, ['integrator'], 'POST', '/cti/customer_card', $card);
expectStatus($app, 200, ['integrator'], 'POST', '/cti/customer_card', ['dbconn_id' => '8'] + $card);
expectStatus($app, 400, ['integrator'], 'POST', '/cti/customer_card', ['dbconn_id' => 'x'] + $card);
expectStatus($app, 400, ['integrator'], 'POST', '/cti/customer_card', array_diff_key($card, ['dbconn_id' => 0]));

$connection = ['host' => '192.0.2.10', 'port' => '3306', 'type' => 'mysql', 'user' => 'crm', 'pass' => 'p', 'name' => 'crm'];
expectStatus($app, 200, ['integrator'], 'POST', '/cti/dbconn', $connection);
expectStatus($app, 200, ['integrator'], 'POST', '/cti/dbconn', ['host' => '127.0.0.1', 'port' => '5432'] + $connection);
foreach ([['127.0.0.1', '20011'], ['localhost', '20011'], ['LOCALHOST', ''], ['[::1]', '20011'], ['127.0.0.2', '20011'], ['0.0.0.0', '20011'], ['', '20011']] as [$host, $port]) {
    expectStatus($app, 403, ['integrator'], 'POST', '/cti/dbconn', ['host' => $host, 'port' => $port] + $connection);
    expectStatus($app, 200, $superadmins, 'POST', '/cti/dbconn', ['host' => $host, 'port' => $port] + $connection);
}
expectStatus($app, 400, ['integrator'], 'POST', '/cti/dbconn', 'not json');
foreach (['1', '2', '01', '7'] as $id) {
    expectStatus($app, 403, ['integrator'], 'PUT', "/cti/dbconn/$id", ['name' => 'asterisk']);
    expectStatus($app, 200, $superadmins, 'PUT', "/cti/dbconn/$id", ['name' => 'asterisk']);
}
expectStatus($app, 403, ['integrator'], 'PUT', '/cti/dbconn/5', ['host' => '127.0.0.1', 'port' => '20011']);
expectStatus($app, 403, ['integrator'], 'PUT', '/cti/dbconn/5', ['host' => 'localhost', 'port' => '20011']);
expectStatus($app, 200, ['integrator'], 'PUT', '/cti/dbconn/5', ['host' => 'localhost']);
expectStatus($app, 403, ['integrator'], 'PUT', '/cti/dbconn/8', ['port' => '20011']);
expectStatus($app, 200, ['integrator'], 'PUT', '/cti/dbconn/5', ['port' => '20011', 'name' => 'crm2']);
expectStatus($app, 200, ['integrator'], 'PUT', '/cti/dbconn/8', ['name' => 'app2']);
expectStatus($app, 403, ['integrator'], 'PUT', '/cti/dbconn/99', ['host' => '127.0.0.1', 'port' => '20011']);
expectStatus($app, 400, ['integrator'], 'PUT', '/cti/dbconn/1x', ['name' => 'x']);

$test = ['host' => '192.0.2.10', 'port' => '3306', 'type' => 'mysql', 'user' => 'crm', 'pass' => 'p', 'name' => 'crm'];
expectStatus($app, 200, ['integrator'], 'POST', '/cti/dbconn/test', $test);
expectStatus($app, 200, ['integrator'], 'POST', '/cti/dbconn/test', ['id' => '5', 'pass' => ''] + $test);
expectStatus($app, 200, ['integrator'], 'POST', '/cti/dbconn/test', ['id' => ''] + $test);
expectStatus($app, 200, ['integrator'], 'POST', '/cti/dbconn/test', ['host' => '127.0.0.1', 'port' => '5432'] + $test);
foreach ([
    ['host' => '127.0.0.1', 'port' => '20011'],
    ['host' => 'localhost', 'port' => ''],
    ['host' => '[::1]', 'port' => '20011'],
    ['id' => '1', 'pass' => ''],
    ['id' => 2, 'pass' => 'x'],
    ['id' => '7', 'host' => '192.0.2.10'],
] as $target) {
    expectStatus($app, 403, ['integrator'], 'POST', '/cti/dbconn/test', $target + $test);
    expectStatus($app, 200, $superadmins, 'POST', '/cti/dbconn/test', $target + $test);
}
foreach (array_filter(nethvoiceNodeAddresses(), fn($address) => !nethvoiceIsForbiddenAddress($address)) as $address) {
    $host = str_contains($address, ':') ? "[$address]" : $address;
    expectStatus($app, 403, ['integrator'], 'POST', '/cti/dbconn', ['host' => $host, 'port' => '20011'] + $connection);
    expectStatus($app, 403, ['integrator'], 'POST', '/cti/dbconn/test', ['host' => $host, 'port' => '20011'] + $test);
    expectStatus($app, 200, ['integrator'], 'POST', '/cti/dbconn', ['host' => $host, 'port' => '5432'] + $connection);
    expectStatus($app, 200, $superadmins, 'POST', '/cti/dbconn', ['host' => $host, 'port' => '20011'] + $connection);
}
expectStatus($app, 400, ['integrator'], 'POST', '/cti/dbconn/test', ['id' => '5 OR 1=1'] + $test);
expectStatus($app, 400, ['integrator'], 'POST', '/cti/dbconn/test', 'not json');
foreach (['1', '2', '01', '7'] as $id) {
    expectStatus($app, 403, ['integrator'], 'DELETE', "/cti/dbconn/$id");
    expectStatus($app, 200, $superadmins, 'DELETE', "/cti/dbconn/$id");
}
foreach (['5', '8', '99'] as $id) {
    expectStatus($app, 200, ['integrator'], 'DELETE', "/cti/dbconn/$id");
}
expectStatus($app, 400, ['integrator'], 'DELETE', '/cti/dbconn/1x');

foreach (['invoices', 'notes', 'identity', 'table', 'missing', 'invoices_custom', 'Invoices', '%2E%2E'] as $name) {
    expectStatus($app, 403, ['integrator', 'allsections'], 'DELETE', "/cti/customer_card/template/$name");
}
foreach (['invoices', 'notes', 'identity', 'table'] as $name) {
    expectStatus($app, 200, $superadmins, 'DELETE', "/cti/customer_card/template/$name");
}

$template = ['name' => 'invoices2', 'custom' => true, 'html' => base64_encode('<p><%= results[0].name %></p>')];
$builtin = ['name' => 'identity', 'custom' => false, 'html' => base64_encode("<!-- color: blue -->\n<thead class=\"bg-blue-600\"></thead>")];
foreach ([
    'a custom template' => $template,
    'a built-in template' => ['name' => 'identity'] + $builtin,
    'a path' => ['name' => '../invoices'] + $template,
    'no body' => null,
    'not json' => 'not json',
] as $label => $body) {
    foreach (['integrator', 'allsections', 'userer', 'phoner'] as $user) {
        $got = status($app, $user, 'POST', '/cti/customer_card/template', $body);
        check($got === 403, "$user POST a template with $label answered $got, expected 403");
    }
}
foreach ([
    'invoices2' => $template,
    'invoices' => ['name' => 'invoices'] + $template,
    'identity' => $builtin,
    'table' => ['name' => 'table'] + $builtin,
] as $name => $body) {
    foreach (['integrator', 'allsections', 'userer', 'phoner'] as $user) {
        $got = status($app, $user, 'PUT', "/cti/customer_card/template/$name", $body);
        check($got === 403, "$user PUT the template $name answered $got, expected 403");
    }
    $got = status($app, 'integrator', 'PUT', "/cti/customer_card/template/$name", 'not json');
    check($got === 403, "integrator PUT the template $name without a body answered $got, expected 403");
}
expectStatus($app, 200, $superadmins, 'POST', '/cti/customer_card/template', $template);
expectStatus($app, 200, $superadmins, 'PUT', '/cti/customer_card/template/invoices2', $template);
expectStatus($app, 200, $superadmins, 'PUT', '/cti/customer_card/template/invoices', ['name' => 'invoices'] + $template);
$response = send($app, 'admin', 'PUT', '/cti/customer_card/template/identity', $builtin);
check($response->getStatusCode() === 200, 'superadmin cannot change the color of a built-in template');
check(json_decode((string) $response->getBody(), true)['body'] === $builtin, 'the handler did not receive the built-in template body');
expectStatus($app, 200, $superadmins, 'PUT', '/cti/customer_card/template/table', ['name' => 'table'] + $builtin);
foreach ([
    'an uppercase name' => ['name' => 'Invoices2'] + $template,
    'a name with an underscore' => ['name' => 'invoices_custom'] + $template,
    'no custom' => array_diff_key($template, ['custom' => 1]),
    'no html' => array_diff_key($template, ['html' => 1]),
] as $label => $body) {
    expectStatus($app, 200, $superadmins, 'POST', '/cti/customer_card/template', $body);
    expectStatus($app, 200, $superadmins, 'PUT', '/cti/customer_card/template/invoices2', $body);
}

$preview = ['dbconn_id' => '5', 'template' => 'invoices_custom', 'query' => base64_encode('select * from crm')];
expectStatus($app, 200, ['integrator'], 'POST', '/cti/customer_card/preview', $preview);
expectStatus($app, 200, ['integrator'], 'POST', '/cti/customer_card/preview', ['dbconn_id' => 8] + $preview);
foreach ([1, '1', '01', 2, '7'] as $dbconn) {
    expectStatus($app, 403, ['integrator'], 'POST', '/cti/customer_card/preview', ['dbconn_id' => $dbconn] + $preview);
    expectStatus($app, 200, $superadmins, 'POST', '/cti/customer_card/preview', ['dbconn_id' => $dbconn] + $preview);
}
foreach ([['dbconn_id' => 'x'] + $preview, ['dbconn_id' => '5 OR 1=1'] + $preview, array_diff_key($preview, ['dbconn_id' => 0]), 'not json'] as $body) {
    expectStatus($app, 400, ['integrator'], 'POST', '/cti/customer_card/preview', $body);
}

$csvSource = ['dbtype' => 'csv', 'url' => 'https://192.0.2.5/a.csv', 'type' => 'Shop', 'mapping' => ['Name' => 'name', 'Phone' => 'workphone', 'Owner' => 'owner_id']];
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config', $csvSource);
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_1', $csvSource);
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_4', ['dbtype' => 'infinity', 'url' => 'https://192.0.2.7', 'username' => 'u', 'password' => 'p', 'type' => 'Inf']);
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/new-Source_9', $csvSource);
foreach (['custom"1', 'a.b', 'custom_1" OR "1"="1', 'a b', '..'] as $id) {
    expectStatus($app, 400, ['integrator'], 'POST', '/phonebook/config/' . rawurlencode($id), $csvSource);
    expectStatus($app, 400, ['integrator'], 'DELETE', '/phonebook/config/' . rawurlencode($id));
    expectStatus($app, 400, ['integrator'], 'POST', '/phonebook/syncnow/' . rawurlencode($id));
    expectStatus($app, 200, $superadmins, 'POST', '/phonebook/config/' . rawurlencode($id), $csvSource);
    expectStatus($app, 200, $superadmins, 'DELETE', '/phonebook/config/' . rawurlencode($id));
}
foreach ([
    ['Name' => 'name) VALUES (1); DROP TABLE phonebook; --'],
    ['Name' => 'sid_imported'],
    ['Name' => 'access'],
    ['Name' => 'Name'],
    ['Name' => ''],
    ['Name' => ['name']],
    'name',
] as $mapping) {
    expectStatus($app, 400, ['integrator'], 'POST', '/phonebook/config/custom_1', ['mapping' => $mapping] + $csvSource);
    expectStatus($app, 200, $superadmins, 'POST', '/phonebook/config/custom_1', ['mapping' => $mapping] + $csvSource);
}
expectStatus($app, 400, ['integrator'], 'POST', '/phonebook/config', ['dbtype' => true] + $csvSource);
$mysqlSource = ['dbtype' => 'mysql', 'host' => '192.0.2.9', 'port' => '3306', 'user' => 'u', 'password' => 'p', 'dbname' => 'd', 'query' => 'select 1', 'mapping' => ['n' => 'name'], 'type' => 'DB'];
foreach (['mysql', 'mssql'] as $dbtype) {
    expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config', ['dbtype' => $dbtype] + $mysqlSource);
    expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_1', ['dbtype' => $dbtype] + $mysqlSource);
    expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config', ['dbtype' => $dbtype, 'host' => '192.0.2.77', 'port' => '1'] + $mysqlSource);
    foreach (['127.0.0.1', 'localhost', 'LOCALHOST', '[::1]', '::1', '127.0.0.2', '0.0.0.0', '169.254.1.1', '', ' ', ['192.0.2.9']] as $host) {
        foreach (['3306', '20011', '1'] as $port) {
            expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config', ['dbtype' => $dbtype, 'host' => $host, 'port' => $port] + $mysqlSource);
            expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config/custom_5', ['dbtype' => $dbtype, 'host' => $host, 'port' => $port] + $mysqlSource);
        }
        expectStatus($app, 200, $superadmins, 'POST', '/phonebook/config', ['dbtype' => $dbtype, 'host' => $host] + $mysqlSource);
    }
    expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config', ['dbtype' => $dbtype] + array_diff_key($mysqlSource, ['host' => 0]));
    foreach (array_filter(nethvoiceNodeAddresses(), fn($address) => !nethvoiceIsForbiddenAddress($address)) as $address) {
        expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config', ['dbtype' => $dbtype, 'host' => $address, 'port' => '1'] + $mysqlSource);
        expectStatus($app, 200, $superadmins, 'POST', '/phonebook/config', ['dbtype' => $dbtype, 'host' => $address] + $mysqlSource);
    }
}
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_5', ['password' => ''] + $storedDatabase);
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_5', array_diff_key($storedDatabase, ['password' => 0]));
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_5', ['password' => '', 'type' => 'Renamed', 'interval' => 60] + $storedDatabase);
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_5', ['password' => 'typed', 'query' => 'select 2', 'host' => '192.0.2.99'] + $storedDatabase);
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_7', ['password' => '', 'query' => 'select 2'] + $storedDatabase);
foreach (['query' => 'select * from other', 'host' => '192.0.2.99', 'port' => '3307', 'dbname' => 'other', 'user' => 'root', 'dbtype' => 'mssql'] as $field => $value) {
    expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config/custom_5', [$field => $value, 'password' => ''] + $storedDatabase);
    expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config/custom_5', [$field => $value] + array_diff_key($storedDatabase, ['password' => 0]));
    expectStatus($app, 200, $superadmins, 'POST', '/phonebook/config/custom_5', [$field => $value, 'password' => ''] + $storedDatabase);
}
foreach ([['password' => ''] + $storedDatabase, $storedDatabase, ['password' => 'typed', 'host' => '192.0.2.99'] + $storedDatabase, $csvSource] as $body) {
    expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config/custom_6', $body);
    expectStatus($app, 200, $superadmins, 'POST', '/phonebook/config/custom_6', $body);
}
foreach (['custom_1', 'custom_2', 'custom_3', 'custom_4', 'custom_5', 'custom_6', 'custom_99'] as $sid) {
    expectStatus($app, 200, ['integrator'], 'DELETE', "/phonebook/config/$sid");
    expectStatus($app, 200, ['integrator'], 'POST', "/phonebook/syncnow/$sid");
    expectStatus($app, 200, $superadmins, 'DELETE', "/phonebook/config/$sid");
    expectStatus($app, 200, $superadmins, 'POST', "/phonebook/syncnow/$sid");
}
expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config/custom_2', $csvSource);
expectStatus($app, 403, ['integrator'], 'POST', '/phonebook/config/custom_5', $csvSource);
expectStatus($app, 200, ['integrator'], 'POST', '/phonebook/config/custom_7', $csvSource);
check(nethvoicePhonebookDatabaseTargetStatus(['dbtype' => 'mysql', 'host' => '192.0.2.9', 'query' => 'select 2'], ['password' => ''] + $storedDatabase) === null, 'a stored source without password must accept a new query');
check(nethvoicePhonebookDatabaseTargetStatus(['dbtype' => 'csv', 'url' => 'https://192.0.2.5/a.csv'], null) === null, 'a CSV source is not a database target');

$response = send($app, 'userer', 'GET', '/csv/csvexport');
check($response->getStatusCode() === 200 && $response->getHeaderLine('Content-Type') === 'application/json;charset=utf-8', 'the export is not JSON');
$redacted = base64_decode(json_decode((string) $response->getBody()));
$expected = $csvRows;
foreach ($expected as $i => $row) {
    $expected[$i][3] = '';
}
$handle = fopen('php://temp', 'r+');
fwrite($handle, $redacted);
rewind($handle);
$parsed = [];
while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {
    $parsed[] = $row;
}
check($parsed === $expected, 'the exported CSV changed beyond the password column: ' . $redacted);
check(!str_contains($redacted, 'Secret') && !str_contains($redacted, 'pw2'), 'a password is left in the export');
check(substr_count($redacted, "\r\n") === substr_count($csv, "\r\n"), 'the export line endings changed');
foreach ($superadmins as $user) {
    check(json_decode((string) send($app, $user, 'GET', '/csv/csvexport')->getBody()) === base64_encode($csv), "$user lost the passwords in the export");
}
check(nethvoiceBase64CsvWithoutColumn(base64_encode(''), 3) === '' && nethvoiceBase64CsvWithoutColumn('%%%', 3) === '' && nethvoiceBase64CsvWithoutColumn(null, 3) === '', 'an empty or broken export must stay empty');

check((string) send($app, 'userer', 'GET', '/voicemails')->getBody() === '{"201":{"mailbox":"201","name":"Alice","email":"a@example.com","options":{"attach":"yes"}},"202":{"mailbox":"202","name":"Bob","email":"","options":[]}}', 'a voicemail PIN is left in the list');
check((string) send($app, 'userer', 'GET', '/voicemails/201')->getBody() === '{"mailbox":"201","name":"Alice","options":[]}', 'the voicemail PIN is left');
check((string) send($app, 'userer', 'GET', '/voicemails/999')->getBody() === 'null', 'a missing voicemail changed');
foreach ($superadmins as $user) {
    check((string) send($app, $user, 'GET', '/voicemails')->getBody() === $voicemails, "$user lost the voicemail PINs");
    check((string) send($app, $user, 'GET', '/voicemails/201')->getBody() === $voicemail, "$user lost the voicemail PIN");
    check((string) send($app, $user, 'GET', '/phonebook/ldap')->getBody() === $ldap, "$user lost the LDAP phonebook password");
}

expectStatus($app, 403, ['integrator', 'userer'], 'GET', '/phonebook/ldap');
$response = send($app, 'phoner', 'GET', '/phonebook/ldap');
check($response->getStatusCode() === 200, 'the phones section must read the LDAP phonebook');
check((string) $response->getBody() === '{"ldaps":{"enabled":true,"port":"20014","user":"cn=ldapuser,dc=phonebook,dc=nh","tls":"ldaps","base":"dc=phonebook,dc=nh"}}', 'the LDAP phonebook password is left');

foreach (['/csv/csvexport', '/voicemails', '/voicemails/{extension}', '/phonebook/ldap'] as $pattern) {
    check(nethvoiceLimitedAdminResponseFilter('HEAD', $pattern) !== null, "HEAD $pattern must remove the same secrets as GET");
}
$head = (new ServerRequestFactory())->createServerRequest('HEAD', '/cti/customer_card?permission_id=1');
check(nethvoiceLimitedAdminRequestStatus($head, '/cti/customer_card', [], $lookup) === 400, 'HEAD /cti/customer_card must pass the request check of GET');
check(nethvoiceRouteAccess('HEAD', '/users/{username}/password')['sections'] === [NETHVOICE_SUPERADMIN], 'HEAD must follow the explicit rule of GET');

foreach (['*', 'cdr;*', ['*'], 'nethvoice:superadmin', 'nethvoice:users;nethvoice:superadmin'] as $sections) {
    check(nethvoiceKeepsFreepbxSession($sections), json_encode($sections) . ' must keep the FreePBX session');
}
foreach (['nethvoice:users', 'nethvoice:settings;nethvoice:phones', '', null, 'cdr*', ['nethvoice:integrations']] as $sections) {
    check(!nethvoiceKeepsFreepbxSession($sections), json_encode($sections) . ' must not keep the FreePBX session');
}

preg_match("/\\\$app->get\\('\\/phonebook\\/fields'.*?array\\((.*?)\\);/s", file_get_contents($rest . '/modules/phonebook.php'), $match);
preg_match_all("/'([a-z0-9_]+)'/", $match[1] ?? '', $fields);
check($fields[1] === NETHVOICE_PHONEBOOK_FIELDS, 'the phonebook mapping check and GET /phonebook/fields list different fields');

check($lookup->phonebookSource('custom_2') === ['dbtype' => 'mysql', 'type' => 'custom_2'], 'a stored phonebook source is not read');
check($lookup->phonebookSource('../custom_2') === null && $lookup->phonebookSource('custom_99') === null, 'an invalid or missing source was read');
check($lookup->cardTemplateExists('invoices_custom') && $lookup->cardTemplateExists('identity'), 'an existing template is not found');
foreach (['invoices', 'missing_custom', '../identity', 'identity.ejs', 'Identity', ''] as $name) {
    check(!$lookup->cardTemplateExists($name), "the template $name must not be found");
}
check(array_column($lookup->builtinDbConnections(), 'id') === [1, 2], 'the built-in connections are not found');
NethCTI::$pdo->connections[2]['host'] = '192.0.2.50';
check(array_column($lookup->builtinDbConnections(), 'id') === [1], 'a connection moved to another server is still built-in');

echo "PASS: limited administrators: input checks on mobiles, customer cards, card templates and previews, database connections and phonebook sources, secrets removed from exports, voicemails and LDAP\n";
