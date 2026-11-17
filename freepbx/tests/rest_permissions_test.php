<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check the section permissions of the REST API against an in-memory ampusers table.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/AuthMiddleware.php';

use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

const AMPUSERS = [
    'admin' => '*',
    'boss' => 'nethvoice:superadmin',
    'dash' => 'nethvoice:dashboard',
    'setter' => 'nethvoice:settings',
    'integrator' => 'nethvoice:integrations',
    'mixed' => 'cdr; nethvoice:users ;nethvoice:bogus;nethvoice:phones',
    'wildcard' => 'nethvoice:*',
    'star' => 'cdr*',
    'legacy' => 'cdr;queues',
];

class FreePBX {
    public static function Database() { return new TestDatabase(); }
}

class TestDatabase {
    private $row = false;
    public function prepare($sql) {
        check($sql === 'SELECT * FROM ampusers WHERE username = ?', "unexpected query: $sql");
        return $this;
    }
    public function execute($args) {
        $this->row = isset(AMPUSERS[$args[0]])
            ? ['username' => $args[0], 'password_sha1' => sha1($args[0]), 'sections' => AMPUSERS[$args[0]]]
            : false;
    }
    public function fetch($mode) { return $this->row; }
}

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

function access($method, $pattern) {
    $access = nethvoiceRouteAccess($method, $pattern);
    return implode('|', $access['sections']) . ($access['self'] ? ' self:' . $access['self'] : '');
}

check(nethvoiceParseSections('*') === ['superadmin'], '* must grant superadmin');
check(nethvoiceParseSections('cdr;*') === ['superadmin'], '* among other sections must grant superadmin');
check(nethvoiceParseSections(['*']) === ['superadmin'], 'sections may be given as an array');
check(nethvoiceParseSections('nethvoice:superadmin;nethvoice:users') === ['superadmin'], 'nethvoice:superadmin must grant superadmin');
check(nethvoiceParseSections('nethvoice:settings;nethvoice:dashboard') === ['dashboard', 'settings'], 'sections must follow the menu order');
check(nethvoiceParseSections(AMPUSERS['mixed']) === ['users', 'phones'], 'unknown and foreign sections must be ignored');
check(nethvoiceParseSections('nethvoice:*') === [], 'nethvoice:* must not grant anything');
check(nethvoiceParseSections('cdr*') === [], 'a * inside another section must not grant superadmin');
check(nethvoiceParseSections('') === [], 'no sections must grant nothing');
check(nethvoiceParseSections(null) === [], 'missing sections must grant nothing');
check(nethvoicePermissionsFor(['username' => 'dash', 'sections' => 'nethvoice:dashboard']) === ['dashboard'], 'resolver must read ampusers.sections');

