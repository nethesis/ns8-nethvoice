<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require __DIR__ . '/../var/www/html/freepbx/rest/lib/libPhonebook.php';

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

function missingTable(): PDOException {
    $e = new PDOException('Base table or view not found');
    $e->errorInfo = ['42S02', 1146, 'Base table or view not found'];
    return $e;
}

class MissingTableDatabase extends PDO {
    public function __construct() { parent::__construct('sqlite::memory:'); }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false { throw missingTable(); }
    public function prepare(string $query, array $options = []): PDOStatement|false { throw missingTable(); }
}

function database(): PDO {
    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE sync_status (sid TEXT PRIMARY KEY, status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, imported INTEGER, message TEXT)');
    $db->exec('CREATE TABLE rest_phonebook_imports (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, owner TEXT NOT NULL, filename TEXT, type TEXT NOT NULL, total INTEGER NOT NULL, imported INTEGER NOT NULL, skipped INTEGER NOT NULL, failed INTEGER NOT NULL)');
    return $db;
}

check(phonebookTestCommand('/tmp/a b.json', false) === "timeout -s ALRM -k 10 60 /usr/share/phonebooks/phonebook-import --check --error-json '/tmp/a b.json'", 'test command changed');
check(phonebookTestCommand('/tmp/a.json', true) === "timeout -s ALRM -k 10 60 /usr/share/phonebooks/phonebook-import --check --error-json --with-total '/tmp/a.json'", 'total not requested');
check(phonebookTestCommand('/tmp/a.json', false, true) === "timeout -s ALRM -k 10 60 /usr/share/phonebooks/phonebook-import --check --error-json --guard-addresses '/tmp/a.json'", 'test of a limited admin not guarded');
check(phonebookTestCommand('/tmp/a.json', true, false) === "timeout -s ALRM -k 10 60 /usr/share/phonebooks/phonebook-import --check --error-json --with-total '/tmp/a.json'", 'test of the superadmin guarded');

$csvSource = ['url' => 'https://node.example.org/qa.csv', 'mapping' => ['name' => 'name'], 'dbtype' => 'csv', 'type' => 'QA'];
check(phonebookGuardedSource($csvSource, null, true) === $csvSource, 'new source of the superadmin marked');
check(phonebookGuardedSource($csvSource, null, false) === $csvSource + ['guard_addresses' => true], 'new source of a limited admin not marked');
check(phonebookGuardedSource($csvSource + ['guard_addresses' => true], null, true) === $csvSource, 'marker taken from the request');
check(phonebookGuardedSource($csvSource, $csvSource + ['guard_addresses' => true], true) === $csvSource, 'save of the superadmin does not clear the marker');
check(phonebookGuardedSource($csvSource, $csvSource, false) === $csvSource, 'limited admin edit of a superadmin source with the same URL marked');
check(phonebookGuardedSource($csvSource, $csvSource + ['guard_addresses' => true], false) === $csvSource + ['guard_addresses' => true], 'limited admin edit cleared the marker');
check(phonebookGuardedSource(['url' => 'https://other.example.org/qa.csv'] + $csvSource, $csvSource, false)['guard_addresses'] === true, 'limited admin URL change not marked');
check(phonebookGuardedSource(['dbtype' => 'infinity'] + $csvSource, $csvSource, false)['guard_addresses'] === true, 'limited admin type change not marked');
$dbSource = ['host' => 'crm.example.org', 'port' => '3306', 'dbname' => 'crm', 'dbtype' => 'mysql', 'type' => 'QA'];
check(phonebookGuardedSource($dbSource, null, false)['guard_addresses'] === true, 'new database source of a limited admin not marked');
check(phonebookGuardedSource($dbSource, $dbSource, false) === $dbSource, 'limited admin edit of a superadmin database source with the same host marked');
check(phonebookGuardedSource(['host' => 'other.example.org'] + $dbSource, $dbSource, false)['guard_addresses'] === true, 'limited admin host change not marked');
check(phonebookGuardedSource(['host' => 'other.example.org'] + $dbSource, $dbSource, true) === ['host' => 'other.example.org'] + $dbSource, 'host change of the superadmin marked');
check(phonebookPublicSource((object) ($csvSource + ['guard_addresses' => true])) == (object) $csvSource, 'marker listed');
check(phonebookPublicSource($csvSource + ['guard_addresses' => true]) === $csvSource, 'marker listed from an array');
$stored = (object) ($csvSource + ['guard_addresses' => true]);
phonebookPublicSource($stored);
check($stored->guard_addresses === true, 'listing changed the stored source');

