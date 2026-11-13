<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the real helpers that keep, restore and delete the extensions of removed users against an in-memory PBX.

namespace FreePBX\modules\Userman\Auth {
    class Fake {
        public static array $failFor = [];
        public function __construct($userman, $freepbx, $config) {}
        public function updateUser($uid, $prevUsername, $username, $defaultExtension, ...$rest) {
            if (in_array($username, self::$failFor, true)) {
                return ['status' => false, 'message' => 'directory error'];
            }
            \Pbx::$users[$uid]['default_extension'] = $defaultExtension;
            return ['status' => true];
        }
    }
}

namespace {
    function check($condition, $message) {
        if (!$condition) throw new RuntimeException($message);
    }

    class Pbx {
        public static array $users = [];
        public static array $devices = [];
        public static array $groups = [];
        public static array $profiles = [];
        public static array $extensions = [];
        public static array $secrets = [];
        public static array $mailboxes = [];
        public static array $orphans = [];
        public static array $astdb = [];
        public static array $calls = [];
        public static int $nextOrphanId = 1;
        public static bool $orphanTable = true;

        public static function reset() {
            self::$users = [
                1 => ['id' => 1, 'username' => 'alice', 'displayname' => 'Alice Rossi', 'email' => 'alice@example.org', 'default_extension' => '201', 'auth' => 1],
                3 => ['id' => 3, 'username' => 'carol', 'displayname' => '', 'email' => '', 'default_extension' => 'none', 'auth' => 1],
                4 => ['id' => 4, 'username' => 'dave', 'displayname' => 'Dave Verdi', 'email' => '', 'default_extension' => '202', 'auth' => 1],
            ];
            self::$devices = [
                ['user_id' => 1, 'mac' => null, 'extension' => '92201', 'secret' => 's1', 'type' => 'webrtc'],
                ['user_id' => 1, 'mac' => 'AA:BB:CC:00:00:01', 'extension' => '91201', 'secret' => 's2', 'type' => 'physical'],
                ['user_id' => 1, 'mac' => null, 'extension' => '93201', 'secret' => 's3', 'type' => 'mobile'],
                ['user_id' => 4, 'mac' => 'AA:BB:CC:00:00:02', 'extension' => '91202', 'secret' => 's4', 'type' => 'physical'],
            ];
            self::$groups = [[1, 10], [1, 20], [4, 10]];
            self::$profiles = [1 => 3, 3 => 5, 4 => 3];
            self::$extensions = ['201', '91201', '92201', '93201', '202', '91202'];
            self::$secrets = ['201' => 'm201', '91201' => 's2', '92201' => 's1', '93201' => 's3', '202' => 'm202', '91202' => 's4'];
            self::$mailboxes = ['201' => ['name' => 'Alice Rossi', 'email' => 'alice@example.org', 'pwd' => '1234']];
            self::$orphans = [];
            self::$astdb = ['AMPUSER/201/device' => '201&91201&92201&93201'];
            self::$calls = [];
            self::$nextOrphanId = 1;
            self::$orphanTable = true;
            \FreePBX\modules\Userman\Auth\Fake::$failFor = [];
        }

        public static function removeUser($id) {
            $user = self::$users[$id];
            unset(self::$users[$id]);
            return $user;
        }

        public static function addUser($id, $username, $displayname = '') {
            self::$users[$id] = ['id' => $id, 'username' => $username, 'displayname' => $displayname, 'email' => '', 'default_extension' => 'none', 'auth' => 1];
            return self::$users[$id];
        }

        public static function userBy($field, $value) {
            foreach (self::$users as $user) {
                if ((string) $user[$field] === (string) $value) return $user;
            }
            return false;
        }

        public static function deviceIndexes(callable $match) {
            return array_keys(array_filter(self::$devices, $match));
        }

        public static function orphanBy($field, $value) {
            foreach (self::$orphans as $orphan) {
                if ((string) $orphan[$field] === (string) $value) return $orphan;
            }
            return false;
        }
    }