$expected = [
    'GET /me' => 'lookup',
    'GET /logout' => 'lookup',
    'GET /users/{all}' => 'lookup',
    'GET /users/count' => 'lookup',
    'GET /cti/groups' => 'lookup',
    'GET /cti/profiles' => 'lookup',
    'GET /trunks' => 'lookup',
    'GET /providers' => 'lookup',
    'GET /inboundroutes' => 'lookup',
    'GET /outboundroutes' => 'lookup',
    'GET /outboundroutes/supportedLocales' => 'lookup',
    'GET /settings/languages' => 'lookup',
    'GET /mainextensions/userlimits' => 'lookup',
    'GET /physicalextensions' => 'lookup',
    'GET /configuration/wizard' => 'lookup',
    'GET /adminphone' => 'lookup',
    'POST /adminphone/session' => 'lookup',
    'GET /users/sync' => 'users',
    'POST /users' => 'users',
    'POST /mainextensions' => 'users',
    'GET /mainextensions/orphans' => 'users',
    'POST /voicemails' => 'users',
    'POST /webrtc' => 'users',
    'DELETE /nethlink/{mainextension}' => 'users',
    'POST /mobileapp' => 'users',
    'POST /bulk/{mainextensions}' => 'users',
    'GET /csv/csvexport' => 'users',
    'GET /destinations' => 'users',
    'POST /cti/groups' => 'users',
    'GET /cti/groups/users/{id}' => 'users',
    'GET /cti/users/groups/{id}' => 'users',
    'POST /cti/profiles/{id}' => 'users',
    'POST /cti/profiles/users/{user_id}' => 'users',
    'POST /physicalextensions' => 'users|phones',
    'PATCH /physicalextensions/{mac}' => 'users|phones',
    'POST /phones/rps/{mac}' => 'users|phones',
    'POST /phones/reconfigure' => 'users|phones',
    'POST /physicalextensions/adminpw' => 'phones',
    'GET /phones/state' => 'phones',
    'POST /extensions/{extension}/srtp/{enabled}' => 'phones',
    'PATCH /trunks/{trunkid}' => 'trunks',
    'GET /trunks/{tech}' => 'trunks',
    'GET /devices/gateways/list/{id}' => 'trunks',
    'GET /codecs/voip' => 'trunks',
    'GET /configuration/networks' => 'trunks',
    'POST /inboundroutes/delete' => 'routes',
    'GET /outboundroutes/defaults' => 'routes',
    'POST /outboundroutes' => 'routes',
    'GET /phonebook/config' => 'integrations',
    'POST /cti/sources/test' => 'integrations',
    'PUT /cti/streaming/{descr}' => 'integrations',
    'GET /cti/paramurls' => 'integrations',
    'POST /cti/paramurl/delete' => 'integrations',
    'GET /cti/dbconn/type' => 'integrations',
    'DELETE /cti/customer_card/template/{name}' => 'integrations',
    'GET /cti/customer_card/template' => 'integrations',
    'POST /cti/customer_card/template' => 'superadmin',
    'PUT /cti/customer_card/template/{name}' => 'superadmin',
    'POST /phonebook/test' => 'integrations',
    'POST /settings/defaultlanguage' => 'settings',
    'POST /users/{username}/password' => 'settings self:username',
    'GET /users/{username}/password' => 'superadmin',
    'POST /configuration/wizard' => 'superadmin',
    'GET /configuration/mode' => 'superadmin',
    'POST /migration/importusers' => 'superadmin',
    'GET /final' => 'superadmin',
    'GET /login' => 'superadmin',
    'DELETE /adminphone' => 'superadmin',
    'GET /unknown' => 'superadmin',
    'GET /dashboard/calls' => 'dashboard',
    'GET /trunksx' => 'superadmin',
];
foreach ($expected as $route => $want) {
    [$method, $pattern] = explode(' ', $route, 2);
    check(access($method, $pattern) === $want, "$route resolves to " . access($method, $pattern) . ", expected $want");
}

