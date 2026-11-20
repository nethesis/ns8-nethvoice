<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run POST /outboundroutes, POST /physicalextensions and addPhone() against a recording database: request values reach SQL only as bound parameters.
// Check that a customer card template name taken from the URL can never contain a path separator.

namespace FreePBX\modules\Core\Components {
    class Outboundrouting {
        public static array $calls = [];
        public function add(...$args) { self::$calls[] = ['add', $args]; return true; }
        public function setOrder(...$args) { self::$calls[] = ['setOrder', $args]; }
        public function updateTrunks(...$args) { self::$calls[] = ['updateTrunks', $args]; }
    }
}

namespace {
    use FreePBX\modules\Core\Components\Outboundrouting;
    use Slim\Factory\AppFactory;
    use Slim\Psr7\Factory\ServerRequestFactory;
    use Slim\Psr7\Response;

    $rest = __DIR__ . '/../var/www/html/freepbx/rest';
    require $rest . '/vendor/autoload.php';
    require $rest . '/lib/JsonResponse.php';
    require $rest . '/lib/Permissions.php';
    require $rest . '/lib/libExtensions.php';

    function check($condition, $message) {
        if (!$condition) { throw new RuntimeException($message); }
    }

    class RecordingDatabase {
        public array $log = [];
        public array $locales = [];
        public array $phones = [];
        public array $maxLines = ['Snom/M300' => 4];

        public function sql($sql, $type = 'query', $mode = null) {
            $this->log[] = ['sql', $sql];
            if ($sql === 'SELECT DISTINCT `locale` FROM `outbound_routes_locales`' && $type === 'getAll' && $mode === \PDO::FETCH_COLUMN) {
                return array_values(array_unique(array_column($this->locales, 'locale')));
            }
            throw new RuntimeException("unexpected sql(): $sql");
        }

        public function query($sql) {
            $this->log[] = ['query', $sql];
            throw new RuntimeException("unexpected query(): $sql");
        }

        public function prepare($sql) { return new RecordingStatement($this, $sql); }
    }

    class RecordingStatement {
        private array $result = [];

        public function __construct(private RecordingDatabase $db, private string $sql) {}

        public function execute($params = []) {
            $this->db->log[] = ['prepare', $this->sql, $params];
            switch ($this->sql) {
                case 'SELECT * FROM `outbound_routes_locales` where locale=?':
                    $this->result = array_values(array_filter($this->db->locales, fn($row) => $row['locale'] === $params[0]));
                    break;
                case 'SELECT max_lines from `endpointman_model_list` WHERE `model`=? AND `brand` = (SELECT `id` FROM `endpointman_brand_list` WHERE `name` = ?)':
                    $key = $params[1] . '/' . $params[0];
                    $this->result = isset($this->db->maxLines[$key]) ? [['max_lines' => $this->db->maxLines[$key]]] : [];
                    break;
                case 'DELETE IGNORE FROM `rest_devices_phones` WHERE `mac` = ?':
                    $this->db->phones = array_values(array_filter($this->db->phones, fn($row) => $row['mac'] !== $params[0]));
                    break;
                case 'INSERT INTO `rest_devices_phones` (`mac`,`vendor`, `model`) VALUES (?,?,?)':
                    $this->db->phones[] = ['mac' => $params[0], 'vendor' => $params[1], 'model' => $params[2], 'line' => 1];
                    break;
                case 'INSERT INTO `rest_devices_phones` (`mac`,`vendor`, `model`,`line`) VALUES (?,?,?,?)':
                    $this->db->phones[] = ['mac' => $params[0], 'vendor' => $params[1], 'model' => $params[2], 'line' => $params[3]];
                    break;
                default:
                    throw new RuntimeException("unexpected statement: {$this->sql}");
            }
            return true;
        }

        public function fetchAll($mode = null) { return $this->result; }
        public function fetchColumn() { return $this->result ? reset($this->result[0]) : false; }
    }

    class FreePBX {
        public static RecordingDatabase $db;
        public static function Database() { return self::$db; }
    }

    class FakeApp {
        public array $routes = [];
        public function __call($method, $args) { $this->routes[strtoupper($method) . ' ' . $args[0]] = $args[1]; }
    }