    class FakeStatement {
        private $result = [];
        public function __construct(private string $sql) {}
        public function execute($args = []) {
            $sql = $this->sql;
            $this->result = [];
            if (str_contains($sql, 'rest_orphan_extensions') && !Pbx::$orphanTable) {
                throw new PDOException('Table rest_orphan_extensions does not exist');
            }
            switch ($sql) {
                case 'SHOW TABLES LIKE ?':
                    $this->result = Pbx::$orphanTable ? [['table' => $args[0]]] : [];
                    break;
                case 'SELECT username FROM userman_users WHERE default_extension = ?':
                    $user = Pbx::userBy('default_extension', $args[0]);
                    $this->result = $user ? [['username' => $user['username']]] : [];
                    break;
                case 'UPDATE rest_devices_phones SET user_id = NULL, extension = NULL, secret = NULL WHERE extension = ?':
                    foreach (Pbx::deviceIndexes(fn($d) => $d['extension'] === $args[0]) as $i) {
                        Pbx::$devices[$i] = array_replace(Pbx::$devices[$i], ['user_id' => null, 'extension' => null, 'secret' => null]);
                    }
                    break;
                case 'DELETE FROM rest_devices_phones WHERE user_id IS NULL AND mac IS NULL':
                    Pbx::$devices = array_values(array_filter(Pbx::$devices, fn($d) => !($d['user_id'] === null && $d['mac'] === null)));
                    break;
                case 'DELETE FROM pin WHERE extension = ?':
                    break;
                case 'UPDATE rest_devices_phones SET user_id = NULL, extension = NULL, secret = NULL WHERE user_id = ? AND mac IS NOT NULL':
                    foreach (Pbx::deviceIndexes(fn($d) => $d['user_id'] === $args[0] && $d['mac'] !== null) as $i) {
                        Pbx::$devices[$i] = array_replace(Pbx::$devices[$i], ['user_id' => null, 'extension' => null, 'secret' => null]);
                    }
                    break;
                case 'DELETE FROM rest_devices_phones WHERE user_id = ? AND mac IS NULL':
                    Pbx::$devices = array_values(array_filter(Pbx::$devices, fn($d) => !($d['user_id'] === $args[0] && $d['mac'] === null)));
                    break;
                case 'DELETE FROM rest_cti_users_groups WHERE user_id = ?':
                    Pbx::$groups = array_values(array_filter(Pbx::$groups, fn($g) => $g[0] !== $args[0]));
                    break;
                case 'DELETE FROM rest_users WHERE user_id = ?':
                    unset(Pbx::$profiles[$args[0]]);
                    break;
                case 'UPDATE rest_devices_phones SET user_id = ? WHERE user_id = ?':
                    foreach (Pbx::deviceIndexes(fn($d) => $d['user_id'] === $args[1]) as $i) {
                        Pbx::$devices[$i]['user_id'] = $args[0];
                    }
                    break;
                case 'SELECT profile_id FROM rest_users WHERE user_id = ?':
                    $this->result = isset(Pbx::$profiles[$args[0]]) ? [['profile_id' => Pbx::$profiles[$args[0]]]] : [];
                    break;
                case 'INSERT INTO rest_users (user_id, profile_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE profile_id = VALUES(profile_id)':
                    Pbx::$profiles[$args[0]] = $args[1];
                    break;
                case 'SELECT group_id FROM rest_cti_users_groups WHERE user_id = ?':
                    foreach (Pbx::$groups as $g) {
                        if ($g[0] === $args[0]) $this->result[] = ['group_id' => $g[1]];
                    }
                    break;
                case 'INSERT IGNORE INTO rest_cti_users_groups (user_id, group_id) VALUES (?, ?)':
                    if (!in_array([$args[0], $args[1]], Pbx::$groups, true)) Pbx::$groups[] = [$args[0], $args[1]];
                    break;
                case 'SELECT extension FROM rest_devices_phones WHERE user_id = ? AND extension IS NOT NULL AND extension != ""':
                    foreach (Pbx::$devices as $d) {
                        if ($d['user_id'] === $args[0] && !empty($d['extension'])) $this->result[] = ['extension' => $d['extension']];
                    }
                    break;
                case 'SELECT extension, type, mac FROM rest_devices_phones WHERE user_id = ? AND extension IS NOT NULL AND extension != ""':
                    foreach (Pbx::$devices as $d) {
                        if ($d['user_id'] === $args[0] && !empty($d['extension'])) {
                            $this->result[] = ['extension' => $d['extension'], 'type' => $d['type'], 'mac' => $d['mac']];
                        }
                    }
                    break;
                case 'SELECT data FROM sip WHERE id = ? AND keyword = "secret"':
                    $this->result = isset(Pbx::$secrets[$args[0]]) ? [['data' => Pbx::$secrets[$args[0]]]] : [];
                    break;
                case 'REPLACE INTO sip SET id = ?, keyword = ?, data = ?':
                    check($args[1] === 'secret', 'unexpected sip keyword '.$args[1]);
                    Pbx::$secrets[$args[0]] = $args[2];
                    break;
                case 'SELECT id FROM rest_orphan_extensions WHERE extension = ?':
                    $orphan = Pbx::orphanBy('extension', $args[0]);
                    $this->result = $orphan ? [['id' => $orphan['id']]] : [];
                    break;
                case 'INSERT INTO rest_orphan_extensions (user_id, username, displayname, extension, devices, secrets, profile_id, cti_groups, removed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)':
                    check(Pbx::orphanBy('extension', $args[3]) === false, 'duplicate orphan extension');
                    Pbx::$orphans[] = array_combine(
                        ['id', 'user_id', 'username', 'displayname', 'extension', 'devices', 'secrets', 'profile_id', 'cti_groups', 'removed_at'],
                        array_merge([Pbx::$nextOrphanId++], $args)
                    );
                    break;
                case 'SELECT * FROM rest_orphan_extensions WHERE username = ? ORDER BY removed_at DESC, id DESC':
                    $rows = array_values(array_filter(Pbx::$orphans, fn($o) => $o['username'] === $args[0]));
                    usort($rows, fn($a, $b) => [$b['removed_at'], $b['id']] <=> [$a['removed_at'], $a['id']]);
                    $this->result = $rows;
                    break;
                case 'DELETE FROM rest_orphan_extensions WHERE id = ?':
                    Pbx::$orphans = array_values(array_filter(Pbx::$orphans, fn($o) => $o['id'] !== $args[0]));
                    break;
                case 'SELECT username, displayname, extension, devices, removed_at FROM rest_orphan_extensions ORDER BY removed_at DESC, extension':
                    $rows = Pbx::$orphans;
                    usort($rows, fn($a, $b) => [$b['removed_at'], $a['extension']] <=> [$a['removed_at'], $b['extension']]);
                    $this->result = array_map(fn($o) => array_intersect_key($o, array_flip(['username', 'displayname', 'extension', 'devices', 'removed_at'])), $rows);
                    break;
                case 'SELECT user_id, extension FROM rest_orphan_extensions WHERE extension = ?':
                    $orphan = Pbx::orphanBy('extension', $args[0]);
                    $this->result = $orphan ? [['user_id' => $orphan['user_id'], 'extension' => $orphan['extension']]] : [];
                    break;
                case 'DELETE FROM rest_orphan_extensions WHERE extension = ?':
                    Pbx::$orphans = array_values(array_filter(Pbx::$orphans, fn($o) => $o['extension'] !== $args[0]));
                    break;
                default:
                    throw new RuntimeException('Unexpected query: '.$sql);
            }
            return true;
        }
        public function fetch($mode = null) { return $this->result[0] ?? false; }
        public function fetchColumn() { return $this->result ? array_values($this->result[0])[0] : false; }
        public function fetchAll($mode = null) {
            return $mode === PDO::FETCH_COLUMN ? array_map(fn($row) => array_values($row)[0], $this->result) : $this->result;
        }
    }

