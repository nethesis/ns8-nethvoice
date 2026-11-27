<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the administrator phone helpers against an in-memory PBX.

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

class Pbx {
    public static array $sip = [];
    public static array $ringgroups = [];
    public static array $kvstore = [];
    public static array $astdb = [];
    public static array $created = [];
    public static array $users = [];
    public static array $commands = [];
    public static array $reloads = [];

    public static function reset() {
        self::$sip = [
            '201' => ['secret' => 'm201', 'callerid' => 'Alice <201>'],
            '91201' => ['secret' => 's91201'],
            '92201' => ['secret' => 's92201'],
        ];
        self::$ringgroups = [];
        self::$kvstore = [];
        self::$astdb = ['AMPUSER/201/device' => '201&91201&92201'];
        self::$created = [];
        self::$users = [['id' => 1, 'username' => 'alice', 'default_extension' => '201']];
        self::$commands = [];
        self::$reloads = [];
    }
}

class FakeStatement {
    private $result = [];
    public function __construct(private string $sql) {}
    public function execute($args = []) {
        $this->result = [];
        switch ($this->sql) {
            case 'SELECT keyword, data FROM sip WHERE id = ?':
                foreach (Pbx::$sip[$args[0]] ?? [] as $keyword => $data) {
                    $this->result[] = ['keyword' => $keyword, 'data' => $data];
                }
                break;
            case 'SELECT * FROM sip WHERE id= ?':
            case 'SELECT id FROM sip WHERE id = ? LIMIT 1':
                $this->result = isset(Pbx::$sip[$args[0]]) ? [['id' => $args[0]]] : [];
                break;
            case 'REPLACE INTO sip SET id = ?, keyword = ?, data = ?':
                Pbx::$sip[$args[0]][$args[1]] = (string) $args[2];
                break;
            case 'SELECT * FROM ringgroups WHERE grpnum= ?':
                $this->result = in_array($args[0], Pbx::$ringgroups, true) ? [['grpnum' => $args[0]]] : [];
                break;
            case 'SHOW TABLES LIKE ?':
                $this->result = [['table' => $args[0]]];
                break;
            case 'SELECT * FROM featurecodes WHERE customcode = ?':
            case 'SELECT * FROM featurecodes WHERE defaultcode = ? AND (customcode IS NULL OR customcode = "")':
            case 'SELECT * FROM queues_details WHERE id = ?':
            case 'SELECT * FROM trunks WHERE channelid = ?':
            case 'SELECT * FROM parkplus WHERE parkext = ?':
                break;
            default:
                throw new RuntimeException('Unexpected query: '.$this->sql);
        }
        return true;
    }
    public function fetch($mode = null) { return $this->result[0] ?? false; }
    public function fetchColumn() { return $this->result ? array_values($this->result[0])[0] : false; }
    public function fetchAll($mode = null) { return $this->result; }
}

class FakeDatabase {
    public function prepare($sql) {
        return new FakeStatement(trim(preg_replace('/\s+/', ' ', str_replace('`', '', $sql))));
    }
}

class FakeCore {
    public function processQuickCreate($tech, $extension, $data) {
        check($tech === 'pjsip', 'not a PJSIP extension');
        check(!isset(Pbx::$sip[$extension]), 'extension created twice');
        Pbx::$created[] = [$extension, $data];
        Pbx::$sip[$extension] = [
            'secret' => 'default-secret',
            'context' => 'from-internal',
            'callerid' => $data['name'].' <'.$extension.'>',
            'accountcode' => '',
            'transport' => '',
            'media_encryption' => 'no',
        ];
        Pbx::$astdb['AMPUSER/'.$extension.'/cidname'] = $data['name'];
        Pbx::$astdb['CW/'.$extension] = 'ENABLED';
        return ['status' => true, 'ext' => $extension, 'name' => $data['name']];
    }
    public function delUser($extension) {
        foreach (array_keys(Pbx::$astdb) as $key) {
            if (str_starts_with($key, 'AMPUSER/'.$extension.'/')) unset(Pbx::$astdb[$key]);
        }
    }
    public function delDevice($extension) { unset(Pbx::$sip[$extension]); }
    public function getAllUsers() { return array_map(fn($e) => ['extension' => (string) $e], array_keys(Pbx::$sip)); }
}

