<?php

require_once __DIR__ . '/AgentCrypto.php';
require_once __DIR__ . '/AgentValidation.php';

class AgentTrunkRepository
{
    private $db;
    private $crypto;

    public function __construct($db, $crypto = null)
    {
        $this->db = $db;
        $this->crypto = $crypto ?: new AgentCrypto();
    }

    public function listAll()
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_trunks` ORDER BY `id`');
        $statement->execute();
        return array_map(array($this, 'publicRow'), $statement->fetchAll(\PDO::FETCH_ASSOC));
    }

    public function getById($id)
    {
        $row = $this->getStoredById($id);
        return $row ? $this->publicRow($row) : null;
    }

    /** Backend-only read for provisioning and secret resolution; never send to AJAX. */
    public function getStoredById($id)
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_trunks` WHERE `id` = ?');
        $statement->execute(array($this->positiveId($id)));
        return $statement->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    public function create(array $input)
    {
        $row = $this->newRow($input);
        AgentValidation::validateTrunk($row);
        $this->validateCredentials($row);
        $temporaryName = 'AgentTrunk_pending_' . bin2hex(random_bytes(12));

        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare('INSERT INTO `satellite_agent_trunks`
                (`name`, `provider`, `runtime_owner`, `freepbx_trunk_name`,
                 `openai_project_id`, `grok_phone_number`, `api_key_encrypted`,
                 `sip_auth_mode`, `sip_auth_username`, `sip_auth_password_encrypted`, `enabled`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute(array(
                $row['name'], $row['provider'], 'cleverai', $temporaryName,
                $row['openai_project_id'], $row['grok_phone_number'], $row['api_key_encrypted'],
                $row['sip_auth_mode'], $row['sip_auth_username'], $row['sip_auth_password_encrypted'], $row['enabled'],
            ));
            $id = (int) $this->db->lastInsertId();
            $this->setGeneratedTrunkName($id);
            $this->db->commit();
            return $id;
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    public function update($id, array $input)
    {
        $stored = $this->getStoredById($id);
        if (!$stored) {
            throw new \RuntimeException('Agent trunk not found');
        }

        $row = $this->mergeRow($stored, $input);
        AgentValidation::validateTrunk($row);
        $this->validateCredentials($row);
        $statement = $this->db->prepare('UPDATE `satellite_agent_trunks` SET
            `name` = ?, `provider` = ?, `openai_project_id` = ?, `grok_phone_number` = ?,
            `api_key_encrypted` = ?, `sip_auth_mode` = ?, `sip_auth_username` = ?,
            `sip_auth_password_encrypted` = ?, `enabled` = ? WHERE `id` = ?');
        $statement->execute(array(
            $row['name'], $row['provider'], $row['openai_project_id'], $row['grok_phone_number'],
            $row['api_key_encrypted'], $row['sip_auth_mode'], $row['sip_auth_username'],
            $row['sip_auth_password_encrypted'], $row['enabled'], $this->positiveId($id),
        ));
    }

    public function setProvisionedTrunkId($id, $freepbxTrunkId)
    {
        $statement = $this->db->prepare('UPDATE `satellite_agent_trunks` SET `freepbx_trunk_id` = ? WHERE `id` = ?');
        $statement->execute(array($this->positiveId($freepbxTrunkId), $this->positiveId($id)));
        if ($statement->rowCount() === 0 && !$this->getStoredById($id)) {
            throw new \RuntimeException('Agent trunk not found');
        }
    }

    public function delete($id)
    {
        $id = $this->positiveId($id);
        $statement = $this->db->prepare('SELECT COUNT(*) FROM `satellite_agent_destinations` WHERE `cleverai_trunk_id` = ?');
        $statement->execute(array($id));
        if ((int) $statement->fetchColumn() !== 0) {
            throw new \RuntimeException('Agent trunk is used by a destination');
        }
        $statement = $this->db->prepare('DELETE FROM `satellite_agent_trunks` WHERE `id` = ?');
        $statement->execute(array($id));
    }

    public function resolveProviderApiKey(array $storedTrunk)
    {
        return $this->crypto->resolveProviderApiKey($storedTrunk);
    }

    private function publicRow(array $row)
    {
        $status = $this->crypto->apiKeyStatus($row);
        $passwordConfigured = !empty($row['sip_auth_password_encrypted']);
        $webhookSecretConfigured = !empty($row['webhook_signing_secret_encrypted']);
        unset($row['api_key_encrypted'], $row['sip_auth_password_encrypted'], $row['webhook_signing_secret_encrypted']);
        $row['api_key_configured'] = $status['api_key_configured'];
        $row['api_key_source'] = $status['api_key_source'];
        $row['sip_auth_password_configured'] = $passwordConfigured;
        $row['webhook_signing_secret_configured'] = $webhookSecretConfigured;
        return $row;
    }

    private function newRow(array $input)
    {
        $row = array(
            'name' => null, 'provider' => null, 'runtime_owner' => 'cleverai',
            'openai_project_id' => null, 'grok_phone_number' => null,
            'api_key_encrypted' => null, 'sip_auth_mode' => 'none',
            'sip_auth_username' => null, 'sip_auth_password_encrypted' => null,
            'enabled' => 1,
        );
        return $this->mergeRow($row, $input);
    }

    private function mergeRow(array $row, array $input)
    {
        $oldProvider = $row['provider'];
        foreach (array('name', 'provider', 'runtime_owner', 'openai_project_id',
                       'grok_phone_number', 'sip_auth_mode', 'sip_auth_username') as $field) {
            if (array_key_exists($field, $input)) {
                $row[$field] = $input[$field];
            }
        }
        if ($oldProvider !== null && $oldProvider !== $row['provider']) {
            $row['api_key_encrypted'] = null;
        }
        if ($row['provider'] === 'openai') {
            $row['grok_phone_number'] = null;
            $row['sip_auth_mode'] = 'none';
        } elseif ($row['provider'] === 'grok') {
            $row['openai_project_id'] = null;
        }
        if ($row['sip_auth_mode'] === 'none') {
            $row['sip_auth_username'] = null;
            $row['sip_auth_password_encrypted'] = null;
        }
        if (array_key_exists('api_key', $input)) {
            AgentValidation::validateSecretInput($input['api_key'], 'provider API key');
        }
        if (array_key_exists('sip_auth_password', $input)) {
            AgentValidation::validateSecretInput($input['sip_auth_password'], 'SIP authentication password');
        }
        if (!empty($input['clear_api_key'])) {
            $row['api_key_encrypted'] = null;
        } elseif (isset($input['api_key']) && $input['api_key'] !== '') {
            $row['api_key_encrypted'] = $this->crypto->encryptSecret($input['api_key']);
        }
        if ($row['sip_auth_mode'] === 'digest' && isset($input['sip_auth_password']) && $input['sip_auth_password'] !== '') {
            $row['sip_auth_password_encrypted'] = $this->crypto->encryptSecret($input['sip_auth_password']);
        }
        $row['enabled'] = 1;
        return $row;
    }

    private function validateCredentials(array $row)
    {
        if ($row['provider'] === 'grok' && empty($row['api_key_encrypted'])) {
            throw new \InvalidArgumentException('An API key is required for Grok');
        }
        if ($row['provider'] === 'openai' && empty($row['api_key_encrypted']) &&
            (getenv('OPENAI_API_KEY') === false || getenv('OPENAI_API_KEY') === '')) {
            throw new \InvalidArgumentException('No OpenAI API key configured for this trunk');
        }
        if ($row['sip_auth_mode'] === 'digest' && empty($row['sip_auth_password_encrypted'])) {
            throw new \InvalidArgumentException('SIP authentication password is required');
        }
    }

    private function setGeneratedTrunkName($id)
    {
        $statement = $this->db->prepare('UPDATE `satellite_agent_trunks` SET `freepbx_trunk_name` = ? WHERE `id` = ?');
        $statement->execute(array('AgentTrunk_' . $id, $id));
    }

    private function positiveId($id)
    {
        if (filter_var($id, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false) {
            throw new \InvalidArgumentException('Invalid agent trunk ID');
        }
        return (int) $id;
    }
}
