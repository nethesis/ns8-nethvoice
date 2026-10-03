<?php

/** Decode the existing JavaScript translation assignment, including trailing newlines. */
function nethvplan_read_labels($source)
{
    $parts = explode('=', trim($source), 2);
    $labels = json_decode(rtrim(trim($parts[1] ?? ''), ';'), true);
    if (!is_array($labels)) {
        throw new InvalidArgumentException('Invalid VisualPlan translations');
    }
    return $labels;
}

/** Agent-specific save preparation; the rest of VisualPlan keeps its normal lifecycle. */
class NethvplanAgentGraph
{
    private $satellite;
    private $agents = array();
    private $widgets = array();
    private $edges = array();
    private $ids = array();
    private $stored = array();

    public function __construct($satellite, array $widgets, array $connections)
    {
        $this->satellite = $satellite;
        foreach ($widgets as $widget) {
            $node = $widget['id'] ?? '';
            if (!is_string($node) || $node === '' || isset($this->widgets[$node])) {
                throw new InvalidArgumentException('Invalid or duplicate block ID');
            }
            $this->widgets[$node] = $widget;
        }
        foreach ($satellite->getAgentDestinations() as $row) {
            $this->stored[(int) $row['id']] = $row;
        }
        $persistentIds = array();
        foreach ($this->widgets as $node => $widget) {
            if (strpos($node, 'satellite-agent-destination%') !== 0) {
                continue;
            }
            $data = $widget['userData'] ?? array();
            if (!is_array($data)) {
                throw new InvalidArgumentException('Invalid agent block data');
            }
            $id = $data['id'] ?? null;
            if ($id === '') {
                $id = null;
            }
            if ($id !== null) {
                if (filter_var($id, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false) {
                    throw new InvalidArgumentException('Invalid agent destination ID');
                }
                $id = (int) $id;
                if (!isset($this->stored[$id])) {
                    throw new InvalidArgumentException('Agent destination not found');
                }
                if (isset($persistentIds[$id])) {
                    throw new InvalidArgumentException('An agent must be represented by a single block');
                }
                $persistentIds[$id] = true;
            }
            $stored = $id === null ? null : $this->stored[$id];
            $protected = $stored !== null && !empty($stored['system_managed']);
            if ($protected && !empty($data['fallback_touched'])) {
                throw new InvalidArgumentException('System Agent destinations are reference only');
            }
            $input = $protected ? null : $satellite->validateAgentDestination(array(
                'agent_type' => $stored['agent_type'] ?? ($data['agent_type'] ?? 'cleverai'),
                'cleverai_trunk_id' => $stored['cleverai_trunk_id'] ?? ($data['cleverai_trunk_id'] ?? null),
                'cleverai_flow' => $stored['cleverai_flow'] ?? ($data['cleverai_flow'] ?? ''),
                'fallback_destination' => $stored['fallback_destination'] ?? null,
            ), $id);
            $this->agents[$node] = array(
                'widget' => $widget, 'id' => $id, 'input' => $input,
                'protected' => $protected,
                'touched' => $id === null || ($data['fallback_touched'] ?? false) === true,
            );
        }
        foreach ($connections as $connection) {
            $node = $connection['source']['node'] ?? '';
            if (!isset($this->agents[$node])) {
                continue;
            }
            if ($this->agents[$node]['protected']) {
                throw new InvalidArgumentException('System Agent destinations are reference only');
            }
            $suffix = explode('%', $node, 2)[1];
            $target = $connection['target']['node'] ?? '';
            if (($connection['source']['port'] ?? '') !== 'output_agent_fallback%' . $suffix ||
                !isset($this->widgets[$target]) || isset($this->edges[$node])) {
                throw new InvalidArgumentException('An agent requires at most one valid Fallback connection');
            }
            $this->edges[$node] = $target;
        }
        $this->validateFallbackGraph();
    }

    private function key($node)
    {
        $id = $this->agents[$node]['id'];
        return $id === null ? 'node:' . $node : 'id:' . $id;
    }

    private function fallbackKey($destination)
    {
        if (preg_match('/^satellite-agent-destination-([1-9][0-9]*),s,1$/D', (string) $destination, $match)) {
            return 'id:' . $match[1];
        }
        return null;
    }

    /** Validate the final overlay, including agents outside this canvas, before allocating IDs. */
    private function validateFallbackGraph()
    {
        $next = array();
        foreach ($this->stored as $id => $row) {
            $next['id:' . $id] = $this->fallbackKey($row['fallback_destination']);
        }
        foreach ($this->agents as $node => $agent) {
            if ($agent['protected']) {
                continue;
            }
            $target = $this->edges[$node] ?? null;
            $key = $this->key($node);
            if (!$agent['touched']) {
                $next[$key] = $this->fallbackKey($agent['input']['fallback_destination']);
            } elseif (isset($this->agents[$target])) {
                $next[$key] = $this->key($target);
            } elseif ($target !== null) {
                // Alternative blocks can also encode a native Agent destination.
                $parts = explode('%', $target, 2);
                $next[$key] = $this->fallbackKey($parts[0] . ',' . ($parts[1] ?? '') . ',1');
            } else {
                $next[$key] = null;
            }
        }
        foreach ($this->agents as $node => $agent) {
            $seen = array();
            $key = $this->key($node);
            while ($key !== null && isset($next[$key])) {
                if (isset($seen[$key])) {
                    throw new InvalidArgumentException('A destination cannot fall back to itself, directly or through other destinations');
                }
                $seen[$key] = true;
                $key = $next[$key];
            }
        }
    }

    public function allocate()
    {
        foreach ($this->agents as $node => $agent) {
            if ($agent['protected']) {
                $this->ids[$node] = $agent['id'];
                continue;
            }
            if (isset($this->ids[$node])) {
                continue;
            }
            $input = $agent['input'];
            $input['fallback_destination'] = null;
            $this->ids[$node] = $agent['id'] === null
                ? $this->satellite->saveAgentDestination($input)
                : $agent['id'];
        }
        return $this->ids;
    }

    public function allocatedIds()
    {
        return $this->ids;
    }

    /** Resolve links only after all graph dependencies have IDs, then update Agents atomically. */
    public function save($resolve)
    {
        $changes = array();
        foreach ($this->agents as $node => $agent) {
            if ($agent['protected']) {
                continue;
            }
            $input = $agent['input'];
            if ($agent['touched']) {
                $input['fallback_destination'] = isset($this->edges[$node])
                    ? call_user_func($resolve, $agent['widget']) : null;
                if ($agent['id'] !== null && $input['fallback_destination'] !== null) {
                    $stored = $this->satellite->getAgentDestination($this->ids[$node]);
                    $original = $stored['fallback_destination'] ?? null;
                    // Moving a connection or undoing a rewire cannot edit an opaque
                    // destination's priority, which the generic graph formatter omits.
                    if ($original !== null && array_slice(explode(',', $original), 0, 2) ===
                        array_slice(explode(',', $input['fallback_destination']), 0, 2)) {
                        $input['fallback_destination'] = $original;
                    }
                }
            } else {
                $stored = $this->satellite->getAgentDestination($this->ids[$node]);
                if (!$stored) {
                    throw new RuntimeException('Agent destination not found');
                }
                $input['fallback_destination'] = $stored['fallback_destination'];
            }
            $changes[$this->ids[$node]] = $input;
        }
        $this->satellite->saveAgentDestinationBatch($changes);
    }
}

/** The same Base/port layout is used for selected agents and reconstructed routes. */
function nethvplan_agent_widget(array $agent, array $trunks, array $labels)
{
    $id = (int) $agent['id'];
    $node = 'satellite-agent-destination%' . $id;
    $type = $agent['agent_type'] ?? 'cleverai';
    $builtin = $type === 'builtin_internal' || $type === 'builtin_external';
    $trunk = $trunks[$agent['cleverai_trunk_id'] ?? null] ?? array();
    $flow = $builtin ? ($type === 'builtin_internal' ? 'Internal' : 'External') : ($agent['cleverai_flow'] ?? '');
    $typeLabel = $builtin ? ($type === 'builtin_internal' ? 'Builtin Internal' : 'Builtin External') : 'CleverAI';
    return array(
        'type' => 'Base', 'id' => $node, 'radius' => 0, 'bgColor' => '#528ba7',
        'name' => $labels['base_agent_string'],
        'userData' => array(
            'id' => $id, 'agent_type' => $type, 'system_managed' => !empty($agent['system_managed']),
            'cleverai_trunk_id' => $agent['cleverai_trunk_id'] === null ? null : (int) $agent['cleverai_trunk_id'],
            'cleverai_flow' => $agent['cleverai_flow'],
            'fallback_destination' => $agent['fallback_destination'], 'fallback_touched' => false,
        ),
        'entities' => array(
            array('text' => $agent['freepbx_name'], 'id' => $node, 'type' => 'input'),
            array('text' => ($builtin ? $typeLabel : $labels['view_agent_flow_string']) . ': ' . $flow, 'id' => 'agent_flow%' . $id, 'type' => 'text'),
            array('text' => $labels['view_agent_trunk_string'] . ': ' . ($builtin ? $typeLabel : ($trunk['name'] ?? '')), 'id' => 'agent_trunk%' . $id, 'type' => 'text'),
            array('text' => $labels['base_agent_fallback_string'], 'id' => 'agent_fallback%' . $id, 'type' => 'output', 'destination' => $agent['fallback_destination'] ?? ''),
        ),
    );
}
