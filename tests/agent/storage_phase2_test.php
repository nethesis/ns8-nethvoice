<?php

require_once __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/satellite/lib/AgentProfileRepository.php';
require_once __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/satellite/lib/AgentDestinationRepository.php';
require_once __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/satellite/lib/AgentTrunkRepository.php';

function check($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function rejects($callback, $message)
{
    try {
        $callback();
    } catch (InvalidArgumentException $error) {
        return;
    }
    throw new RuntimeException($message);
}

class StorageFakeStatement
{
    private $db;
    private $sql;
    private $rows = array();
    private $count = 0;

    public function __construct($db, $sql)
    {
        $this->db = $db;
        $this->sql = $sql;
    }

    public function execute($params = array())
    {
        $sql = $this->sql;
        $this->rows = array();
        $this->count = 0;
        if (strpos($sql, 'FROM `satellite_agent_configuration_state`') !== false) {
            $this->rows = array($this->db->state);
        } elseif (strpos($sql, 'UPDATE `satellite_agent_configuration_state`') !== false) {
            if (strpos($sql, '`desired_hash` = ?') !== false) {
                $acknowledging = strpos($sql, '`acknowledged_revision` = ?') !== false;
                $revision = $acknowledging ? $params[3] : $params[1];
                if ((int) $revision === $this->db->state['desired_revision']
                    && ($this->db->state['desired_hash'] === $params[0]
                        || (!$acknowledging && $this->db->state['desired_hash'] === null))) {
                    $this->db->state['desired_hash'] = $params[0];
                    if ($acknowledging) {
                        $this->db->state['acknowledged_revision'] = $params[1];
                        $this->db->state['acknowledged_hash'] = $params[2];
                        $this->db->state['sync_error'] = null;
                    }
                    $this->count = 1;
                }
            } elseif (strpos($sql, '`sync_error` = ?') !== false) {
                $this->db->state['sync_error'] = $params[0];
                $this->count = 1;
            }
        } elseif (strpos($sql, 'SELECT * FROM `satellite_agent_profiles` WHERE') !== false) {
            if (isset($this->db->profiles[$params[0]])) {
                $this->rows = array($this->db->profiles[$params[0]]);
            }
        } elseif (strpos($sql, 'SELECT * FROM `satellite_agent_profiles` ORDER') !== false) {
            $this->rows = array_values($this->db->profiles);
        } elseif (strpos($sql, 'SELECT `runtime_owner` FROM `satellite_agent_trunks`') !== false) {
            $this->rows = isset($this->db->trunks[$params[0]])
                ? array(array('runtime_owner' => $this->db->trunks[$params[0]]['runtime_owner'])) : array();
        } elseif (strpos($sql, 'UPDATE `satellite_agent_profiles`') !== false) {
            $key = end($params);
            $fields = array('display_name', 'trunk_id', 'flow', 'model', 'voice', 'language', 'greeting', 'prompt',
                'permissions_json', 'tools_json', 'transfer_policy_json', 'knowledge_json',
                'max_call_duration_seconds', 'fallback_destination', 'company_json', 'calendar_services_json');
            foreach ($fields as $index => $field) {
                $this->db->profiles[$key][$field] = $params[$index];
            }
            $this->db->profiles[$key]['config_revision']++;
            $this->count = 1;
        } elseif (strpos($sql, 'SELECT * FROM `satellite_agent_destinations` WHERE') !== false) {
            if (isset($this->db->destinations[$params[0]])) {
                $this->rows = array($this->db->destinations[$params[0]]);
            }
        } elseif (strpos($sql, 'UPDATE `satellite_agent_destinations` SET') !== false) {
            $id = end($params);
            if (isset($this->db->destinations[$id])) {
                foreach (array('agent_type', 'cleverai_trunk_id', 'cleverai_flow', 'fallback_destination', 'enabled') as $index => $field) {
                    $this->db->destinations[$id][$field] = $params[$index];
                }
                $this->count = 1;
            }
        }
        return true;
    }

    public function fetch($mode = null)
    {
        return array_shift($this->rows) ?: false;
    }

    public function fetchAll($mode = null)
    {
        return $this->rows;
    }

    public function fetchColumn()
    {
        $row = $this->fetch();
        return $row ? reset($row) : false;
    }

    public function rowCount()
    {
        return $this->count;
    }
}

class StorageFakeDb
{
    public $state = array('desired_revision' => 1, 'desired_hash' => null,
        'acknowledged_revision' => 0, 'acknowledged_hash' => null, 'sync_error' => null,
        'snapshot_revision' => null, 'snapshot_hash' => null);
    public $profiles = array();
    public $trunks = array();
    public $destinations = array();
    private $transaction = false;

    public function prepare($sql)
    {
        return new StorageFakeStatement($this, $sql);
    }

    public function exec($sql)
    {
        if (strpos($sql, 'SET `desired_revision` = `desired_revision` + 1') !== false) {
            $this->state['desired_revision']++;
            $this->state['desired_hash'] = null;
        }
        return 1;
    }

    public function inTransaction() { return $this->transaction; }
    public function beginTransaction() { $this->transaction = true; return true; }
    public function commit() { $this->transaction = false; return true; }
    public function rollBack() { $this->transaction = false; return true; }
}

$db = new StorageFakeDb();
$defaults = AgentProfileRepository::defaultPermissions();
check(count($defaults) >= 14 && count(array_unique($defaults)) === 1 && reset($defaults) === 'deny', 'Permissions must default deny');
check(count(array_unique(AgentProfileRepository::defaultTools())) === 1, 'Tools must default disabled');
foreach (array('internal' => 'Internal', 'external' => 'External') as $key => $flow) {
    $db->profiles[$key] = array('profile_key' => $key, 'display_name' => 'Builtin ' . $flow,
        'trunk_id' => null, 'flow' => $flow, 'model' => null, 'voice' => null, 'language' => 'it',
        'greeting' => null, 'prompt' => null, 'permissions_json' => json_encode($defaults),
        'tools_json' => json_encode(AgentProfileRepository::defaultTools()),
        'transfer_policy_json' => '{}', 'knowledge_json' => '{}', 'company_json' => '{}',
        'calendar_services_json' => '{}', 'max_call_duration_seconds' => 600,
        'fallback_destination' => null, 'config_revision' => 1);
}
$db->trunks[1] = array('runtime_owner' => 'cleverai');
$db->trunks[2] = array('runtime_owner' => 'builtin');
$profiles = new AgentProfileRepository($db);
rejects(function () use ($profiles) { $profiles->save('internal', array('trunk_id' => 1)); }, 'CleverAI trunk selected for built-in profile');
check($db->state['desired_revision'] === 1, 'Rejected profile save changed revision');
$saved = $profiles->save('internal', array('trunk_id' => 2,
    'permissions' => array('directory.queues' => 'allow'),
    'company' => array('company_name' => 'Example'),
    'calendar_services' => array('reception' => '42')));
check($saved['permissions']['directory.extensions'] === 'deny' && $saved['permissions']['directory.queues'] === 'allow', 'Policy normalization failed');
check($saved['company']['company_name'] === 'Example' && $saved['calendar_services']['reception'] === '42', 'Profile JSON round trip failed');
check($db->state['desired_revision'] === 2, 'Profile save did not bump global revision');

$db->destinations[5] = array('id' => 5, 'system_managed' => 0, 'agent_type' => 'cleverai',
    'cleverai_trunk_id' => 1, 'cleverai_flow' => 'reception', 'fallback_destination' => null,
    'freepbx_name' => 'CleverAI_5', 'enabled' => 1);
$destinations = new AgentDestinationRepository($db);
$destinations->update(5, array('agent_type' => 'builtin_internal'));
check($db->destinations[5]['cleverai_trunk_id'] === 1 && $db->destinations[5]['cleverai_flow'] === 'reception', 'Switch lost CleverAI binding');
$destinations->update(5, array('agent_type' => 'cleverai'));
check($db->destinations[5]['freepbx_name'] === 'CleverAI_5' && $db->state['desired_revision'] === 4, 'Destination identity/revision changed unexpectedly');
rejects(function () use ($destinations) { $destinations->validateInput(array('agent_type' => 'cleverai',
    'cleverai_trunk_id' => 2, 'cleverai_flow' => 'reception')); }, 'Built-in trunk accepted for CleverAI');

$db->destinations[1] = array('id' => 1, 'system_managed' => 1, 'agent_type' => 'builtin_internal',
    'freepbx_name' => 'Satellite Agent Internal', 'enabled' => 1);
$deletionRejected = false;
try { $destinations->delete(1); } catch (RuntimeException $error) { $deletionRejected = true; }
check($deletionRejected, 'Protected destination deletion accepted');
check(isset($db->destinations[1]) && $db->state['desired_revision'] === 4,
    'Protected destination deletion changed configuration');

$state = new AgentConfigurationState($db);
$hash = str_repeat('a', 64);
$state->setDesiredHash(4, $hash);
$state->acknowledge(4, $hash);
check($state->status()['acknowledged_hash'] === $hash, 'Acknowledgement not recorded');
rejects(function () use ($state) { $state->acknowledge(4, 'bad'); }, 'Invalid hash accepted');

echo "storage_phase2_test: OK\n";
