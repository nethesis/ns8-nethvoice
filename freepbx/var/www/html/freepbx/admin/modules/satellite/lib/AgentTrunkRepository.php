<?php

require_once __DIR__ . '/AgentCrypto.php';
require_once __DIR__ . '/AgentValidation.php';
require_once __DIR__ . '/AgentConfigurationState.php';

class AgentTrunkRepository
{
    private const WEBHOOK_KEY_GRACE_SECONDS = 86700;
    private $db;
    private $crypto;

    // Set the database and module adapters used by this object.
    public function __construct($db, $crypto = null)
    {
        $this->db = $db;
        $this->crypto = $crypto ?: new AgentCrypto();
    }

    // List public provider bindings without secret values.
    public function listAll()
    {
        $statement = $this->db->prepare('SELECT * FROM `satellite_agent_trunks` ORDER BY `id`');
        $statement->execute();
        return array_map(array($this, 'publicRow'), $statement->fetchAll(\PDO::FETCH_ASSOC));
    }

    // Read one public provider binding by its ID.
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

    // Create a provider binding with encrypted credentials.
    public function create(array $input)
    {
        $row = $this->newRow($input);
        AgentValidation::validateTrunk($row);
        $this->validateCredentials($row);
        $temporaryName = 'AgentTrunk_pending_' . bin2hex(random_bytes(12));

        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $this->validateBinding($row);
            $statement = $this->db->prepare('INSERT INTO `satellite_agent_trunks`
                (`name`, `provider`, `runtime_owner`, `freepbx_trunk_name`,
                 `openai_project_id`, `grok_phone_number`, `api_key_encrypted`,
                 `sip_auth_mode`, `sip_auth_username`, `sip_auth_password_encrypted`,
                 `webhook_signing_secret_encrypted`, `enabled`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute(array(
                $row['name'], $row['provider'], $row['runtime_owner'], $temporaryName,
                $row['openai_project_id'], $row['grok_phone_number'], $row['api_key_encrypted'],
                $row['sip_auth_mode'], $row['sip_auth_username'], $row['sip_auth_password_encrypted'],
                $row['webhook_signing_secret_encrypted'], $row['enabled'],
            ));
            $id = (int) $this->db->lastInsertId();
            $this->setGeneratedTrunkName($id);
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

    // Update a binding and retain any replaced webhook key.
    public function update($id, array $input)
    {
        $stored = $this->getStoredById($id);
        if (!$stored) {
            throw new \RuntimeException('Agent trunk not found');
        }

        $row = $this->mergeRow($stored, $input);
        if ($row['runtime_owner'] !== $stored['runtime_owner']) {
            throw new \InvalidArgumentException('Agent trunk ownership cannot be changed in place');
        }
        if ($this->isReferenced($id) && ($row['provider'] !== $stored['provider']
            || $row['openai_project_id'] !== $stored['openai_project_id']
            || $row['grok_phone_number'] !== $stored['grok_phone_number'])) {
            throw new \RuntimeException('Referenced Agent trunk binding cannot be changed');
        }
        AgentValidation::validateTrunk($row);
        $this->validateCredentials($row);
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
        $this->validateBinding($row, $this->positiveId($id));
        $this->retireWebhookSecretIfChanged($stored, $row);
        $statement = $this->db->prepare('UPDATE `satellite_agent_trunks` SET
            `name` = ?, `provider` = ?, `openai_project_id` = ?, `grok_phone_number` = ?,
            `api_key_encrypted` = ?, `sip_auth_mode` = ?, `sip_auth_username` = ?,
            `sip_auth_password_encrypted` = ?, `webhook_signing_secret_encrypted` = ?,
            `enabled` = ? WHERE `id` = ?');
        $statement->execute(array(
            $row['name'], $row['provider'], $row['openai_project_id'], $row['grok_phone_number'],
            $row['api_key_encrypted'], $row['sip_auth_mode'], $row['sip_auth_username'],
            $row['sip_auth_password_encrypted'], $row['webhook_signing_secret_encrypted'],
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

    // Attach the generated FreePBX trunk ID to the binding.
    public function setProvisionedTrunkId($id, $freepbxTrunkId)
    {
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
        $statement = $this->db->prepare('UPDATE `satellite_agent_trunks` SET `freepbx_trunk_id` = ? WHERE `id` = ?');
        $statement->execute(array($this->positiveId($freepbxTrunkId), $this->positiveId($id)));
        if ($statement->rowCount() === 0 && !$this->getStoredById($id)) {
            throw new \RuntimeException('Agent trunk not found');
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

    // Delete an unreferenced provider binding.
    public function delete($id)
    {
        $id = $this->positiveId($id);
        if ($this->isReferenced($id)) { throw new \RuntimeException('Agent trunk is referenced'); }
        $statement = $this->db->prepare('SELECT COUNT(*) FROM `satellite_agent_destinations` WHERE `cleverai_trunk_id` = ?');
        $statement->execute(array($id));
        if ((int) $statement->fetchColumn() !== 0) {
            throw new \RuntimeException('Agent trunk is used by a destination');
        }
        $statement = $this->db->prepare('SELECT COUNT(*) FROM `satellite_agent_profiles` WHERE `trunk_id` = ?');
        $statement->execute(array($id));
        if ((int) $statement->fetchColumn() !== 0) {
            throw new \RuntimeException('Agent trunk is used by a built-in profile');
        }
        if (!$this->getStoredById($id)) {
            throw new \RuntimeException('Agent trunk not found');
        }
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
        $this->retireWebhookSecret($this->getStoredById($id));
        $statement = $this->db->prepare('DELETE FROM `satellite_agent_trunks` WHERE `id` = ?');
        $statement->execute(array($id));
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

    // Return the explicit or permitted environment provider key.
    public function resolveProviderApiKey(array $storedTrunk)
    {
        return $this->crypto->resolveProviderApiKey($storedTrunk);
    }

    // Decrypt the current webhook signing secret.
    public function resolveWebhookSigningSecret(array $storedTrunk)
    {
        return $this->crypto->decryptSecret(isset($storedTrunk['webhook_signing_secret_encrypted'])
            ? $storedTrunk['webhook_signing_secret_encrypted'] : null);
    }

    /** Backend-only candidates for gateway signature checks during key rotation. */
    public function webhookVerificationBindings()
    {
        $this->cleanupExpiredWebhookSecrets();
        $bindings = array();
        $statement = $this->db->prepare('SELECT `id`, `provider`, `webhook_signing_secret_encrypted`
            FROM `satellite_agent_trunks` WHERE `runtime_owner` = ?
            AND `webhook_signing_secret_encrypted` IS NOT NULL AND `webhook_signing_secret_encrypted` <> \'\'');
        $statement->execute(array('builtin'));
        foreach ($statement->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $bindings[] = array('id' => (string) $row['id'], 'provider' => $row['provider'],
                'webhook_secret' => $this->crypto->decryptSecret($row['webhook_signing_secret_encrypted']));
        }
        $statement = $this->db->prepare('SELECT `binding_id`, `provider`, `secret_encrypted`
            FROM `satellite_agent_webhook_previous_keys` WHERE `expires_at` > UTC_TIMESTAMP()');
        $statement->execute();
        foreach ($statement->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $bindings[] = array('id' => (string) $row['binding_id'], 'provider' => $row['provider'],
                'webhook_secret' => $this->crypto->decryptSecret($row['secret_encrypted']));
        }
        return $bindings;
    }

    // Remove secret values from public trunk data.
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

    // Build a new trunk record from checked input.
    private function newRow(array $input)
    {
        $row = array(
            'name' => null, 'provider' => null, 'runtime_owner' => 'cleverai',
            'openai_project_id' => null, 'grok_phone_number' => null,
            'api_key_encrypted' => null, 'sip_auth_mode' => 'none',
            'sip_auth_username' => null, 'sip_auth_password_encrypted' => null,
            'webhook_signing_secret_encrypted' => null,
            'enabled' => 1,
        );
        return $this->mergeRow($row, $input);
    }

    // Merge permitted changes into the stored trunk record.
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
            $row['webhook_signing_secret_encrypted'] = null;
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
        if (array_key_exists('webhook_signing_secret', $input)) {
            AgentValidation::validateSecretInput($input['webhook_signing_secret'], 'webhook signing secret');
            if ($input['webhook_signing_secret'] !== '' &&
                (strpos($input['webhook_signing_secret'], 'whsec_') !== 0 ||
                 base64_decode(substr($input['webhook_signing_secret'], 6), true) === false ||
                 substr($input['webhook_signing_secret'], 6) === '')) {
                throw new \InvalidArgumentException('Webhook signing secret must be a valid whsec_ key');
            }
        }
        if (!empty($input['clear_api_key'])) {
            $row['api_key_encrypted'] = null;
        } elseif (isset($input['api_key']) && $input['api_key'] !== '') {
            $row['api_key_encrypted'] = $this->crypto->encryptSecret($input['api_key']);
        }
        if ($row['sip_auth_mode'] === 'digest' && isset($input['sip_auth_password']) && $input['sip_auth_password'] !== '') {
            $row['sip_auth_password_encrypted'] = $this->crypto->encryptSecret($input['sip_auth_password']);
        }
        if (!empty($input['clear_webhook_signing_secret'])) {
            $row['webhook_signing_secret_encrypted'] = null;
        } elseif (isset($input['webhook_signing_secret']) && $input['webhook_signing_secret'] !== '') {
            $row['webhook_signing_secret_encrypted'] = $this->crypto->encryptSecret($input['webhook_signing_secret']);
        }
        $row['enabled'] = 1;
        return $row;
    }

    // Check required provider and SIP credentials.
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

    // Check provider fields and runtime ownership.
    private function validateBinding(array $row, $excludeId = null)
    {
        $field = $row['provider'] === 'openai' ? 'openai_project_id' : 'grok_phone_number';
        $value = strtolower(trim($row[$field]));
        $statement = $this->db->prepare('SELECT `id`, `runtime_owner`, `' . $field . '` FROM `satellite_agent_trunks`
            WHERE `provider` = ? FOR UPDATE');
        $statement->execute(array($row['provider']));
        foreach ($statement->fetchAll(\PDO::FETCH_ASSOC) as $other) {
            if ($excludeId !== null && (int) $other['id'] === $excludeId) {
                continue;
            }
            if (strtolower(trim((string) $other[$field])) === $value
                && ($other['runtime_owner'] !== $row['runtime_owner'] || $row['runtime_owner'] === 'builtin')) {
                throw new \InvalidArgumentException('Provider binding is already assigned to an Agent runtime');
            }
        }
    }

    // Keep the previous signing key when it changes.
    private function retireWebhookSecretIfChanged(array $stored, array $replacement)
    {
        if ($stored['webhook_signing_secret_encrypted'] !== $replacement['webhook_signing_secret_encrypted']) {
            $this->retireWebhookSecret($stored);
        }
    }

    // Retain the previous signing key for the allowed transition.
    private function retireWebhookSecret(array $stored)
    {
        if ($stored['runtime_owner'] !== 'builtin' || empty($stored['webhook_signing_secret_encrypted'])) {
            return;
        }
        $this->cleanupExpiredWebhookSecrets();
        $statement = $this->db->prepare('INSERT INTO `satellite_agent_webhook_previous_keys`
            (`binding_id`, `provider`, `secret_encrypted`, `expires_at`)
            VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . self::WEBHOOK_KEY_GRACE_SECONDS . ' SECOND))');
        $statement->execute(array((int) $stored['id'], $stored['provider'], $stored['webhook_signing_secret_encrypted']));
    }

    // Remove previous webhook keys after their expiry.
    private function cleanupExpiredWebhookSecrets()
    {
        $this->db->exec('DELETE FROM `satellite_agent_webhook_previous_keys` WHERE `expires_at` <= UTC_TIMESTAMP()');
    }

    // Check whether profiles or destinations use the trunk.
    private function isReferenced($id)
    {
        $id = $this->positiveId($id);
        foreach (array('SELECT COUNT(*) FROM `satellite_agent_destinations` WHERE `cleverai_trunk_id` = ?',
                       'SELECT COUNT(*) FROM `satellite_agent_destinations` WHERE `workflow_binding_id` = ?',
                       'SELECT COUNT(*) FROM `satellite_agent_profiles` WHERE `trunk_id` = ?') as $sql) {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($id));
            if ((int) $statement->fetchColumn() > 0) {
                return true;
            }
        }
        return false;
    }

    // Store the generated FreePBX trunk name.
    private function setGeneratedTrunkName($id)
    {
        $statement = $this->db->prepare('UPDATE `satellite_agent_trunks` SET `freepbx_trunk_name` = ? WHERE `id` = ?');
        $statement->execute(array('AgentTrunk_' . $id, $id));
    }

    // Check and return a positive database record ID.
    private function positiveId($id)
    {
        if (filter_var($id, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false) {
            throw new \InvalidArgumentException('Invalid agent trunk ID');
        }
        return (int) $id;
    }
}