    class FakeDatabase {
        public function prepare($sql) {
            return new FakeStatement(trim(preg_replace('/\s+/', ' ', str_replace('`', '', $sql))));
        }
    }

    class FakeCore {
        public function getAllUsers() { return array_map(fn($e) => ['extension' => $e], Pbx::$extensions); }
        public function delUser($extension) {
            Pbx::$extensions = array_values(array_diff(Pbx::$extensions, [$extension]));
            unset(Pbx::$mailboxes[$extension], Pbx::$secrets[$extension]);
        }
        public function delDevice($extension) {}
    }

    class FakeUserman {
        public function getUserByDefaultExtension($extension) { return Pbx::userBy('default_extension', $extension); }
        public function getUserByUsername($username) { return Pbx::userBy('username', $username); }
        public function getUserByID($id) { return Pbx::$users[$id] ?? false; }
        public function getAllDirectories() { return [['id' => 1, 'driver' => 'Fake', 'config' => []]]; }
    }

    class FakeVoicemail {
        public function getMailbox($extension, $cached = true) { return Pbx::$mailboxes[$extension] ?? null; }
        public function updateMailbox($extension, $mailbox, $cached = true) { Pbx::$mailboxes[$extension] = $mailbox; }
    }

    class FakeNethcti3 {
        public function setExtensionsDisplayName($extensions, $displayname, $mainextension) {
            Pbx::$calls[] = ['displayname', $extensions, $displayname, $mainextension];
            return true;
        }
    }

