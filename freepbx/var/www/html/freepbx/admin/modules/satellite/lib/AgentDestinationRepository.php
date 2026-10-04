<?php

require_once __DIR__ . '/AgentValidation.php';
require_once __DIR__ . '/AgentConfigurationState.php';

class AgentDestinationRepository
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function listAll()
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_destinations` ORDER BY `id`');
        $statement->execute();
        return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function getById($id)
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_destinations` WHERE `id` = ?');
        $statement->execute(array($this->positiveId($id)));
        return $statement->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    /** Creates the database ID and stable FreePBX name as one transaction. */
    public function create(array $input)
    {
        $row = $this->validateInput($input);
        $temporaryName = 'CleverAI_pending_' . bin2hex(random_bytes(12));
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $statement = $this->db->prepare('INSERT INTO `satellite_agent_destinations`
                (`freepbx_name`, `agent_type`, `cleverai_trunk_id`, `cleverai_flow`,
                 `fallback_destination`, `system_managed`, `enabled`)
                VALUES (?, ?, ?, ?, ?, 0, ?)');
            $statement->execute(array(
                $temporaryName, $row['agent_type'], $row['cleverai_trunk_id'], $row['cleverai_flow'],
                $row['fallback_destination'], $row['enabled'],
            ));
            $id = (int) $this->db->lastInsertId();
            $this->setFreePBXName($id, 'CleverAI_' . $id);
            (new AgentConfigurationState($this->db))->bump();
            if ($ownTransaction) {
                $this->db->commit();
            }
            return $id;
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    /** Only the generated name for this ID can be set. */
    public function setFreePBXName($id, $name)
    {
        $id = $this->positiveId($id);
        if ($name !== 'CleverAI_' . $id) {
            throw new \InvalidArgumentException('Destination name must match its ID');
        }
        $statement = $this->db->prepare('UPDATE `satellite_agent_destinations` SET `freepbx_name` = ? WHERE `id` = ?');
        $statement->execute(array($name, $id));
        if ($statement->rowCount() === 0 && !$this->getById($id)) {
            throw new \RuntimeException('Agent destination not found');
        }
    }

    /** Built-in destinations may change fallback, while retaining their identity. */
    public function validateUpdateInput($id, array $input)
    {
        $stored = $this->getById($id);
        if (!$stored) {
            throw new \RuntimeException('Editable Agent destination not found');
        }
        if (!empty($stored['system_managed'])) {
            if (!in_array($stored['agent_type'], array('builtin_internal', 'builtin_external'), true)) {
                throw new \RuntimeException('Editable Agent destination not found');
            }
            foreach (array('agent_type', 'cleverai_trunk_id', 'cleverai_flow') as $field) {
                if (array_key_exists($field, $input) && (string) $input[$field] !== (string) $stored[$field]) {
                    throw new \InvalidArgumentException('Built-in Agent destination identity cannot be changed');
                }
            }
        }
        return $this->validateInput(array_merge($stored, $input));
    }

    public function update($id, array $input)
    {
        $row = $this->validateUpdateInput($id, $input);
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
        $statement = $this->db->prepare('UPDATE `satellite_agent_destinations` SET
            `agent_type` = ?, `cleverai_trunk_id` = ?, `cleverai_flow` = ?,
            `fallback_destination` = ?, `enabled` = ?
            WHERE `id` = ?');
        $statement->execute(array(
            $row['agent_type'], $row['cleverai_trunk_id'], $row['cleverai_flow'], $row['fallback_destination'],
            $row['enabled'], $this->positiveId($id),
        ));
        (new AgentConfigurationState($this->db))->bump();
        if ($ownTransaction) {
            $this->db->commit();
        }
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    /** The caller must check the FreePBX destination usage registry first. */
    public function delete($id)
    {
        $stored = $this->getById($id);
        if (!$stored || (int) $stored['system_managed'] !== 0) {
            throw new \RuntimeException('Deletable Agent destination not found');
        }
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
        $statement = $this->db->prepare('DELETE FROM `satellite_agent_destinations` WHERE `id` = ?');
        $statement->execute(array($this->positiveId($id)));
        (new AgentConfigurationState($this->db))->bump();
        if ($ownTransaction) {
            $this->db->commit();
        }
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function listByFallbackDestination($destination)
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_destinations` WHERE `fallback_destination` = ? ORDER BY `id`');
        $statement->execute(array(AgentValidation::validateFallback($destination)));
        return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function replaceFallbackDestination($oldDestination, $newDestination)
    {
        $oldDestination = AgentValidation::validateFallback($oldDestination);
        if ($oldDestination === null) {
            throw new \InvalidArgumentException('Old fallback destination is required');
        }
        $newDestination = AgentValidation::validateFallback($newDestination);
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
        $statement = $this->db->prepare('UPDATE `satellite_agent_destinations`
            SET `fallback_destination` = ? WHERE `fallback_destination` = ?');
        $statement->execute(array($newDestination, $oldDestination));
        $changed = $statement->rowCount();
        if ($changed) {
            (new AgentConfigurationState($this->db))->bump();
        }
        if ($ownTransaction) {
            $this->db->commit();
        }
        return $changed;
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function validateInput(array $input)
    {
        $type = isset($input['agent_type']) ? $input['agent_type'] : 'cleverai';
        if (!in_array($type, array('cleverai', 'builtin_internal', 'builtin_external'), true)) {
            throw new \InvalidArgumentException('Unsupported Agent destination type');
        }
        $trunkId = isset($input['cleverai_trunk_id']) && $input['cleverai_trunk_id'] !== ''
            ? $this->positiveId($input['cleverai_trunk_id']) : null;
        $flow = isset($input['cleverai_flow']) && $input['cleverai_flow'] !== ''
            ? AgentValidation::validateFlow($input['cleverai_flow']) : null;
        if ($type === 'cleverai') {
            if ($trunkId === null || $flow === null) {
                throw new \InvalidArgumentException('CleverAI trunk and flow are required');
            }
            $statement = $this->db->prepare('SELECT `runtime_owner` FROM `satellite_agent_trunks` WHERE `id` = ?');
            $statement->execute(array($trunkId));
            if ($statement->fetchColumn() !== 'cleverai') {
                throw new \InvalidArgumentException('CleverAI trunk not found');
            }
        }
        return array(
            'agent_type' => $type,
            'cleverai_trunk_id' => $trunkId,
            'cleverai_flow' => $flow,
            'fallback_destination' => AgentValidation::validateFallback(isset($input['fallback_destination']) ? $input['fallback_destination'] : null),
            'enabled' => 1,
        );
    }

    public function directoryRules()
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_directory_rules` ORDER BY `resource_key`');
        $statement->execute();
        $rules = array();
        foreach ($statement->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $row['synonyms'] = json_decode($row['synonyms'] ?: '[]', true) ?: array();
            $row['internal_allowed'] = (bool) $row['internal_allowed'];
            $row['external_allowed'] = (bool) $row['external_allowed'];
            $rules[$row['resource_key']] = $row;
        }
        return $rules;
    }

    /** Merge supplied resource rules, leaving other resources untouched. */
    public function saveDirectoryRules(array $rules)
    {
        if (!$rules) {
            return;
        }
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $statement = $this->db->prepare('INSERT INTO `satellite_agent_directory_rules`
                (`resource_key`, `resource_type`, `description`, `synonyms`, `internal_allowed`, `external_allowed`)
                VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
                `resource_type` = VALUES(`resource_type`), `description` = VALUES(`description`),
                `synonyms` = VALUES(`synonyms`), `internal_allowed` = VALUES(`internal_allowed`),
                `external_allowed` = VALUES(`external_allowed`)');
            foreach ($rules as $key => $rule) {
                $rule = AgentValidation::validateDirectoryRule($key, $rule);
                $statement->execute(array($key, $rule['resource_type'], $rule['description'],
                    json_encode($rule['synonyms'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                    $rule['internal_allowed'] ? 1 : 0, $rule['external_allowed'] ? 1 : 0));
            }
            (new AgentConfigurationState($this->db))->bump();
            if ($ownTransaction) {
                $this->db->commit();
            }
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function deleteDirectoryRule($resourceKey)
    {
        AgentValidation::validateDirectoryRuleKey($resourceKey);
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $statement = $this->db->prepare('DELETE FROM `satellite_agent_directory_rules` WHERE `resource_key` = ?');
            $statement->execute(array($resourceKey));
            if ($statement->rowCount()) {
                (new AgentConfigurationState($this->db))->bump();
            }
            if ($ownTransaction) {
                $this->db->commit();
            }
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private function positiveId($id)
    {
        if (filter_var($id, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false) {
            throw new \InvalidArgumentException('Invalid agent destination ID');
        }
        return (int) $id;
    }
}