class FakeNethcti3 {
    public function getConfig($key, $id = 'noid') { return Pbx::$kvstore[$id][$key] ?? false; }
    public function setConfig($key, $value, $id = 'noid') {
        if ($value === false) {
            unset(Pbx::$kvstore[$id][$key]);
        } else {
            Pbx::$kvstore[$id][$key] = $value;
        }
        return true;
    }
    public function setExtensionsDisplayName($extensions, $displayname, $mainextension) {
        $changed = false;
        foreach ($extensions as $extension) {
            $callerid = $displayname.' <'.$mainextension.'>';
            if ((Pbx::$sip[$extension]['callerid'] ?? null) !== $callerid) {
                Pbx::$sip[$extension]['callerid'] = $callerid;
                $changed = true;
            }
            if ((Pbx::$astdb['AMPUSER/'.$extension.'/cidname'] ?? null) !== $displayname) {
                Pbx::$astdb['AMPUSER/'.$extension.'/cidname'] = $displayname;
                $changed = true;
            }
        }
        return $changed;
    }
}

class FakeAstman {
    public function database_get($family, $key) { return Pbx::$astdb[$family.'/'.$key] ?? false; }
    public function database_put($family, $key, $value) { Pbx::$astdb[$family.'/'.$key] = (string) $value; return true; }
    public function database_del($family, $key) {
        $found = isset(Pbx::$astdb[$family.'/'.$key]);
        unset(Pbx::$astdb[$family.'/'.$key]);
        return $found;
    }
    public function database_show($family = '') {
        $shown = [];
        foreach (Pbx::$astdb as $key => $value) {
            if (str_starts_with($key, $family.'/')) $shown['/'.$key] = $value;
        }
        return $shown;
    }
    public function send_request($action, $parameters = []) {
        Pbx::$commands[] = [$action, $parameters];
        return ['Response' => 'Success'];
    }
}

class FreePBX {
    public $Core;
    public function __construct() { $this->Core = new FakeCore(); }
    public static function create() { return new self(); }
    public static function Database() { return new FakeDatabase(); }
    public static function Nethcti3() { return new FakeNethcti3(); }
}

$astman = new FakeAstman();
require __DIR__.'/../var/www/html/freepbx/rest/lib/libAdminPhone.php';

$authFile = tempnam(sys_get_temp_dir(), 'adminphone-auth');
$lockFile = tempnam(sys_get_temp_dir(), 'adminphone-lock');
register_shutdown_function(fn() => array_map('unlink', array_filter([$authFile, $lockFile], 'file_exists')));
$writeAuth = function ($secret) use ($authFile) {
    file_put_contents($authFile, "#include pjsip.auth_custom.conf\n\n[201-auth]\ntype=auth\nauth_type=userpass\npassword=m201\nusername=201\n\n[770000-auth]\ntype=auth\nauth_type=userpass\npassword=$secret\nusername=770000\n\n[7700001-auth]\ntype=auth\nauth_type=userpass\npassword=other\nusername=7700001\n");
};
$authSecret = function ($extension) use ($authFile) {
    preg_match('/^\['.$extension.'-auth\]\n(?:[^\[].*\n)*?password=(.*)$/m', file_get_contents($authFile), $match);
    return $match[1] ?? null;
};
$pjsipReloads = fn() => count(array_filter(Pbx::$commands, fn($command) => $command === ['Command', ['Command' => 'module reload res_pjsip.so']]));
$env = ['ASTERISK_SIP_UDP_PORT' => '20160', 'NETHCTI_UI_HOST' => 'cti.example.org', 'NETHVOICE_HOST' => 'voice.example.org'];
$foreign = fn() => array_intersect_key(Pbx::$sip, array_flip(['201', '91201', '92201']));

Pbx::reset();
$foreignBefore = $foreign();
check(adminPhoneStatus() === ['enabled' => false, 'extension' => null], 'phone reported before creation');

