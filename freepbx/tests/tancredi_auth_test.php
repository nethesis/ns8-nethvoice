<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check which administrator sections may use the Tancredi API.

require __DIR__ . '/../var/www/html/freepbx/rest/vendor/autoload.php';
require __DIR__ . '/../../tancredi/usr/share/tancredi/src/Entity/NethVoiceAuth.php';

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\StreamFactory;
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

function request($factory, $user, $method, $path, $secret = null, $body = null, $type = 'application/json') {
    $request = $factory->createServerRequest($method, 'http://localhost/tancredi/api/v1' . $path);
    if ($user !== null) {
        $request = $request->withHeader('User', $user)->withHeader('Secretkey', $secret ?? sha1($user . sha1($user) . 'tancredi-secret'));
    }
    if ($body !== null) {
        $request = $request->withHeader('Content-Type', $type)->withBody((new StreamFactory())->createStream(is_string($body) ? $body : json_encode($body)));
    }
    return $request;
}

$phone = '{"mac":"AC-CD-EF-01-02-03","tok1":"t1","tok2":"t2","variables":{"account_password_1":"sip-1","account_password_12":"sip-12","account_username_1":"201","adminpw":"web-admin","userpw":"web-user","ldap_password":"ldap-secret","nested":{"account_password_3":"sip-3"},"url":"https://pbx/a"},"model_url":"/tancredi/api/v1/models/fanvil-X5","provisioning_url1":"https://pbx/provisioning/t1/x.cfg","provisioning_url2":"https://pbx/provisioning/t2/x.cfg"}';
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
    $response = $auth->process(request($factory, $user, 'GET', $user === 'phoner' ? '/phones/AC-CD-EF-01-02-03' : '/phones'), new FixedHandler($phone));
    check($response->getStatusCode() === 200, "$user must read the phone");
    $data = json_decode((string) $response->getBody(), true);
    check(!preg_match('/account_password|sip-/', (string) $response->getBody()), "$user received a SIP line password");
    check(!preg_match('/ldap_password|ldap-secret/', (string) $response->getBody()), "$user received the LDAP phonebook password");
    check($data['variables']['account_username_1'] === '201' && $data['model_url'] === '/tancredi/api/v1/models/fanvil-X5', "$user lost other phone fields");
    check(str_contains((string) $response->getBody(), '"nested":{}'), 'an emptied object must stay an object');
    check(str_contains((string) $response->getBody(), '"url":"https://pbx/a"'), 'the response must keep the Tancredi JSON flags');

    $response = $auth->process(request($factory, $user, 'GET', '/models'), new FixedHandler($list));
    check((string) $response->getBody() === '[{"name":"fanvil-X5","variables":{"ldap_server":"x"}},{"name":"empty","variables":{}}]', "$user received a SIP line password in a list");

    $response = $auth->process(request($factory, $user, 'GET', '/defaults'), new FixedHandler('{"account_password_1":"d","adminpw":"a","userpw":"u","ldap_password":"l","ldap_user":"cn=x"}'));
    check((string) $response->getBody() === ($user === 'phoner' ? '{"adminpw":"a","userpw":"u","ldap_user":"cn=x"}' : '{"ldap_user":"cn=x"}'), "$user received a secret of another section in the defaults: " . $response->getBody());

}
$response = $auth->process(request($factory, 'phoner', 'GET', '/firmware/x.bin'), new FixedHandler('binary account_password_1', 'application/octet-stream'));
check((string) $response->getBody() === 'binary account_password_1', 'a non JSON response must not change');

$data = json_decode((string) $auth->process(request($factory, 'phoner', 'GET', '/phones/AC-CD-EF-01-02-03'), new FixedHandler($phone))->getBody(), true);
check($data['variables']['adminpw'] === 'web-admin' && $data['variables']['userpw'] === 'web-user', 'the phones section lost the phone web passwords');
check(!array_intersect(['tok1', 'tok2', 'provisioning_url1', 'provisioning_url2'], array_keys($data)), 'the phones section received the provisioning tokens or URLs');
foreach (['/phones/AC-CD-EF-01-02-03?inherit=1', '/phones', '/phones/AC-CD-EF-01-02-03'] as $path) {
    $body = (string) $auth->process(request($factory, 'phoner', 'GET', $path), new FixedHandler(str_starts_with($path, '/phones/') ? $phone : '[' . $phone . ']'))->getBody();
    check(!preg_match('/tok1|tok2|provisioning_url|"t1"|"t2"|\/provisioning\//', $body), "the phones section received a provisioning token or URL from $path: $body");
}
$body = (string) $auth->process(request($factory, 'userer', 'GET', '/phones'), new FixedHandler($phone))->getBody();
check(!preg_match('/adminpw|userpw|web-admin|web-user|tok1|tok2|provisioning_url|"t1"|"t2"/', $body), "the users section received the phone web passwords or provisioning tokens: $body");
$body = (string) $auth->process(request($factory, 'userer', 'GET', '/phones'), new FixedHandler('[' . $phone . ']'))->getBody();
check(!str_contains($body, 'web-admin') && !str_contains($body, '/provisioning/'), 'the users section received a secret in a list');

