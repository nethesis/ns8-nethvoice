<?php
require_once __DIR__ . '/AgentConfigurationState.php';

/** Single native owner of retention and per-agent capture policy. */
class AgentMonitoringRepository
{
    private $db;
    // Set the database and module adapters used by this object.
    public function __construct($db) { $this->db = $db; }

    // Return the initial monitoring capture and retention policy.
    public static function defaults()
    {
        return array('metadata_retention_days' => 30, 'transcript_retention_days' => 7,
            'transcripts' => array('internal' => false, 'external' => false),
            'capture_versions' => array('internal' => 1, 'external' => 1));
    }

    // Read the stored monitoring policy or its defaults.
    public function policy()
    {
        $statement = $this->db->query('SELECT policy_json FROM satellite_agent_monitoring_policy WHERE id=1');
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        if (!$row) { throw new \RuntimeException('Monitoring policy is not installed'); }
        return json_decode($row['policy_json'], true, 16, JSON_THROW_ON_ERROR);
    }

    // Save the checked monitoring capture and retention policy.
    public function save($input, $actor)
    {
        if (!is_array($input) || count($input) !== 4 || !isset($input['metadata_retention_days'],
            $input['transcript_retention_days'], $input['transcripts'], $input['expected_revision'])) {
            throw new \InvalidArgumentException('invalid_policy');
        }
        foreach (array('metadata_retention_days', 'transcript_retention_days') as $key) {
            if (!is_int($input[$key]) || $input[$key] < 1 || $input[$key] > 365) {
                throw new \InvalidArgumentException('invalid_retention');
            }
        }
        if ($input['transcript_retention_days'] > $input['metadata_retention_days'] ||
            !is_int($input['expected_revision']) || $input['expected_revision'] < 1 ||
            !is_array($input['transcripts']) || count($input['transcripts']) !== 2) {
            throw new \InvalidArgumentException('invalid_policy');
        }
        foreach (array('internal', 'external') as $key) {
            if (!array_key_exists($key, $input['transcripts']) || !is_bool($input['transcripts'][$key])) {
                throw new \InvalidArgumentException('invalid_capture_policy');
            }
        }
        if (!is_string($actor) || strlen($actor) > 128) { throw new \InvalidArgumentException('invalid_actor'); }
        $this->db->beginTransaction();
        try {
            $state = $this->db->query('SELECT desired_revision FROM satellite_agent_configuration_state WHERE id=1 FOR UPDATE')->fetch(\PDO::FETCH_ASSOC);
            if ((int) $state['desired_revision'] !== $input['expected_revision']) {
                throw new \RuntimeException('configuration_conflict', 409);
            }
            $policy = $this->policy();
            foreach (array('internal', 'external') as $key) {
                if ($policy['transcripts'][$key] !== $input['transcripts'][$key]) {
                    $policy['capture_versions'][$key]++;
                }
            }
            foreach (array('metadata_retention_days', 'transcript_retention_days', 'transcripts') as $key) {
                $policy[$key] = $input[$key];
            }
            $statement = $this->db->prepare('UPDATE satellite_agent_monitoring_policy SET policy_json=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=1');
            $statement->execute(array(json_encode($policy, JSON_THROW_ON_ERROR), $actor));
            $revision = (new AgentConfigurationState($this->db))->bump();
            $this->db->commit();
            return array('policy' => $policy, 'revision' => $revision);
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }
}