$result = adminPhoneSession($env, null, $authFile);
$session = $result['session'];
check($result['changed'] === true && $session['reloading'] === true, 'creation does not request a reload');
check($pjsipReloads() === 0, 'a new phone must wait for the full reload, not reload PJSIP alone');
check($session['extension'] === '770000', 'unexpected default number '.$session['extension']);
check(count(Pbx::$created) === 1 && !array_key_exists('um', Pbx::$created[0][1]), 'quick create asked for a Userman user');
check(Pbx::$created[0][1]['name'] === 'Admin (test)' && Pbx::$created[0][1]['vm'] === 'no', 'unexpected quick create data');
check(preg_match('/^[0-9a-f]{32}$/', $session['secret']) === 1 && $session['secret'] === Pbx::$sip['770000']['secret'], 'secret not random or not stored');
check($session['sip_host'] === '127.0.0.1' && $session['sip_port'] === 20160 && $session['cti_host'] === 'cti.example.org', 'wrong SIP or CTI endpoint');
check($session['display_name'] === 'Admin (test)', 'wrong display name');
$sip = Pbx::$sip['770000'];
check($sip['accountcode'] === 'nv-admin' && $sip['transport'] === '0.0.0.0-udp' && $sip['media_encryption'] === 'no', 'WebRTC settings not applied');
check($sip['allow'] === 'opus,g722,ulaw,alaw,h264,vp8' && $sip['rewrite_contact'] === 'yes' && $sip['force_rport'] === 'yes', 'softphone settings not applied');
check($sip['rtp_symmetric'] === 'yes' && $sip['direct_media'] === 'no' && $sip['outbound_proxy'] === '', 'media settings not applied');
check($sip['context'] === 'nethvoice-adminphone', 'administrator phone context not applied');
check($sip['callerid'] === 'Admin (test) <770000>', 'wrong caller id');
check(Pbx::$astdb['AMPUSER/770000/accountcode'] === 'nv-admin' && !isset(Pbx::$astdb['CW/770000']), 'astdb not configured');
check(Pbx::$kvstore['adminphone']['extension'] === '770000', 'number not stored');
check(adminPhoneStatus() === ['enabled' => true, 'extension' => '770000'], 'wrong status after creation');
check(!isset(Pbx::$kvstore['adminphone']['secret']), 'secret stored in kvstore');
check($foreign() === $foreignBefore && count(Pbx::$users) === 1, 'other extensions or users changed');
check(!in_array('770000', getUserExtensionNumbers('201'), true), 'service extension listed among user devices');

$writeAuth($session['secret']);
Pbx::$astdb['registrar/contact/770000;@0a1b2c'] = '{"uri":"sip:770000@127.0.0.1:5060"}';
Pbx::$astdb['registrar/contact/7700001;@3d4e5f'] = '{"uri":"sip:7700001@127.0.0.1:5060"}';
Pbx::$astdb['registrar/contact/201;@6a7b8c'] = '{"uri":"sip:201@192.0.2.20:5060"}';
$again = adminPhoneSession($env, null, $authFile);
check($again['changed'] === false && $again['session']['reloading'] === false, 'a session with an existing phone requested a full reload');
check(count(Pbx::$created) === 1, 'second session recreated the extension');
check($again['session']['secret'] !== $session['secret'] && preg_match('/^[0-9a-f]{32}$/', $again['session']['secret']) === 1, 'a new session must rotate the secret');
check(Pbx::$sip['770000']['secret'] === $again['session']['secret'], 'the rotated secret is not stored');
check($authSecret('770000') === $again['session']['secret'], 'the rotated secret does not reach the PJSIP configuration');
check($authSecret('201') === 'm201' && $authSecret('7700001') === 'other', 'the secrets of other extensions changed');
check($pjsipReloads() === 1, 'the rotated secret must be loaded with a PJSIP reload');
check(!isset(Pbx::$astdb['registrar/contact/770000;@0a1b2c']), 'the registrations made with the old secret must be removed');
check(isset(Pbx::$astdb['registrar/contact/7700001;@3d4e5f']) && isset(Pbx::$astdb['registrar/contact/201;@6a7b8c']), 'registrations of other extensions removed');

$third = adminPhoneSession($env, null, $authFile);
check($third['session']['secret'] !== $again['session']['secret'] && $authSecret('770000') === $third['session']['secret'], 'every session must rotate the secret');

unlink($authFile);
$offline = adminPhoneSession($env, null, $authFile);
check($offline['changed'] === true && $offline['session']['reloading'] === true, 'a secret that cannot be applied live must request a full reload');
check(Pbx::$sip['770000']['secret'] === $offline['session']['secret'], 'the secret must be stored for the full reload');

