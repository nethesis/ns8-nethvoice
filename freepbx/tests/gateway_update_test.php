#!/usr/bin/env php
<?php

require_once __DIR__ . '/../var/www/html/freepbx/rest/lib/gateway/functions.inc.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

final class Pbx
{
    public static array $config = [];
    public static array $models = [];
    public static array $ports = [];
    public static array $fxs = [];
    public static array $pjsip = [];
    public static array $secrets = [];
    public static array $physical = [];
    public static array $log = [];
    public static array $failingExtensions = [];
    public static ?string $failOn = null;
    public static int $nextRow = 100;
    public static ?array $snapshot = null;

    public static function reset(string $manufacturer = 'Grandstream'): void
    {
        self::$config = [7 => [
            'id' => '7', 'model_id' => '42', 'name' => 'Grandstream-HT813 TLS gateway', 'ipv4' => '',
            'ipv4_new' => '198.51.100.42', 'gateway' => '198.51.100.1', 'ipv4_green' => '192.0.2.10',
            'netmask_green' => '255.255.255.0', 'mac' => 'AA:BB:CC:DD:EE:FF', 'proxy' => 'voice.example.test',
        ], 8 => [
            'id' => '8', 'model_id' => '42', 'name' => 'Grandstream-HT813 TLS gateway', 'ipv4' => '',
            'ipv4_new' => '198.51.100.43', 'gateway' => '198.51.100.1', 'ipv4_green' => '192.0.2.10',
            'netmask_green' => '255.255.255.0', 'mac' => '02:00:00:00:00:08', 'proxy' => 'voice.example.test',
        ]];
        self::$models = ['42' => $manufacturer, '43' => $manufacturer];
        self::$ports = [
            'isdn' => [['id' => '1', 'config_id' => '7', 'trunk' => '11', 'protocol' => 'pp']],
            'pri' => [],
            'fxo' => [
                ['id' => '2', 'config_id' => '7', 'trunk' => '12', 'number' => '0212345670'],
                ['id' => '3', 'config_id' => '7', 'trunk' => '13', 'number' => ''],
                ['id' => '4', 'config_id' => '8', 'trunk' => '14', 'number' => ''],
            ],
        ];
        self::$fxs = [
            ['id' => '5', 'config_id' => '7', 'extension' => '201', 'physical_extension' => '91201', 'secret' => 's91201'],
            ['id' => '6', 'config_id' => '7', 'extension' => '202', 'physical_extension' => '91202', 'secret' => 's91202'],
            ['id' => '9', 'config_id' => '7', 'extension' => '203', 'physical_extension' => '91203', 'secret' => 's91203'],
        ];
        self::$pjsip = [];
        foreach (['11', '12', '13', '14'] as $trunk) {
            self::$pjsip[$trunk] = ['sip_server' => '198.51.100.42', 'aors' => 'trunk-'.$trunk];
        }
        self::$pjsip['13']['aors'] = 'trunk-13,91201,91202,91203';
        self::$secrets = ['91201' => 's91201', '91202' => 's91202', '91203' => 's91203'];
        self::$physical = ['91201' => true, '91202' => true, '91203' => true];
        self::$log = [];
        self::$failingExtensions = [];
        self::$failOn = null;
        self::$snapshot = null;
    }

    public static function state(): array
    {
        return [self::$config, self::$ports, self::$fxs, self::$pjsip];
    }
}

final class FakeStatement
{
    private array $rows = [];

    public function __construct(private string $sql)
    {
    }