foreach ([
    ['phoner', 'PATCH', '/defaults', ['adminpw' => 'New-Admin-1!', 'userpw' => 'New-User-1!', 'language' => 'it'], 200],
    ['phoner', 'PATCH', '/defaults', ['ldap_password' => 'stolen'], 403],
    ['phoner', 'PATCH', '/models/fanvil-X5', ['variables' => ['ldap_server' => '192.0.2.5', 'ldap_password' => 'x']], 403],
    ['phoner', 'POST', '/phones', ['mac' => 'AC-CD-EF-01-02-04', 'model' => 'fanvil-X5', 'variables' => ['adminpw' => 'Phone-Admin-1!']], 200],
    ['userer', 'PATCH', '/phones/AC-CD-EF-01-02-03', ['model' => 'fanvil-X5'], 403],
    ['phoner', 'PATCH', '/phones/AC-CD-EF-01-02-03', ['model' => 'fanvil-X5'], 200],
    ['phoner', 'PATCH', '/phones/AC-CD-EF-01-02-03', ['tok1' => 'chosen'], 403],
    ['phoner', 'PATCH', '/phones/AC-CD-EF-01-02-03', ['provisioning_url1' => 'https://evil.example.org/x.cfg'], 403],
    ['phoner', 'PATCH', '/defaults', ['hostname' => 'evil.example.org'], 403],
    ['phoner', 'PATCH', '/models/fanvil-X5', ['variables' => ['outbound_proxy_1' => 'evil.example.org']], 403],
    ['phoner', 'PATCH', '/models/fanvil-X5', ['variables' => ['outbound_proxy2_3' => 'evil.example.org']], 403],
    ['phoner', 'POST', '/phones', ['mac' => 'AC-CD-EF-01-02-04', 'model' => 'fanvil-X5', 'variables' => ['hostname' => 'evil.example.org']], 403],
    ['phoner', 'PATCH', '/phones/AC-CD-EF-01-02-03', ['variables' => ['lcd_logo_url' => 'https://evil.example.org/logo.png']], 403],
    ['phoner', 'PATCH', '/models/fanvil-X5', ['variables' => ['ldap_server' => '192.0.2.5', 'ntp_server' => 'ntp.example.org', 'firmware_file' => 'x.bin', 'outbound_proxy_port_1' => '5061']], 200],
    ['phoner', 'POST', '/models', ['name' => 'fanvil-X5-custom', 'variables' => ['provisioning_url_filename' => '{mac}.cfg', 'language' => 'it']], 200],
    ['phoner', 'POST', '/phones/AC-CD-EF-01-02-03/tok1', null, 403],
    ['phoner', 'POST', '/firmware', null, 200],
    ['phoner', 'DELETE', '/models/fanvil-X5-custom', null, 200],
    ['admin', 'PATCH', '/defaults', ['hostname' => 'pbx.example.org', 'outbound_proxy_1' => 'proxy.example.org', 'lcd_logo_url' => 'https://pbx.example.org/logo.png'], 200],
    ['boss', 'POST', '/phones/AC-CD-EF-01-02-03/tok1', null, 200],
    ['userer', 'PATCH', '/phones/AC-CD-EF-01-02-03', ['variables' => ['adminpw' => 'x']], 403],
    ['userer', 'POST', '/phones', ['mac' => 'AC-CD-EF-01-02-04', 'model' => 'fanvil-X5', 'variables' => ['userpw' => 'x']], 403],
    ['userer', 'PATCH', '/models/fanvil-X5', ['variables' => ['nested' => ['ldap_password' => 'x']]], 403],
    ['userer', 'POST', '/phones', 'mac=AC-CD-EF-01-02-04&variables%5Badminpw%5D=x', 403, 'application/x-www-form-urlencoded'],
    ['userer', 'POST', '/phones', '{"mac":"AC-CD-EF-01-02-04","variables":{"userpw":"x"}}', 403, 'application/vnd.example+json'],
    ['admin', 'PATCH', '/defaults', ['ldap_password' => 'new', 'adminpw' => 'new'], 200],
    ['boss', 'PATCH', '/models/fanvil-X5', ['variables' => ['ldap_password' => 'new']], 200],
] as $case) {
    [$user, $method, $path, $body, $expected] = $case;
    $handler = new FixedHandler('{}');
    $status = $auth->process(request($factory, $user, $method, $path, null, $body, $case[5] ?? 'application/json'), $handler)->getStatusCode();
    check($status === $expected && $handler->calls === ($expected === 200 ? 1 : 0), "$user $method $path " . json_encode($body) . ": expected $expected, got $status");
}
$handler = new FixedHandler('{}');
$parsed = request($factory, 'userer', 'POST', '/phones')->withParsedBody(['mac' => 'AC-CD-EF-01-02-04', 'variables' => ['adminpw' => 'x']]);
check($auth->process($parsed, $handler)->getStatusCode() === 403 && $handler->calls === 0, 'a secret in a parsed form body must be refused');