$superadminOnly = [];
foreach (glob($rest . '/modules/*.php') as $module) {
    preg_match_all("/\\\$app->(get|post|put|patch|delete)\\('([^']+)'/", file_get_contents($module), $routes, PREG_SET_ORDER);
    foreach ($routes as [, $method, $pattern]) {
        if (access($method, $pattern) === 'superadmin') {
            $superadminOnly[] = strtoupper($method) . ' ' . $pattern;
        }
    }
}
sort($superadminOnly);
$expectedSuperadminOnly = [
    'DELETE /adminphone',
    'GET /configuration/allowexternalsips',
    'GET /configuration/externalip',
    'GET /configuration/localnetworks',
    'GET /configuration/mode',
    'GET /configuration/suggestedip',
    'GET /configuration/userprovider',
    'GET /devices/{mac}/brand',
    'GET /final',
    'GET /login',
    'GET /migration/cdr',
    'GET /migration/cdrrowcount',
    'GET /migration/ismigration',
    'GET /migration/migrationstatus',
    'GET /migration/oldusers',
    'GET /migration/report',
    'GET /users/{username}/password',
    'POST /configuration/allowexternalsips/{status:enabled|disabled}',
    'POST /configuration/externalip/{ip}',
    'POST /configuration/localnetworks',
    'POST /configuration/wizard',
    'POST /cti/customer_card/template',
    'POST /devices/scan',
    'POST /migration/announcements',
    'POST /migration/cdr',
    'POST /migration/cqr',
    'POST /migration/daynight',
    'POST /migration/endmigration',
    'POST /migration/gateways',
    'POST /migration/groups',
    'POST /migration/iax',
    'POST /migration/importoldvoiptrunks',
    'POST /migration/importoutboundroutes',
    'POST /migration/importprofiles',
    'POST /migration/importusers',
    'POST /migration/inboundroutes',
    'POST /migration/ivr',
    'POST /migration/migrationstatus',
    'POST /migration/postmigration',
    'POST /migration/queues',
    'POST /migration/recordings',
    'POST /migration/timeconditions',
    'POST /migration/timegroups',
    'POST /migration/trunksroutesassignements',
    'POST /testauth',
    'PUT /cti/customer_card/template/{name}',
];
check($superadminOnly === $expectedSuperadminOnly, "superadmin-only routes changed:\n" . implode("\n", array_diff($superadminOnly, $expectedSuperadminOnly)) . "\n--\n" . implode("\n", array_diff($expectedSuperadminOnly, $superadminOnly)));

$app = AppFactory::create();
$app->setBasePath('/freepbx/rest');
$ok = fn($req, $res) => $res->withStatus(200);
foreach (['/trunks', '/trunks/{trunkid}', '/migration/report', '/settings/defaultlanguage', '/users/{all}', '/users/{username}/password', '/adminphone', '/adminphone/session', '/physicalextensions/{mac}', '/cti/customer_card/template', '/cti/customer_card/template/{name}'] as $pattern) {
    $app->map(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], $pattern, $ok);
}
require $rest . '/modules/authentication.php';
$app->add(new PermissionMiddleware($app->getResponseFactory()));
$app->addRoutingMiddleware();
$app->add(new AuthMiddleware('server-secret', $app->getResponseFactory()));
$app->addErrorMiddleware(false, false, false);
$factory = new ServerRequestFactory();

function call($app, $factory, $user, $method, $path) {
    $request = $factory->createServerRequest($method, '/freepbx/rest' . $path);
    if ($user !== null) {
        $request = $request->withHeader('User', $user)->withHeader('Secretkey', sha1($user . sha1($user) . 'server-secret'));
    }
    return $app->handle($request);
}

function status($app, $factory, $user, $method, $path) {
    return call($app, $factory, $user, $method, $path)->getStatusCode();
}

foreach (['admin', 'boss'] as $user) {
    foreach ([['GET', '/migration/report'], ['PATCH', '/trunks/1'], ['GET', '/users/bob/password'], ['POST', '/users/bob/password'], ['DELETE', '/adminphone'], ['POST', '/settings/defaultlanguage']] as [$method, $path]) {
        check(status($app, $factory, $user, $method, $path) === 200, "$user must bypass section checks on $method $path");
    }
}

$me = call($app, $factory, 'admin', 'GET', '/me');
check($me->getStatusCode() === 200, '/me must answer the administrator');
check(json_decode((string) $me->getBody(), true) === ['username' => 'admin', 'permissions' => ['superadmin']], '/me must return the administrator permissions');
$me = call($app, $factory, 'mixed', 'GET', '/me');
check(json_decode((string) $me->getBody(), true) === ['username' => 'mixed', 'permissions' => ['users', 'phones']], '/me must return the granted sections');