    public function execute(array $args = []): bool
    {
        Pbx::$log[] = [$this->sql, $args];
        if (Pbx::$failOn !== null && str_starts_with($this->sql, Pbx::$failOn)) {
            throw new PDOException('forced failure on '.Pbx::$failOn);
        }
        $this->rows = [];
        if (preg_match('/^SELECT id, (.+) FROM gateway_config_(isdn|pri|fxo|fxs) WHERE config_id = \? ORDER BY id$/', $this->sql, $m)) {
            $table = $m[2] === 'fxs' ? Pbx::$fxs : Pbx::$ports[$m[2]];
            foreach ($table as $row) {
                if ($row['config_id'] === (string) $args[0]) {
                    $this->rows[] = $row;
                }
            }
            return true;
        }
        switch ($this->sql) {
            case 'SELECT * FROM gateway_config WHERE id = ?':
                $this->rows = isset(Pbx::$config[(int) $args[0]]) ? [Pbx::$config[(int) $args[0]]] : [];
                break;
            case 'SELECT id FROM gateway_config WHERE mac = ? AND id <> ?':
                foreach (Pbx::$config as $row) {
                    if ($row['mac'] === $args[0] && $row['id'] !== (string) $args[1]) {
                        $this->rows[] = ['id' => $row['id']];
                    }
                }
                break;
            case 'SELECT manufacturer FROM gateway_models WHERE id = ?':
                $this->rows = isset(Pbx::$models[$args[0]]) ? [['manufacturer' => Pbx::$models[$args[0]]]] : [];
                break;
            case 'SELECT data FROM pjsip WHERE keyword = "aors" AND id = ?':
                $this->rows = isset(Pbx::$pjsip[$args[0]]['aors']) ? [['data' => Pbx::$pjsip[$args[0]]['aors']]] : [];
                break;
            case 'REPLACE INTO pjsip (id,keyword,data,flags) VALUES (?,?,?,?)':
                Pbx::$pjsip[$args[0]][$args[1]] = $args[2];
                break;
            case 'SELECT data FROM sip WHERE id = ? AND keyword = "secret"':
                $this->rows = isset(Pbx::$secrets[$args[0]]) ? [['data' => Pbx::$secrets[$args[0]]]] : [];
                break;
            case 'UPDATE rest_devices_phones SET srtp = ? WHERE extension = ?':
                break;
            case 'UPDATE gateway_config SET ipv4 = ?, ipv4_new = ?, gateway = ?, ipv4_green = ?, netmask_green = ?, mac = ?, proxy = ? WHERE id = ?':
                $row = &Pbx::$config[(int) $args[7]];
                [$row['ipv4'], $row['ipv4_new'], $row['gateway'], $row['ipv4_green'], $row['netmask_green'], $row['mac'], $row['proxy']] = array_slice($args, 0, 7);
                break;
            case 'UPDATE gateway_config_isdn SET protocol = ? WHERE id = ?':
            case 'UPDATE gateway_config_fxo SET number = ? WHERE id = ?':
                $type = str_contains($this->sql, 'isdn') ? 'isdn' : 'fxo';
                $field = $type === 'isdn' ? 'protocol' : 'number';
                foreach (Pbx::$ports[$type] as &$port) {
                    if ($port['id'] === $args[1]) {
                        $port[$field] = $args[0];
                    }
                }
                break;
            case 'UPDATE pjsip SET data = ? WHERE id = ? AND keyword = "sip_server"':
                Pbx::$pjsip[$args[1]]['sip_server'] = $args[0];
                break;
            case 'DELETE FROM gateway_config_fxs WHERE config_id = ?':
                Pbx::$fxs = array_values(array_filter(Pbx::$fxs, fn($row) => $row['config_id'] !== (string) $args[0]));
                break;
            case 'INSERT INTO gateway_config_fxs (config_id,extension,physical_extension,secret) VALUES (?,?,?,?)':
                Pbx::$fxs[] = ['id' => (string) Pbx::$nextRow++, 'config_id' => (string) $args[0], 'extension' => $args[1], 'physical_extension' => $args[2], 'secret' => $args[3]];
                break;
            default:
                throw new RuntimeException('Unexpected query: '.$this->sql);
        }
        return true;
    }

    public function fetch($mode = null)
    {
        return array_shift($this->rows) ?? false;
    }

    public function fetchColumn()
    {
        $row = array_shift($this->rows);
        return $row === null ? false : reset($row);
    }
}

final class FakeDatabase
{
    private bool $transaction = false;

    public function prepare(string $sql): FakeStatement
    {
        return new FakeStatement(trim(preg_replace('/\s+/', ' ', str_replace('`', '', $sql))));
    }

    public function beginTransaction(): bool
    {
        Pbx::$log[] = ['BEGIN', []];
        Pbx::$snapshot = Pbx::state();
        $this->transaction = true;
        return true;
    }

