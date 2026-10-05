<?php
require_once __DIR__ . '/AgentWorkflowDestination.php';
require_once __DIR__ . '/../../../../rest/lib/AgentWorkflowClient.php';
/** Reconcile application activation to PBX bindings without a distributed transaction. */
class AgentWorkflowReconciler
{
    public static function reconcile($db)
    {
        $client = new AgentWorkflowClient();
        $inventory = $client->request('GET', '/inventory', 'workflow_sync');
        $query = $db->query('SELECT `workflow_agent_id`,`workflow_version`,`enabled` FROM `satellite_agent_destinations` WHERE `agent_type`=\'workflow\'');
        $stored = array();
        foreach ($query->fetchAll(\PDO::FETCH_ASSOC) as $row) { $stored[$row['workflow_agent_id']] = $row; }
        $agents = array();
        foreach ($inventory['agents'] as $agent) { if ($agent['kind'] !== 'subflow') { $agents[$agent['agent_id']] = $agent; } }
        $bindings = new AgentWorkflowDestination($db); $changed = false; $pending = false;
        foreach ($inventory['definitions'] as $definition) {
            if ($definition['kind'] !== 'agent' || !$definition['active_version']) { continue; }
            $id = $definition['agent_id']; $previous = $stored[$id] ?? null;
            $voice = in_array('voice', $agents[$id]['entrypoints'], true);
            $enabled = $voice && $definition['enabled'];
            if ((!$voice && !$previous) || ($previous && (int) $previous['workflow_version'] === (int) $definition['active_version'] && (bool) $previous['enabled'] === $enabled)) { continue; }
            try {
                $graph = $client->request('GET', '/definitions/agent/' . $id . '/versions/' . $definition['active_version'], 'workflow_sync')['definition'];
                $result = $bindings->synchronize($id, (int) $definition['active_version'], $graph, (bool) $definition['enabled']);
                $changed = $changed || $result === null || !empty($result['changed']);
            } catch (\Throwable $error) { $pending = true; }
        }
        return array('changed' => $changed, 'pending' => $pending);
    }
}
