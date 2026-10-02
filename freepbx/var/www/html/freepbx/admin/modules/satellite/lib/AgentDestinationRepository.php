<?php

require_once __DIR__ . '/AgentValidation.php';

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
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare('INSERT INTO `satellite_agent_destinations`
                (`freepbx_name`, `agent_type`, `cleverai_trunk_id`, `cleverai_flow`,
                 `fallback_destination`, `system_managed`, `enabled`)
                VALUES (?, \'cleverai\', ?, ?, ?, 0, ?)');
            $statement->execute(array(
                $temporaryName, $row['cleverai_trunk_id'], $row['cleverai_flow'],
                $row['fallback_destination'], $row['enabled'],
            ));
            $id = (int) $this->db->lastInsertId();
            $this->setFreePBXName($id, 'CleverAI_' . $id);
            $this->db->commit();
            return $id;
        } catch (\Throwable $error) {
            $this->db->rollBack();
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

    public function update($id, array $input)
    {
        $stored = $this->getById($id);
        if (!$stored || (int) $stored['system_managed'] !== 0 || $stored['agent_type'] !== 'cleverai') {
            throw new \RuntimeException('Editable CleverAI destination not found');
        }
        $row = $this->validateInput(array_merge($stored, $input));
        $statement = $this->db->prepare('UPDATE `satellite_agent_destinations` SET
            `cleverai_trunk_id` = ?, `cleverai_flow` = ?, `fallback_destination` = ?, `enabled` = ?
            WHERE `id` = ?');
        $statement->execute(array(
            $row['cleverai_trunk_id'], $row['cleverai_flow'], $row['fallback_destination'],
            $row['enabled'], $this->positiveId($id),
        ));
    }

    /** The caller must check the FreePBX destination usage registry first. */
    public function delete($id)
    {
        $stored = $this->getById($id);
        if (!$stored || (int) $stored['system_managed'] !== 0 || $stored['agent_type'] !== 'cleverai') {
            throw new \RuntimeException('Deletable CleverAI destination not found');
        }
        $statement = $this->db->prepare('DELETE FROM `satellite_agent_destinations` WHERE `id` = ?');
        $statement->execute(array($this->positiveId($id)));
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
        $statement = $this->db->prepare('UPDATE `satellite_agent_destinations`
            SET `fallback_destination` = ? WHERE `fallback_destination` = ?');
        $statement->execute(array($newDestination, $oldDestination));
        return $statement->rowCount();
    }

    public function validateInput(array $input)
    {
        if (isset($input['agent_type']) && $input['agent_type'] !== 'cleverai') {
            throw new \InvalidArgumentException('Phase 1 supports CleverAI destinations only');
        }
        if (!isset($input['cleverai_trunk_id'])) {
            throw new \InvalidArgumentException('Agent trunk is required');
        }
        $trunkId = $this->positiveId($input['cleverai_trunk_id']);
        $statement = $this->db->prepare('SELECT `runtime_owner` FROM `satellite_agent_trunks` WHERE `id` = ?');
        $statement->execute(array($trunkId));
        if ($statement->fetchColumn() !== 'cleverai') {
            throw new \InvalidArgumentException('CleverAI trunk not found');
        }
        return array(
            'cleverai_trunk_id' => $trunkId,
            'cleverai_flow' => AgentValidation::validateFlow(isset($input['cleverai_flow']) ? $input['cleverai_flow'] : null),
            'fallback_destination' => AgentValidation::validateFallback(isset($input['fallback_destination']) ? $input['fallback_destination'] : null),
            'enabled' => 1,
        );
    }

    private function positiveId($id)
    {
        if (filter_var($id, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false) {
            throw new \InvalidArgumentException('Invalid agent destination ID');
        }
        return (int) $id;
    }
}
