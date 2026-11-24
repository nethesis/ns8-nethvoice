<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the query that picks the phones whose Tancredi account is released on reload against an in-memory database.

require __DIR__ . '/../var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php';

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE userman_users (id INTEGER PRIMARY KEY)');
$db->exec('CREATE TABLE devices (id TEXT)');
$db->exec('CREATE TABLE rest_devices_phones (id INTEGER PRIMARY KEY, user_id INTEGER, mac TEXT, extension TEXT, type TEXT)');
$db->exec("INSERT INTO userman_users (id) VALUES (1)");
$db->exec("INSERT INTO devices (id) VALUES ('91201'), ('91202'), ('91203'), ('92203')");
$rows = [
    [1, 'AA:BB:CC:00:00:01', '91201'],
    [7, 'AA:BB:CC:00:00:02', '91202'],
    [null, 'AA:BB:CC:00:00:03', '91203'],
    [null, 'AA:BB:CC:00:00:04', null],
    [null, 'AA:BB:CC:00:00:05', ''],
    [7, 'AA:BB:CC:00:00:06', '91206'],
    [null, null, '92203'],
];
$insert = $db->prepare("INSERT INTO rest_devices_phones (user_id, mac, extension, type) VALUES (?, ?, ?, 'physical')");
foreach ($rows as $row) { $insert->execute($row); }

$macs = nethcti3_unassigned_phone_macs($db);
sort($macs);

check(!in_array('AA:BB:CC:00:00:01', $macs, true), 'the phone of a configured user was released');
check(!in_array('AA:BB:CC:00:00:02', $macs, true), 'the phone of a user removed from the domain lost its account, while its extension still exists');
check(!in_array('AA:BB:CC:00:00:03', $macs, true), 'a phone whose extension still exists lost its account');
check(in_array('AA:BB:CC:00:00:04', $macs, true), 'a phone released by the delete flow kept its account');
check(in_array('AA:BB:CC:00:00:05', $macs, true), 'a phone with an empty extension kept its account');
check(in_array('AA:BB:CC:00:00:06', $macs, true), 'a phone whose extension was deleted kept its account');
check($macs === ['AA:BB:CC:00:00:04', 'AA:BB:CC:00:00:05', 'AA:BB:CC:00:00:06'], 'unexpected released phones: ' . json_encode($macs));

$db->exec("INSERT INTO rest_devices_phones (user_id, mac, extension, type) VALUES (NULL, 'AA:BB:CC:00:00:04', '91202', 'physical')");
check(!in_array('AA:BB:CC:00:00:04', nethcti3_unassigned_phone_macs($db), true), 'a phone with one line still in use was released');

$db->exec('DELETE FROM rest_devices_phones');
foreach ([
    [1, 'aa-bb-cc-00-00-07', '91201'],
    [null, 'AA:BB:CC:00:00:07', null],
    [null, 'AA-BB-CC-00-00-08', ''],
    [null, 'aa:bb:cc:00:00:08', ''],
] as $row) { $insert->execute($row); }
check(nethcti3_unassigned_phone_macs($db) === ['AA:BB:CC:00:00:08'], 'the MAC address format changed which phones are released: ' . json_encode(nethcti3_unassigned_phone_macs($db)));

echo "PASS: only phones without an existing extension are released, whatever the MAC address format\n";
