<?php
require_once __DIR__ . '/AgentDestinationRepository.php';
require_once __DIR__ . '/AgentProfileRepository.php';
/** Read-only PBX resources; routing targets are created here, never by an LLM. */
class AgentContextSource
{
    private $freepbx;
    public function __construct($freepbx) { $this->freepbx = $freepbx; }

    public function directory()
    {
        $resources = array();
        foreach ($this->freepbx->Core->listUsers(false) as $row) {
            if (isset($row[0], $row[1])) { $resources[] = $this->resource('extension', $row[0], $row[1], 'from-did-direct', $row[0]); }
        }
        try {
            foreach ($this->freepbx->Queues->listQueues() as $row) {
                if (isset($row[0])) { $resources[] = $this->resource('queue', $row[0], isset($row[1]) ? $row[1] : $row[0], 'ext-queues', $row[0]); }
            }
        } catch (\Throwable $error) { /* Optional PBX module. */ }
        try {
            foreach ($this->freepbx->Ivr->getDetails() as $row) {
                if (isset($row['id'])) { $resources[] = $this->resource('ivr', $row['id'], isset($row['name']) ? html_entity_decode($row['name'], ENT_QUOTES, 'UTF-8') : 'IVR ' . $row['id'], 'ivr-' . $row['id'], 's'); }
            }
        } catch (\Throwable $error) { /* Optional PBX module. */ }
        $rules = (new AgentDestinationRepository($this->freepbx->Database))->directoryRules();
        $result = array();
        foreach ($resources as $resource) {
            if (!$resource) { continue; }
            if (isset($rules[$resource['id']])) {
                foreach (array('description', 'synonyms', 'internal_allowed', 'external_allowed') as $field) {
                    $resource[$field] = $rules[$resource['id']][$field];
                }
            }
            $resource['description'] = (string) $resource['description'];
            $result[] = $resource;
        }
        usort($result, function ($a, $b) { return strcmp($a['id'], $b['id']); });
        return $result;
    }

    private function resource($type, $id, $name, $context, $exten)
    {
        if (!preg_match('/^[0-9]+$/D', (string) $id)) { return null; }
        return array('id' => $type . ':' . $id, 'type' => $type, 'name' => (string) $name,
            'description' => '', 'synonyms' => array(), 'internal_allowed' => false,
            'external_allowed' => false, 'target' => array('context' => $context, 'exten' => (string) $exten, 'priority' => 1));
    }

    public function timeConditions()
    {
        $result = array();
        try {
            foreach ($this->freepbx->Timeconditions->listTimeconditions(false) as $row) {
                $result[] = array('id' => (string) $row['timeconditions_id'], 'name' => $row['displayname']);
            }
        } catch (\Throwable $error) { }
        return $result;
    }

    public function calendars()
    {
        $result = array();
        try {
            $conditions = $this->freepbx->Timeconditions->listTimeconditions(false);
        } catch (\Throwable $error) { $conditions = array(); }
        foreach ($conditions as $row) {
            $id = (string) $row['timeconditions_id'];
            $rules = array();
            $supported = !empty($row['time']) && empty($row['calendar_id']) && empty($row['calendar_group_id']);
            if ($supported) {
                $query = $this->freepbx->Database->prepare('SELECT `time` FROM `timegroups_details` WHERE `timegroupid` = ? ORDER BY `id`');
                $query->execute(array($row['time']));
                foreach ($query->fetchAll(\PDO::FETCH_ASSOC) as $rule) {
                    if (!preg_match('/^[^|]{1,32}\|[^|]{1,32}\|[^|]{1,32}\|[^|]{1,32}$/D', $rule['time'])) {
                        $supported = false; continue;
                    }
                    $rules[] = $rule['time'];
                }
            }
            $override = 'unknown';
            try {
                $manager = $this->freepbx->astman;
                if ($manager && $manager->connected()) {
                    // Bypass phpagi AstDB cache: manual overrides can change between syncs.
                    $response = $manager->command('database get TC ' . (int) $id);
                    $data = isset($response['data']) ? $response['data'] : '';
                    if (preg_match('/Value:\s*(\S*)/', $data, $match)) {
                        $value = $match[1];
                        $override = in_array($value, array('true', 'true_sticky'), true) ? 'open'
                            : (in_array($value, array('false', 'false_sticky'), true) ? 'closed' : ($value === '' ? 'auto' : 'unknown'));
                    } elseif (stripos($data, 'Database entry not found') !== false) { $override = 'auto'; }
                }
            } catch (\Throwable $error) { }
            $timezone = !empty($row['timezone']) ? $row['timezone'] : (getenv('TIMEZONE') ?: date_default_timezone_get());
            if (!in_array($timezone, \DateTimeZone::listIdentifiers(\DateTimeZone::ALL_WITH_BC), true)) {
                $timezone = date_default_timezone_get();
                $supported = false;
            }
            $result[$id] = array('timezone' => $timezone, 'rules' => $rules, 'override' => $override,
                'observed_at' => time(), 'supported' => (bool) $supported);
        }
        // Deleted or unavailable sources stay explicitly unknown so unrelated
        // profiles and directory updates can still synchronize atomically.
        foreach ((new AgentProfileRepository($this->freepbx->Database))->listAll() as $profile) {
            foreach ($profile['calendar_services'] as $id) {
                if (!isset($result[$id])) {
                    $result[$id] = array('timezone' => date_default_timezone_get(), 'rules' => array(),
                        'override' => 'unknown', 'observed_at' => time(), 'supported' => false);
                }
            }
        }
        return (object) $result;
    }
}
