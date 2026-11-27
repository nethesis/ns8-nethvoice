<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// A display name changed in the account provider reaches the labels of the phone keys that point to the user's main extension.

if (!function_exists('_')) { function _($value) { return $value; } }

interface BMO {}
class FreePBX_Helpers {}

class FreePBX {
    public static ?PDO $pdo = null;
    public static function Database() { return self::$pdo; }
}

require __DIR__ . '/../var/www/html/freepbx/admin/modules/nethcti3/Nethcti3.class.php';
require __DIR__ . '/../var/www/html/freepbx/rest/lib/libPhoneKeyLabels.php';

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class MysqlDialectPdo extends PDO {
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $query = str_replace(
            ['REPLACE INTO `sip` SET `id` = ?, `keyword` = "callerid", `data` = ?', '`keyword` = "callerid"'],
            ["REPLACE INTO `sip` (`id`, `keyword`, `data`) VALUES (?, 'callerid', ?)", "`keyword` = 'callerid'"],
            $query
        );
        return parent::prepare($query, $options);
    }
}

class FakeAstman {
    public array $values = [];
    public function database_get($family, $key) { return $this->values[$family . '/' . $key] ?? false; }
    public function database_put($family, $key, $value) { $this->values[$family . '/' . $key] = $value; return true; }
}

class FakeUserman {
    public array $users = [];
    public function getUserByID($id) { return $this->users[$id] ?? null; }
}

class FakeTancredi {
    public array $reads = [];
    public array $writes = [];
    public bool $unreachable = false;

    public function __construct(public array $scopes) {}

    public function get($path) {
        $this->reads[] = $path;
        if ($this->unreachable) throw new RuntimeException('Connection refused');
        return $this->scopes[$path];
    }

    public function getMany(array $paths) {
        $results = [];
        foreach ($paths as $path) {
            $this->reads[] = $path;
            $results[$path] = $this->scopes[$path] ?? null;
        }
        return $results;
    }

    public function patch($path, array $body) {
        $this->writes[] = [$path, $body];
        $this->scopes[$path]['variables'] = array_merge($this->scopes[$path]['variables'], $body['variables']);
    }
}

class TestNethcti3 extends \FreePBX\modules\Nethcti3 {
    public function __construct($freepbx, $client) {
        parent::__construct($freepbx);
        $this->phoneKeyLabelsClient = $client;
    }
}

function scopes(): array {
    return [
        'phones' => [['mac' => 'AA-BB-CC-00-00-01']],
        'models' => [['name' => 'yealink-T46S-Reception']],
        'phones/AA-BB-CC-00-00-01' => ['variables' => [
            'linekey_type_1' => 'blf', 'linekey_value_1' => '201', 'linekey_label_1' => 'Alice Rossi',
            'linekey_type_2' => 'blf', 'linekey_value_2' => '202', 'linekey_label_2' => 'Bruno Verdi',
        ]],
        'models/yealink-T46S-Reception' => ['variables' => [
            'expkey_type_3' => 'blf', 'expkey_value_3' => '201', 'expkey_label_3' => 'Alice Rossi',
        ]],
    ];
}

function freepbx(string $displayname): object {
    $db = new MysqlDialectPdo('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE users (extension TEXT PRIMARY KEY, name TEXT NOT NULL)');
    $db->exec('CREATE TABLE sip (id TEXT NOT NULL, keyword TEXT NOT NULL, data TEXT, PRIMARY KEY (id, keyword))');
    $db->exec('CREATE TABLE rest_devices_phones (user_id INTEGER, extension TEXT)');
    $db->exec("INSERT INTO users VALUES ('201', 'Alice Rossi'), ('91201', 'Alice Rossi')");
    $db->exec("INSERT INTO sip VALUES ('201', 'callerid', 'Alice Rossi <201>'), ('91201', 'callerid', 'Alice Rossi <201>')");
    $db->exec("INSERT INTO rest_devices_phones VALUES (7, '91201')");
    $astman = new FakeAstman();
    $astman->values = ['AMPUSER/201/cidname' => 'Alice Rossi', 'AMPUSER/91201/cidname' => 'Alice Rossi'];
    $userman = new FakeUserman();
    $userman->users[7] = ['id' => 7, 'username' => 'qa_alice', 'displayname' => $displayname, 'default_extension' => '201'];
    return (object) ['Database' => $db, 'astman' => $astman, 'Userman' => $userman];
}

$log = tempnam(sys_get_temp_dir(), 'qa_key_labels_log_');
ini_set('error_log', $log);
putenv('TANCREDIPORT');
unset($_ENV['NETHVOICESECRETKEY']);
putenv('NETHVOICESECRETKEY');

$freepbx = freepbx('Alice Bianchi');
$tancredi = new FakeTancredi(scopes());
check((new TestNethcti3($freepbx, $tancredi))->usermanUpdateUser(7, 'userman', []) === true, 'renamed user not synchronized');
check($tancredi->writes === [
    ['phones/AA-BB-CC-00-00-01', ['variables' => ['linekey_label_1' => 'Alice Bianchi']]],
    ['models/yealink-T46S-Reception', ['variables' => ['expkey_label_3' => 'Alice Bianchi']]],
], 'labels not updated: ' . json_encode($tancredi->writes));
check($tancredi->scopes['phones/AA-BB-CC-00-00-01']['variables']['linekey_label_2'] === 'Bruno Verdi', 'label of another extension changed');
check($freepbx->Database->query("SELECT name FROM users WHERE extension = '201'")->fetchColumn() === 'Alice Bianchi', 'extension name not updated');