    class FakeAstman {
        public function database_get($family, $key) { return Pbx::$astdb[$family.'/'.$key] ?? false; }
        public function database_put($family, $key, $value) { Pbx::$astdb[$family.'/'.$key] = $value; return true; }
    }

    class FreePBX {
        public $Core;
        public $Userman;
        public $Voicemail;
        public function __construct() {
            $this->Core = new FakeCore();
            $this->Userman = new FakeUserman();
            $this->Voicemail = new FakeVoicemail();
        }
        public static function create() { return new self(); }
        public static function Database() { return new FakeDatabase(); }
        public static function Nethcti3() { return new FakeNethcti3(); }
    }

    $astman = new FakeAstman();
    $amp_conf = ['AMPWEBROOT' => '/nonexistent'];
    require __DIR__.'/../var/www/html/freepbx/rest/lib/libExtensions.php';

    $userDevices = fn($uid) => array_values(array_map(fn($d) => $d['extension'], array_filter(Pbx::$devices, fn($d) => $d['user_id'] === $uid)));
    $userGroups = fn($uid) => array_values(array_map(fn($g) => $g[1], array_filter(Pbx::$groups, fn($g) => $g[0] === $uid)));
    $aliceSecrets = ['201' => 'm201', '91201' => 's2', '92201' => 's1', '93201' => 's3'];
    $currentSecrets = fn() => array_intersect_key(Pbx::$secrets, $aliceSecrets);

    Pbx::reset();
    check(orphanUserExtensions(1, Pbx::removeUser(1)) === true, 'removed user not kept as orphan');
    check(Pbx::$extensions === ['201', '91201', '92201', '93201', '202', '91202'], 'extensions were deleted');
    check(isset(Pbx::$mailboxes['201']), 'voicemail was deleted');
    check($userDevices(1) === ['92201', '91201', '93201'], 'devices were detached or deleted');
    check(Pbx::$devices[1]['mac'] === 'AA:BB:CC:00:00:01' && Pbx::$devices[1]['secret'] === 's2', 'physical phone was freed');
    check(count(Pbx::$orphans) === 1, 'orphan not recorded');
    $orphan = Pbx::$orphans[0];
    check($orphan['user_id'] === 1 && $orphan['username'] === 'alice' && $orphan['displayname'] === 'Alice Rossi' && $orphan['extension'] === '201', 'orphan identity not recorded');
    check(json_decode($orphan['secrets'], true) === $aliceSecrets, 'original secrets not recorded');
    check($orphan['profile_id'] === 3 && json_decode($orphan['cti_groups'], true) === [10, 20], 'profile and groups not recorded');
    check(json_decode($orphan['devices'], true) === [
        ['extension' => '92201', 'type' => 'webrtc', 'mac' => null],
        ['extension' => '91201', 'type' => 'physical', 'mac' => 'AA:BB:CC:00:00:01'],
        ['extension' => '93201', 'type' => 'mobile', 'mac' => null],
    ], 'devices not recorded');
    foreach ($aliceSecrets as $extension => $secret) {
        check(Pbx::$secrets[$extension] !== $secret && strlen(Pbx::$secrets[$extension]) === 32, 'extension '.$extension.' can still register');
    }
    check(Pbx::$secrets['202'] === 'm202' && Pbx::$secrets['91202'] === 's4', 'another user lost credentials');
    check($userGroups(1) === [] && !isset(Pbx::$profiles[1]), 'groups or profile of the removed user kept');
    check($userGroups(4) === [10] && Pbx::$profiles[4] === 3, 'another user was changed');