check(phonebookSyncCommand('custom_1', false) === "timeout -s ALRM -k 10 900 /usr/share/phonebooks/phonebook-import '/etc/phonebook/sources.d/custom_1.json'", 'sync command of the previous wizard changed');
check(phonebookSyncCommand('custom_1', true) === "timeout -s ALRM -k 10 900 /usr/share/phonebooks/phonebook-import --force '/etc/phonebook/sources.d/custom_1.json'", 'force not passed');

$rows = '[{"name":"Ada","1":"x"},{"name":"Bob"},{"name":"Cy"},{"name":"Di"}]';
check(json_encode(phonebookTestResult(0, [$rows], false)) === '[{"name":"Ada","1":"x"},{"name":"Bob"},{"name":"Cy"}]', 'rows not returned as an array of three');
check(json_encode(phonebookTestResult(0, ['[{}]'], false)) === '[{}]', 'empty row not kept as an object');
check(phonebookTestResult(0, ['{"rows":[],"total":0}'], false) === ['status' => false], 'object accepted without with_total');
check(phonebookTestResult(0, [], false) === ['status' => false], 'missing output accepted');
check(json_encode(phonebookTestResult(0, ['{"rows":' . $rows . ',"total":1234}'], true)) === '{"rows":[{"name":"Ada","1":"x"},{"name":"Bob"},{"name":"Cy"}],"total":1234}', 'total not returned');
check(phonebookTestResult(0, [$rows], true) === ['status' => false], 'array accepted with with_total');
check(phonebookTestResult(0, ['{"rows":[],"total":"3"}'], true) === ['status' => false], 'total that is not an integer accepted');

check(phonebookTestResult(1, [], false) === ['status' => false], 'failure without cause changed');
check(phonebookTestResult(1, ['{"kind":"auth","details":"1045 (28000): Access denied"}'], true) === ['status' => false, 'error' => ['kind' => 'auth', 'details' => '1045 (28000): Access denied']], 'cause not returned');
check(phonebookTestResult(1, ['noise', '{"kind":"query","details":"bad"}'], false)['error']['kind'] === 'query', 'cause not read from the last line');
check(phonebookTestResult(1, ['{"kind":"disk","details":"x"}'], false) === ['status' => false], 'unknown kind accepted');
check(phonebookTestResult(1, ['{"kind":"http"}'], false) === ['status' => false], 'cause without details accepted');
foreach ([124, 137] as $status) {
    check(phonebookTestResult($status, [], false) === ['status' => false, 'error' => ['kind' => 'connection', 'details' => 'The source did not answer within 60 seconds']], "time limit ($status) not reported");
}
check(phonebookTestResult(124, ['{"kind":"connection","details":"The source did not answer within the time limit"}'], false)['error']['details'] === 'The source did not answer within the time limit', 'cause of the importer replaced');
check(phonebookTestResult(2, [], false) === ['status' => false], 'other failures reported as a time limit');
check(mb_strlen(phonebookTestResult(1, [json_encode(['kind' => 'http', 'details' => str_repeat('é', 600)])], false)['error']['details']) === 500, 'details not capped');