    public function commit(): bool
    {
        Pbx::$log[] = ['COMMIT', []];
        $this->transaction = false;
        return true;
    }

    public function rollBack(): bool
    {
        Pbx::$log[] = ['ROLLBACK', []];
        [Pbx::$config, Pbx::$ports, Pbx::$fxs, Pbx::$pjsip] = Pbx::$snapshot;
        $this->transaction = false;
        return true;
    }

    public function inTransaction(): bool
    {
        return $this->transaction;
    }
}

final class FakeCore
{
    public function deleteTrunk($trunkId): void
    {
        Pbx::$log[] = ['deleteTrunk', [$trunkId]];
    }

    public function deleteTrunkDialRulesByID($trunkId): void
    {
        Pbx::$log[] = ['deleteTrunkDialRulesByID', [$trunkId]];
    }
}

final class FreePBX
{
    public static function Database(): FakeDatabase
    {
        static $database = null;
        return $database ??= new FakeDatabase();
    }

    public static function Core(): FakeCore
    {
        return new FakeCore();
    }
}

function core_trunks_add(...$args)
{
    Pbx::$log[] = ['core_trunks_add', $args];
    return 99;
}

function createExtension($mainExtension, $delete = false)
{
    Pbx::$log[] = ['createExtension', [$mainExtension]];
    if (in_array($mainExtension, Pbx::$failingExtensions, true)) {
        return false;
    }
    for ($i = 91; $i <= 98; $i++) {
        if (!isset(Pbx::$physical[$i.$mainExtension])) {
            Pbx::$physical[$i.$mainExtension] = true;
            Pbx::$secrets[$i.$mainExtension] = 's'.$i.$mainExtension;
            return $i.$mainExtension;
        }
    }
    return false;
}

function useExtensionAsCustomPhysical($extension, $secret = false, $type = 'physical')
{
    return true;
}

function deletePhysicalExtension($extension)
{
    Pbx::$log[] = ['deletePhysicalExtension', [$extension]];
    return true;
}

function deleteExtension($extension)
{
    Pbx::$log[] = ['deleteExtension', [$extension]];
    unset(Pbx::$physical[$extension], Pbx::$secrets[$extension]);
    return true;
}

function params(array $overrides = []): array
{
    return $overrides + [
        'name' => 'Grandstream-HT813 TLS gateway',
        'model' => 42,
        'manufacturer' => 'Grandstream',
        'mac' => 'AA:BB:CC:DD:EE:FF',
        'ipv4' => '',
        'ipv4_new' => '198.51.100.42',
        'netmask_green' => '255.255.255.0',
        'gateway' => '198.51.100.1',
        'ipv4_green' => '192.0.2.10',
        'proxy' => 'voice.example.test',
        'trunks_isdn' => [['name' => 1, 'type' => 'pp']],
        'trunks_pri' => [],
        'trunks_fxo' => [['name' => 1, 'number' => '0212345670'], ['name' => 2, 'number' => '']],
        'trunks_fxs' => [
            ['name' => 1, 'linked_extension' => '201'],
            ['name' => 2, 'linked_extension' => '202'],
            ['name' => 3, 'linked_extension' => '203'],
        ],
    ];
}

function calls(string $name): array
{
    return array_values(array_filter(Pbx::$log, fn($entry) => $entry[0] === $name));
}

function writes(): array
{
    return array_values(array_filter(Pbx::$log, fn($entry) => preg_match('/^(UPDATE|INSERT|DELETE|REPLACE)/', $entry[0]) === 1));
}

function fxsOf(string $configId): array
{
    return array_values(array_map(
        fn($row) => [$row['extension'], $row['physical_extension'], $row['secret']],
        array_filter(Pbx::$fxs, fn($row) => $row['config_id'] === $configId),
    ));
}

$tests = [];

