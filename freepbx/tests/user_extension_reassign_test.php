<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the real main extension reassign and release helpers against an in-memory PBX.

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
        public static array $mailboxes = [];
        public static array $astdb = [];
        public static array $calls = [];

        public static function reset() {
            self::$users = [
                1 => ['id' => 1, 'username' => 'alice', 'displayname' => 'Alice Rossi', 'email' => 'alice@example.org', 'default_extension' => '201', 'auth' => 1],
                2 => ['id' => 2, 'username' => 'bob', 'displayname' => 'Bob Bianchi', 'email' => 'bob@example.org', 'default_extension' => 'none', 'auth' => 1],
                3 => ['id' => 3, 'username' => 'carol', 'displayname' => '', 'email' => '', 'default_extension' => 'none', 'auth' => 1],
                4 => ['id' => 4, 'username' => 'dave', 'displayname' => 'Dave Verdi', 'email' => '', 'default_extension' => '202', 'auth' => 1],
            ];
            self::$devices = [
                ['user_id' => 1, 'mac' => null, 'extension' => '92201', 'secret' => 's1', 'type' => 'webrtc'],
                ['user_id' => 1, 'mac' => 'AA:BB:CC:00:00:01', 'extension' => '91201', 'secret' => 's2', 'type' => 'physical'],
                ['user_id' => 1, 'mac' => null, 'extension' => '93201', 'secret' => 's3', 'type' => 'mobile'],
                ['user_id' => 4, 'mac' => 'AA:BB:CC:00:00:02', 'extension' => '91202', 'secret' => 's4', 'type' => 'physical'],
                ['user_id' => null, 'mac' => 'AA:BB:CC:00:00:03', 'extension' => null, 'secret' => null, 'type' => 'physical'],
            ];
            self::$groups = [[1, 10], [2, 20], [4, 10]];
            self::$profiles = [1 => 3, 3 => 5];
            self::$extensions = ['201', '91201', '92201', '93201', '202', '91202'];
            self::$mailboxes = ['201' => ['name' => 'Alice Rossi', 'email' => 'alice@example.org', 'pwd' => '1234']];
            self::$astdb = ['AMPUSER/201/device' => '201&91201&92201&93201'];
            self::$calls = [];
            \FreePBX\modules\Userman\Auth\Fake::$failFor = [];
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
    }

    class FakeStatement {
        private $result = [];
        public function __construct(private string $sql) {}
        public function execute($args = []) {
            $sql = $this->sql;
            $this->result = [];
            switch ($sql) {
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
                case 'UPDATE rest_devices_phones SET user_id = ? WHERE user_id = ?':
                    foreach (Pbx::deviceIndexes(fn($d) => $d['user_id'] === $args[1]) as $i) {
                        Pbx::$devices[$i]['user_id'] = $args[0];
                    }
                    break;
                case 'INSERT IGNORE INTO rest_cti_users_groups (user_id, group_id) SELECT ?, group_id FROM rest_cti_users_groups WHERE user_id = ?':
                    foreach (Pbx::$groups as $g) {
                        if ($g[0] === $args[1] && !in_array([$args[0], $g[1]], Pbx::$groups, true)) Pbx::$groups[] = [$args[0], $g[1]];
                    }
                    break;
                case 'SELECT profile_id FROM rest_users WHERE user_id = ?':
                    $this->result = isset(Pbx::$profiles[$args[0]]) ? [['profile_id' => Pbx::$profiles[$args[0]]]] : [];
                    break;
                case 'SELECT extension FROM rest_devices_phones WHERE user_id = ? AND extension IS NOT NULL AND extension != ""':
                    foreach (Pbx::$devices as $d) {
                        if ($d['user_id'] === $args[0] && !empty($d['extension'])) $this->result[] = ['extension' => $d['extension']];
                    }
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
            unset(Pbx::$mailboxes[$extension]);
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

    function setCTIUserProfile($userId, $profileId) {
        Pbx::$calls[] = ['profile', $userId, $profileId];
        return true;
    }

    $astman = new FakeAstman();
    $amp_conf = ['AMPWEBROOT' => '/nonexistent'];
    require __DIR__.'/../var/www/html/freepbx/rest/lib/libExtensions.php';

    $userDevices = fn($uid) => array_values(array_map(fn($d) => $d['extension'], array_filter(Pbx::$devices, fn($d) => $d['user_id'] === $uid)));
    $userGroups = fn($uid) => array_values(array_map(fn($g) => $g[1], array_filter(Pbx::$groups, fn($g) => $g[0] === $uid)));

    Pbx::reset();
    check(reassignMainExtension('201', 'bob') === true, 'reassign failed');
    check(Pbx::$users[1]['default_extension'] === 'none', 'previous owner kept the main extension');
    check(Pbx::$users[2]['default_extension'] === '201', 'new owner did not get the main extension');
    check($userDevices(1) === [], 'previous owner kept devices');
    check($userDevices(2) === ['92201', '91201', '93201'], 'devices were not moved unchanged');
    check(Pbx::$devices[1]['mac'] === 'AA:BB:CC:00:00:01' && Pbx::$devices[1]['secret'] === 's2', 'physical phone credentials changed');
    check(in_array('201', Pbx::$extensions, true) && in_array('91201', Pbx::$extensions, true), 'extensions were deleted');
    check($userGroups(1) === [] && $userGroups(2) === [20, 10], 'group memberships were not moved');
    check(in_array(['profile', 2, 3], Pbx::$calls, true), 'profile of the previous owner was not applied');
    check(in_array(['displayname', ['201', '92201', '91201', '93201'], 'Bob Bianchi', '201'], Pbx::$calls, true), 'display names not updated');
    check(Pbx::$mailboxes['201'] === ['name' => 'Bob Bianchi', 'email' => 'bob@example.org', 'pwd' => '1234'], 'voicemail owner not updated');
    check(Pbx::$users[4]['default_extension'] === '202' && $userDevices(4) === ['91202'], 'another user was changed');

    Pbx::reset();
    check(reassignMainExtension('201', 'carol') === true, 'reassign to a user with a profile failed');
    check(in_array(['profile', 3, 5], Pbx::$calls, true), 'profile of the new owner was not kept');
    check(in_array(['displayname', ['201', '92201', '91201', '93201'], 'carol', '201'], Pbx::$calls, true), 'username fallback not used');

    Pbx::reset();
    check(reassignMainExtension('999', 'bob')[1] === 404, 'unknown extension accepted');
    check(reassignMainExtension('201', 'nobody')[1] === 404, 'unknown user accepted');
    check(reassignMainExtension('201', 'alice')[1] === 422, 'same user accepted');
    check(reassignMainExtension('201', 'dave')[1] === 422, 'user with an extension accepted');
    check(Pbx::$users[1]['default_extension'] === '201' && $userDevices(1) === ['92201', '91201', '93201'], 'rejected request changed data');

    Pbx::reset();
    \FreePBX\modules\Userman\Auth\Fake::$failFor = ['bob'];
    check(reassignMainExtension('201', 'bob')[1] === 500, 'directory failure not reported');
    check(Pbx::$users[1]['default_extension'] === '201' && Pbx::$users[2]['default_extension'] === 'none', 'failed reassign not rolled back');
    check($userDevices(1) === ['92201', '91201', '93201'] && $userDevices(2) === [], 'devices not restored after failure');

    Pbx::reset();
    unset(Pbx::$users[1]);
    releaseUserExtensions(1, '201');
    check(Pbx::$extensions === ['202', '91202'], 'extensions of the deleted user were kept');
    check(!isset(Pbx::$mailboxes['201']), 'voicemail of the deleted user was kept');
    check($userDevices(1) === [], 'devices of the deleted user were kept');
    $freed = array_values(array_filter(Pbx::$devices, fn($d) => $d['mac'] === 'AA:BB:CC:00:00:01'));
    check(count($freed) === 1 && $freed[0]['user_id'] === null && $freed[0]['extension'] === null && $freed[0]['secret'] === null, 'physical phone not freed');
    check($userGroups(1) === [] && $userGroups(4) === [10], 'group memberships not cleaned');
    check($userDevices(4) === ['91202'], 'another user lost devices');

    Pbx::reset();
    releaseUserExtensions(3, 'none');
    check(count(Pbx::$extensions) === 6 && count(Pbx::$devices) === 5, 'release without extension changed data');

    echo "PASS: main extension reassign, rollback, validation and release of deleted users\n";
}
