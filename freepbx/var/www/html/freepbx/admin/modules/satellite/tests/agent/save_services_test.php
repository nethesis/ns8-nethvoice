<?php

require_once __DIR__ . '/../../lib/AgentSession.php';
session_save_path(sys_get_temp_dir());
$helperToken = AgentSession::csrfToken();
if (!preg_match('/^[a-f0-9]{64}$/D', $helperToken)) {
    throw new RuntimeException('CSRF helper did not generate a 32-byte hex token');
}
AgentSession::assertCsrfToken($helperToken);

class FreePBX_Helpers { public $db; }
interface BMO {}

require_once __DIR__ . '/../../Satellite.class.php';

$reloads = 0;
function needreload() {
    global $reloads;
    $reloads++;
}

function serviceCheck($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function serviceReject($callback, $message) {
    try {
        $callback();
    } catch (InvalidArgumentException $error) {
        return;
    } catch (RuntimeException $error) {
        return;
    }
    throw new RuntimeException($message);
}

class ServiceDb {
    public $begins = 0;
    public $commits = 0;
    public $rollbacks = 0;
    public $destinations;
    private $snapshot;
    public function beginTransaction() {
        $this->begins++;
        $this->snapshot = $this->destinations->rows;
    }
    public function commit() { $this->commits++; }
    public function rollBack() {
        $this->rollbacks++;
        $this->destinations->rows = $this->snapshot;
    }
}

class ServiceDestinations extends AgentDestinationRepository {
    public $rows = array();
    public $updates = array();
    public $failOnUpdate = null;
    public function __construct() {}
    public function listAll() { return array_values($this->rows); }
    public function getById($id) { return isset($this->rows[(int) $id]) ? $this->rows[(int) $id] : null; }
    public function validateInput(array $input) {
        if (in_array($input['agent_type'] ?? 'cleverai', array('builtin_internal', 'builtin_external'), true)) {
            return array('agent_type' => $input['agent_type'], 'cleverai_trunk_id' => null,
                'cleverai_flow' => null, 'fallback_destination' => AgentValidation::validateFallback($input['fallback_destination'] ?? null),
                'enabled' => 1);
        }
        if ((int) ($input['cleverai_trunk_id'] ?? 0) !== 7) {
            throw new InvalidArgumentException('CleverAI trunk not found');
        }
        return array(
            'cleverai_trunk_id' => 7,
            'cleverai_flow' => AgentValidation::validateFlow($input['cleverai_flow'] ?? null),
            'fallback_destination' => AgentValidation::validateFallback($input['fallback_destination'] ?? null),
            'enabled' => 1,
        );
    }
    public function update($id, array $input) {
        if ((int) $id === $this->failOnUpdate) {
            throw new RuntimeException('Injected update failure');
        }
        $this->updates[] = (int) $id;
        $this->rows[(int) $id] = array_merge($this->rows[(int) $id], $input);
    }
    public function create(array $input) {
        $id = 12;
        $this->rows[$id] = array_merge(array('id' => $id, 'system_managed' => 0, 'agent_type' => 'cleverai'), $input);
        return $id;
    }
}

class ServiceTrunks extends AgentTrunkRepository {
    public $created = null;
    public function __construct() {}
    public function create(array $input) {
        $this->created = $input;
        throw new InvalidArgumentException('Stopped before provisioning');
    }
}

function serviceSet($object, $name, $value) {
    $property = new ReflectionProperty(Satellite::class, $name);
    $property->setAccessible(true);
    $property->setValue($object, $value);
}

$service = (new ReflectionClass(Satellite::class))->newInstanceWithoutConstructor();
$db = new ServiceDb();
$destinations = new ServiceDestinations();
$destinations->rows = array(
    1 => array('id' => 1, 'system_managed' => 0, 'agent_type' => 'cleverai', 'cleverai_trunk_id' => 7,
        'cleverai_flow' => 'one', 'fallback_destination' => null),
    2 => array('id' => 2, 'system_managed' => 0, 'agent_type' => 'cleverai', 'cleverai_trunk_id' => 7,
        'cleverai_flow' => 'two', 'fallback_destination' => null),
    3 => array('id' => 3, 'system_managed' => 0, 'agent_type' => 'cleverai', 'cleverai_trunk_id' => 7,
        'cleverai_flow' => 'three', 'fallback_destination' => 'satellite-agent-destination-1,s,1'),
);
serviceSet($service, 'db', $db);
serviceSet($service, 'agentDestinations', $destinations);
$db->destinations = $destinations;

$normalized = $service->validateAgentDestination(array('cleverai_flow' => ' edited ',
    'fallback_destination' => ' ext-local,203,1 '), 1);
serviceCheck($normalized['cleverai_flow'] === 'edited' &&
    $normalized['fallback_destination'] === 'ext-local,203,1', 'Destination inputs were not normalized');

serviceReject(function () use ($service) {
    $service->saveAgentDestinationBatch(array(1 => array(
        'fallback_destination' => 'satellite-agent-destination-3,s,1')));
}, 'Stored off-canvas cycle was accepted');
serviceCheck($db->rollbacks === 1 && !$destinations->updates && $reloads === 0,
    'Invalid batch changed a destination');

serviceReject(function () use ($service) {
    $service->saveAgentDestinationBatch(array(
        1 => array('fallback_destination' => 'satellite-agent-destination-2,s,1'),
        2 => array('fallback_destination' => 'satellite-agent-destination-1,s,1'),
    ));
}, 'Cycle formed by two edits was accepted');
serviceCheck($db->rollbacks === 2 && !$destinations->updates, 'Second invalid batch changed a destination');

$service->saveAgentDestinationBatch(array(
    1 => array('fallback_destination' => 'satellite-agent-destination-2,s,1'),
    3 => array('fallback_destination' => 'ext-local,203,1'),
));
serviceCheck($destinations->updates === array(1, 3) && $db->commits === 1 && $reloads === 1,
    'Valid batch did not update both destinations in one transaction');

$destinations->rows[4] = array('id' => 4, 'system_managed' => 0, 'agent_type' => 'cleverai',
    'cleverai_trunk_id' => 7, 'cleverai_flow' => 'four',
    'fallback_destination' => 'satellite-agent-destination-5,s,1');
$destinations->rows[5] = array('id' => 5, 'system_managed' => 0, 'agent_type' => 'cleverai',
    'cleverai_trunk_id' => 7, 'cleverai_flow' => 'five',
    'fallback_destination' => 'satellite-agent-destination-4,s,1');
$service->saveAgentDestinationBatch(array(2 => array('cleverai_flow' => 'two-edited')));
serviceCheck($destinations->rows[2]['cleverai_flow'] === 'two-edited' && $db->commits === 2 && $reloads === 2,
    'An unrelated stored cycle blocked an unaffected edit');

$beforeFailure = $destinations->rows;
$destinations->failOnUpdate = 3;
serviceReject(function () use ($service) {
    $service->saveAgentDestinationBatch(array(
        1 => array('cleverai_flow' => 'one-failed'),
        3 => array('cleverai_flow' => 'three-failed'),
    ));
}, 'Injected second update failure was ignored');
$destinations->failOnUpdate = null;
serviceCheck($db->rollbacks === 3 && $db->commits === 2 && $reloads === 2 &&
    $destinations->rows === $beforeFailure, 'Failed second update was not rolled back');

serviceCheck($service->saveAgentDestination(array('cleverai_trunk_id' => 7,
    'cleverai_flow' => ' new ', 'fallback_destination' => ''), null) === 12,
    'Creation did not return the persistent ID');
serviceCheck($destinations->rows[12]['cleverai_flow'] === 'new' && $reloads === 3,
    'Creation did not use normalized values or request reload');

$destinations->rows[2]['system_managed'] = 1;
serviceReject(function () use ($service) {
    $service->saveAgentDestination(array('cleverai_flow' => 'blocked'), 2);
}, 'System-managed destination was editable');

$destinations->rows[20] = array('id' => 20, 'system_managed' => 1, 'agent_type' => 'builtin_internal',
    'cleverai_trunk_id' => null, 'cleverai_flow' => null, 'fallback_destination' => null);
$service->saveAgentDestination(array('fallback_destination' => 'ext-local,203,1'), 20);
serviceCheck($destinations->rows[20]['fallback_destination'] === 'ext-local,203,1' &&
    $destinations->rows[20]['agent_type'] === 'builtin_internal', 'Built-in fallback edit failed');
serviceReject(function () use ($service) {
    $service->saveAgentDestination(array('agent_type' => 'builtin_external'), 20);
}, 'Built-in identity edit accepted');
serviceReject(function () use ($service) {
    $service->saveAgentDestination(array('fallback_destination' => 'satellite-agent-destination-20,s,1'), 20);
}, 'Built-in self fallback accepted');
$service->saveAgentDestination(array('fallback_destination' => null), 20);
serviceCheck($destinations->rows[20]['fallback_destination'] === null, 'Built-in fallback clearing failed');

$trunks = new ServiceTrunks();
serviceSet($service, 'agentTrunks', $trunks);
serviceReject(function () use ($service) {
    $service->saveAgentTrunk(array('name' => ' Agent ', 'provider' => 'openai',
        'openai_project_id' => ' proj_test ', 'sip_auth_password' => null,
        'ignored' => 'not persisted'));
}, 'Trunk test did not reach repository');
serviceCheck($trunks->created['name'] === 'Agent' &&
    $trunks->created['openai_project_id'] === 'proj_test' &&
    $trunks->created['sip_auth_password'] === '' &&
    !isset($trunks->created['ignored']), 'Trunk input was not trimmed and whitelisted');

$token = $service->agentCsrfToken();
serviceCheck($token === $helperToken && AgentSession::csrfToken() === $helperToken,
    'CSRF token was not reused across helper and Satellite');
$service->assertAgentCsrfToken($token);
foreach (array('' => 'missing', 'null' => 'literal null', 'wrong' => 'wrong') as $invalid => $label) {
    serviceReject(function () use ($invalid) {
        AgentSession::assertCsrfToken($invalid);
    }, 'CSRF helper accepted ' . $label . ' token');
    serviceReject(function () use ($service, $invalid) {
        $service->assertAgentCsrfToken($invalid);
    }, 'Satellite accepted ' . $label . ' token');
}
serviceReject(function () {
    AgentSession::assertCsrfToken(null);
}, 'CSRF helper accepted null token');
serviceReject(function () use ($service) {
    $service->assertAgentCsrfToken(null);
}, 'Satellite accepted null token');

echo "Agent save service tests passed\n";

// PHP truncates a large form before its final sentinel. Reject it before a write.
$profileMethod = new ReflectionMethod(Satellite::class, 'handleAgentProfileRequest');
$profileMethod->setAccessible(true);
$emptySatellite = (new ReflectionClass(Satellite::class))->newInstanceWithoutConstructor();
$_POST = array('action' => 'save', 'greeting' => 'Synthetic greeting');
serviceReject(function () use ($profileMethod, $emptySatellite) {
    $profileMethod->invoke($emptySatellite, 'external');
}, 'A truncated profile form must be rejected before modifying stored settings');
echo "Truncated profile form rejection passed\n";