$tests['updates the network and the lines in place, keeping trunks and FXS extensions'] = function (): void {
    Pbx::reset();
    $result = updateGateway('7', params([
        'ipv4_new' => '198.51.100.50',
        'gateway' => '198.51.100.254',
        'ipv4_green' => 'pbx.example.test',
        'trunks_isdn' => [['name' => 1, 'type' => 'pmp']],
        'trunks_fxo' => [['name' => 1, 'number' => '+390212345679'], ['name' => 2, 'number' => '0212345671']],
    ]));
    check($result['status'] === true && $result['id'] === '7' && !isset($result['http_status']), 'update failed: '.json_encode($result));
    check(calls('core_trunks_add') === [] && calls('deleteTrunk') === [] && calls('createExtension') === [] && calls('deleteExtension') === [], 'the update recreated trunks or extensions');
    $config = Pbx::$config[7];
    check($config['ipv4_new'] === '198.51.100.50' && $config['gateway'] === '198.51.100.254' && $config['ipv4_green'] === 'pbx.example.test' && $config['name'] === 'Grandstream-HT813 TLS gateway', 'gateway settings not saved');
    check(Pbx::$ports['isdn'][0]['protocol'] === 'pmp', 'ISDN mode not saved');
    check(Pbx::$ports['fxo'][0]['number'] === '+390212345679' && Pbx::$ports['fxo'][1]['number'] === '0212345671', 'FXO numbers not saved');
    foreach (['11', '12', '13'] as $trunk) {
        check(Pbx::$pjsip[$trunk]['sip_server'] === '198.51.100.50', "trunk $trunk still points to the old address");
    }
    check(Pbx::$pjsip['14']['sip_server'] === '198.51.100.42' && Pbx::$ports['fxo'][2]['number'] === '' && Pbx::$config[8]['ipv4_new'] === '198.51.100.43', 'another gateway changed');
    check(fxsOf('7') === [['201', '91201', 's91201'], ['202', '91202', 's91202'], ['203', '91203', 's91203']], 'FXS ports changed');
    check(Pbx::$pjsip['13']['aors'] === 'trunk-13,91201,91202,91203', 'the FXO AOR changed');
};

$tests['replaces and removes FXS users keeping the order of the ports'] = function (): void {
    Pbx::reset();
    $result = updateGateway('7', params(['trunks_fxs' => [
        ['name' => 1, 'linked_extension' => '201'],
        ['name' => 2, 'linked_extension' => '204'],
    ]]));
    check($result['status'] === true, 'update failed: '.json_encode($result));
    check(array_column(calls('createExtension'), 1) === [['204']], 'unexpected extensions created');
    check(fxsOf('7') === [['201', '91201', 's91201'], ['204', '91204', 's91204']], 'FXS ports not in order: '.json_encode(fxsOf('7')));
    check(array_column(calls('deleteExtension'), 1) === [['91202'], ['91203']], 'removed FXS extensions not deleted');
    $commit = array_search(['COMMIT', []], Pbx::$log, true);
    check($commit !== false && array_search(calls('deleteExtension')[0], Pbx::$log, true) > $commit, 'extensions deleted before the configuration was saved');
    check(Pbx::$pjsip['13']['aors'] === 'trunk-13,91201,91204', 'the FXO AOR keeps removed extensions: '.Pbx::$pjsip['13']['aors']);
};

$tests['uses the first FXO trunk of Patton gateways for the FXS AOR'] = function (): void {
    Pbx::reset('Patton');
    Pbx::$pjsip['12']['aors'] = 'trunk-12,91203';
    Pbx::$pjsip['13']['aors'] = 'trunk-13';
    $result = updateGateway('7', params(['trunks_fxs' => [['name' => 0, 'linked_extension' => '201'], ['name' => 1, 'linked_extension' => '202']]]));
    check($result['status'] === true, 'update failed: '.json_encode($result));
    check(Pbx::$pjsip['12']['aors'] === 'trunk-12' && Pbx::$pjsip['13']['aors'] === 'trunk-13', 'wrong FXO AOR updated');
};

