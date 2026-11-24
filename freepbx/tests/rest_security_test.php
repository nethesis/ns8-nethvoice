<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check the URL restrictions of the server side fetches and the redaction of secrets in the responses.

require __DIR__ . '/../var/www/html/freepbx/rest/lib/libSecurity.php';

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

foreach (['127.0.0.1', '127.8.9.10', '0.0.0.0', '0.1.2.3', '169.254.169.254', '::1', '::', 'fe80::1', 'febf::1', '::ffff:127.0.0.1', '::ffff:169.254.1.1', '::127.0.0.1', 'not-an-ip', ''] as $address) {
    check(nethvoiceIsForbiddenAddress($address), "$address must be forbidden");
}
foreach (['192.168.1.10', '10.0.0.1', '172.16.0.1', '8.8.8.8', '2001:db8::1', 'fc00::1', 'fec0::1', '::ffff:192.168.1.1'] as $address) {
    check(!nethvoiceIsForbiddenAddress($address), "$address must be allowed");
}

foreach (['file:///etc/passwd', 'gopher://192.0.2.1/', 'dict://192.0.2.1:11211/', 'ftp://192.0.2.1/a', 'http://a\\@192.0.2.1/', "http://192.0.2.1/a b", "http://192.0.2.1/\r\nHost: x", '//192.0.2.1/', 'http:///a', '', null, ['http://192.0.2.1/']] as $url) {
    check(nethvoiceParseFetchUrl($url) === null, 'unsupported URL accepted: ' . json_encode($url));
}
$target = nethvoiceParseFetchUrl('HTTP://Camera.Example.org:8080/snap?size=1#frame');
check($target['scheme'] === 'http' && $target['host'] === 'camera.example.org' && $target['port'] === 8080, 'URL parts not normalized');
check($target['url'] === 'http://camera.example.org:8080/snap?size=1', 'URL not rebuilt from the checked parts');
$target = nethvoiceParseFetchUrl('https://user:pass@[2001:db8::1]/snap');
check($target['host'] === '2001:db8::1' && $target['port'] === 443 && $target['url'] === 'https://user:pass@[2001:db8::1]/snap', 'IPv6 URL not rebuilt');

foreach (['http://127.0.0.1/', 'http://localhost:8080/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data', 'http://0.0.0.0/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://0x7f.1/', 'https://nethvoice.invalid/', 'file:///etc/passwd'] as $url) {
    check(nethvoiceCheckFetchUrl($url) === null, "$url must not be fetched");
    check(nethvoiceFetchUrl($url) === null, "$url must not be fetched");
}
check(nethvoiceCheckFetchUrl('http://192.0.2.10/snapshot.jpg')['addresses'] === ['192.0.2.10'], 'public address refused');
check(nethvoiceCheckFetchUrl('https://192.168.5.20:8443/csv')['addresses'] === ['192.168.5.20'], 'LAN address refused');
check(nethvoiceCheckFetchUrl('http://192.0.2.10/snapshot.jpg', ['http', 'https'], ['192.0.2.10']) === null, 'an address of the node was fetched');
check(nethvoiceCheckFetchUrl('http://192.0.2.10/snapshot.jpg', ['http', 'https'], ['::ffff:192.0.2.10']) === null, 'an IPv4 mapped address of the node was fetched');
check(nethvoiceCheckFetchUrl('http://[2001:db8::10]:20094/', ['http', 'https'], ['2001:db8::10']) === null, 'an IPv6 address of the node was fetched');
check(nethvoiceCheckFetchUrl('http://192.0.2.11/snapshot.jpg', ['http', 'https'], ['192.0.2.10'])['addresses'] === ['192.0.2.11'], 'an address outside the node refused');
foreach (nethvoiceNodeAddresses() as $address) {
    $url = 'http://' . (str_contains($address, ':') ? "[$address]" : $address) . ':20094/';
    check(nethvoiceCheckFetchUrl($url) === null, "$url of this node must not be fetched");
    check(nethvoiceFetchUrl($url) === null, "$url of this node must not be fetched");
}