    $listed = listOrphanExtensions();
    check(count($listed) === 1 && $listed[0]['username'] === 'alice' && $listed[0]['extension'] === '201', 'orphan not listed');
    check(count($listed[0]['devices']) === 3 && !isset($listed[0]['secrets']), 'listed orphan exposes secrets or misses devices');
    check(preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $listed[0]['removed_at']) === 1, 'removal date not in ISO 8601');

    $lockedSecrets = $currentSecrets();
    check(orphanUserExtensions(1, ['id' => 1, 'username' => 'alice', 'default_extension' => '201']) === true && count(Pbx::$orphans) === 1, 'second removal duplicated the orphan');
    check($currentSecrets() === $lockedSecrets && json_decode(Pbx::$orphans[0]['secrets'], true) === $aliceSecrets, 'second removal overwrote the original secrets');

    check(reattachOrphanExtension(Pbx::$users[4]) === false, 'user with an extension got the orphan');
    $bob = Pbx::addUser(2, 'bob', 'Bob');
    check(reattachOrphanExtension($bob) === false && count(Pbx::$orphans) === 1, 'orphan given to another username');

    $alice = Pbx::addUser(7, 'alice', 'Alice Rossi Nuova');
    \FreePBX\modules\Userman\Auth\Fake::$failFor = ['alice'];
    check(reattachOrphanExtension($alice) === false, 'failed directory update not reported');
    check($userDevices(1) === ['92201', '91201', '93201'] && $userDevices(7) === [] && count(Pbx::$orphans) === 1, 'failed restore not rolled back');
    \FreePBX\modules\Userman\Auth\Fake::$failFor = [];

    check(reattachOrphanExtension($alice) === '201', 'orphan not restored to the same username');
    check(Pbx::$users[7]['default_extension'] === '201', 'main extension not restored');
    check($userDevices(7) === ['92201', '91201', '93201'] && $userDevices(1) === [], 'devices not restored');
    check($currentSecrets() === $aliceSecrets, 'original secrets not restored');
    check($userGroups(7) === [10, 20] && Pbx::$profiles[7] === 3, 'groups or profile not restored');
    check(in_array(['displayname', ['201', '92201', '91201', '93201'], 'Alice Rossi Nuova', '201'], Pbx::$calls, true), 'display names not updated');
    check(Pbx::$mailboxes['201']['name'] === 'Alice Rossi Nuova' && Pbx::$mailboxes['201']['pwd'] === '1234', 'voicemail not kept for the new account');
    check(Pbx::$orphans === [], 'restored orphan not removed');

    Pbx::reset();
    Pbx::addUser(8, 'alice', 'Alice Rossi');
    $removed = Pbx::removeUser(1);
    check(orphanUserExtensions(1, $removed) === true, 'removal with a new account failed');
    check(Pbx::$users[8]['default_extension'] === '201' && $userDevices(8) === ['92201', '91201', '93201'], 'extension not moved to the new account of the same username');
    check(Pbx::$orphans === [] && $currentSecrets() === $aliceSecrets, 'new account of the same username left an orphan');

    Pbx::reset();
    Pbx::$profiles[5] = 4;
    Pbx::addUser(5, 'carol2');
    check(orphanUserExtensions(5, Pbx::removeUser(5)) === false, 'user without extension became an orphan');
    check(Pbx::$orphans === [] && !isset(Pbx::$profiles[5]) && count(Pbx::$extensions) === 6, 'removal of a user without extension changed extensions');

    Pbx::reset();
    orphanUserExtensions(1, Pbx::removeUser(1));
    check(releaseOrphanExtensions(['201', '999'])[1] === 404, 'unknown orphan accepted');
    check(count(Pbx::$orphans) === 1 && count(Pbx::$extensions) === 6, 'rejected release changed data');
    check(releaseOrphanExtensions(['201']) === true, 'release failed');
    check(Pbx::$extensions === ['202', '91202'], 'extensions of the removed user were kept');
    check(!isset(Pbx::$mailboxes['201']) && Pbx::$orphans === [], 'voicemail or orphan kept after release');
    $freed = array_values(array_filter(Pbx::$devices, fn($d) => $d['mac'] === 'AA:BB:CC:00:00:01'));
    check(count($freed) === 1 && $freed[0]['user_id'] === null && $freed[0]['extension'] === null && $freed[0]['secret'] === null, 'physical phone not freed');
    check($userDevices(1) === [] && $userDevices(4) === ['91202'], 'devices not cleaned');
    check(listOrphanExtensions() === [], 'released orphan still listed');

    Pbx::reset();
    Pbx::$orphanTable = false;
    $threw = false;
    try {
        orphanUserExtensions(1, Pbx::removeUser(1));
    } catch (PDOException $e) {
        $threw = true;
    }
    check($threw && count(Pbx::$extensions) === 6 && $currentSecrets() === $aliceSecrets && $userGroups(1) === [10, 20], 'missing table lost data');
    check(listOrphanExtensions() === [] && reattachOrphanExtension(Pbx::addUser(9, 'alice')) === false, 'missing table not tolerated');

    echo "PASS: extensions of removed users kept, locked, restored and deleted on request\n";
}
