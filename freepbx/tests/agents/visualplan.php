<?php
if (($argv[1] ?? '') === '--save-endpoint') {
    // Minimal FreePBX bootstrap for the endpoint's own session and native writes.
    interface BMO {}
    class FreePBX_Helpers {}
    final class VisualPlanTestUser {
        public function __construct(public string $username) {}
        public function getMode(): string
        { return $this->username === 'userman-admin' ? 'usermanager' : 'database'; }
        public function checkSection(string $section): bool
        { return $section === 'visualplan' || ($section === '*' && $this->username !== 'operator'); }
        public function getAmpUser(string $username): array
        { return ['sections' => in_array($username, ['admin', 'userman-admin'], true) ? ['*'] : ['visualplan']]; }
    }
    final class FreePBX {
        public static ?PDO $db = null;
        public static function Database(): PDO
        {
            ++$GLOBALS['agentLookups'];
            return self::$db ?? throw new LogicException('unexpected_agent_lookup');
        }
        public static function Satellite(): object
        {
            return new class {
                public function agentDestinations(): array { return [['agent_id' => 'internal', 'routable' => true]]; }
                public function agentTrunkReady(array $binding): bool { return true; }
            };
        }
    }
    function core_did_get($extension, $cidnum) { return false; }
    function core_did_add($route, $destination) { $GLOBALS['nativeDestinations'][] = $destination; }
    function system($command) { return ''; }

    // Supply the HTTP request body through stdin while using the CLI preview settings fixture.
    final class VisualPlanTestInput {
        public $context;
        public function stream_open($path, $mode, $options, &$openedPath): bool { return $path === 'php://input'; }
        public function stream_read(int $count): string { return fread(STDIN, $count); }
        public function stream_eof(): bool { return feof(STDIN); }
        public function stream_stat(): array { return fstat(STDIN); }
    }
    [$script, $mode, $temp, $username, $csrf] = $argv;
    if (in_array('--with-database', $argv, true)) {
        $db = new PDO(getenv('M0_TEST_DSN'), 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        FreePBX::$db = $db;
        // Use the foundation database schema with rows local to this connection.
        foreach (['agents', 'bindings', 'drafts', 'versions'] as $table) {
            $db->exec("CREATE TEMPORARY TABLE asterisk.visualplan_$table LIKE asterisk.voice_agent_$table");
            $db->exec("ALTER TABLE asterisk.visualplan_$table RENAME TO asterisk.voice_agent_$table");
        }
        $root = __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents';
        $published = json_decode(file_get_contents($root . '/contracts/published-v8.example.json'), true, 512, JSON_THROW_ON_ERROR);
        $published['agent_id'] = 'internal';
        $published['destination_id'] = 'agent:internal';
        $published['conversation']['model'] = 'gpt-live-1';
        $db->exec("INSERT INTO asterisk.voice_agent_agents (agent_id, name, destination_id, revision, enabled, sync_status, active_workflow_version)
            VALUES ('internal', 'Test Agent', 'agent:internal', 3, 1, 'synced', 1)");
        $db->exec("INSERT INTO asterisk.voice_agent_bindings (binding_id, name, provider, settings_json, secrets_encrypted, sync_status)
            VALUES ('provider_test', 'Test Binding', 'openai', '{}', '', 'synced')");
        $db->prepare("INSERT INTO asterisk.voice_agent_versions (agent_id, workflow_version, definition_json) VALUES ('internal', 1, ?)")
            ->execute([json_encode($published, JSON_THROW_ON_ERROR)]);
    }
    putenv('FREEPBX_CONF=' . __FILE__);
    putenv('VOICE_AGENT_SETTINGS_FILE=' . $temp . '/preview.env');
    session_save_path($temp);
    session_id('visualplan-test');
    session_start();
    $_SESSION = ['AMP_user' => new VisualPlanTestUser($username), 'visualplan_agent_csrf' => 'test-csrf'];
    session_write_close();
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['HTTP_X_VISUALPLAN_AGENT_CSRF'] = $csrf;
    stream_wrapper_unregister('php');
    stream_wrapper_register('php', VisualPlanTestInput::class);
    $agentLookups = 0;
    $nativeDestinations = [];
    register_shutdown_function(static function () use (&$agentLookups, &$nativeDestinations) {
        echo "\n", json_encode([http_response_code() ?: 200, $agentLookups, $nativeDestinations]);
    });
    require __DIR__ . '/../../var/www/html/freepbx/admin/modules/visualplan/htdocs/create.php';
    exit;
}

require_once __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/VisualPlan.php';
use NethVoice\Agents\VisualPlan;
$agent=['agent_id'=>'internal','name'=>'Internal','kind'=>'builtin','routable'=>true,'published'=>['fallback_destination_id'=>'extension:203'],'revision'=>3];
$widget=VisualPlan::widget($agent, ['base_agent_string'=>'Agent','base_details_string'=>'Configure']);
assert($widget['userData']['agent_id']==='internal');
assert(VisualPlan::resolve($widget, fn($id)=>$agent)==='voice-agent-internal,s,1');
assert(count(array_filter($widget['entities'], fn($e)=>$e['type']==='output'))===1);
$connection=['source'=>['node'=>'incoming%test','port'=>'output_incoming%test'],'target'=>['node'=>$widget['id'],'port'=>'input_'.$widget['id']]];
VisualPlan::validateGraph([$widget],[$connection],fn($id)=>$agent);
foreach ([[[],[$connection]],[[$widget],[array_replace($connection,['source'=>['node'=>$widget['id']]])]],[[$widget],[array_replace($connection,['target'=>['node'=>$widget['id'],'port'=>'forged']])]]] as [$widgets,$connections]) {
    try { VisualPlan::validateGraph($widgets,$connections,fn($id)=>$agent); throw new Exception('unsafe_graph_accepted'); }
    catch (RuntimeException $error) { assert(in_array($error->getMessage(),['invalid_agent_reference','fallback_cycle'],true)); }
}
foreach ([['id'=>'satellite-agent-destination%../bad','userData'=>['agent_id'=>'../bad']], ['id'=>'satellite-agent-destination%internal','userData'=>['agent_id'=>'external']]] as $invalid) {
    try { VisualPlan::resolve($invalid,fn($id)=>$agent); throw new Exception('unsafe_widget_accepted'); }
    catch (RuntimeException $error) { assert(in_array($error->getMessage(),['invalid_agent_reference','fallback_cycle'],true)); }
}
$hangup=['id'=>'app-blackhole%hangup'];
$fallback=['source'=>['node'=>$widget['id'],'port'=>'output_agent_fallback%internal'],'target'=>['node'=>$hangup['id'],'port'=>'input_'.$hangup['id']]];
VisualPlan::validateGraph([$widget,$hangup],[$connection,$fallback],fn($id)=>$agent);
$back=['source'=>['node'=>$hangup['id'],'port'=>'output_back'],'target'=>['node'=>$widget['id'],'port'=>'input_'.$widget['id']]];
foreach ([[$fallback,$fallback],[$fallback,$back],[array_replace($fallback,['source'=>['node'=>$widget['id'],'port'=>'output_forged']])],[array_replace($fallback,['target'=>['node'=>'missing','port'=>'input_missing']])]] as $edges) {
    try { VisualPlan::validateGraph([$widget,$hangup],$edges,fn($id)=>$agent); throw new Exception('unsafe_fallback_accepted'); }
    catch (RuntimeException $error) { assert(in_array($error->getMessage(),['invalid_agent_reference','fallback_cycle'],true)); }
}
$agent['routable']=false;
try { VisualPlan::resolve($widget,fn($id)=>$agent); throw new Exception('disabled_agent_accepted'); }
catch (RuntimeException $error) { assert($error->getMessage()==='agent_not_ready'); }
echo "VisualPlan stable references and readiness passed\n";

$temp = sys_get_temp_dir() . '/visualplan-test-' . bin2hex(random_bytes(8));
mkdir($temp, 0700);
file_put_contents($temp . '/preview.env', "VOICE_AGENT_ENABLED=true\n");
try {
    $native = ['type' => 'Base', 'id' => 'incoming%test', 'entities' => [['id' => 'incoming%test', 'text' => '201/202 (Test route)']]];
    $agentConnection = ['type' => 'MyConnection'] + $connection;
    $cases = [
        ['operator', 'test-csrf', [$native, $widget], 403, ['error' => 'forbidden'], 0, []],
        ['revoked', 'test-csrf', [$native, $widget], 403, ['error' => 'forbidden'], 0, []],
        ['userman-admin', 'test-csrf', [$native, $widget], 403, ['error' => 'forbidden'], 0, []],
        ['operator', 'test-csrf', [$native, $agentConnection], 403, ['error' => 'forbidden'], 0, []],
        ['admin', 'wrong-csrf', [$native, $agentConnection], 403, ['error' => 'forbidden'], 0, []],
        ['admin', 'test-csrf', [$native, $agentConnection], 422, ['error' => 'agent_reference_unavailable'], 0, []],
        ['operator', '', [$native], 200, ['success' => []], 0, ['']],
    ];
    if (getenv('M0_TEST_DSN')) {
        $cases[] = ['admin', 'test-csrf', [$native, $widget, $agentConnection], 200, ['success' => []], 3, ['voice-agent-internal,s,1']];
        $staleWidget = $widget;
        --$staleWidget['userData']['revision'];
        $cases[] = ['admin', 'test-csrf', [$native, $staleWidget, $agentConnection], 409, ['error' => 'agent_revision_conflict'], 1, []];
    }
    foreach ($cases as [$user, $csrf, $body, $status, $response, $lookups, $destinations]) {
        $command = [PHP_BINARY, '-d', 'disable_functions=system', __FILE__, '--save-endpoint', $temp, $user, $csrf];
        if ($lookups) $command[] = '--with-database';
        $process = proc_open($command,
            [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes);
        assert(is_resource($process));
        fwrite($pipes[0], json_encode($body));
        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        assert($exit === 0 && $stderr === '', $stderr);
        [$actualResponse, $observed] = explode("\n", $output, 2);
        assert(json_decode($observed, true) === [$status, $lookups, $destinations], $output);
        assert(json_decode($actualResponse, true) === $response, $output);
    }
} finally {
    foreach (glob($temp . '/*') as $file) unlink($file);
    rmdir($temp);
}
echo "VisualPlan save authorization and native saves passed\n";
