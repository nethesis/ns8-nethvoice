<?php
// Run the packaged sipsettings installer and Core transport generator without a PBX.
if ($argc !== 3) { exit(2); }
require $argv[2] . '/functions.inc/Driver.class.php';
require $argv[2] . '/functions.inc/drivers/PJSip.class.php';
const FREEPBX_IS_AUTH = true;
const DB_FETCHMODE_ASSOC = PDO::FETCH_ASSOC;
if (!function_exists('_')) {
    function _($message) { return $message; }
}
function out($message) {}
function freepbx_trim($value) { return trim((string) $value); }

class FreePBX {
    public static object $instance;
    public static function Create() { return self::$instance; }
    public static function Database() { return self::$instance->Database; }
    public static function Sipsettings() { return self::$instance->Sipsettings; }
}
function sql($query, $mode = null, $fetchMode = PDO::FETCH_ASSOC) {
    $result = FreePBX::Database()->query($query);
    return match ($mode) {
        'getAll' => $result->fetchAll($fetchMode),
        'getOne' => $result->fetchColumn(),
        default => $result,
    };
}

$db = new PDO('sqlite::memory:');
$db->exec("CREATE TABLE sipsettings (keyword TEXT, data TEXT, seq INTEGER, type INTEGER);
    CREATE TABLE admin (variable TEXT, value TEXT);
    CREATE TABLE kvstore_Sipsettings (`key` TEXT PRIMARY KEY, val TEXT, type TEXT);
    ATTACH ':memory:' AS information_schema;
    CREATE TABLE information_schema.TABLES (TABLE_NAME TEXT);
    INSERT INTO information_schema.TABLES VALUES ('kvstore_Sipsettings');
    INSERT INTO sipsettings VALUES ('bindport', '5160', 0, 0)");
$ss = new class {
    public function getConfig($key) {
        $stmt = FreePBX::Database()->prepare('SELECT val, type FROM kvstore_Sipsettings WHERE `key` = ?');
        $stmt->execute([$key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) { return false; }
        return $row['type'] === 'json-arr' ? json_decode($row['val'], true) : $row['val'];
    }
    public function setConfig($key, $value) {
        $stmt = FreePBX::Database()->prepare('REPLACE INTO kvstore_Sipsettings (`key`, val, type) VALUES (?, ?, ?)');
        $stmt->execute([$key, is_array($value) ? json_encode($value) : $value, is_array($value) ? 'json-arr' : null]);
    }
};
FreePBX::$instance = (object) [
    'Database' => $db,
    'Sipsettings' => $ss,
    'Config' => new class { public function get($key) { return '22.10.1'; } },
];
$ss->setConfig('binds', ['udp' => ['0.0.0.0' => 'on'], 'tcp' => ['0.0.0.0' => 'on']]);
$ss->setConfig('voicecodecs', ['ulaw' => 1]);
$ss->setConfig('videocodecs', ['h264' => 1]);

function checkUpgrade($scenario, $udpAddress = null, $tcpAddress = null, $udpNetworks = [], $tcpNetworks = []) {
    global $argv;
    for ($pass = 1; $pass <= 2; $pass++) {
        require $argv[1] . '/install.php';
        $driver = new FreePBX\modules\Core\Drivers\PJSip(FreePBX::Create());
        $transports = $driver->getTransportConfigs();
        foreach (['udp' => [$udpAddress, $udpNetworks], 'tcp' => [$tcpAddress, $tcpNetworks]] as $protocol => [$address, $networks]) {
            $transport = $transports['0.0.0.0-' . $protocol];
            if ($transport['bind'] !== '0.0.0.0' ||
                ($transport['external_media_address'] ?? null) !== $address ||
                ($transport['external_signaling_address'] ?? null) !== $address ||
                ($transport['local_net'] ?? []) !== $networks) {
                throw new RuntimeException("$scenario, install $pass, $protocol: " . json_encode($transport));
            }
        }
    }
}

checkUpgrade('no legacy NAT');
$db->exec("INSERT INTO sipsettings VALUES ('externip_val', '192.0.2.10', 40, 0)");
checkUpgrade('legacy address and empty local networks');
$db->exec("INSERT INTO sipsettings VALUES ('localnet_0', '10.1.0.0', 0, 0), ('netmask_0', '24', 0, 0)");
checkUpgrade('legacy address and subnet');

$ss->setConfig('externip', '192.0.2.10');
$ss->setConfig('localnets', [['net' => '10.2.0.0', 'mask' => '24']]);
$ss->setConfig('tcpextip-0.0.0.0', '203.0.113.30');
$ss->setConfig('tcplocalnet-0.0.0.0', '10.3.0.0/24');
$udpNetworks = ['10.2.0.0/24'];
$tcpNetworks = ['10.2.0.0/24', '10.3.0.0/24'];
checkUpgrade('intentional matching address', '192.0.2.10', '203.0.113.30', $udpNetworks, $tcpNetworks);
$ss->setConfig('externip', '198.51.100.20');
checkUpgrade('intentional different address', '198.51.100.20', '203.0.113.30', $udpNetworks, $tcpNetworks);

$ss->setConfig('externip', '');
if (sql("SELECT data FROM sipsettings WHERE keyword='externip_val'", 'getOne') !== '192.0.2.10') {
    throw new RuntimeException('Missing legacy address in the recovery fixture');
}
checkUpgrade('operator-cleared address', null, '203.0.113.30', $udpNetworks, $tcpNetworks);
// The GUI deletes the general localnets key when its last network is cleared.
$ss->setConfig('externip', '192.0.2.10');
$db->exec("DELETE FROM kvstore_Sipsettings WHERE `key` = 'localnets'");
checkUpgrade('operator-cleared networks', '192.0.2.10', '203.0.113.30', [], ['10.3.0.0/24']);
echo "PASS: repeated sipsettings installation preserves PJSIP transport NAT settings\n";