$tancredi = new FakeTancredi(scopes());
check((new TestNethcti3($freepbx, $tancredi))->usermanUpdateUser(7, 'userman', []) === false, 'unchanged user reported as changed');
check($tancredi->reads === [] && $tancredi->writes === [], 'Tancredi called for an unchanged display name: ' . json_encode($tancredi->reads));

$long = str_repeat('é', 60);
$freepbx = freepbx($long);
$tancredi = new FakeTancredi(scopes());
check((new TestNethcti3($freepbx, $tancredi))->usermanUpdateUser(7, 'userman', []) === true, 'long display name not synchronized');
check(count($tancredi->writes) === 2 && $tancredi->writes[0][1]['variables']['linekey_label_1'] === $long, 'labels not set to the full display name');
$tancredi = new FakeTancredi(scopes());
(new TestNethcti3($freepbx, $tancredi))->usermanUpdateUser(7, 'userman', []);
check($tancredi->reads === [], 'Tancredi called again for a display name longer than the extension name');

$freepbx = freepbx('');
$tancredi = new FakeTancredi(scopes());
(new TestNethcti3($freepbx, $tancredi))->usermanUpdateUser(7, 'userman', []);
check($tancredi->reads === [], 'labels cleared for an empty display name');

$freepbx = freepbx('Alice Bianchi');
$freepbx->Userman->users[8] = ['id' => 8, 'username' => 'qa_noext', 'displayname' => 'No Extension', 'default_extension' => 'none'];
$tancredi = new FakeTancredi(scopes());
check((new TestNethcti3($freepbx, $tancredi))->usermanUpdateUser(8, 'userman', []) === false && $tancredi->reads === [], 'user without extension touched Tancredi');

$freepbx = freepbx('Alice Bianchi');
$tancredi = new FakeTancredi(scopes());
$tancredi->unreachable = true;
check((new TestNethcti3($freepbx, $tancredi))->usermanUpdateUser(7, 'userman', []) === true, 'sync failed with Tancredi unreachable');
check($freepbx->Database->query("SELECT name FROM users WHERE extension = '201'")->fetchColumn() === 'Alice Bianchi', 'extension name not updated with Tancredi unreachable');
check($freepbx->astman->values['AMPUSER/201/cidname'] === 'Alice Bianchi', 'AstDB name not updated with Tancredi unreachable');
check(str_contains(file_get_contents($log), 'Phone key labels of extension 201 not fully updated'), 'Tancredi failure not logged');

$freepbx = freepbx('Alice Bianchi');
check((new TestNethcti3($freepbx, null))->usermanUpdateUser(7, 'userman', []) === true, 'sync failed without Tancredi credentials');
check(str_contains(file_get_contents($log), 'Missing Tancredi credentials'), 'missing credentials not logged');

FreePBX::$pdo = new PDO('sqlite::memory:');
FreePBX::$pdo->exec("CREATE TABLE ampusers (username TEXT, password_sha1 TEXT)");
FreePBX::$pdo->exec("INSERT INTO ampusers VALUES ('admin', 'hash')");
$restConfig = tempnam(sys_get_temp_dir(), 'qa_rest_config_');
file_put_contents($restConfig, '<?php $config = ["settings" => ["secretkey" => "qa-secret", "tancredi_port" => "20999"]];');
$client = new TancrediKeyLabelsClient($restConfig);
$url = (new ReflectionProperty($client, 'url'))->getValue($client);
$headers = (new ReflectionProperty($client, 'headers'))->getValue($client);
check($url === 'http://127.0.0.1:20999/tancredi/api/v1/', 'Tancredi port not read from the REST configuration: ' . $url);
check(in_array('SecretKey: ' . sha1('adminhashqa-secret'), $headers, true), 'secret not read from the REST configuration');
unlink($restConfig);
unlink($log);

$removals = [];
$orphaned = [];
function userRemovalPrepared($uid, $username) { return in_array([$uid, $username], $GLOBALS['removals'], true); }
function orphanUserExtensions($uid, $user) { $GLOBALS['orphaned'][] = [$uid, $user['username'] ?? null]; return true; }
$display = ini_set('display_errors', '0');
$hook = new TestNethcti3($freepbx, null);
check($hook->usermanDelUser(7, 'userman', ['username' => 'qa_alice', 'default_extension' => '201']) === true && $orphaned === [], 'a user removed outside the admin interface lost the extensions');
$removals[] = [7, 'qa_alice'];
check($hook->usermanDelUser(8, 'userman', ['username' => 'qa_alice']) === true && $orphaned === [], 'the removal mark of another user was used');
check($hook->usermanDelUser(7, 'userman', ['username' => 'qa_alice', 'default_extension' => '201']) === true && $orphaned === [[7, 'qa_alice']], 'a user removed from the admin interface kept the extensions');
ini_set('display_errors', (string) $display);

echo "PASS: display name changes update the phone key labels of the main extension\n";
