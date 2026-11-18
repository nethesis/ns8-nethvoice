<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check which administrator sections may use the Tancredi API.

require __DIR__ . '/../var/www/html/freepbx/rest/vendor/autoload.php';
require __DIR__ . '/../../tancredi/usr/share/tancredi/src/Entity/NethVoiceAuth.php';

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tancredi\Entity\NethVoiceAuth;

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

foreach (['*', 'cdr;*', 'nethvoice:superadmin', 'nethvoice:phones', 'nethvoice:users', 'cdr; nethvoice:users ;nethvoice:bogus', 'nethvoice:dashboard;nethvoice:phones'] as $sections) {
    check(NethVoiceAuth::isPhonesAdministrator($sections), "$sections must reach Tancredi");
}
foreach (['', null, 'cdr*', 'nethvoice:*', 'nethvoice:dashboard', 'nethvoice:trunks;nethvoice:settings', 'cdr;queues', 'nethvoice:phonesx', 'xnethvoice:phones', 'NETHVOICE:PHONES'] as $sections) {
    check(!NethVoiceAuth::isPhonesAdministrator($sections), json_encode($sections) . ' must not reach Tancredi');
}
foreach (['*', 'cdr;*', 'nethvoice:superadmin', 'nethvoice:users; nethvoice:superadmin'] as $sections) {
    check(NethVoiceAuth::isSuperAdministrator($sections), "$sections must be a superadmin");
}
foreach (['nethvoice:phones', 'nethvoice:users', 'cdr*', 'nethvoice:*', ''] as $sections) {
    check(!NethVoiceAuth::isSuperAdministrator($sections), "$sections must not be a superadmin");
}

const USERS = [
    'admin' => '*',
    'boss' => 'nethvoice:superadmin',
    'phoner' => 'nethvoice:phones',
    'userer' => 'nethvoice:users',
    'dash' => 'nethvoice:dashboard',
];

class TestAuth extends NethVoiceAuth
{
    protected function findUser(string $username): array
    {
        return isset(USERS[$username]) ? [['username' => $username, 'password_sha1' => sha1($username), 'sections' => USERS[$username]]] : [];
    }
}

class FixedHandler implements RequestHandlerInterface
{
    public int $calls = 0;

    public function __construct(private string $body, private string $type = 'application/json')
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->calls++;
        $response = new Response(200);
        $response->getBody()->write($this->body);

        return $response->withHeader('Content-Type', $this->type);
    }
}

$auth = new TestAuth(['secret' => 'tancredi-secret', 'static_token' => 'static-token']);
$factory = new ServerRequestFactory();

function request($factory, $user, $method, $path, $secret = null) {
    $request = $factory->createServerRequest($method, 'http://localhost/tancredi/api/v1' . $path);
    if ($user !== null) {
        $request = $request->withHeader('User', $user)->withHeader('Secretkey', $secret ?? sha1($user . sha1($user) . 'tancredi-secret'));
    }
    return $request;
}

$phone = '{"mac":"AC-CD-EF-01-02-03","tok1":"t1","variables":{"account_password_1":"sip-1","account_password_12":"sip-12","account_username_1":"201","adminpw":"web-admin","userpw":"web-user","nested":{"account_password_3":"sip-3"},"url":"https://pbx/a"},"model_url":"/tancredi/api/v1/models/fanvil-X5"}';
$list = '[{"name":"fanvil-X5","variables":{"account_password_1":"m","ldap_server":"x"}},{"name":"empty","variables":{}}]';

foreach (['admin', 'boss'] as $user) {
    foreach ([$phone, $list] as $body) {
        $handler = new FixedHandler($body);
        $response = $auth->process(request($factory, $user, 'GET', '/phones/AC-CD-EF-01-02-03'), $handler);
        check($response->getStatusCode() === 200 && (string) $response->getBody() === $body, "$user must read the phone unchanged");
    }
    $handler = new FixedHandler('');
    check($auth->process(request($factory, $user, 'PATCH', '/defaults'), $handler)->getStatusCode() === 200 && $handler->calls === 1, "$user must change the defaults");
}

