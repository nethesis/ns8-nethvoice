<?php

define('NETHVPLAN_CREATE_LIBRARY_MODE', true);
require_once __DIR__ . '/../htdocs/create.php';
require_once __DIR__ . '/../../satellite/functions.inc.php';

function check($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function rejects($callback, $message)
{
    try {
        $callback();
    } catch (InvalidArgumentException $error) {
        return;
    }
    throw new RuntimeException($message);
}

class GraphSatellite
{
    public $rows = array();
    public $created = array();
    public $batch = array();
    public $nextId = 100;
    public $failBatch = false;
    public function getAgentDestinations() { return array_values($this->rows); }
    public function getAgentDestination($id) { return $this->rows[$id] ?? null; }
    public function validateAgentDestination($input, $id = null)
    {
        if ($id !== null && !isset($this->rows[$id])) {
            throw new InvalidArgumentException('Missing agent');
        }
        if (($input['agent_type'] ?? 'cleverai') === 'cleverai' &&
            ($input['cleverai_trunk_id'] !== 1 || $input['cleverai_flow'] === '')) {
            throw new InvalidArgumentException('Invalid agent');
        }
        return $input;
    }
    public function saveAgentDestination($input)
    {
        $id = $this->nextId++;
        $this->created[] = $id;
        $this->rows[$id] = array_merge($input, array('id' => $id));
        return $id;
    }
    public function saveAgentDestinationBatch($changes)
    {
        if ($this->failBatch) { throw new RuntimeException('Batch failed'); }
        $this->batch = $changes;
        foreach ($changes as $id => $input) {
            $this->rows[$id] = array_merge($this->rows[$id], $input);
        }
    }
}

function agent($suffix, $id = null, $touched = false)
{
    return array('type' => 'Base', 'id' => 'satellite-agent-destination%' . $suffix,
        'userData' => array('id' => $id, 'cleverai_trunk_id' => 1,
            'cleverai_flow' => 'sales', 'fallback_touched' => $touched));
}

function linkTo($source, $target)
{
    return array('type' => 'MyConnection',
        'source' => array('node' => $source['id'], 'port' => 'output_agent_fallback%' . explode('%', $source['id'], 2)[1]),
        'target' => array('node' => $target['id'], 'port' => 'input_' . $target['id']));
}

$satellite = new GraphSatellite();
$a = agent('new-a');
$b = agent('new-b');
$widgetArray = array($a, $b);
$connectionArray = array(linkTo($a, $b));
$graph = new NethvplanAgentGraph($satellite, $widgetArray, $connectionArray);
check(!$satellite->created, 'Preflight performed writes');
$currentCreated = $graph->allocate();
$graph->allocate();
check(count($satellite->created) === 2, 'Allocation was not idempotent within a save');
$returnedIdArray = array();
$currentVisited = array();
$resolved = nethvplan_getDestination($a, $connectionArray);
check($resolved['output_agent_fallback%new-a'] === 'satellite-agent-destination-101,s,1', 'Native Agent destination mapping failed');
check(nethvplan_switchCreate('satellite-agent-destination', $b, $connectionArray) === 101, 'Shared target ID changed');
$graph->save(function ($widget) use ($connectionArray) {
    $links = nethvplan_getDestination($widget, $connectionArray);
    return $links['output_agent_fallback%' . explode('%', $widget['id'], 2)[1]] ?? null;
});
check($satellite->batch[100]['fallback_destination'] === 'satellite-agent-destination-101,s,1', 'New Agent fallback was lost');
check($satellite->batch[101]['fallback_destination'] === null, 'Unconnected new Agent must have no fallback');

rejects(function () use ($a) { new NethvplanAgentGraph(new GraphSatellite(), array($a), array(linkTo($a, $a))); }, 'Self-cycle accepted');
rejects(function () use ($a, $b) { new NethvplanAgentGraph(new GraphSatellite(), array($a, $b), array(linkTo($a, $b), linkTo($b, $a))); }, 'Two-agent cycle accepted');
$other = array('type' => 'Base', 'id' => 'app-blackhole%hangup');
rejects(function () use ($a, $b, $other) { new NethvplanAgentGraph(new GraphSatellite(), array($a, $b, $other), array(linkTo($a, $b), linkTo($a, $other))); }, 'Multiple fallback edges accepted');

$satellite = new GraphSatellite();
foreach (array(1 => 'satellite-agent-destination-2,s,1', 2 => null, 3 => 'satellite-agent-destination-1,s,1') as $id => $fallback) {
    $satellite->rows[$id] = array('id' => $id, 'cleverai_trunk_id' => 1, 'cleverai_flow' => 'sales', 'fallback_destination' => $fallback);
}
$a = agent('a', 1, true);
$b = agent('b', 2, true);
$graph = new NethvplanAgentGraph($satellite, array($b, $a), array(linkTo($b, $a)));
$graph->allocate();
$graph->save(function () { return 'satellite-agent-destination-1,s,1'; });
check($satellite->batch[1]['fallback_destination'] === null && $satellite->batch[2]['fallback_destination'] === 'satellite-agent-destination-1,s,1', 'Valid reversal depended on node order');
$external = agent('external', 3);
rejects(function () use ($satellite, $a, $external) { new NethvplanAgentGraph($satellite, array($a, $external), array(linkTo($a, $external))); }, 'Cycle through stored agent accepted');
rejects(function () use ($satellite) { new NethvplanAgentGraph($satellite, array(agent('a', 1), agent('copy', 1)), array()); }, 'Duplicate persistent Agent accepted');

$satellite->rows[1]['fallback_destination'] = 'custom-handler,entry,7';
$untouched = agent('opaque', 1);
$graph = new NethvplanAgentGraph($satellite, array($untouched), array());
$graph->allocate();
$graph->save(function () { throw new RuntimeException('Untouched fallback was resolved'); });
check($satellite->batch[1]['fallback_destination'] === 'custom-handler,entry,7', 'Opaque or missing fallback did not round-trip exactly');
$opaqueTarget = array('type' => 'Base', 'id' => 'custom-handler%entry');
$touched = agent('opaque', 1, true);
$graph = new NethvplanAgentGraph($satellite, array($touched, $opaqueTarget), array(linkTo($touched, $opaqueTarget)));
$graph->allocate();
$graph->save(function () { return 'custom-handler,entry,1'; });
check($satellite->batch[1]['fallback_destination'] === 'custom-handler,entry,7', 'Undo or reconnect to the same opaque target changed its priority');
$graph = new NethvplanAgentGraph($satellite, array(agent('opaque', 1, true)), array());
$graph->allocate();
$graph->save(function () {});
check($satellite->batch[1]['fallback_destination'] === null, 'Explicit disconnect did not clear fallback');

$satellite = new GraphSatellite();
$graph = new NethvplanAgentGraph($satellite, array(agent('retry')), array());
$ids = $graph->allocate();
$satellite->failBatch = true;
try { $graph->save(function () {}); } catch (RuntimeException $error) {}
check($graph->allocatedIds() === $ids, 'Save failure lost allocated IDs');
$satellite->failBatch = false;
$retry = agent('retry', $ids['satellite-agent-destination%retry']);
$graph = new NethvplanAgentGraph($satellite, array($retry), array());
$graph->allocate();
check(count($satellite->created) === 1, 'Reconciled retry allocated a duplicate Agent');

$satellite = new GraphSatellite();
$satellite->rows[8] = array('id' => 8, 'system_managed' => 1, 'agent_type' => 'builtin_internal',
    'cleverai_trunk_id' => null, 'cleverai_flow' => null, 'fallback_destination' => null);
$system = array('type' => 'Base', 'id' => 'satellite-agent-destination%8',
    'userData' => array('id' => 8, 'agent_type' => 'builtin_internal', 'system_managed' => true,
        'fallback_touched' => false));
$graph = new NethvplanAgentGraph($satellite, array($system), array());
check($graph->allocate()['satellite-agent-destination%8'] === 8, 'System Agent ID was not preserved');
$graph->save(function () { throw new RuntimeException('System fallback must not be resolved'); });
check(!$satellite->batch, 'System Agent was sent to edit batch');
$system['userData']['fallback_touched'] = true;
$target = array('type' => 'Base', 'id' => 'ext-local%203');
$graph = new NethvplanAgentGraph($satellite, array($system, $target), array(linkTo($system, $target)));
$graph->allocate();
$graph->save(function () { return 'ext-local,203,1'; });
check($satellite->batch[8]['fallback_destination'] === 'ext-local,203,1', 'System Agent fallback was not saved');
check($satellite->rows[8]['agent_type'] === 'builtin_internal' && !$satellite->created, 'System Agent identity changed');
$graph = new NethvplanAgentGraph($satellite, array($system), array());
$graph->allocate();
$graph->save(function () { throw new RuntimeException('Disconnected fallback was resolved'); });
check($satellite->batch[8]['fallback_destination'] === null, 'System Agent fallback disconnect was not saved');
rejects(function () use ($satellite, $system) {
    new NethvplanAgentGraph($satellite, array($system), array(linkTo($system, $system)));
}, 'System Agent fallback cycle accepted');

echo "VisualPlan Agent graph tests passed\n";
