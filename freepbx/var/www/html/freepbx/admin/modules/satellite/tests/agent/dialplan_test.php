<?php

class AgentDialplanApplication
{
    public $arguments;
    public function __construct(...$arguments) { $this->arguments = $arguments; }
}
class ext_noop extends AgentDialplanApplication {}
class ext_set extends AgentDialplanApplication {}
class ext_execif extends AgentDialplanApplication {}
class ext_return extends AgentDialplanApplication {}
class ext_dial extends AgentDialplanApplication {}
class ext_gotoif extends AgentDialplanApplication {}
class ext_goto extends AgentDialplanApplication {}
class ext_hangup extends AgentDialplanApplication {}
class ext_answer extends AgentDialplanApplication {}
class ext_stasis extends AgentDialplanApplication {}

class AgentDialplanCore
{
    public function listUsers($withNames) { return array(array('201')); }
}

class AgentDialplanCollector
{
    public $entries = array();
    public function add($context, $extension, $priority, $application)
    {
        $this->entries[$context][] = array($extension, $priority, $application);
    }
}

class AgentDialplanSatellite
{
    public $destinations = array();
    public $trunks = array();
    public function getAgentDestinations() { return $this->destinations; }
    public $changed = array();
    public function changeAgentFallbackDestination($old, $new)
    {
        $this->changed = array($old, $new);
        return 1;
    }
    public function getAgentTrunks()
    {
        $rows = array();
        foreach ($this->trunks as $id => $trunk) {
            $rows[] = array_merge(array('id' => $id), $trunk);
        }
        return $rows;
    }
}

class FreePBX
{
    public static $satellite;
    public static function Satellite() { return self::$satellite; }
    public static function Core() { return new AgentDialplanCore(); }
}

function agent_dialplan_assert($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function agent_dialplan_has($entries, $class, array $arguments)
{
    foreach ($entries as $entry) {
        $application = $entry[2];
        if ($application instanceof $class && $application->arguments === $arguments) {
            return true;
        }
    }
    return false;
}

require_once __DIR__ . '/../../functions.inc.php';

// FreePBX ext_stasis($app_name, $args = '') always inserts a comma between
// the two parameters. Putting args into the first parameter adds an extra
// empty argument, which the runtime correctly rejects during admission.
$dialplanSource = file_get_contents(__DIR__ . '/../../functions.inc.php');
agent_dialplan_assert(strpos($dialplanSource, "new ext_stasis(getenv('SATELLITE_AGENT_ARI_APP') ?: 'satellite-agent', 'caller,'") !== false,
    'Built-in Stasis must use the native application/arguments contract');
agent_dialplan_assert(strpos($dialplanSource, '${CHANNEL(endpoint)}') !== false
    && strpos($dialplanSource, '${CHANNEL(pjsip,endpoint)}') === false,
    'Internal provenance must use the installed Asterisk endpoint function');

FreePBX::$satellite = new AgentDialplanSatellite();
for ($id = 1; $id <= 20; ++$id) {
    FreePBX::$satellite->destinations[] = array(
        'id' => $id,
        'freepbx_name' => 'CleverAI_' . $id,
        'agent_type' => 'cleverai',
        'cleverai_trunk_id' => $id <= 10 ? 1 : 2,
        'cleverai_flow' => 'flow_' . $id,
        'fallback_destination' => 'app-blackhole,hangup,1',
        'enabled' => 1,
    );
}
FreePBX::$satellite->trunks = array(
    1 => array('provider' => 'openai', 'openai_project_id' => 'proj_test',
        'freepbx_trunk_name' => 'AgentTrunk_1', 'enabled' => 1),
    2 => array('provider' => 'grok', 'grok_phone_number' => '+390721123456',
        'freepbx_trunk_name' => 'AgentTrunk_2', 'enabled' => 1),
);

$ext = new AgentDialplanCollector();
unset($_ENV['SATELLITE_CALL_TRANSCRIPTION_ENABLED']);
satellite_get_config_late('asterisk');

agent_dialplan_assert(count(satellite_destinations()) === 20, 'All destinations must be advertised');
agent_dialplan_assert(satellite_getdest(12) === array('satellite-agent-destination-12,s,1'),
    'Native destination key must be stable');
agent_dialplan_assert(count(satellite_check_destinations(array('app-blackhole,hangup,1'))) === 20,
    'Fallback references must be advertised');
agent_dialplan_assert(count($ext->entries) === 26, 'Twenty destinations and six shared Agent contexts expected');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-consult-wait'],
    'ext_execif', array('1', 'BridgeWait', 'agent-consult,participant,S(30)')), 'Accepted operator must wait in a bounded native holding bridge');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-consult-connect'],
    'ext_execif', array('1', 'Bridge', '${AGENT_CONSULT_CHANNEL},x')), 'Accepted consultation must bridge the existing leg without redialing');