foreach (['phoner', 'userer'] as $user) {
    $response = $auth->process(request($factory, $user, 'GET', '/phones/AC-CD-EF-01-02-03'), new FixedHandler($phone));
    check($response->getStatusCode() === 200, "$user must read the phone");
    $data = json_decode((string) $response->getBody(), true);
    check(!preg_match('/account_password|sip-/', (string) $response->getBody()), "$user received a SIP line password");
    check($data['variables']['adminpw'] === 'web-admin' && $data['variables']['userpw'] === 'web-user', "$user lost the phone web passwords");
    check($data['variables']['account_username_1'] === '201' && $data['tok1'] === 't1', "$user lost other phone fields");
    check(str_contains((string) $response->getBody(), '"nested":{}'), 'an emptied object must stay an object');
    check(str_contains((string) $response->getBody(), '"url":"https://pbx/a"'), 'the response must keep the Tancredi JSON flags');

    $response = $auth->process(request($factory, $user, 'GET', '/models'), new FixedHandler($list));
    check((string) $response->getBody() === '[{"name":"fanvil-X5","variables":{"ldap_server":"x"}},{"name":"empty","variables":{}}]', "$user received a SIP line password in a list");

    $response = $auth->process(request($factory, $user, 'GET', '/defaults'), new FixedHandler('{"account_password_1":"d","adminpw":"a"}'));
    check((string) $response->getBody() === '{"adminpw":"a"}', "$user received a SIP line password in the defaults");

    $response = $auth->process(request($factory, $user, 'GET', '/firmware/x.bin'), new FixedHandler('binary account_password_1', 'application/octet-stream'));
    check((string) $response->getBody() === 'binary account_password_1', 'a non JSON response must not change');
}

$handler = new FixedHandler('');
check($auth->process(request($factory, 'phoner', 'PATCH', '/defaults'), $handler)->getStatusCode() === 200 && $handler->calls === 1, 'the phones section must change the defaults');
foreach (['/defaults', '/defaults/', '/%64efaults', '/phones/defaults', '/models/defaults', '//defaults'] as $path) {
    foreach (['PATCH', 'POST', 'PUT', 'DELETE'] as $method) {
        $handler = new FixedHandler('');
        $response = $auth->process(request($factory, 'userer', $method, $path), $handler);
        check($response->getStatusCode() === 403 && $handler->calls === 0, "the users section must not $method $path");
    }
}
foreach ([['PATCH', '/phones/AC-CD-EF-01-02-03'], ['POST', '/phones'], ['DELETE', '/phones/AC-CD-EF-01-02-03'], ['GET', '/defaults']] as [$method, $path]) {
    $handler = new FixedHandler('{}');
    check($auth->process(request($factory, 'userer', $method, $path), $handler)->getStatusCode() === 200 && $handler->calls === 1, "the users section must $method $path");
}

foreach ([['dash', null], ['ghost', null], ['phoner', 'wrong']] as [$user, $secret]) {
    $handler = new FixedHandler('{}');
    check($auth->process(request($factory, $user, 'GET', '/phones', $secret), $handler)->getStatusCode() === 403 && $handler->calls === 0, "$user must not reach Tancredi");
}

$handler = new FixedHandler($phone);
$static = $factory->createServerRequest('GET', 'http://localhost/tancredi/api/v1/phones/AC-CD-EF-01-02-03')
    ->withHeader('Authentication', 'static static-token')->withHeader('HTTP_HOST', '127.0.0.1');
check((string) $auth->process($static, $handler)->getBody() === $phone, 'the static token must read the phone unchanged');

echo "PASS: Tancredi access, SIP line passwords hidden from sections, defaults written only by the phones section\n";
