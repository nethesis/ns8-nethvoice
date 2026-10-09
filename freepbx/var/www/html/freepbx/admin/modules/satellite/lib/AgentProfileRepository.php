<?php

require_once __DIR__ . '/AgentValidation.php';
require_once __DIR__ . '/AgentConfigurationState.php';

class AgentProfileRepository
{
    private $db;

    // Set the database and module adapters used by this object.
    public function __construct($db)
    {
        $this->db = $db;
    }

    // List the native permission names supported by agents.
    public static function permissionsCatalog()
    {
        return array('directory.extensions', 'directory.queues', 'directory.ivrs',
            'company.public_information', 'company.address', 'company.email', 'company.vat_number',
            'calendar.opening_hours', 'telephony.transfer.extension', 'telephony.transfer.queue',
            'telephony.transfer.ivr', 'telephony.consultative_transfer', 'telephony.message_relay',
            'telephony.external_destination');
    }

    // List the native tools supported by agents.
    public static function toolsCatalog()
    {
        return array('directory.find_destinations', 'company.get_information',
            'calendar.get_opening_hours', 'telephony.handoff');
    }

    // Return the initial permission values for a profile.
    public static function defaultPermissions()
    {
        return array_fill_keys(self::permissionsCatalog(), 'deny');
    }

    // Return the initial tool values for a profile.
    public static function defaultTools()
    {
        return array_fill_keys(self::toolsCatalog(), 'disabled');
    }

    // List the built-in profiles with decoded policies.
    public function listAll()
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_profiles` ORDER BY `profile_key`');
        $statement->execute();
        return array_map(array($this, 'decodeRow'), $statement->fetchAll(\PDO::FETCH_ASSOC));
    }

    // Read a built-in profile by its stable key.
    public function getByKey($key)
    {
        $key = $this->key($key);
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_profiles` WHERE `profile_key` = ?');
        $statement->execute(array($key));
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        return $row ? $this->decodeRow($row) : null;
    }

    // Save a checked built-in profile.
    public function save($key, array $input)
    {
        $key = $this->key($key);
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $stored = $this->getByKey($key);
            if (!$stored) {
                throw new \RuntimeException('Agent profile not found');
            }
            $row = array_merge($stored, $input);
            $row['flow'] = $key === 'internal' ? 'Internal' : 'External';
            $row = AgentValidation::validateProfile($row);
            if ($row['trunk_id'] !== null) {
                $statement = $this->db->prepare('SELECT `runtime_owner` FROM `satellite_agent_trunks` WHERE `id` = ?');
                $statement->execute(array($row['trunk_id']));
                if ($statement->fetchColumn() !== 'builtin') {
                    throw new \InvalidArgumentException('Profile trunk must be owned by the built-in Agent');
                }
            }
            $statement = $this->db->prepare('UPDATE `satellite_agent_profiles` SET `display_name` = ?, `trunk_id` = ?,
                `flow` = ?, `model` = ?, `voice` = ?, `language` = ?, `greeting` = ?, `prompt` = ?,
                `permissions_json` = ?, `tools_json` = ?, `transfer_policy_json` = ?, `knowledge_json` = ?,
                `max_call_duration_seconds` = ?, `fallback_destination` = ?, `company_json` = ?,
                `calendar_services_json` = ?, `config_revision` = `config_revision` + 1 WHERE `profile_key` = ?');
            $statement->execute(array($row['display_name'], $row['trunk_id'], $row['flow'], $row['model'],
                $row['voice'], $row['language'], $row['greeting'], $row['prompt'],
                $this->json($row['permissions']), $this->json($row['tools']),
                $this->json($row['transfer_policy']), $this->json($row['knowledge']),
                $row['max_call_duration_seconds'], $row['fallback_destination'], $this->json($row['company']),
                $this->json($row['calendar_services']), $key));
            (new AgentConfigurationState($this->db))->bump();
            if ($ownTransaction) {
                $this->db->commit();
            }
            return $this->getByKey($key);
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    // Decode stored profile JSON fields.
    private function decodeRow(array $row)
    {
        foreach (array('permissions', 'tools', 'transfer_policy', 'knowledge', 'company', 'calendar_services') as $field) {
            $value = json_decode($row[$field . '_json'], true);
            $row[$field] = is_array($value) ? $value : array();
            unset($row[$field . '_json']);
        }
        $row['trunk_id'] = $row['trunk_id'] === null ? null : (int) $row['trunk_id'];
        $row['max_call_duration_seconds'] = (int) $row['max_call_duration_seconds'];
        $row['config_revision'] = (int) $row['config_revision'];
        return $row;
    }

    // Decode and check a stored JSON object.
    private function json(array $value)
    {
        return json_encode((object) $value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    // Check the built-in profile key.
    private function key($key)
    {
        if ($key !== 'internal' && $key !== 'external') {
            throw new \InvalidArgumentException('Unknown built-in Agent profile');
        }
        return $key;
    }
}
