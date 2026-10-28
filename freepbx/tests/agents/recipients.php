<?php
// Disposable native-schema fixture; no running PBX or CTI process required.
class FreePBX {
    public static $db;
    public static $mailbox;
    public static function Database() { return self::$db; }
    public static function Voicemail() { return new class {
        public function getMailbox($extension, $cached) {
            assert($extension==='203' && $cached===false);
            if (FreePBX::$mailbox==='error') throw new RuntimeException('unavailable');
            return FreePBX::$mailbox;
        }
    }; }
}
// These libraries include the installed FreePBX bootstrap, absent in this fixture.
@require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/libCTI.php';
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/libExtensions.php';
$db = new PDO(getenv('M0_TEST_DSN'), 'root', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE DATABASE m0_recipients');
$db->exec('USE m0_recipients');
FreePBX::$db = $db;
$schema = __DIR__.'/../../../mariadb/docker-entrypoint-initdb.d/';
foreach (['users', 'userman_users', 'rest_users', 'rest_cti_profiles', 'rest_cti_macro_permissions',
    'rest_cti_permissions', 'rest_cti_profiles_macro_permissions',
    'rest_cti_macro_permissions_permissions', 'rest_cti_profiles_permissions'] as $table) {
    $db->exec(str_replace('USE `asterisk`;', 'USE `m0_recipients`;', file_get_contents($schema.'10_asterisk.'.$table.'-schema.sql')));
}
foreach (['rest_cti_profiles', 'rest_cti_macro_permissions', 'rest_cti_permissions',
    'rest_cti_profiles_macro_permissions', 'rest_cti_macro_permissions_permissions',
    'rest_cti_profiles_permissions'] as $table) {
    $db->exec(str_replace('USE `asterisk`;', 'USE `m0_recipients`;', file_get_contents($schema.'50_asterisk.'.$table.'.sql')));
}
$db->exec("INSERT INTO userman_users (id,username,default_extension) VALUES (1,'alice','203'),(2,'bob','204')");
$db->exec("INSERT INTO users (extension,voicemail) VALUES ('203','novm')");
assert(getMainExtensionVoicemailEnabled('203')===false);
FreePBX::$mailbox=['vmcontext'=>'default','pwd'=>'synthetic-secret','email'=>'alice@example.org'];
foreach (['','novm','disabled'] as $disabled) {
    $db->prepare('UPDATE users SET voicemail=?')->execute([$disabled]);
    assert(getMainExtensionVoicemailEnabled('203')===false);
}
$db->exec("UPDATE users SET voicemail='default'");
assert(getMainExtensionVoicemailEnabled('203')===true);
foreach ([null,['vmcontext'=>'other'],'error'] as $mailbox) {
    FreePBX::$mailbox=$mailbox;
    assert(getMainExtensionVoicemailEnabled('203')===false);
}
assert(getMainExtensionVoicemailEnabled('999')===false);
try { getMainExtensionVoicemailEnabled('203)'); assert(false); } catch (InvalidArgumentException $error) {}
$profile = $db->query("SELECT id FROM rest_cti_profiles WHERE name='Standard'")->fetchColumn();
assert($profile);
$db->exec("INSERT INTO rest_users (user_id,profile_id) VALUES (1,$profile),(2,NULL)");
$main = getMainExtensionUser('203');
assert($main['username']==='alice' && $main['default_extension']==='203');
assert(getMainExtensionUser('90203')===null && getMainExtensionUser('203 OR 1=1')===null);
assert(getCTIUserPermission(1,'nethvoice_cti','chat')===['username'=>'alice','allowed'=>true]);
assert(getCTIUserPermission(2,'nethvoice_cti','chat')===['username'=>'bob','allowed'=>false]);
assert(getCTIUserPermission(99,'nethvoice_cti','chat')===null);
$db->exec("DELETE FROM rest_cti_profiles_permissions WHERE profile_id=$profile AND permission_id=8");
assert(getCTIUserPermission(1,'nethvoice_cti','chat')['allowed']===false);
$db->exec("INSERT INTO rest_cti_profiles_permissions (profile_id,permission_id) VALUES ($profile,8)");
$db->exec("DELETE FROM rest_cti_profiles_macro_permissions WHERE profile_id=$profile AND macro_permission_id=12");
assert(getCTIUserPermission(1,'nethvoice_cti','chat')['allowed']===false);
$db->exec("INSERT INTO rest_cti_profiles_macro_permissions (profile_id,macro_permission_id) VALUES ($profile,12)");
$db->exec('DELETE FROM rest_cti_macro_permissions_permissions WHERE macro_permission_id=12 AND permission_id=8');
assert(getCTIUserPermission(1,'nethvoice_cti','chat')['allowed']===false);
$db->exec("UPDATE rest_users SET profile_id=1 WHERE user_id=1");
assert(getCTIUserPermission(1,'nethvoice_cti','chat')['allowed']===false);
$db->exec("INSERT INTO userman_users (id,username,default_extension) VALUES (3,'ambiguous','203')");
assert(getMainExtensionUser('203')===null);
$db->exec('DELETE FROM userman_users WHERE id IN (1,3)');
assert(getMainExtensionUser('203')===null && getCTIUserPermission(1,'nethvoice_cti','chat')===null);
$astman = new class {
    public $dnd = '';
    public $cf = '';
    public $status = '0';
    public $fail = false;
    public function Command($command) {
        assert(in_array($command,['database get DND 203','database get CF 203'],true));
        $value=$command==='database get DND 203'?$this->dnd:$this->cf;
        return $this->fail ? ['Response'=>'Error'] : ['Response'=>'Success',
            'data'=>"Privilege: Command\n".($value===''?"Database entry not found.\n":"Value: $value\n")];
    }
    public function ExtensionState($extension, $context) {
        assert($extension==='203' && $context==='ext-local');
        return ['Response'=>'Success','Status'=>$this->status];
    }
};
foreach (['0'=>'online','1'=>'busy','2'=>'busy','4'=>'offline','8'=>'ringing','9'=>'busy','16'=>'busy','17'=>'busy','-1'=>'unknown',''=>'unknown'] as $status=>$presence) {
    $astman->status=(string)$status;
    assert(getMainExtensionPresence('203')===['effective_presence'=>$presence,'device_state'=>(string)$status]);
}
$astman->status='0';
foreach (['204'=>'callforward','*203'=>'voicemail','vmu203'=>'voicemail'] as $cf=>$presence) {
    $astman->cf=(string)$cf;
    assert(getMainExtensionPresence('203')['effective_presence']===$presence);
}
$astman->dnd='YES';
assert(getMainExtensionPresence('203')['effective_presence']==='dnd');
$astman->fail=true;
try { getMainExtensionPresence('203'); assert(false); } catch (RuntimeException $error) {}
try { getMainExtensionPresence('203)'); assert(false); } catch (InvalidArgumentException $error) {}
// Authentication and route checks run before the privileged FreePBX bootstrap.
$handler=__DIR__.'/../../usr/libexec/voice-agent-recipient.php';
putenv('VOICE_AGENT_RECIPIENT_TOKEN='.str_repeat('x',32));
putenv('NETHVOICE_RECIPIENT_SERVICE_PORT=31043');
$server=['SERVER_PORT'=>'31043','REMOTE_ADDR'=>'127.0.0.1','HTTP_AUTHORIZATION'=>'Bearer '.str_repeat('x',32),
    'REQUEST_METHOD'=>'GET','REQUEST_URI'=>'/v1/recipients/203'];
foreach ([['SERVER_PORT'=>'80'], ['REMOTE_ADDR'=>'192.0.2.10'], ['HTTP_AUTHORIZATION'=>'Bearer invalid'],
    ['HTTP_AUTHORIZATION'=>''],
    ['REQUEST_METHOD'=>'POST'], ['REQUEST_URI'=>'/v1/recipients/203?admin=1'], ['REQUEST_URI'=>'/v1/recipients/203/'],
    ['REQUEST_URI'=>'/v1/recipients/203%0a'], ['CONTENT_LENGTH'=>'1'], ['HTTP_TRANSFER_ENCODING'=>'chunked']] as $change) {
    $process=proc_open([PHP_BINARY,'-r','$_SERVER=json_decode($argv[1],true); require $argv[2];',json_encode(array_replace($server,$change)),$handler],
        [1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $result=json_decode(stream_get_contents($pipes[1]),true);
    assert(stream_get_contents($pipes[2])==='');
    assert(proc_close($process)===0);
    $forbidden=isset($change['SERVER_PORT']) || isset($change['REMOTE_ADDR']) || isset($change['HTTP_AUTHORIZATION']);
    assert(($result['error']??'')===($forbidden?'forbidden':'invalid_request'));
}
$db->exec('DROP DATABASE m0_recipients');
echo "Native recipient identity, permission revocation, live presence and private request guards passed\n";