check(nethvoicePhonebookUrlAllowed('mysql', null, [], false), 'database sources have no URL');
check(nethvoicePhonebookUrlAllowed('csv', 'file:///var/lib/nethvoice/phonebook/uploads/a.csv', [], true), 'uploaded CSV refused');
check(!nethvoicePhonebookUrlAllowed('csv', 'file:///etc/passwd', [], false), 'local file accepted');
check(!nethvoicePhonebookUrlAllowed('csv', 'http://127.0.0.1:8080/a.csv', [], false), 'loopback CSV accepted');
check(nethvoicePhonebookUrlAllowed('csv', 'https://192.0.2.5/a.csv', [], false), 'remote CSV refused');
check(nethvoicePhonebookUrlAllowed('csv', 'file:///var/lib/old/a.csv', ['file:///var/lib/old/a.csv'], false), 'configured URL refused');
check(!nethvoicePhonebookUrlAllowed('csv', null, [], false), 'missing URL accepted');
check(nethvoicePhonebookUrlAllowed('infinity', '192.0.2.7/servlet', [], false), 'Infinity address without scheme refused');
check(!nethvoicePhonebookUrlAllowed('infinity', 'localhost', [], false), 'Infinity on loopback accepted');
check(!nethvoicePhonebookUrlAllowed('infinity', 'ftp://192.0.2.7', [], false), 'Infinity over FTP accepted');

$node = ['127.0.0.1', '::1', 'fe80::1%eth0', '198.51.100.7', '2001:DB8:0::7', 'not-an-ip'];
foreach (['198.51.100.7', ' 198.51.100.7 ', '::ffff:198.51.100.7', '[2001:db8::7]', '2001:db8:0:0:0:0:0:7'] as $host) {
    check(nethvoiceIsLocalHost($host, $node), "$host of the node not local");
}
check(nethvoiceIsLocalHost('198.51.100.7', ['::ffff:198.51.100.7']), 'IPv4 mapped node address not local');
foreach (['198.51.100.8', '2001:db8::8', '192.0.2.9'] as $host) {
    check(!nethvoiceIsLocalHost($host, $node), "$host outside the node local");
}
check(!nethvoiceIsLocalHost('198.51.100.7', []), 'address local without node addresses');
check(nethvoiceIsLocalHost('127.0.0.1', []) && nethvoiceIsLocalHost('localhost', []), 'loopback not local without node addresses');
check(in_array('127.0.0.1', nethvoiceNodeAddresses(), true), 'node addresses not read from the interfaces');
foreach (nethvoiceNodeAddresses() as $address) {
    check(nethvoiceIsLocalHost($address), "$address of this node not local");
}

$users = [
    ['id' => 1, 'username' => 'alice', 'password' => 'clear', 'devices' => [
        ['id' => 3, 'extension' => '91201', 'secret' => 's', 'web_user' => 'admin', 'web_password' => 'w', 'mac' => 'AA'],
    ]],
    ['id' => 2, 'username' => 'bob', 'password' => null, 'devices' => []],
    ['id' => 4, 'username' => 'carol'],
];
check(nethvoiceWithoutUserSecrets($users) === [
    ['id' => 1, 'username' => 'alice', 'devices' => [['id' => 3, 'extension' => '91201', 'mac' => 'AA']]],
    ['id' => 2, 'username' => 'bob', 'devices' => []],
    ['id' => 4, 'username' => 'carol'],
], 'secrets left in the users list');

$phones = [
    ['model' => 'custom', 'lines' => [['extension' => '91201', 'secret' => 's', 'web_user' => 'admin', 'web_password' => 'w', 'username' => 'alice']]],
    ['mac' => 'AA', 'lines' => [(object) ['extension' => '91202', 'secret' => 's2', 'status' => 'Idle']]],
    ['mac' => 'BB', 'lines' => []],
    ['mac' => 'CC'],
];
$redacted = nethvoiceWithoutLineSecrets($phones);
check($redacted[0]['lines'][0] === ['extension' => '91201', 'username' => 'alice'], 'secrets left in a custom line');
check($redacted[1]['lines'][0] == (object) ['extension' => '91202', 'status' => 'Idle'], 'secret left in a scanned line');
check(isset($phones[1]['lines'][0]->secret), 'original line object changed');
check($redacted[2] === ['mac' => 'BB', 'lines' => []] && $redacted[3] === ['mac' => 'CC'], 'phones without lines changed');
check(!preg_match('/secret|web_|"s2?"|"w"/', json_encode($redacted)), 'secret value left in the phones list');

