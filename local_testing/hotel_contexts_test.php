<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Usage: php local_testing/hotel_contexts_test.php MYSQL_DSN CUSTOMCONTEXTS_DIR EXTENSIONS_CLASS
// Requires a disposable MariaDB accepting root with an empty password.
if ($argc !== 4) {
    fwrite(STDERR, "Usage: php hotel_contexts_test.php MYSQL_DSN CUSTOMCONTEXTS_DIR EXTENSIONS_CLASS\n");
    exit(2);
}
define('FREEPBX_IS_AUTH', true);
class Database extends PDO {
    public function getAll($query) { return $this->query($query)->fetchAll(PDO::FETCH_NUM); }
    public function sql($query, $mode, $fetch) { return $this->query($query)->fetchAll($fetch); }
}
class FreePBX {
    public static function Database() { global $db; return $db; }
}
class DB {
    public static function IsError($result) { return false; }
}
function sql($query, $mode) { global $db; return $db->getAll($query); }
function needreload() {}
function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}
function permissions($context) {
    global $db;
    $statement = $db->prepare('SELECT * FROM customcontexts_includes WHERE context = ? ORDER BY `include`');
    $statement->execute([$context]);
    return $statement->fetchAll(PDO::FETCH_ASSOC);
}
require $argv[2].'/functions.inc.php';
require $argv[3];
require __DIR__.'/../freepbx/var/www/html/freepbx/rest/lib/context_default_permissions.php';
// Isolate the real permission functions from FreePBX's absolute bootstrap paths.
$source = file_get_contents(__DIR__.'/../freepbx/var/www/html/freepbx/rest/lib/libCTI.php');
$start = strpos($source, 'function enableHotelServicesForCTIProfiles(');
$end = strpos($source, 'function deleteCTIProfile(', $start);
check($start !== false && $end !== false, 'Cannot locate CTI context permission functions');
eval(substr($source, $start, $end - $start));

