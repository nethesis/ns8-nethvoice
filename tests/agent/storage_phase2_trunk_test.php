<?php

require_once __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/satellite/lib/AgentTrunkRepository.php';

class TrunkStatement
{
    private $db;
    private $sql;
    private $rows = array();
    private $count = 0;
    public function __construct($db, $sql) { $this->db = $db; $this->sql = $sql; }
    public function execute($params = array())
    {
        $sql = $this->sql;
        $this->rows = array();
        $this->count = 0;
        if (strpos($sql, 'FROM `satellite_agent_configuration_state`') !== false) {
            $this->rows = array($this->db->state);
        } elseif (strpos($sql, 'SELECT * FROM `satellite_agent_trunks` WHERE') !== false) {
            if (isset($this->db->trunks[$params[0]])) { $this->rows = array($this->db->trunks[$params[0]]); }
        } elseif (strpos($sql, 'SELECT `id`, `runtime_owner`') !== false) {
            foreach ($this->db->trunks as $row) {
                if ($row['provider'] === $params[0]) { $this->rows[] = $row; }
            }
        } elseif (strpos($sql, 'SELECT COUNT(*)') !== false) {
            $this->rows = array(array(0));
        } elseif (strpos($sql, 'INSERT INTO `satellite_agent_trunks`') !== false) {
            $id = ++$this->db->lastId;
            $fields = array('name', 'provider', 'runtime_owner', 'freepbx_trunk_name', 'openai_project_id',
                'grok_phone_number', 'api_key_encrypted', 'sip_auth_mode', 'sip_auth_username',
                'sip_auth_password_encrypted', 'webhook_signing_secret_encrypted', 'enabled');
            $this->db->trunks[$id] = array_combine($fields, $params) + array('id' => $id);
            $this->count = 1;
        } elseif (strpos($sql, 'UPDATE `satellite_agent_trunks` SET `freepbx_trunk_name`') !== false) {
            $this->db->trunks[$params[1]]['freepbx_trunk_name'] = $params[0];
            $this->count = 1;
        } elseif (strpos($sql, 'UPDATE `satellite_agent_trunks` SET') !== false) {
            $id = end($params);
            $fields = array('name', 'provider', 'openai_project_id', 'grok_phone_number', 'api_key_encrypted',
                'sip_auth_mode', 'sip_auth_username', 'sip_auth_password_encrypted',
                'webhook_signing_secret_encrypted', 'enabled');
            foreach ($fields as $index => $field) { $this->db->trunks[$id][$field] = $params[$index]; }
            $this->count = 1;
        }
        return true;
    }
    public function fetch($mode = null) { return array_shift($this->rows) ?: false; }
    public function fetchAll($mode = null) { return $this->rows; }
    public function fetchColumn() { $row = $this->fetch(); return $row ? reset($row) : false; }
    public function rowCount() { return $this->count; }
}

class TrunkDb
{
    public $trunks = array();
    public $lastId = 0;
    public $state = array('desired_revision' => 1, 'desired_hash' => null,
        'acknowledged_revision' => 0, 'acknowledged_hash' => null, 'sync_error' => null,
        'snapshot_revision' => null, 'snapshot_hash' => null);
    private $transaction = false;
    public function prepare($sql) { return new TrunkStatement($this, $sql); }
    public function exec($sql) {
        if (strpos($sql, '`desired_revision` = `desired_revision` + 1') !== false) { $this->state['desired_revision']++; }
        return 1;
    }
    public function lastInsertId() { return (string) $this->lastId; }
    public function beginTransaction() { $this->transaction = true; return true; }
    public function inTransaction() { return $this->transaction; }
    public function commit() { $this->transaction = false; return true; }
    public function rollBack() { $this->transaction = false; return true; }
}

putenv('SATELLITE_AGENT_CONFIG_KEY=storage-phase2-test-key');
putenv('OPENAI_API_KEY=storage-phase2-test-api-key');
$db = new TrunkDb();
$repository = new AgentTrunkRepository($db);
$signingSecret = 'whsec_' . base64_encode('signed-secret');
$clever = $repository->create(array('name' => 'Clever', 'provider' => 'openai',
    'runtime_owner' => 'cleverai', 'openai_project_id' => 'proj_shared'));
try {
    $repository->create(array('name' => 'Builtin duplicate', 'provider' => 'openai',
        'runtime_owner' => 'builtin', 'openai_project_id' => 'proj_shared'));
    throw new RuntimeException('Cross-owner duplicate binding was accepted');
} catch (InvalidArgumentException $expected) { }
$builtin = $repository->create(array('name' => 'Builtin', 'provider' => 'openai',
    'runtime_owner' => 'builtin', 'openai_project_id' => 'proj_other',
    'webhook_signing_secret' => $signingSecret));
$stored = $repository->getStoredById($builtin);
if ($stored['runtime_owner'] !== 'builtin' || $stored['webhook_signing_secret_encrypted'] === $signingSecret
    || $repository->resolveWebhookSigningSecret($stored) !== $signingSecret
    || isset($repository->getById($builtin)['webhook_signing_secret_encrypted'])) {
    throw new RuntimeException('Webhook secret was not protected');
}
$ciphertext = $stored['webhook_signing_secret_encrypted'];
$repository->update($builtin, array('webhook_signing_secret' => ''));
if ($repository->getStoredById($builtin)['webhook_signing_secret_encrypted'] !== $ciphertext) {
    throw new RuntimeException('Empty secret field did not retain the configured secret');
}
$repository->update($builtin, array('clear_webhook_signing_secret' => true));
if ($repository->getStoredById($builtin)['webhook_signing_secret_encrypted'] !== null) {
    throw new RuntimeException('Explicit secret removal failed');
}
try {
    $repository->update($clever, array('runtime_owner' => 'builtin'));
    throw new RuntimeException('In-place ownership change was accepted');
} catch (InvalidArgumentException $expected) { }
echo "storage_phase2_trunk_test: OK\n";