foreach (array('satellite-agent-provider', 'satellite-agent-handoff', 'satellite-agent-end') as $context) {
    agent_dialplan_assert(isset($ext->entries[$context]), 'Shared Agent context missing: ' . $context);
}
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'],
    'ext_set', array('__AGENT_FLOW', 'flow_1')), 'First destination flow missing');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-2'],
    'ext_set', array('__AGENT_FLOW', 'flow_2')), 'Second destination flow missing');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'],
    'ext_dial', array('PJSIP/AgentTrunk_1/sip:proj_test@sip.api.openai.com:5061\;transport=tls,',
        'b(satellite-agent-add-headers^s^1)')),
    'OpenAI trunk dial missing');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-20'],
    'ext_dial', array('PJSIP/AgentTrunk_2/sip:+390721123456@sip.voice.x.ai:5061\;transport=tls,',
        'b(satellite-agent-add-headers^s^1)')),
    'Grok trunk dial missing');
foreach (FreePBX::$satellite->destinations as $destination) {
    $entries = $ext->entries['satellite-agent-destination-' . $destination['id']];
    $answered = false;
    foreach ($entries as $entry) {
        if ($entry[2] instanceof ext_answer) { $answered = true; }
        if ($entry[2] instanceof ext_dial) {
            agent_dialplan_assert($answered, 'Caller must be answered before dialing the Agent trunk');
        }
    }
}
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-add-headers'],
    'ext_set', array('PJSIP_HEADER(add,X-OS-FLOW)', '${AGENT_FLOW}')),
    'Per-destination flow header missing');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-add-headers'],
    'ext_set', array('PJSIP_HEADER(add,X-OS-Session-ID)', '${AGENT_SESSION_ID}')),
    'Session header missing');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'],
    'ext_set', array('__AGENT_SESSION_ID', '${CHANNEL(linkedid)}')),
    'CleverAI linkedid session identity missing');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-add-headers'],
    'ext_set', array('PJSIP_HEADER(add,isTrunk)', '1')),
    'Trunk header missing');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'],
    'ext_goto', array('1', 'hangup', 'app-blackhole')), 'Fallback missing');

FreePBX::$satellite->destinations[0]['cleverai_flow'] = "bad\r\nX-Evil: yes";
$ext = new AgentDialplanCollector();
satellite_get_config_late('asterisk');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'], 'ext_goto', array('1', 'hangup', 'app-blackhole')),
    'Invalid SIP header flow must retain a safe fallback context');

FreePBX::$satellite->destinations[0]['cleverai_flow'] = 'flow_1';
FreePBX::$satellite->destinations[0]['fallback_destination'] = 'queueexit-3,${EXTEN},1';
$ext = new AgentDialplanCollector();
satellite_get_config_late('asterisk');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'],
    'ext_goto', array('1', '${AGENT_ORIGINAL_DID}', 'queueexit-3')),
    'Dynamic fallback must use the original DID');

// Workflow calls enter Stasis on the incoming caller channel.
FreePBX::$satellite->destinations[0]['agent_type'] = 'workflow';
FreePBX::$satellite->destinations[0]['workflow_binding_id'] = 1;
FreePBX::$satellite->destinations[0]['workflow_version'] = 1;
FreePBX::$satellite->destinations[0]['workflow_agent_id'] = 'call-router';
$ext = new AgentDialplanCollector();
satellite_get_config_late('asterisk');
$entries = $ext->entries['satellite-agent-destination-1'];
$answered = false;
$enteredStasis = false;
foreach ($entries as $entry) {
    if ($entry[2] instanceof ext_answer) { $answered = true; }
    if ($entry[2] instanceof ext_stasis) {
        agent_dialplan_assert($answered, 'Workflow caller must be answered before entering Stasis');
        $enteredStasis = true;
    }
}
agent_dialplan_assert($enteredStasis, 'Workflow must enter the Agent runtime');

agent_dialplan_assert(satellite_change_destination("'ext-local,203,1'", "'ext-local,204,1'") === 1
    && FreePBX::$satellite->changed === array('ext-local,203,1', 'ext-local,204,1'),
    'PDO-quoted destinations must be unquoted and the count returned');
agent_dialplan_assert(satellite_change_destination('', 'x') === 0, 'Empty old destination must be ignored');

echo "Agent dialplan tests passed\n";

// Disabled and malformed rows keep their native context and fallback.
FreePBX::$satellite->destinations[0]['enabled'] = 0;
FreePBX::$satellite->destinations[0]['fallback_destination'] = 'app-blackhole,hangup,1';
FreePBX::$satellite->destinations[1]['cleverai_flow'] = 'invalid flow';
$ext = new AgentDialplanCollector();
satellite_generate_agent_dialplan();
foreach (array(1, 2) as $id) {
    $entries = $ext->entries['satellite-agent-destination-' . $id];
    agent_dialplan_assert(agent_dialplan_has($entries, 'ext_goto', array('1', 'hangup', 'app-blackhole')), 'Disabled/invalid destination must use its fallback');
    foreach ($entries as $entry) { agent_dialplan_assert(!$entry[2] instanceof ext_dial, 'Disabled destination must not call a provider'); }
}
echo "Disabled and invalid fallback contexts passed\n";

// A configured Stasis application must agree with Satellite's ARI app.
FreePBX::$satellite->destinations[0]['enabled'] = 1;
putenv('SATELLITE_AGENT_ARI_APP=synthetic-agent-app');
$ext = new AgentDialplanCollector();
satellite_generate_agent_dialplan();
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'],
    'ext_stasis', array('synthetic-agent-app', 'caller,1,workflow')), 'Configured Agent ARI application was ignored');
putenv('SATELLITE_AGENT_ARI_APP');
echo "Configured Agent ARI application passed\n";