$connections = [
    ['id' => 1, 'host' => 'db', 'pass' => 'stored'],
    ['id' => 2, 'host' => 'db2', 'pass' => ''],
    ['id' => 3, 'host' => 'db3'],
];
check(nethvoiceWithoutStoredPasswords($connections, 'pass') === [
    ['id' => 1, 'host' => 'db', 'has_password' => true],
    ['id' => 2, 'host' => 'db2', 'has_password' => false],
    ['id' => 3, 'host' => 'db3', 'has_password' => false],
], 'database connection password not redacted');
check(nethvoiceWithoutStoredPasswords($connections, 'pass', true)[0] === ['id' => 1, 'host' => 'db', 'pass' => 'stored', 'has_password' => true], 'password not kept when asked');

$sources = ['custom_1' => (object) ['dbtype' => 'mysql', 'password' => 'pw', 'mapping' => new stdClass()], 'custom_2' => (object) ['dbtype' => 'csv', 'url' => 'https://192.0.2.5/a.csv']];
$redacted = nethvoiceWithoutStoredPasswords($sources, 'password');
check(json_encode($redacted) === '{"custom_1":{"dbtype":"mysql","mapping":{},"has_password":true},"custom_2":{"dbtype":"csv","url":"https:\/\/192.0.2.5\/a.csv","has_password":false}}', 'phonebook source password not redacted');
check($sources['custom_1']->password === 'pw', 'original source object changed');

$stored = ['host' => 'crm.example.com', 'port' => '3306', 'type' => 'mysql', 'user' => 'crm', 'pass' => 'stored'];
$targets = ['host', 'port', 'type'];
check(nethvoiceKeepStoredPassword(['host' => 'crm.example.com', 'pass' => 'new'], $stored, 'pass', $targets) === ['host' => 'crm.example.com', 'pass' => 'new'], 'typed password replaced');
check(nethvoiceKeepStoredPassword(['host' => 'crm.example.com', 'port' => '3306', 'pass' => ''], $stored, 'pass', $targets) === ['host' => 'crm.example.com', 'port' => '3306', 'pass' => 'stored'], 'empty password did not keep the stored one');
check(nethvoiceKeepStoredPassword(['user' => 'other'], $stored, 'pass', $targets) === ['user' => 'other', 'pass' => 'stored'], 'omitted password did not keep the stored one');
check(nethvoiceKeepStoredPassword(['host' => ' crm.example.com ', 'pass' => null], $stored, 'pass', $targets)['pass'] === 'stored', 'trimmed host seen as a different server');
check(nethvoiceKeepStoredPassword(['host' => 'attacker.example.org', 'pass' => ''], $stored, 'pass', $targets) === null, 'stored password sent to a different host');
check(nethvoiceKeepStoredPassword(['port' => '3307'], $stored, 'pass', $targets) === null, 'stored password sent to a different port');
check(nethvoiceKeepStoredPassword(['type' => 'postgres'], $stored, 'pass', $targets) === null, 'stored password sent to a different type');
check(nethvoiceKeepStoredPassword(['host' => 'attacker.example.org', 'pass' => 'typed'], $stored, 'pass', $targets) === ['host' => 'attacker.example.org', 'pass' => 'typed'], 'typed password refused for a new host');
check(nethvoiceKeepStoredPassword(['host' => 'new', 'pass' => ''], null, 'pass', $targets) === ['host' => 'new'], 'empty password kept without a stored connection');
check(nethvoiceKeepStoredPassword(['host' => 'new', 'pass' => ''], ['pass' => ''], 'pass', $targets) === ['host' => 'new'], 'empty stored password blocked a new host');
check(nethvoiceKeepStoredPassword(['pass' => 1234], $stored, 'pass', $targets) === ['pass' => 1234], 'numeric password replaced');
check(nethvoiceKeepStoredPassword(['pass' => ['x']], $stored, 'pass', $targets) === ['pass' => 'stored'], 'non scalar password stored');
check(nethvoiceKeepStoredPassword(['dbtype' => 'infinity', 'url' => 'https://crm.example.com', 'password' => ''], ['dbtype' => 'infinity', 'url' => 'https://crm.example.com', 'password' => 'api'], 'password', ['dbtype', 'url'])['password'] === 'api', 'Infinity password not kept');
check(nethvoiceKeepStoredPassword(['dbtype' => 'infinity', 'url' => 'https://evil.example.org', 'password' => ''], ['dbtype' => 'infinity', 'url' => 'https://crm.example.com', 'password' => 'api'], 'password', ['dbtype', 'url']) === null, 'Infinity password sent to a different URL');

echo "PASS: server side fetch URL restrictions, users list, phone lines and stored passwords redaction\n";