    $sandbox = sys_get_temp_dir() . '/rest_bound_parameters_test_' . getmypid();
    mkdir("$sandbox/rest/modules", 0700, true);
    mkdir("$sandbox/admin/modules/core", 0700, true);
    file_put_contents("$sandbox/admin/modules/core/functions.inc.php", '<?php');
    foreach (['routes.php' => 4, 'physicalextensions.php' => 7] as $module => $helpers) {
        $source = str_replace("system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');", 'null;', file_get_contents("$rest/modules/$module"), $count);
        check($count === $helpers, "$module: unexpected number of helper calls ($count)");
        file_put_contents("$sandbox/rest/modules/$module", $source);
    }
    register_shutdown_function(function () use ($sandbox) {
        foreach (['rest/modules/routes.php', 'rest/modules/physicalextensions.php', 'admin/modules/core/functions.inc.php'] as $file) {
            unlink("$sandbox/$file");
        }
        foreach (['rest/modules', 'rest', 'admin/modules/core', 'admin/modules', 'admin', ''] as $dir) {
            rmdir("$sandbox/$dir");
        }
    });

    $app = new FakeApp();
    set_include_path($rest);
    require "$sandbox/rest/modules/routes.php";
    require "$sandbox/rest/modules/physicalextensions.php";

    function call($app, $route, $body, $permissions = ['routes', 'phones']) {
        $request = (new ServerRequestFactory())->createServerRequest('POST', '/')->withParsedBody($body)->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, $permissions);
        $response = $app->routes[$route]($request, new Response(), []);
        return [$response->getStatusCode(), (string) $response->getBody()];
    }

    function resetDatabase() {
        FreePBX::$db = new RecordingDatabase();
        FreePBX::$db->locales = [
            ['id' => 1, 'locale' => 'it', 'key' => 'national', 'prefix_value' => '', 'pattern_value' => '0ZXXX.'],
            ['id' => 2, 'locale' => 'it', 'key' => 'national', 'prefix_value' => '+39', 'pattern_value' => '0ZXXX.'],
            ['id' => 8, 'locale' => 'it', 'key' => 'cellphone', 'prefix_value' => '', 'pattern_value' => '3XXXXXX.'],
            ['id' => 58, 'locale' => 'en', 'key' => 'national', 'prefix_value' => '', 'pattern_value' => '0[1235]XXX.'],
        ];
        FreePBX::$db->phones = [
            ['mac' => 'AA:BB:CC:00:00:01', 'vendor' => 'Yealink', 'model' => 'T46U', 'line' => 1],
            ['mac' => '11:22:33:44:55:66', 'vendor' => 'Fanvil', 'model' => 'X5U', 'line' => 1],
        ];
        Outboundrouting::$calls = [];
    }

    function pattern($prefix, $pass) {
        return ['match_pattern_prefix' => $prefix, 'match_pattern_pass' => $pass, 'match_cid' => '', 'prepend_digits' => ''];
    }

    function added($name, $patterns, $trunks) {
        return ['add', [$name, '', '', '', '', '', 'default', null, $patterns, $trunks, 'new', '']];
    }

    $distinct = ['sql', 'SELECT DISTINCT `locale` FROM `outbound_routes_locales`'];
    $byLocale = 'SELECT * FROM `outbound_routes_locales` where locale=?';

    resetDatabase();
    $body = ['it' => [
        ['name' => 'national_it', 'trunks' => [['trunkid' => '2'], ['trunkid' => '3']]],
        ['name' => 'cellphone_it', 'trunks' => [['trunkid' => '2']]],
        ['name' => 'toll_it', 'trunks' => []],
    ]];
    check(call($app, 'POST /outboundroutes', $body) === [200, ''], 'a supported locale was not accepted');
    check(FreePBX::$db->log === [$distinct, ['prepare', $byLocale, ['it']]], 'the locale did not travel as a bound parameter: ' . json_encode(FreePBX::$db->log));
    check(Outboundrouting::$calls === [
        added('national_it', [pattern('', '0ZXXX.'), pattern('+39', '0ZXXX.')], ['2', '3']),
        added('cellphone_it', [pattern('', '3XXXXXX.')], ['2']),
        added('toll_it', [], []),
    ], 'the default routes of a supported locale changed: ' . json_encode(Outboundrouting::$calls));

    foreach (['xx', 'IT', 'it ', 'en_GB', 0] as $locale) {
        resetDatabase();
        check(call($app, 'POST /outboundroutes', [$locale => [['name' => "national_$locale", 'trunks' => [['trunkid' => '2']]]]]) === [200, ''], "the unsupported locale $locale was refused");
        check(FreePBX::$db->log === [$distinct], "the unsupported locale $locale reached a query");
        check(Outboundrouting::$calls === [added("national_$locale", [], ['2'])], "the unsupported locale $locale did not create a route without patterns");
    }

    foreach (['it"', 'it\\', 'i""t', 'it" OR "1"="1', "zz\"; UPDATE ampusers SET password_sha1=SHA1('x') WHERE username='admin'; -- "] as $locale) {
        resetDatabase();
        check(call($app, 'POST /outboundroutes', [$locale => [['name' => 'national_it', 'trunks' => []]]]) === [400, '{"message":"Unsupported locale"}'], "the locale $locale was not refused");
        check(FreePBX::$db->log === [$distinct], "the locale $locale reached a query");
        check(Outboundrouting::$calls === [], "the locale $locale created routes");
        resetDatabase();
        check(call($app, 'POST /outboundroutes', [$locale => [['name' => 'national_it', 'trunks' => [['trunkid' => '2']]]]], ['superadmin']) === [200, ''], "the locale $locale was refused to the superadmin");
        check(FreePBX::$db->log === [$distinct], "the locale $locale of the superadmin reached a query");
        check(Outboundrouting::$calls === [added('national_it', [], ['2'])], "the locale $locale of the superadmin did not create a route without patterns");
    }

    resetDatabase();
    check(call($app, 'POST /outboundroutes', ['it' => [['route_id' => 7, 'trunks' => [['trunkid' => '2']]], ['route_id' => '9', 'trunks' => []]]]) === [200, ''], 'the routes order was not saved');
    check(FreePBX::$db->log === [], 'saving the routes order queried the locales');
    check(Outboundrouting::$calls === [['setOrder', [7, '0']], ['updateTrunks', [7, ['2'], true]], ['setOrder', ['9', '1']], ['updateTrunks', ['9', [], true]]], 'the routes order changed');

    $delete = 'DELETE IGNORE FROM `rest_devices_phones` WHERE `mac` = ?';
    $insert = 'INSERT INTO `rest_devices_phones` (`mac`,`vendor`, `model`) VALUES (?,?,?)';
    $insertLine = 'INSERT INTO `rest_devices_phones` (`mac`,`vendor`, `model`,`line`) VALUES (?,?,?,?)';

    resetDatabase();
    check(addPhone('AA:BB:CC:00:00:01', 'Yealink', 'T48U') === true, 'an existing phone was not replaced');
    check(FreePBX::$db->log === [['prepare', $delete, ['AA:BB:CC:00:00:01']], ['prepare', $insert, ['AA:BB:CC:00:00:01', 'Yealink', 'T48U']]], 'the MAC did not travel as a bound parameter: ' . json_encode(FreePBX::$db->log));
    check(FreePBX::$db->phones === [
        ['mac' => '11:22:33:44:55:66', 'vendor' => 'Fanvil', 'model' => 'X5U', 'line' => 1],
        ['mac' => 'AA:BB:CC:00:00:01', 'vendor' => 'Yealink', 'model' => 'T48U', 'line' => 1],
    ], 'the stored phones changed');

    foreach (['"OR""="', "x\"; UPDATE ampusers SET password_sha1=SHA1('x') WHERE username='admin'; -- "] as $mac) {
        resetDatabase();
        addPhone($mac, null, 'T46U');
        check(FreePBX::$db->log[0] === ['prepare', $delete, [$mac]], 'a malicious MAC changed the statement');
        check(count(FreePBX::$db->phones) === 3 && FreePBX::$db->phones[0]['mac'] === 'AA:BB:CC:00:00:01', 'a malicious MAC deleted other phones');
    }

    resetDatabase();
    check(addPhone('00:04:13:AA:BB:01', 'Snom', 'M300') === true, 'a multi line phone was not added');
    check(FreePBX::$db->log[0] === ['prepare', 'SELECT max_lines from `endpointman_model_list` WHERE `model`=? AND `brand` = (SELECT `id` FROM `endpointman_brand_list` WHERE `name` = ?)', ['M300', 'Snom']], 'the model lookup did not use bound parameters');
    check(array_slice(FreePBX::$db->log, 1) === [
        ['prepare', $delete, ['00:04:13:AA:BB:01']],
        ['prepare', $insertLine, ['00:04:13:AA:BB:01', 'Snom', 'M300', 1]],
        ['prepare', $insertLine, ['00:04:13:AA:BB:01', 'Snom', 'M300', 2]],
        ['prepare', $insertLine, ['00:04:13:AA:BB:01', 'Snom', 'M300', 3]],
        ['prepare', $insertLine, ['00:04:13:AA:BB:01', 'Snom', 'M300', 4]],
    ], 'the lines of a multi line phone changed');

    resetDatabase();
    FreePBX::$db->maxLines = [];
    check(addPhone('00:04:13:AA:BB:02', 'Snom', 'M700') === true, 'a multi line phone without a known model failed');
    check(count(FreePBX::$db->log) === 2 && FreePBX::$db->log[1] === ['prepare', $delete, ['00:04:13:AA:BB:02']], 'a multi line phone without a known model inserted rows');

    $phone = ['model' => 'T46U', 'line' => null, 'web_user' => 'admin', 'web_password' => 'invented', 'clear_temporary' => null];
    error_reporting(E_ALL & ~E_DEPRECATED);
    foreach ([
        'AA:BB:CC:00:00:02' => 'AA:BB:CC:00:00:02',
        'AA-BB-CC-00-00-03' => 'AA:BB:CC:00:00:03',
        'aa:bb:cc:dd:ee:01' => 'aa:bb:cc:dd:ee:01',
        'AABBCC000004' => 'AABBCC000004',
        'aabb.cc00.0005' => 'aabb.cc00.0005',
    ] as $mac => $stored) {
        resetDatabase();
        check(call($app, 'POST /physicalextensions', ['mac' => $mac] + $phone) === [200, ''], "the MAC $mac was refused");
        check(end(FreePBX::$db->phones)['mac'] === $stored && count(FreePBX::$db->phones) === 3, "the MAC $mac was not stored as $stored");
    }

    foreach (['hello', '"OR""="', "x\"; UPDATE ampusers SET password_sha1=SHA1('x') WHERE username='admin'; -- ", 'AA:BB:CC:00:00', 'AA:BB:CC:00:00:01:02', 'AA:BB:CC:00:00:0G', ' AA:BB:CC:00:00:07', ['AA:BB:CC:00:00:06']] as $mac) {
        resetDatabase();
        check(call($app, 'POST /physicalextensions', ['mac' => $mac] + $phone) === [400, '{"status":"Invalid MAC address"}'], 'the MAC ' . json_encode($mac) . ' was not refused');
        check(FreePBX::$db->log === [], 'the MAC ' . json_encode($mac) . ' reached the database');
    }

    resetDatabase();
    check(call($app, 'POST /physicalextensions', ['mac' => ''] + $phone) === [500, '{"status":"Error adding phone"}'], 'a phone without MAC changed answer');
    check(FreePBX::$db->log === [], 'a phone without MAC reached the database');

    preg_match_all("/\\\$app->(get|post|put|delete)\\('(\\/cti\\/customer_card\\/template[^']*)'/", file_get_contents("$rest/modules/cti.php"), $templateRoutes, PREG_SET_ORDER);
    check(array_map(fn($r) => strtoupper($r[1]) . ' ' . $r[2], $templateRoutes) === ['GET /cti/customer_card/template', 'POST /cti/customer_card/template', 'PUT /cti/customer_card/template/{name}', 'DELETE /cti/customer_card/template/{name}'], 'the customer card template routes changed');

    $slim = AppFactory::create();
    $slim->setBasePath('/freepbx/rest');
    $names = [];
    $slim->delete('/cti/customer_card/template/{name}', function ($request, $response, $args) use (&$names) {
        $names[] = $args['name'];
        return $response;
    });
    $slim->addRoutingMiddleware();
    $slim->addErrorMiddleware(false, false, false);
    $delete = fn($name) => $slim->handle((new ServerRequestFactory())->createServerRequest('DELETE', '/freepbx/rest/cti/customer_card/template/' . $name))->getStatusCode();
    foreach (['..%2F..%2Fsecret', '..%2fsecret', '%2E%2E%2Fsecret', '..%2F', '%2F'] as $name) {
        check($delete($name) === 404, "the template name $name was routed");
    }
    check($names === [], 'a template name with a path separator reached the handler: ' . json_encode($names));
    foreach (['identity', 'mycard', '..', '..%252F..%252Fsecret', '..%5Csecret'] as $name) {
        check($delete($name) === 200, "the template name $name was not routed");
    }
    check($names === ['identity', 'mycard', '..', '..%2F..%2Fsecret', '..\\secret'], 'template names decoded differently: ' . json_encode($names));
    foreach ($names as $name) {
        check(!str_contains($name, '/'), "the template name $name contains a path separator");
    }

    echo "PASS: outbound route locales and phone MACs reach SQL only as bound parameters, template names never contain a path separator\n";
}
