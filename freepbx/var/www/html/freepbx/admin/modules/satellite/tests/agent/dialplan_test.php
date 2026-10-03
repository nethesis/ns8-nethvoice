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
agent_dialplan_assert(strpos($dialplanSource, "new ext_stasis('satellite-agent', 'caller,'") !== false,
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
agent_dialplan_assert(count($ext->entries) === 24, 'Twenty destinations and four shared Agent contexts expected');
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
agent_dialplan_assert(!isset($ext->entries['satellite-agent-destination-1']),
    'Invalid SIP header flow must not enter the dialplan');

FreePBX::$satellite->destinations[0]['cleverai_flow'] = 'flow_1';
FreePBX::$satellite->destinations[0]['fallback_destination'] = 'queueexit-3,${EXTEN},1';
$ext = new AgentDialplanCollector();
satellite_get_config_late('asterisk');
agent_dialplan_assert(agent_dialplan_has($ext->entries['satellite-agent-destination-1'],
    'ext_goto', array('1', '${AGENT_ORIGINAL_DID}', 'queueexit-3')),
    'Dynamic fallback must use the original DID');

agent_dialplan_assert(satellite_change_destination("'ext-local,203,1'", "'ext-local,204,1'") === 1
    && FreePBX::$satellite->changed === array('ext-local,203,1', 'ext-local,204,1'),
    'PDO-quoted destinations must be unquoted and the count returned');
agent_dialplan_assert(satellite_change_destination('', 'x') === 0, 'Empty old destination must be ignored');

echo "Agent dialplan tests passed\n";
