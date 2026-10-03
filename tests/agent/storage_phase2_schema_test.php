<?php

require_once __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/satellite/lib/AgentSchema.php';

class SchemaStatement
{
    private $db;
    private $sql;
    private $rows = array();

    public function __construct($db, $sql) { $this->db = $db; $this->sql = $sql; }
    public function execute($params = array())
    {
        if (strpos($this->sql, 'SHOW COLUMNS') === 0) {
            $this->rows = array(array('Field' => $params[0]));
        } elseif (strpos($this->sql, 'INSERT IGNORE INTO `satellite_agent_profiles`') === 0) {
            if (!isset($this->db->profiles[$params[0]])) {
                $this->db->profiles[$params[0]] = array('flow' => $params[2], 'permissions' => json_decode($params[3], true));
            }
        } elseif (strpos($this->sql, 'INSERT IGNORE INTO `satellite_agent_destinations`') === 0) {
            if (!isset($this->db->destinations[$params[0]])) {
                $this->db->destinations[$params[0]] = array('name' => $params[1], 'type' => $params[2]);
            }
        }
        return true;
    }
    public function fetch($mode = null) { return array_shift($this->rows) ?: false; }
}

class SchemaDb
{
    public $profiles = array();
    public $destinations = array();
    public $sql = array();
    public function exec($sql) { $this->sql[] = $sql; return 0; }
    public function prepare($sql) { return new SchemaStatement($this, $sql); }
}

$db = new SchemaDb();
AgentSchema::install($db);
if (count($db->profiles) !== 2 || count($db->destinations) !== 2
    || $db->profiles['internal']['permissions']['directory.extensions'] !== 'deny'
    || $db->destinations['builtin_external']['type'] !== 'builtin_external') {
    throw new RuntimeException('Missing built-in defaults');
}
$db->profiles['internal']['flow'] = 'Edited';
$db->destinations['builtin_internal']['name'] = 'Edited';
AgentSchema::install($db);
if (count($db->profiles) !== 2 || count($db->destinations) !== 2
    || $db->profiles['internal']['flow'] !== 'Edited'
    || $db->destinations['builtin_internal']['name'] !== 'Edited') {
    throw new RuntimeException('Migration overwrote existing configuration');
}
foreach ($db->sql as $sql) {
    if (preg_match('/UPDATE `satellite_agent_destinations` SET `agent_type`/', $sql)) {
        throw new RuntimeException('Migration must preserve destination type');
    }
}
echo "storage_phase2_schema_test: OK\n";