$handler = new FixedHandler('');
check($auth->process(request($factory, 'phoner', 'PATCH', '/defaults'), $handler)->getStatusCode() === 200 && $handler->calls === 1, 'the phones section must change the defaults');
foreach (['/defaults', '/defaults/', '/%64efaults', '/phones/defaults', '/models/defaults', '//defaults'] as $path) {
    foreach (['PATCH', 'POST', 'PUT', 'DELETE'] as $method) {
        $handler = new FixedHandler('');
        $response = $auth->process(request($factory, 'userer', $method, $path), $handler);
        check($response->getStatusCode() === 403 && $handler->calls === 0, "the users section must not $method $path");
    }
}
foreach ([['GET', '/phones'], ['GET', '/phones/'], ['HEAD', '/phones'], ['GET', '/models'], ['GET', '/defaults'], ['GET', '/macvendors'], ['GET', '/phones?inherit=1']] as [$method, $path]) {
    $handler = new FixedHandler('{}');
    check($auth->process(request($factory, 'userer', $method, $path), $handler)->getStatusCode() === 200 && $handler->calls === 1, "the users section must $method $path");
}
foreach ([
    ['PATCH', '/phones/AC-CD-EF-01-02-03'], ['POST', '/phones'], ['DELETE', '/phones/AC-CD-EF-01-02-03'], ['PATCH', '/phones'],
    ['POST', '/models'], ['PATCH', '/models/fanvil-X5'], ['DELETE', '/models/fanvil-X5'], ['POST', '/phones/AC-CD-EF-01-02-03/tok1'],
    ['POST', '/firmware'], ['DELETE', '/firmware/x.bin'], ['POST', '/backgrounds'], ['DELETE', '/ringtones/x.wav'], ['POST', '/screensavers'],
    ['GET', '/phones/AC-CD-EF-01-02-03'], ['GET', '/phones/AC-CD-EF-01-02-03?inherit=1'], ['GET', '/models/fanvil-X5'], ['GET', '/firmware'],
    ['GET', '/phones/../defaults/x'], ['GET', '/models/../phones/AC-CD-EF-01-02-03'], ['POST', '/%70hones'],
] as [$method, $path]) {
    $handler = new FixedHandler('{}');
    check($auth->process(request($factory, 'userer', $method, $path), $handler)->getStatusCode() === 403 && $handler->calls === 0, "the users section must not $method $path");
}

foreach ([['dash', null], ['ghost', null], ['phoner', 'wrong']] as [$user, $secret]) {
    $handler = new FixedHandler('{}');
    check($auth->process(request($factory, $user, 'GET', '/phones', $secret), $handler)->getStatusCode() === 403 && $handler->calls === 0, "$user must not reach Tancredi");
}

$handler = new FixedHandler($phone);
$static = $factory->createServerRequest('GET', 'http://localhost/tancredi/api/v1/phones/AC-CD-EF-01-02-03')
    ->withHeader('Authentication', 'static static-token')->withHeader('HTTP_HOST', '127.0.0.1');
check((string) $auth->process($static, $handler)->getBody() === $phone, 'the static token must read the phone unchanged');

echo "PASS: Tancredi access, SIP line passwords hidden from sections, LDAP password, provisioning tokens and URLs and phone redirection variables only for the superadmin, phone web passwords only for the phones section, the users section only reads the phones, models and defaults\n";
