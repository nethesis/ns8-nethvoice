<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Usage: php local_testing/legacy_sip_trunks_test.php MYSQL_DSN PINNED_SOURCES
// Requires a disposable MariaDB accepting root with an empty password.
if ($argc !== 3) {
    fwrite(STDERR, "Usage: php legacy_sip_trunks_test.php MYSQL_DSN PINNED_SOURCES\n");
    exit(2);
}
$sources = $argv[2];
require "$sources/framework/amp_conf/htdocs/admin/libraries/Composer/vendor/autoload.php";
require "$sources/framework/amp_conf/htdocs/admin/libraries/BMO/DB_Helper.class.php";
interface BMO {}
class FreePBX_Helpers extends \FreePBX\DB_Helper {
    public $database;
    public $freepbx;
}
class FreePBX {
    public static $instance;
    public static function Create() { return self::$instance; }
}
require "$sources/core/Core.class.php";
require "$sources/core/functions.inc/Driver.class.php";
require "$sources/core/functions.inc/drivers/PJSip.class.php";
require __DIR__ . '/../freepbx/initdb.d/legacy-sip-trunks.php';

function check($condition, string $message): void {
    if (!$condition) { throw new RuntimeException($message); }
}
function rows(PDO $db, string $table): array {
    return $db->query("SELECT * FROM `$table` ORDER BY 1, 2")->fetchAll(PDO::FETCH_ASSOC);
}
$db = new PDO($argv[1], 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
// Refuse to overwrite an existing database.
$db->exec('CREATE DATABASE nethvoice_legacy_sip_test');
try {
    foreach (['trunks', 'sip', 'pjsip', 'kvstore_FreePBX_modules_Core', 'kvblobstore',
              'outbound_route_trunks', 'admin', 'sipsettings'] as $table) {
        $schema = file_get_contents(__DIR__ . "/../mariadb/docker-entrypoint-initdb.d/10_asterisk.$table-schema.sql");
        $db->exec(str_replace('USE `asterisk`;', 'USE `nethvoice_legacy_sip_test`;', $schema));
    }
    $db->exec("INSERT INTO trunks (trunkid, tech, name, channelid, disabled, outcid) VALUES
        (1, 'sip', 'Synthetic legacy trunk', 'legacy-one', 'off', '1000'),
        (2, 'pjsip', 'Existing PJSIP', 'existing', 'off', '2000'),
        (3, 'sip', 'Disabled legacy trunk', 'legacy-three', 'on', '3000');
        INSERT INTO pjsip VALUES (2, 'secret', 'existing-test-secret', 0), (2, 'disabletrunk', 'off', 0);
        INSERT INTO outbound_route_trunks VALUES (10, 1, 0), (10, 2, 1), (20, 3, 0);
        INSERT INTO admin VALUES ('MIGRATION_SCRIPT', '2');
        INSERT INTO sipsettings VALUES ('tlsenable', 'no', 0, 0)");
    $insert = $db->prepare('INSERT INTO sip (id, keyword, data, flags) VALUES (?, ?, ?, 0)');
    foreach ([1, 3] as $id) {
        foreach (['host' => 'provider.example.net', 'port' => '5060',
                  'secret' => 'synthetic-test-secret', 'username' => 'alice',
                  'outbound_proxy' => 'sip:proxy.example.net:5060;lr',
                  'allow' => 'alaw,ulaw', 'context' => 'from-trunk',
                  'custom_option' => 'retained for manual review'] as $key => $value) {
            $insert->execute(["tr-peer-$id", $key, $value]);
        }
        $insert->execute(["tr-reg-$id", 'register', 'alice:synthetic-test-secret@provider.example.net']);
    }
    // Exercise the upstream blob writer for backups larger than 4 KB too.
    for ($option = 0; $option < 25; $option++) {
        $insert->execute(['tr-peer-3', "custom_$option", str_repeat('x', 150)]);
    }
    $environment = (object) [
        'Database' => $db,
        'Config' => new class { function get($key) { return '22.10.0'; } },
        'Sipsettings' => new class { function getCodecs($type) { return ['alaw' => 1, 'ulaw' => 2]; } },
        'astman' => new class { function database_get($family, $key) { return ''; } },
    ];
    FreePBX::$instance = $environment;
    // Use the actual pinned converter, driver, defaults and key/value writer.
    $reflection = new ReflectionClass(\FreePBX\modules\Core::class);
    $core = $reflection->newInstanceWithoutConstructor();
    $core->database = $db;
    $core->freepbx = $environment;
    $reflection->getProperty('drivers')->setValue($core, [
        'pjsip' => new \FreePBX\modules\Core\Drivers\PJSip($environment),
    ]);
    $routes = rows($db, 'outbound_route_trunks');
    $originalSip = rows($db, 'sip');
    $originalTrunks = rows($db, 'trunks');
    $existingPjsip = rows($db, 'pjsip');

    // Fail after the converter deletes legacy rows, while recording its backup.
    $db->exec("CREATE TRIGGER fail_second_trunk BEFORE INSERT ON kvstore_FreePBX_modules_Core
        FOR EACH ROW BEGIN IF NEW.id = '3' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-test-secret'; END IF; END");
    try {
        convertLegacySipTrunks($db, $core);
        throw new RuntimeException('Injected conversion failure was ignored');
    } catch (RuntimeException $error) {
        check(strpos($error->getMessage(), 'transaction rolled back') !== false, 'Missing rollback error');
        check(strpos($error->getMessage(), 'synthetic-test-secret') === false, 'Credentials leaked');
    }
    check($db->query('SELECT tech FROM trunks WHERE trunkid=1')->fetchColumn() === 'pjsip', 'First conversion lost');
    check($db->query('SELECT tech FROM trunks WHERE trunkid=3')->fetchColumn() === 'sip', 'Failed conversion not rolled back');
    check($db->query('SELECT COUNT(*) FROM pjsip WHERE id=3')->fetchColumn() == 0, 'Partial PJSIP rows remain');
    check($db->query('SELECT COUNT(*) FROM kvblobstore')->fetchColumn() == 0, 'Partial blob backup remains');
    $remaining = $db->query("SELECT * FROM sip ORDER BY id, keyword")->fetchAll(PDO::FETCH_ASSOC);
    check($remaining === array_values(array_filter($originalSip, function ($row) {
        return in_array($row['id'], ['tr-peer-3', 'tr-reg-3', 'tr-user-3'], true);
    })), 'Legacy settings not restored after failure');
    $db->exec('DROP TRIGGER fail_second_trunk');
    convertLegacySipTrunks($db, $core);

    foreach ([1, 3] as $id) {
        $row = $db->query("SELECT tech, disabled FROM trunks WHERE trunkid=$id")->fetch(PDO::FETCH_ASSOC);
        check($row === ['tech' => 'pjsip', 'disabled' => 'on'], 'Converted trunk not disabled');
        $settings = $db->query("SELECT keyword, data FROM pjsip WHERE id=$id")->fetchAll(PDO::FETCH_KEY_PAIR);
        check($settings['disabletrunk'] === 'on', 'PJSIP disable flag missing');
        check($settings['secret'] === 'synthetic-test-secret', 'Credentials lost');
        check($settings['outbound_proxy'] === 'sip:proxy.example.net:5060;lr', 'Proxy setting lost');
        $backup = json_decode($db->query("SELECT configuration FROM nethvoice_legacy_sip_trunks WHERE trunkid=$id")->fetchColumn(), true);
        check($backup['trunk'] === $originalTrunks[$id === 1 ? 0 : 2], 'Original trunk backup changed');
        check($backup['sip'] === array_values(array_filter($originalSip, function ($row) use ($id) {
            return in_array($row['id'], ["tr-peer-$id", "tr-reg-$id", "tr-user-$id"], true);
        })), 'Original SIP backup incomplete');
    }
    check(rows($db, 'outbound_route_trunks') === $routes, 'Route references changed');
    check($db->query('SELECT COUNT(*) FROM sip')->fetchColumn() == 0, 'Legacy rows remain');
    check($db->query('SELECT * FROM pjsip WHERE id=2 ORDER BY id, keyword')->fetchAll(PDO::FETCH_ASSOC) === $existingPjsip, 'Existing PJSIP modified');
    // Once an administrator enables a reviewed trunk, restart must leave it enabled.
    foreach ([1, 3] as $id) {
        $core->enableTrunk($id);
        $activeTrunks = $core->getDriver('pjsip')->getAllTrunks();
        $dialplanTarget = $db->query("SELECT channelid FROM trunks WHERE trunkid=$id")->fetchColumn();
        check($activeTrunks[$id]['trunk_name'] === $dialplanTarget,
            "Enabled trunk $id has an endpoint name that differs from its dialplan target");
    }
    $before = array_map(function ($table) use ($db) { return rows($db, $table); },
        ['trunks', 'sip', 'pjsip', 'outbound_route_trunks', 'nethvoice_legacy_sip_trunks', 'admin', 'sipsettings']);
    convertLegacySipTrunks($db, $core);
    $after = array_map(function ($table) use ($db) { return rows($db, $table); },
        ['trunks', 'sip', 'pjsip', 'outbound_route_trunks', 'nethvoice_legacy_sip_trunks', 'admin', 'sipsettings']);
    check($before === $after, 'Repeat conversion modified configuration');

    // Never overwrite partial/manual PJSIP settings belonging to the same ID.
    $db->exec("INSERT INTO trunks (trunkid, tech, name, channelid) VALUES (4, 'sip', 'Conflicting trunk', 'conflict');
        INSERT INTO pjsip VALUES (4, 'secret', 'keep-existing-settings', 0)");
    $conflicting = rows($db, 'pjsip');
    try {
        convertLegacySipTrunks($db, $core);
        throw new RuntimeException('Conflicting PJSIP settings were overwritten');
    } catch (RuntimeException $error) {
        check(strpos($error->getMessage(), 'transaction rolled back') !== false, 'Conflict not rejected');
    }
    check(rows($db, 'pjsip') === $conflicting, 'Conflicting settings changed');
    $db->exec('DELETE FROM pjsip WHERE id=4; ALTER TABLE sip ENGINE=MyISAM');
    try {
        convertLegacySipTrunks($db, $core);
        throw new RuntimeException('Non-transactional conversion was allowed');
    } catch (RuntimeException $error) {
        check(strpos($error->getMessage(), 'requires InnoDB') !== false, 'Non-transactional table not rejected');
    }
    check($db->query('SELECT tech FROM trunks WHERE trunkid=4')->fetchColumn() === 'sip', 'Rejected trunk modified');
    $db->exec("ALTER TABLE sip ENGINE=InnoDB;
        INSERT INTO trunks (trunkid, tech, name, channelid) VALUES (0, 'sip', 'Invalid legacy ID', 'zero')");
    try {
        convertLegacySipTrunks($db, $core);
        throw new RuntimeException('Trunk zero was passed to the upstream converter as all trunks');
    } catch (RuntimeException $error) {
        check(strpos($error->getMessage(), 'positive trunk IDs') !== false, 'Unsafe trunk ID not rejected');
    }
    check($db->query('SELECT tech FROM trunks WHERE trunkid=4')->fetchColumn() === 'sip', 'Other legacy trunk converted by mistake');
    echo "PASS: pinned converter, disabled trunks, originals, credentials, proxy, routes, endpoint/dialplan targets, rollback, retry and existing marker\n";
} finally {
    $db->exec('DROP DATABASE nethvoice_legacy_sip_test');
}