check(phonebookIsoTime('2026-11-23 08:05:09') === '2026-11-23T08:05:09Z', 'datetime not read as UTC');
check(phonebookIsoTime(1795421109) === gmdate('Y-m-d\TH:i:s\Z', 1795421109), 'unix time not formatted');
check(phonebookIsoTime(null) === null && phonebookIsoTime('') === null, 'missing time not null');

$db = database();
$db->exec("INSERT INTO sync_status VALUES ('custom_2', 'running', '2026-11-23 08:00:00', NULL, NULL, NULL)");
$db->exec("INSERT INTO sync_status VALUES ('custom_1', 'failed', '2026-11-23 07:00:00', '2026-11-23 07:00:03', NULL, 'Could not resolve host: csv.example.org')");
$db->exec("INSERT INTO sync_status VALUES ('custom_3', 'ok', '2026-11-23 06:00:00', '2026-11-23 06:01:00', '42', NULL)");
check(phonebookSyncStatuses($db) === [
    ['id' => 'custom_1', 'status' => 'failed', 'started_at' => '2026-11-23T07:00:00Z', 'finished_at' => '2026-11-23T07:00:03Z', 'imported' => null, 'message' => 'Could not resolve host: csv.example.org'],
    ['id' => 'custom_2', 'status' => 'running', 'started_at' => '2026-11-23T08:00:00Z', 'finished_at' => null, 'imported' => null, 'message' => null],
    ['id' => 'custom_3', 'status' => 'ok', 'started_at' => '2026-11-23T06:00:00Z', 'finished_at' => '2026-11-23T06:01:00Z', 'imported' => 42, 'message' => null],
], 'sync statuses not listed');
$restarted = phonebookSyncStatuses($db, strtotime('2026-11-23 08:30:00 UTC'));
check($restarted[1]['status'] === 'failed' && $restarted[1]['message'] === 'The sync was interrupted', 'sync running before the container start still running');
check($restarted[0]['status'] === 'failed' && $restarted[0]['message'] === 'Could not resolve host: csv.example.org' && $restarted[2]['status'] === 'ok', 'finished syncs changed by the container start');
check(phonebookSyncStatuses($db, strtotime('2026-11-23 07:30:00 UTC'))[1]['status'] === 'running', 'sync started after the container start not running');
$marker = tempnam(sys_get_temp_dir(), 'qa_started_');
touch($marker, 1795400000);
check(phonebookContainerStartedAt($marker) === 1795400000, 'container start time not read');
unlink($marker);
check(phonebookContainerStartedAt($marker) === null, 'missing container start time not null');
phonebookDeleteSyncStatus($db, 'custom_2');
check(array_column(phonebookSyncStatuses($db), 'id') === ['custom_1', 'custom_3'], 'sync status not deleted');
check(phonebookSyncStatuses(new MissingTableDatabase()) === [], 'missing status table not empty');
phonebookDeleteSyncStatus(new MissingTableDatabase(), 'custom_1');
$broken = new PDO('sqlite::memory:');
$broken->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try {
    phonebookSyncStatuses($broken);
    check(false, 'database error hidden');
} catch (PDOException $e) {
}

check(phonebookImportFilename('contacts.csv') === 'contacts.csv', 'file name changed');
check(phonebookImportFilename('C:\\Users\\qa\\contacts 2026.csv') === 'contacts 2026.csv', 'path kept in file name');
check(phonebookImportFilename('  ') === null && phonebookImportFilename(null) === null && phonebookImportFilename(['a']) === null, 'invalid file name kept');
check(mb_strlen(phonebookImportFilename(str_repeat('à', 300) . '.csv')) === 255, 'file name not capped');

