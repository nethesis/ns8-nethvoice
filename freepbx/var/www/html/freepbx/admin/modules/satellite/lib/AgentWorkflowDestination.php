<?php
require_once __DIR__ . '/AgentConfigurationState.php';
require_once __DIR__ . '/AgentValidation.php';

/** PBX-owned binding to an immutable application definition. */
class AgentWorkflowDestination
{
    private $db;
    // Set the database and module adapters used by this object.
    public function __construct($db) { $this->db = $db; }

    // Reject a cycle in native and workflow fallback references.
    private function validateFallbackChain($agentId, $fallback)
    {
        $rows = $this->db->query('SELECT `id`,`system_key`,`agent_type`,`fallback_destination` FROM `satellite_agent_destinations`')->fetchAll(\PDO::FETCH_ASSOC);
        $destinations = array(); $seen = array();
        foreach ($rows as $row) {
            $destinations[(int) $row['id']] = $row;
            if ($row['system_key'] === 'workflow:' . $agentId) { $seen[(int) $row['id']] = true; }
        }
        $profiles = array();
        foreach ($this->db->query('SELECT `profile_key`,`fallback_destination` FROM `satellite_agent_profiles`')->fetchAll(\PDO::FETCH_ASSOC) as $profile) {
            $profiles[$profile['profile_key']] = $profile['fallback_destination'];
        }
        $next = $fallback ?? ($profiles['external'] ?? null);
        while (is_string($next) && preg_match('/^satellite-agent-destination-([0-9]+),s,1$/D', $next, $match)) {
            $id = (int) $match[1];
            if (isset($seen[$id])) { throw new \InvalidArgumentException('workflow_fallback_cycle'); }
            if (!isset($destinations[$id])) { throw new \InvalidArgumentException('workflow_fallback_unavailable'); }
            $seen[$id] = true; $target = $destinations[$id]; $next = $target['fallback_destination'];
            if ($next === null && $target['agent_type'] !== 'cleverai') {
                $next = $profiles[$target['agent_type'] === 'builtin_internal' ? 'internal' : 'external'] ?? null;
            }
        }
    }

    // Check the voice provider binding and PBX fallback path.
    public function validate(array $graph)
    {
        if (!in_array('voice', $graph['entrypoints'], true)) { return; }
        $trunk = $graph['provider_binding_ref'];
        if (!ctype_digit((string) $trunk)) { throw new \RuntimeException('workflow_provider_required', 409); }
        $query = $this->db->prepare('SELECT `runtime_owner` FROM `satellite_agent_trunks` WHERE `id`=? AND `enabled`=1');
        $query->execute(array((int) $trunk));
        if ($query->fetchColumn() !== 'builtin') { throw new \RuntimeException('workflow_provider_unavailable', 409); }
        $fallback = AgentValidation::validateFallback($graph['fallback'] ?? null);
        $this->validateFallbackChain($graph['agent_id'], $fallback);
    }

    // Create or update the stable PBX binding for this publication.
    public function synchronize($agentId, $version, array $graph, $enabled)
    {
        if (!preg_match('/^[a-z][a-z0-9_-]{0,47}$/D', $agentId) || !is_int($version) || $version < 1 ||
            ($graph['agent_id'] ?? '') !== $agentId || !is_bool($enabled)) {
            throw new \InvalidArgumentException('invalid_workflow_binding');
        }
        if (!in_array('voice', $graph['entrypoints'], true)) {
            $query = $this->db->prepare('UPDATE `satellite_agent_destinations` SET `enabled`=0,`workflow_version`=? WHERE `system_key`=? AND (`enabled`<>0 OR `workflow_version`<>?)');
            $query->execute(array($version, 'workflow:' . $agentId, $version));
            if ($query->rowCount()) { (new AgentConfigurationState($this->db))->bump(); }
            return null;
        }
        if ($enabled) { $this->validate($graph); }
        $trunk = $graph['provider_binding_ref'];
        $fallback = AgentValidation::validateFallback($graph['fallback'] ?? null);
        $name = 'AgentWorkflow_' . $agentId;
        $query = $this->db->prepare('SELECT `workflow_version`,`workflow_binding_id`,`enabled`,`fallback_destination` FROM `satellite_agent_destinations` WHERE `system_key`=?');
        $query->execute(array('workflow:' . $agentId)); $stored = $query->fetch(\PDO::FETCH_ASSOC);
        if ($stored && (int) $stored['workflow_version'] === $version && (string) $stored['workflow_binding_id'] === (string) $trunk &&
            (bool) $stored['enabled'] === $enabled && $stored['fallback_destination'] === $fallback) {
            return array('name' => $name, 'enabled' => $enabled, 'changed' => false);
        }
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare('INSERT INTO `satellite_agent_destinations`
                (`system_key`,`freepbx_name`,`agent_type`,`system_managed`,`enabled`,`workflow_agent_id`,`workflow_version`,`workflow_binding_id`,`fallback_destination`)
                VALUES (?, ?, \'workflow\', 1, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE `enabled`=VALUES(`enabled`),`workflow_version`=VALUES(`workflow_version`),
                `workflow_binding_id`=VALUES(`workflow_binding_id`),`fallback_destination`=VALUES(`fallback_destination`)');
            $query->execute(array('workflow:' . $agentId, $name, $enabled ? 1 : 0, $agentId, $version, (int) $trunk, $fallback));
            if ($enabled) { $this->validateFallbackChain($agentId, $fallback); }
            (new AgentConfigurationState($this->db))->bump();
            $this->db->commit();
        } catch (\Throwable $error) { $this->db->rollBack(); throw $error; }
        return array('name' => $name, 'enabled' => $enabled, 'changed' => true);
    }
}