check(status($app, $factory, 'dash', 'GET', '/trunks') === 200, 'lookups must be open to every administrator');
check(status($app, $factory, 'dash', 'GET', '/users/false') === 200, 'the users lookup must be open to every administrator');
check(status($app, $factory, 'dash', 'POST', '/adminphone/session') === 200, 'every administrator must get the administrator phone');
check(status($app, $factory, 'dash', 'DELETE', '/adminphone') === 403, 'removing the administrator phone is reserved to superadmin');
$denied = call($app, $factory, 'dash', 'PATCH', '/trunks/1');
check($denied->getStatusCode() === 403, 'a missing section must be denied');
check(json_decode((string) $denied->getBody(), true) === ['message' => 'Forbidden: missing permission'], 'a denied route must explain why');
check(status($app, $factory, 'dash', 'GET', '/migration/report') === 403, 'unmapped routes must be reserved to superadmin');
check(status($app, $factory, 'dash', 'GET', '/login') === 403, 'the FreePBX session is reserved to superadmin');
check(status($app, $factory, 'mixed', 'PATCH', '/physicalextensions/AA-BB') === 200, 'phones may be changed from the users section');
check(status($app, $factory, 'mixed', 'PATCH', '/trunks/1') === 403, 'users and phones must not reach trunks');

check(status($app, $factory, 'setter', 'POST', '/settings/defaultlanguage') === 200, 'settings must reach settings');
check(status($app, $factory, 'setter', 'POST', '/users/setter/password') === 200, 'an administrator may change his own password');
check(status($app, $factory, 'setter', 'POST', '/users/SETTER/password') === 200, 'the own password check must ignore case');
check(status($app, $factory, 'setter', 'POST', '/users/admin/password') === 403, 'an administrator must not change other passwords');
check(status($app, $factory, 'setter', 'GET', '/users/setter/password') === 403, 'reading passwords is reserved to superadmin');
check(status($app, $factory, 'mixed', 'POST', '/users/mixed/password') === 403, 'the own password needs the settings section');

check(status($app, $factory, 'integrator', 'GET', '/cti/customer_card/template') === 200, 'integrations must read the customer card templates');
check(status($app, $factory, 'integrator', 'DELETE', '/cti/customer_card/template/base') === 200, 'integrations must delete the customer card templates');
check(status($app, $factory, 'integrator', 'POST', '/cti/customer_card/template') === 403, 'writing a customer card template is reserved to superadmin');
check(status($app, $factory, 'integrator', 'PUT', '/cti/customer_card/template/base') === 403, 'changing a customer card template is reserved to superadmin');
check(status($app, $factory, 'boss', 'PUT', '/cti/customer_card/template/base') === 200, 'superadmin must change the customer card templates');

$request = (new ServerRequestFactory())->createServerRequest('GET', '/');
check(!nethvoiceRequestIsSuperadmin($request) && !nethvoiceRequestHasSection($request, 'users'), 'a request without permissions must grant nothing');
$sectioned = $request->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, ['dashboard', 'users']);
check(!nethvoiceRequestIsSuperadmin($sectioned), 'sections must not grant superadmin');
check(nethvoiceRequestHasSection($sectioned, 'users') && !nethvoiceRequestHasSection($sectioned, 'phones'), 'only the granted sections must be reported');
$superadmin = $request->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, ['superadmin']);
check(nethvoiceRequestIsSuperadmin($superadmin) && nethvoiceRequestHasSection($superadmin, 'phones'), 'superadmin must have every section');
$forbidden = nethvoiceForbidden((new Slim\Psr7\Factory\ResponseFactory())->createResponse());
check($forbidden->getStatusCode() === 403 && json_decode((string) $forbidden->getBody(), true) === ['message' => 'Forbidden: missing permission'], 'handlers must deny like the middleware');

foreach (['wildcard', 'star', 'legacy', 'ghost'] as $user) {
    $response = call($app, $factory, $user, 'GET', '/me');
    check($response->getStatusCode() === 403, "$user must not authenticate");
    check(json_decode((string) $response->getBody(), true) === ['error' => 'Forbidden: invalid user'], "$user must be rejected as an invalid user");
}
check(status($app, $factory, null, 'GET', '/me') === 403, '/me requires credentials');

echo "PASS: REST section permissions, lookups, own password, superadmin bypass and default deny\n";