$db = database();
phonebookRecordImport($db, 'qa_owner', 'first.csv', 'public', ['message' => 'phonebook import completed', 'total_rows' => 5, 'imported_rows' => 3, 'failed_rows' => 1, 'skipped_rows' => 1], 1795400000);
phonebookRecordImport($db, 'qa_owner', null, 'group:Sales,Support', ['total_rows' => 2, 'imported_rows' => 2], 1795500000);
phonebookRecordImport($db, 'qa_owner', 'ignored.csv', 'public', null, 1795600000);
check(phonebookImports($db) === [
    ['id' => 2, 'created_at' => gmdate('Y-m-d\TH:i:s\Z', 1795500000), 'owner' => 'qa_owner', 'filename' => null, 'type' => 'group:Sales,Support', 'total' => 2, 'imported' => 2, 'skipped' => 0, 'failed' => 0],
    ['id' => 1, 'created_at' => gmdate('Y-m-d\TH:i:s\Z', 1795400000), 'owner' => 'qa_owner', 'filename' => 'first.csv', 'type' => 'public', 'total' => 5, 'imported' => 3, 'skipped' => 1, 'failed' => 1],
], 'imports not listed newest first');
phonebookRecordImport(new MissingTableDatabase(), 'qa_owner', 'a.csv', 'public', ['total_rows' => 1], 1795400000);
check(phonebookImports(new MissingTableDatabase()) === [], 'missing imports table not empty');

$uploads = sys_get_temp_dir() . '/qa_pb_uploads_' . uniqid() . '/';
mkdir($uploads);
$upload = function (string $name) use ($uploads): string { file_put_contents($uploads . $name, "name\nQA\n"); return $name; };
$unused = fn(string $path): bool => false;
$used = fn(string $path): bool => $path === $uploads . '6b04063270758.csv';
check(phonebookDeleteUpload($upload('6b04076a92b81.csv'), $unused, $uploads) === 'deleted' && !is_file($uploads . '6b04076a92b81.csv'), 'unused upload not deleted');
check(phonebookDeleteUpload($upload('6b04063270758.csv'), $used, $uploads) === 'in_use' && is_file($uploads . '6b04063270758.csv'), 'upload of a saved source deleted');
check(phonebookDeleteUpload('6b04076a92b82.csv', $unused, $uploads) === 'missing', 'missing upload not reported');
file_put_contents($uploads . '../qa_outside.csv', 'x');
symlink($uploads . '../qa_outside.csv', $uploads . '6b04076a92b83.csv');
check(phonebookDeleteUpload('6b04076a92b83.csv', $unused, $uploads) === 'missing' && is_file($uploads . '../qa_outside.csv'), 'link out of the uploads followed');
unlink($uploads . '6b04076a92b83.csv');
unlink($uploads . '../qa_outside.csv');
foreach (['../qa_outside.csv', '6b04076a92b8.csv', '6B04076A92B81.csv', '6b04076a92b81.txt', '6b04076a92b81.csv/', '', '.csv', 'contacts.csv'] as $name) {
    check(phonebookDeleteUpload($name, $unused, $uploads) === 'invalid', 'invalid name accepted: ' . $name);
}
check(phonebookDeleteImportedUpload(200, 'file://' . $uploads . $upload('6b04076a92b84.csv'), $unused, $uploads) === 'deleted' && !is_file($uploads . '6b04076a92b84.csv'), 'imported upload kept');
check(phonebookDeleteImportedUpload(207, 'file://' . $uploads . '6b04063270758.csv', $used, $uploads) === 'in_use' && is_file($uploads . '6b04063270758.csv'), 'imported upload of a saved source deleted');
check(phonebookDeleteImportedUpload(500, 'file://' . $uploads . $upload('6b04076a92b85.csv'), $unused, $uploads) === null && is_file($uploads . '6b04076a92b85.csv'), 'upload deleted after a failed import');
check(phonebookDeleteImportedUpload(200, 'file:///etc/passwd', $unused, $uploads) === 'invalid', 'file out of the uploads accepted');
array_map('unlink', glob($uploads . '*'));
rmdir($uploads);

echo "phonebook sources tests passed\n";