$tests['refuses a model change, an unknown gateway, a used MAC address and different ports'] = function (): void {
    foreach ([
        ['7', params(['model' => 43]), 400, 'Gateway model cannot be changed'],
        ['70', params(), 404, 'Gateway configuration not found'],
        ['7', params(['mac' => '02:00:00:00:00:08']), 409, 'Another gateway already uses this MAC address'],
        ['7', params(['mac' => '02:00:00:00:00:08']), 409, 'Another gateway already uses this MAC address', true],
        ['7', params(['trunks_fxo' => [['name' => 1, 'number' => '']]]), 400, 'Gateway ports cannot be changed'],
        ['7', params(['trunks_isdn' => []]), 400, 'Gateway ports cannot be changed'],
        ['7', params(['trunks_fxs' => [['name' => 1, 'linked_extension' => '201'], ['name' => 2, 'linked_extension' => '201']]]), 400, 'Invalid linked extension'],
        ['7', params(['trunks_fxs' => [['name' => 1, 'linked_extension' => '20 1']]]), 400, 'Invalid linked extension'],
        ['7', params(['trunks_fxo' => [['name' => 1, 'number' => '02 1234'], ['name' => 2, 'number' => '']]]), 400, 'Invalid line number'],
        ['7', params(['trunks_fxo' => [['name' => 1, 'number' => ['0212345670']], ['name' => 2, 'number' => '']]]), 400, 'Invalid line number'],
        ['7', params(['ipv4_new' => 'gateway.example.test']), 400, 'Invalid gateway field ipv4_new', true],
        ['7', params(['ipv4_new' => '']), 400, 'Missing gateway field ipv4_new'],
    ] as $case) {
        Pbx::reset();
        $before = Pbx::state();
        $result = updateGateway($case[0], $case[1], $case[4] ?? false);
        check($result['status'] === false && ($result['http_status'] ?? null) === $case[2] && $result['errors'] === [$case[3]], 'unexpected result: '.json_encode([$case[3], $result]));
        check(Pbx::state() === $before && writes() === [] && calls('createExtension') === [], $case[3].' changed the PBX');
    }
};

$tests['keeps the MAC address of the same gateway'] = function (): void {
    Pbx::reset();
    $result = updateGateway('7', params(['mac' => 'aa:bb:cc:dd:ee:ff']), true);
    check($result['status'] === true && Pbx::$config[7]['mac'] === 'AA:BB:CC:DD:EE:FF', 'the same MAC address was refused: '.json_encode($result));
};

$tests['removes the new extensions and keeps the old ones when an FXS user fails'] = function (): void {
    Pbx::reset();
    Pbx::$failingExtensions = ['205'];
    $before = Pbx::state();
    $result = updateGateway('7', params(['trunks_fxs' => [
        ['name' => 1, 'linked_extension' => '204'],
        ['name' => 2, 'linked_extension' => '205'],
    ]]));
    check($result['status'] === false && $result['errors'] === ['Error creating extension'], 'failure not reported: '.json_encode($result));
    check(calls('BEGIN') === [] && Pbx::state() === $before, 'configuration changed after a failure');
    check(array_column(calls('deleteExtension'), 1) === [['91204']], 'created extension not removed or old extensions deleted');
    check(isset(Pbx::$physical['91201'], Pbx::$physical['91202'], Pbx::$physical['91203']), 'old FXS extensions lost');
};

$tests['rolls back the configuration and keeps the old extensions when saving fails'] = function (): void {
    Pbx::reset();
    Pbx::$failOn = 'INSERT INTO gateway_config_fxs';
    $before = Pbx::state();
    $result = updateGateway('7', params(['ipv4_new' => '198.51.100.50', 'trunks_fxs' => [['name' => 1, 'linked_extension' => '204']]]));
    check($result['status'] === false && !isset($result['http_status']), 'failure not reported: '.json_encode($result));
    check(calls('ROLLBACK') !== [] && Pbx::state() === $before, 'configuration not rolled back');
    check(array_column(calls('deleteExtension'), 1) === [['91204']], 'only the created extension must be removed');
};

set_error_handler(static function (int $severity, string $message, string $file, int $line): void {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$failures = 0;
foreach ($tests as $name => $test) {
    try {
        $test();
        echo "PASS: updateGateway $name\n";
    } catch (Throwable $exception) {
        $failures++;
        fwrite(STDERR, "FAIL: updateGateway $name: {$exception->getMessage()}\n");
    }
}
restore_error_handler();
exit($failures === 0 ? 0 : 1);
