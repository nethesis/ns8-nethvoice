<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check the URL restrictions of the server side fetches and the redaction of the users list.

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

echo "PASS: server side fetch URL restrictions and users list redaction\n";