$db = new Database($argv[1], 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
// Refuse to overwrite an existing installation.
$db->exec('CREATE DATABASE asterisk');
try {
    $db->exec("USE asterisk;
        CREATE TABLE rest_cti_profiles (id int PRIMARY KEY, name varchar(255));
        CREATE TABLE customcontexts_contexts (
            context varchar(100) PRIMARY KEY, description varchar(100), dialrules text NOT NULL DEFAULT '',
            faildestination varchar(255) DEFAULT '', featurefaildestination varchar(255) DEFAULT '',
            failpin varchar(100) DEFAULT '', featurefailpin varchar(100) DEFAULT '');
        CREATE TABLE customcontexts_includes (
            context varchar(100), `include` varchar(100), timegroupid int NULL,
            sort int NOT NULL DEFAULT 0, userules varchar(10) NULL, PRIMARY KEY (context, `include`));
        CREATE TABLE customcontexts_contexts_list (context varchar(100) PRIMARY KEY, description varchar(100));
        CREATE TABLE customcontexts_includes_list (context varchar(100), `include` varchar(100),
            description varchar(100), sort int, PRIMARY KEY (context, `include`));
        CREATE TABLE outbound_routes (route_id int PRIMARY KEY);
        CREATE TABLE outbound_route_sequence (route_id int PRIMARY KEY, seq int);
        CREATE TABLE timegroups_details (timegroupid int, time varchar(100));
        INSERT INTO rest_cti_profiles VALUES (1,'Base'), (2,'Standard'), (3,'Advanced'), (4,'Custom'), (5,'Hotel');
        INSERT INTO customcontexts_contexts (context, description) VALUES
            ('cti-profile-1','Base'), ('cti-profile-2','Standard'), ('cti-profile-3','Advanced'),
            ('hotel','Hotel'), ('from-trunk','Trunk'), ('manual-services','Manual');
        INSERT INTO customcontexts_includes VALUES
            ('cti-profile-1','hotel-services',NULL,29,NULL),
            ('cti-profile-2','hotel-services',8,200,'allowmatch'),
            ('cti-profile-1','ext-local',NULL,20,NULL),
            ('cti-profile-2','ext-local',NULL,20,NULL),
            ('cti-profile-3','ext-local',NULL,20,NULL),
            ('cti-profile-3','outrt-9',NULL,100,NULL),
            ('cti-profile-3','app-dnd-on',NULL,5,NULL),
            ('cti-profile-99','hotel-services',NULL,0,NULL),
            ('manual-services','hotel-services',NULL,29,NULL);
        INSERT INTO customcontexts_contexts_list VALUES ('from-internal-additional','Internal');
        INSERT INTO customcontexts_includes_list VALUES
            ('from-internal-additional','ext-local','Local',20),
            ('from-internal-additional','hotel-services','Hotel',29),
            ('from-internal-additional','app-dnd-on','DND',5),
            ('from-internal-additional','camere','Rooms',30),
            ('from-internal-additional','from-internal-additional','All internal',1),
            ('from-internal-additional','outrt-7','Denied route',100),
            ('from-internal-additional','outrt-9','Allowed route',101);
        INSERT INTO outbound_routes VALUES (7), (9);
        INSERT INTO outbound_route_sequence VALUES (7,0), (9,1)");

    $before = permissions('cti-profile-3');
    $disabledExpected = $db->query("SELECT * FROM customcontexts_includes
        WHERE NOT (`include` = 'hotel-services' AND context LIKE 'cti-profile-%')
        ORDER BY context, `include`")->fetchAll(PDO::FETCH_ASSOC);
    foreach ([null, 'False'] as $disabled) {
        $db->exec("REPLACE INTO customcontexts_includes VALUES ('cti-profile-1','hotel-services',NULL,0,NULL)");
        unset($_ENV['NETHVOICE_HOTEL']);
        if ($disabled !== null) { $_ENV['NETHVOICE_HOTEL'] = $disabled; }
        enableHotelServicesForCTIProfiles();
        check($db->query('SELECT * FROM customcontexts_includes ORDER BY context, `include`')->fetchAll(PDO::FETCH_ASSOC) === $disabledExpected,
            'Disabled hotel support left stale CTI includes or changed unrelated permissions');
    }
    // An enabled installation may also have an old, time-restricted permission.
    $db->exec("INSERT INTO customcontexts_includes VALUES ('cti-profile-2','hotel-services',8,200,'allowmatch')");
    $_ENV['NETHVOICE_HOTEL'] = 'True';
    enableHotelServicesForCTIProfiles();
    $after = $db->query('SELECT * FROM customcontexts_includes ORDER BY context, `include`')->fetchAll(PDO::FETCH_ASSOC);
    enableHotelServicesForCTIProfiles();
    check($db->query('SELECT * FROM customcontexts_includes ORDER BY context, `include`')->fetchAll(PDO::FETCH_ASSOC) === $after,
        'Repeated backfill changed permissions');
    check(array_values(array_filter(permissions('cti-profile-3'), fn($row) => $row['include'] !== 'hotel-services')) === $before,
        'Backfill changed unrelated permissions');

    $profile = ['id' => 3, 'name' => 'Advanced', 'macro_permissions' => [],
        'outbound_routes_permissions' => [['route_id' => 7, 'permission' => false], ['route_id' => 9, 'permission' => true]]];
    // Profile saves must also work before the first reload discovers hotel-services.
    $db->exec("DELETE FROM customcontexts_includes WHERE context = 'cti-profile-3' AND `include` = 'hotel-services';
        DELETE FROM customcontexts_includes_list WHERE `include` = 'hotel-services'");
    foreach ([$profile, array_replace($profile, ['id' => 4, 'name' => 'Custom'])] as $saved) {
        setCustomContextPermissions($saved);
    }
    setCustomContextPermissions(array_replace($profile, ['id' => 5, 'name' => 'Hotel']));

    $ext = new extensions();
    customcontexts_get_config('asterisk');
    foreach ([1, 2, 3, 4] as $id) {
        $context = 'cti-profile-'.$id;
        $includes = array_column($ext->_includes[$context], 'include');
        $hotelIndex = array_search('hotel-services', $includes, true);
        $localIndex = array_search('ext-local', $includes, true);
        check($hotelIndex !== false && count(array_keys($includes, 'hotel-services', true)) === 1,
            'Hotel services missing, duplicated or time-restricted in '.$context);
        check($localIndex !== false && $localIndex < $hotelIndex,
            'Hotel services override internal destinations in '.$context);
        foreach (['outrt-9', $context.'_bad-number', 'bad-number'] as $fallback) {
            $fallbackIndex = array_search($fallback, $includes, true);
            check($fallbackIndex === false || $hotelIndex < $fallbackIndex,
                'Hotel services follow an outbound or invalid-number fallback in '.$context);
        }
    }
    foreach (['cti-profile-3', 'cti-profile-4'] as $context) {
        $includes = array_column($ext->_includes[$context], 'include');
        check(in_array('outrt-9', $includes, true) && !in_array('outrt-7', $includes, true), 'Outbound restrictions changed');
        check(!in_array('from-internal-additional', $includes, true) && !in_array('camere', $includes, true), 'Profile gained unrestricted context access');
    }
    foreach (['hotel', 'from-trunk'] as $context) {
        check(!in_array('hotel-services', array_column($ext->_includes[$context], 'include'), true), 'Hotel services granted to '.$context);
    }
    $_ENV['NETHVOICE_HOTEL'] = 'False';
    setCustomContextPermissions($profile);
    check(!in_array('hotel-services', array_column(permissions('cti-profile-3'), 'include'), true), 'Saving a disabled hotel profile enabled hotel services');
    $unrelated = permissions('manual-services');
    enableHotelServicesForCTIProfiles();
    enableHotelServicesForCTIProfiles();
    $ext = new extensions();
    customcontexts_get_config('asterisk');
    foreach ([1, 2, 3, 4] as $id) {
        check(!in_array('hotel-services', array_column($ext->_includes['cti-profile-'.$id], 'include'), true),
            'Disabling hotel support left a dangling dialplan include');
    }
    check(permissions('manual-services') === $unrelated, 'Cleanup changed an unrelated custom context');
    $_ENV['NETHVOICE_HOTEL'] = 'True';
    enableHotelServicesForCTIProfiles();
    $ext = new extensions();
    customcontexts_get_config('asterisk');
    foreach ([1, 2, 3, 4] as $id) {
        $includes = array_column($ext->_includes['cti-profile-'.$id], 'include');
        $localIndex = array_search('ext-local', $includes, true);
        $hotelIndex = array_search('hotel-services', $includes, true);
        check($localIndex !== false && $hotelIndex !== false && $localIndex < $hotelIndex,
            'Re-enabling hotel support lost access or internal-context precedence');
    }
    echo "PASS: existing and custom profiles, saves, disable/re-enable reloads, internal precedence, room exclusion and route restrictions\n";
} finally {
    $db->exec('DROP DATABASE asterisk');
}