$writeAuth(Pbx::$sip['770000']['secret']);
Pbx::$commands = [];
$reloads = 0;
$before = Pbx::$sip['770000']['secret'];
Pbx::$astdb['registrar/contact/770000;@9f8e7d'] = '{"uri":"sip:770000@127.0.0.1:5060"}';
check(adminPhoneRevoke($lockFile, $authFile, function () use (&$reloads) { $reloads++; }) === true, 'revoking an existing phone must report it');
check(Pbx::$sip['770000']['secret'] !== $before && $authSecret('770000') === Pbx::$sip['770000']['secret'], 'revoking must rotate the secret live');
check($pjsipReloads() === 1 && $reloads === 0, 'revoking must reload PJSIP only');
check(!isset(Pbx::$astdb['registrar/contact/770000;@9f8e7d']), 'revoking must remove the registrations');
unlink($authFile);
check(adminPhoneRevoke($lockFile, $authFile, function () use (&$reloads) { $reloads++; }) === true && $reloads === 1, 'revoking without the PJSIP configuration must request a full reload');
$writeAuth(Pbx::$sip['770000']['secret']);
$session = adminPhoneSession($env, null, $authFile)['session'];

Pbx::$sip['770000']['transport'] = '';
check(adminPhoneSession($env)['changed'] === true && Pbx::$sip['770000']['transport'] === '0.0.0.0-udp', 'drifted settings not repaired');
Pbx::$sip['770000']['context'] = 'from-internal';
check(adminPhoneSession($env)['changed'] === true && Pbx::$sip['770000']['context'] === 'nethvoice-adminphone', 'drifted context not repaired');

$renamed = adminPhoneSession($env, 'Admin (mario)');
check($renamed['changed'] === true && Pbx::$sip['770000']['callerid'] === 'Admin (mario) <770000>', 'display name not applied');
check(adminPhoneSession($env)['session']['display_name'] === 'Admin (mario)', 'display name not kept');
foreach (['', '   ', str_repeat('x', 51), 42] as $invalid) {
    $threw = false;
    try { adminPhoneSession($env, $invalid); } catch (InvalidArgumentException $e) { $threw = true; }
    check($threw, 'invalid display name accepted');
}
check(adminPhoneNormalizeName("Admin <x>\n") === 'Admin x', 'display name not sanitized');

check(adminPhoneSession($env, null, $authFile)['session']['secret'] === Pbx::$sip['770000']['secret'], 'session returns a stale secret');

check(adminPhoneDelete() === true, 'delete failed');
check(!isset(Pbx::$sip['770000']) && !isset(Pbx::$astdb['AMPUSER/770000/accountcode']), 'extension not removed');
check(adminPhoneStatus() === ['enabled' => false, 'extension' => null], 'phone reported after delete');
check(adminPhoneDelete() === false, 'missing phone not reported');
check($foreign() === $foreignBefore, 'delete changed other extensions');
$revoked = 0;
check(adminPhoneRevoke($lockFile, $authFile, function () use (&$revoked) { $revoked++; }) === false && $revoked === 0, 'revoking a missing phone must do nothing');

Pbx::reset();
Pbx::$sip['770000'] = ['secret' => 'taken'];
Pbx::$sip['91770001'] = ['secret' => 'taken'];
Pbx::$sip['0002'] = ['secret' => 'taken'];
Pbx::$ringgroups = ['770003'];
check(adminPhoneSession($env)['session']['extension'] === '770004', 'collision checks not applied');

Pbx::reset();
adminPhoneSession($env);
unset(Pbx::$sip['770000']);
$recreated = adminPhoneSession($env);
check($recreated['session']['extension'] === '770000' && $recreated['changed'] === true, 'externally removed extension not recreated on the same number');

Pbx::reset();
Pbx::$kvstore['adminphone']['extension'] = '770050';
check(adminPhoneSession($env)['session']['extension'] === '770050', 'stored number not preferred');

Pbx::reset();
$threw = false;
try { adminPhoneSession(['NETHCTI_UI_HOST' => 'cti.example.org']); } catch (RuntimeException $e) { $threw = true; }
check($threw, 'missing SIP port accepted');

Pbx::reset();
foreach (adminPhoneCandidates() as $candidate) Pbx::$sip[$candidate] = ['secret' => 'taken'];
$threw = false;
try { adminPhoneSession($env); } catch (RuntimeException $e) { $threw = true; }
check($threw && count(Pbx::$created) === 0, 'exhausted numbering not reported');

echo "PASS: administrator phone created without users, reused, repaired, rotated, revoked and removed\n";
