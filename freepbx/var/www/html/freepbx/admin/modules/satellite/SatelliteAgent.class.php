<?php
#
# Copyright (C) 2026 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

class SatelliteAgent
{
    private $FreePBX;
    private $db;

    private static $nodeTypes = array('agent', 'transfer', 'hangup', 'webhook');
    private static $agentTools = array('transfer_call', 'hangup_call', 'send_webhook_event');

    public function __construct($freepbx) {
        if ($freepbx == null) {
            throw new \Exception('Not given a FreePBX Object');
        }

        $this->FreePBX = $freepbx;
        $this->db = $freepbx->Database;
    }

    public function install() {
        $sqls = array(
            "CREATE TABLE IF NOT EXISTS `satellite_agent_nodes` (
                `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                `uuid` CHAR(36) NOT NULL UNIQUE,
                `name` VARCHAR(128) NOT NULL,
                `type` VARCHAR(32) NOT NULL,
                `version` INT UNSIGNED NOT NULL DEFAULT 1,
                `enabled` TINYINT(1) NOT NULL DEFAULT 1,
                `json` LONGTEXT NOT NULL,
                `checksum` CHAR(64) NOT NULL,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `satellite_agent_nodes_type_idx` (`type`),
                INDEX `satellite_agent_nodes_enabled_idx` (`enabled`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS `satellite_agent_workflows` (
                `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                `uuid` CHAR(36) NOT NULL UNIQUE,
                `name` VARCHAR(128) NOT NULL,
                `description` TEXT NULL,
                `enabled` TINYINT(1) NOT NULL DEFAULT 1,
                `entry_node_uuid` CHAR(36) NOT NULL,
                `graph_json` LONGTEXT NOT NULL,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `satellite_agent_workflows_enabled_idx` (`enabled`),
                INDEX `satellite_agent_workflows_entry_idx` (`entry_node_uuid`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS `satellite_agent_destinations` (
                `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                `workflow_uuid` CHAR(36) NOT NULL,
                `description` VARCHAR(128) NOT NULL,
                `enabled` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `satellite_agent_destinations_workflow_unique` (`workflow_uuid`),
                INDEX `satellite_agent_destinations_enabled_idx` (`enabled`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        );

        foreach ($sqls as $sql) {
            $this->execute($sql);
        }
    }

    public function uninstall() {
    }

    public function backup() {
        return array(
            'nodes' => $this->listNodes(),
            'workflows' => $this->listWorkflows(),
            'destinations' => $this->listDestinations(),
        );
    }

    public function restore($backup) {
        if (!is_array($backup)) {
            throw new \Exception('Invalid Satellite Agent backup');
        }

        $nodes = isset($backup['nodes']) && is_array($backup['nodes']) ? $backup['nodes'] : array();
        $workflows = isset($backup['workflows']) && is_array($backup['workflows']) ? $backup['workflows'] : array();
        $destinations = isset($backup['destinations']) && is_array($backup['destinations']) ? $backup['destinations'] : array();

        $this->install();
        $this->db->beginTransaction();
        try {
            foreach ($nodes as $node) {
                $this->restoreNode($node);
            }
            foreach ($workflows as $workflow) {
                $this->restoreWorkflow($workflow);
            }
            foreach ($destinations as $destination) {
                $this->restoreDestination($destination);
            }
            $this->db->commit();
        } catch (\Exception $exception) {
            $this->db->rollBack();
            throw $exception;
        }

        $this->markReloadRequired();
    }

    public function createNode($name, $type, array $json) {
        $name = $this->validateText($name, 'name', 128);
        $type = $this->validateNodeType($type);
        $jsonType = $this->validatedNodeJsonType($json);
        if ($type !== $jsonType) {
            throw new \Exception('Node type does not match JSON type');
        }

        $uuid = $this->generateUuidV4();
        $canonicalJson = $this->canonicalJson($json);
        $checksum = hash('sha256', $canonicalJson);
        $sql = 'INSERT INTO `satellite_agent_nodes` (`uuid`, `name`, `type`, `json`, `checksum`) VALUES (?, ?, ?, ?, ?)';
        $this->execute($sql, array($uuid, $name, $type, $canonicalJson, $checksum));

        return $this->getNode($uuid);
    }

    public function updateNode($uuid, array $json) {
        $uuid = $this->validateUuid($uuid, 'uuid');
        $type = $this->validatedNodeJsonType($json);
        $canonicalJson = $this->canonicalJson($json);
        $checksum = hash('sha256', $canonicalJson);
        $sql = 'UPDATE `satellite_agent_nodes` SET `type` = ?, `version` = `version` + 1, `json` = ?, `checksum` = ? WHERE `uuid` = ?';
        $statement = $this->execute($sql, array($type, $canonicalJson, $checksum, $uuid));
        if ($statement->rowCount() === 0 && $this->getNode($uuid) === null) {
            throw new \Exception('Satellite Agent node not found');
        }

        return $this->getNode($uuid);
    }

    public function getNode($uuid) {
        $uuid = $this->validateUuid($uuid, 'uuid');
        $row = $this->fetchOne('SELECT * FROM `satellite_agent_nodes` WHERE `uuid` = ?', array($uuid));
        if ($row === null) {
            return null;
        }

        return $this->formatNodeRow($row);
    }

    public function listNodes($type = null, $enabled = null) {
        $clauses = array();
        $parameters = array();
        if ($type !== null) {
            $clauses[] = '`type` = ?';
            $parameters[] = $this->validateNodeType($type);
        }
        if ($enabled !== null) {
            $clauses[] = '`enabled` = ?';
            $parameters[] = $this->enabledValue($enabled);
        }

        $sql = 'SELECT * FROM `satellite_agent_nodes`';
        if (!empty($clauses)) {
            $sql .= ' WHERE ' . implode(' AND ', $clauses);
        }
        $sql .= ' ORDER BY `name`, `id`';

        $rows = $this->fetchAll($sql, $parameters);
        $nodes = array();
        foreach ($rows as $row) {
            $nodes[] = $this->formatNodeRow($row);
        }

        return $nodes;
    }

    public function deleteNode($uuid) {
        $uuid = $this->validateUuid($uuid, 'uuid');
        $this->assertNodeIsNotReferenced($uuid);
        $statement = $this->execute('DELETE FROM `satellite_agent_nodes` WHERE `uuid` = ?', array($uuid));
        if ($statement->rowCount() === 0) {
            throw new \Exception('Satellite Agent node not found');
        }
    }

    public function createWorkflow($name, $entryNodeUuid, array $graphJson, $description = '') {
        $name = $this->validateText($name, 'name', 128);
        $description = $this->validateOptionalText($description, 'description', 65535);
        $entryNodeUuid = $this->validateUuid($entryNodeUuid, 'entry_node_uuid');
        $graph = $this->validatedWorkflowGraph($graphJson);
        if ($entryNodeUuid !== $graph['entry']) {
            throw new \Exception('Workflow entry node does not match graph entry');
        }

        $uuid = $this->generateUuidV4();
        $canonicalGraph = $this->canonicalJson($graph);
        $sql = 'INSERT INTO `satellite_agent_workflows` (`uuid`, `name`, `description`, `entry_node_uuid`, `graph_json`) VALUES (?, ?, ?, ?, ?)';
        $this->execute($sql, array($uuid, $name, $description, $entryNodeUuid, $canonicalGraph));

        return $this->getWorkflow($uuid);
    }

    public function updateWorkflow($uuid, array $graphJson) {
        $uuid = $this->validateUuid($uuid, 'uuid');
        $this->assertWorkflowExists($uuid);
        $graph = $this->validatedWorkflowGraph($graphJson);
        $canonicalGraph = $this->canonicalJson($graph);
        $sql = 'UPDATE `satellite_agent_workflows` SET `entry_node_uuid` = ?, `graph_json` = ? WHERE `uuid` = ?';
        $this->execute($sql, array($graph['entry'], $canonicalGraph, $uuid));

        return $this->getWorkflow($uuid);
    }

    public function getWorkflow($uuid, $expandNodes = false) {
        $uuid = $this->validateUuid($uuid, 'uuid');
        $row = $this->fetchOne('SELECT * FROM `satellite_agent_workflows` WHERE `uuid` = ?', array($uuid));
        if ($row === null) {
            return null;
        }

        $workflow = $this->formatWorkflowRow($row);
        if ($expandNodes) {
            $workflow['nodes'] = $this->expandWorkflowNodes($workflow['graph_json']);
        }

        return $workflow;
    }

    public function listWorkflows($enabled = null) {
        $parameters = array();
        $sql = 'SELECT * FROM `satellite_agent_workflows`';
        if ($enabled !== null) {
            $sql .= ' WHERE `enabled` = ?';
            $parameters[] = $this->enabledValue($enabled);
        }
        $sql .= ' ORDER BY `name`, `id`';

        $rows = $this->fetchAll($sql, $parameters);
        $workflows = array();
        foreach ($rows as $row) {
            $workflows[] = $this->formatWorkflowRow($row);
        }

        return $workflows;
    }

    public function deleteWorkflow($uuid) {
        $uuid = $this->validateUuid($uuid, 'uuid');
        $this->execute('DELETE FROM `satellite_agent_destinations` WHERE `workflow_uuid` = ?', array($uuid));
        $statement = $this->execute('DELETE FROM `satellite_agent_workflows` WHERE `uuid` = ?', array($uuid));
        if ($statement->rowCount() === 0) {
            throw new \Exception('Satellite Agent workflow not found');
        }
        $this->markReloadRequired();
    }

    public function createDestination($workflowUuid, $description) {
        $workflowUuid = $this->validateWorkflowForDestination($workflowUuid, true);
        $description = $this->validateText($description, 'description', 128);
        $sql = 'INSERT INTO `satellite_agent_destinations` (`workflow_uuid`, `description`) VALUES (?, ?)';
        $this->execute($sql, array($workflowUuid, $description));
        $this->markReloadRequired();

        return $this->fetchDestination($workflowUuid);
    }

    public function updateDestination($workflowUuid, $description, $enabled = true) {
        $enabledValue = $this->enabledValue($enabled);
        $workflowUuid = $this->validateWorkflowForDestination($workflowUuid, $enabledValue === 1);
        $description = $this->validateText($description, 'description', 128);
        $sql = 'INSERT INTO `satellite_agent_destinations` (`workflow_uuid`, `description`, `enabled`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `description` = ?, `enabled` = ?';
        $this->execute($sql, array($workflowUuid, $description, $enabledValue, $description, $enabledValue));
        $this->markReloadRequired();

        return $this->fetchDestination($workflowUuid);
    }

    public function deleteDestination($workflowUuid) {
        $workflowUuid = $this->validateUuid($workflowUuid, 'workflow_uuid');
        $statement = $this->execute('DELETE FROM `satellite_agent_destinations` WHERE `workflow_uuid` = ?', array($workflowUuid));
        if ($statement->rowCount() > 0) {
            $this->markReloadRequired();
        }
    }

    public function listDestinations($enabled = null) {
        $parameters = array();
        $sql = 'SELECT * FROM `satellite_agent_destinations`';
        if ($enabled !== null) {
            $sql .= ' WHERE `enabled` = ?';
            $parameters[] = $this->enabledValue($enabled);
        }
        $sql .= ' ORDER BY `description`, `id`';

        return $this->fetchAll($sql, $parameters);
    }

    public function destinations() {
        $sql = 'SELECT `d`.`workflow_uuid`, `d`.`description` FROM `satellite_agent_destinations` `d` INNER JOIN `satellite_agent_workflows` `w` ON `w`.`uuid` = `d`.`workflow_uuid` WHERE `d`.`enabled` = 1 AND `w`.`enabled` = 1 ORDER BY `d`.`description`, `d`.`id`';
        $rows = $this->fetchAll($sql);
        $destinations = array();
        foreach ($rows as $row) {
            $destinations[] = array(
                'destination' => 'satellite-agent,' . $row['workflow_uuid'] . ',1',
                'description' => 'Satellite Agent: ' . $row['description'],
                'category' => 'Satellite Agents',
            );
        }

        return $destinations;
    }

    public function renderDialplan($ext) {
        $context = 'satellite-agent';
        $sql = 'SELECT `w`.`uuid` FROM `satellite_agent_workflows` `w` INNER JOIN `satellite_agent_destinations` `d` ON `d`.`workflow_uuid` = `w`.`uuid` WHERE `w`.`enabled` = 1 AND `d`.`enabled` = 1 ORDER BY `d`.`description`, `d`.`id`';
        $rows = $this->fetchAll($sql);
        foreach ($rows as $row) {
            $workflowUuid = $this->validateUuid($row['uuid'], 'workflow_uuid');
            $ext->add($context, $workflowUuid, '', new \ext_noop('Satellite Agent workflow ' . $workflowUuid));
            $ext->add($context, $workflowUuid, '', new \ext_set('__SATELLITE_AGENT_WORKFLOW', $workflowUuid));
            $ext->add($context, $workflowUuid, '', new \ext_set('PJSIP_HEADER(add,X-NethVoice-Agent-Workflow)', $workflowUuid));
            $ext->add($context, $workflowUuid, '', new \ext_set('PJSIP_HEADER(add,X-NethVoice-Uniqueid)', '${UNIQUEID}'));
            $ext->add($context, $workflowUuid, '', new \ext_set('PJSIP_HEADER(add,X-NethVoice-Linkedid)', '${CHANNEL(linkedid)}'));
            $ext->add($context, $workflowUuid, '', new \ext_set('PJSIP_HEADER(add,X-NethVoice-Caller)', '${CALLERID(num)}'));
            $ext->add($context, $workflowUuid, '', new \ext_dial('PJSIP/${OPENAI_PROJECT_ID}@openai-realtime', '60'));
            $ext->add($context, $workflowUuid, '', new \ext_hangup());
        }
    }

    public function exportRuntimeWorkflow($workflowUuid) {
        $workflowUuid = $this->validateUuid($workflowUuid, 'workflow_uuid');
        $workflow = $this->getWorkflow($workflowUuid);
        if ($workflow === null || (int) $workflow['enabled'] !== 1) {
            throw new \Exception('Satellite Agent workflow is not enabled');
        }
        $graph = $this->validatedWorkflowGraph($workflow['graph_json']);
        if ($workflow['entry_node_uuid'] !== $graph['entry']) {
            throw new \Exception('Workflow entry node does not match graph entry');
        }

        $nodes = array();
        foreach ($this->expandWorkflowNodes($graph) as $nodeUuid => $node) {
            if ((int) $node['enabled'] !== 1) {
                throw new \Exception('Satellite Agent workflow references a disabled node');
            }
            $nodes[$nodeUuid] = array(
                'uuid' => $node['uuid'],
                'name' => $node['name'],
                'type' => $node['type'],
                'version' => (int) $node['version'],
                'json' => $node['json'],
            );
        }

        return array(
            'workflow_uuid' => $workflow['uuid'],
            'name' => $workflow['name'],
            'entry_node_uuid' => $workflow['entry_node_uuid'],
            'graph' => $graph,
            'nodes' => $nodes,
        );
    }

    public function validateNodeJson(array $json) {
        $this->validatedNodeJsonType($json);

        return true;
    }

    public function validateWorkflowJson(array $json) {
        $this->validatedWorkflowGraph($json);

        return true;
    }

    private function execute($sql, array $parameters = array()) {
        $statement = $this->db->prepare($sql);
        $statement->execute($parameters);

        return $statement;
    }

    private function fetchOne($sql, array $parameters = array()) {
        $statement = $this->execute($sql, $parameters);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function fetchAll($sql, array $parameters = array()) {
        $statement = $this->execute($sql, $parameters);

        return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }

    private function restoreNode(array $node) {
        $uuid = $this->validateUuid(isset($node['uuid']) ? $node['uuid'] : '', 'node uuid');
        $name = $this->validateText(isset($node['name']) ? $node['name'] : '', 'name', 128);
        $type = $this->validateNodeType(isset($node['type']) ? $node['type'] : '');
        $version = isset($node['version']) ? $this->positiveInteger($node['version'], 'version') : 1;
        $enabled = isset($node['enabled']) ? $this->enabledValue($node['enabled']) : 1;
        $json = $this->jsonValueFromBackup($node, 'json');
        $jsonType = $this->validatedNodeJsonType($json);
        if ($type !== $jsonType) {
            throw new \Exception('Node type does not match JSON type');
        }

        $canonicalJson = $this->canonicalJson($json);
        $checksum = hash('sha256', $canonicalJson);
        $sql = 'INSERT INTO `satellite_agent_nodes` (`uuid`, `name`, `type`, `version`, `enabled`, `json`, `checksum`) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name` = ?, `type` = ?, `version` = ?, `enabled` = ?, `json` = ?, `checksum` = ?';
        $this->execute($sql, array($uuid, $name, $type, $version, $enabled, $canonicalJson, $checksum, $name, $type, $version, $enabled, $canonicalJson, $checksum));
    }

    private function restoreWorkflow(array $workflow) {
        $uuid = $this->validateUuid(isset($workflow['uuid']) ? $workflow['uuid'] : '', 'workflow uuid');
        $name = $this->validateText(isset($workflow['name']) ? $workflow['name'] : '', 'name', 128);
        $description = $this->validateOptionalText(isset($workflow['description']) ? $workflow['description'] : '', 'description', 65535);
        $enabled = isset($workflow['enabled']) ? $this->enabledValue($workflow['enabled']) : 1;
        $entryNodeUuid = $this->validateUuid(isset($workflow['entry_node_uuid']) ? $workflow['entry_node_uuid'] : '', 'entry_node_uuid');
        $graphJson = $this->jsonValueFromBackup($workflow, 'graph_json');
        $graph = $this->validatedWorkflowGraph($graphJson);
        if ($entryNodeUuid !== $graph['entry']) {
            throw new \Exception('Workflow entry node does not match graph entry');
        }

        $canonicalGraph = $this->canonicalJson($graph);
        $sql = 'INSERT INTO `satellite_agent_workflows` (`uuid`, `name`, `description`, `enabled`, `entry_node_uuid`, `graph_json`) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name` = ?, `description` = ?, `enabled` = ?, `entry_node_uuid` = ?, `graph_json` = ?';
        $this->execute($sql, array($uuid, $name, $description, $enabled, $entryNodeUuid, $canonicalGraph, $name, $description, $enabled, $entryNodeUuid, $canonicalGraph));
    }

    private function restoreDestination(array $destination) {
        $workflowUuid = $this->validateUuid(isset($destination['workflow_uuid']) ? $destination['workflow_uuid'] : '', 'workflow_uuid');
        $description = $this->validateText(isset($destination['description']) ? $destination['description'] : '', 'description', 128);
        $enabled = isset($destination['enabled']) ? $this->enabledValue($destination['enabled']) : 1;
        $this->assertWorkflowExists($workflowUuid);

        $sql = 'INSERT INTO `satellite_agent_destinations` (`workflow_uuid`, `description`, `enabled`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `description` = ?, `enabled` = ?';
        $this->execute($sql, array($workflowUuid, $description, $enabled, $description, $enabled));
    }

    private function jsonValueFromBackup(array $row, $field) {
        if (!array_key_exists($field, $row)) {
            throw new \Exception('Missing backup field: ' . $field);
        }

        if (is_array($row[$field])) {
            return $row[$field];
        }
        if (is_string($row[$field])) {
            return $this->decodeJson($row[$field], $field);
        }

        throw new \Exception('Invalid backup JSON field: ' . $field);
    }

    private function formatNodeRow(array $row) {
        $row['id'] = (int) $row['id'];
        $row['version'] = (int) $row['version'];
        $row['enabled'] = (int) $row['enabled'];
        $row['json'] = $this->decodeJson($row['json'], 'node json');

        return $row;
    }

    private function formatWorkflowRow(array $row) {
        $row['id'] = (int) $row['id'];
        $row['enabled'] = (int) $row['enabled'];
        $row['graph_json'] = $this->decodeJson($row['graph_json'], 'workflow graph');

        return $row;
    }

    private function fetchDestination($workflowUuid) {
        $workflowUuid = $this->validateUuid($workflowUuid, 'workflow_uuid');
        $row = $this->fetchOne('SELECT * FROM `satellite_agent_destinations` WHERE `workflow_uuid` = ?', array($workflowUuid));
        if ($row === null) {
            return null;
        }

        $row['id'] = (int) $row['id'];
        $row['enabled'] = (int) $row['enabled'];

        return $row;
    }

    private function validatedNodeJsonType(array $json) {
        if (!isset($json['type'])) {
            throw new \Exception('Missing required field: type');
        }

        $type = $this->validateNodeType($json['type']);
        switch ($type) {
            case 'agent':
                $this->validateAgentNode($json);
                break;
            case 'transfer':
                $this->validateTransferNode($json);
                break;
            case 'hangup':
                $this->validateHangupNode($json);
                break;
            case 'webhook':
                $this->validateWebhookNode($json);
                break;
        }

        return $type;
    }

    private function validateAgentNode(array $json) {
        $this->assertAllowedKeys($json, array('type', 'model', 'voice', 'instructions', 'behavior', 'tools'), 'agent node');
        $this->requiredString($json, 'model', 128);
        $this->optionalString($json, 'voice', 64);
        $this->requiredString($json, 'instructions', 65535);

        if (isset($json['behavior'])) {
            if (!is_array($json['behavior'])) {
                throw new \Exception('Agent behavior must be an object');
            }
            $this->assertAllowedKeys($json['behavior'], array('first_message', 'barge_in', 'silence_timeout_ms', 'max_call_seconds'), 'agent behavior');
            $this->optionalString($json['behavior'], 'first_message', 1024);
            $this->optionalBoolean($json['behavior'], 'barge_in');
            $this->optionalIntegerRange($json['behavior'], 'silence_timeout_ms', 500, 300000);
            $this->optionalIntegerRange($json['behavior'], 'max_call_seconds', 1, 86400);
        }

        if (isset($json['tools'])) {
            if (!is_array($json['tools']) || !$this->isSequentialArray($json['tools'])) {
                throw new \Exception('Agent tools must be a list');
            }
            $seenTools = array();
            foreach ($json['tools'] as $tool) {
                if (!is_string($tool) || !in_array($tool, self::$agentTools, true)) {
                    throw new \Exception('Invalid agent tool');
                }
                if (isset($seenTools[$tool])) {
                    throw new \Exception('Duplicate agent tool');
                }
                $seenTools[$tool] = true;
            }
        }
    }

    private function validateTransferNode(array $json) {
        $this->assertAllowedKeys($json, array('type', 'destination', 'label'), 'transfer node');
        $destination = $this->requiredString($json, 'destination', 128);
        if (!preg_match('/^[A-Za-z0-9_.-]+,[A-Za-z0-9_.*#+-]+,[1-9][0-9]*$/', $destination)) {
            throw new \Exception('Invalid transfer destination');
        }
        $this->optionalString($json, 'label', 128);
    }

    private function validateHangupNode(array $json) {
        $this->assertAllowedKeys($json, array('type', 'reason'), 'hangup node');
        if (isset($json['reason'])) {
            $reason = $this->requiredString($json, 'reason', 64);
            if (!preg_match('/^[A-Za-z0-9_.-]+$/', $reason)) {
                throw new \Exception('Invalid hangup reason');
            }
        }
    }

    private function validateWebhookNode(array $json) {
        $this->assertAllowedKeys($json, array('type', 'url', 'method', 'event'), 'webhook node');
        $url = $this->requiredString($json, 'url', 2048);
        $urlParts = parse_url($url);
        if (!filter_var($url, FILTER_VALIDATE_URL) || !isset($urlParts['scheme']) || !in_array(strtolower($urlParts['scheme']), array('http', 'https'), true)) {
            throw new \Exception('Invalid webhook URL');
        }
        if (isset($urlParts['user']) || isset($urlParts['pass'])) {
            throw new \Exception('Webhook URL must not include credentials');
        }
        $method = strtoupper($this->requiredString($json, 'method', 8));
        if (!in_array($method, array('POST', 'PUT', 'PATCH'), true)) {
            throw new \Exception('Invalid webhook method');
        }
        $event = $this->requiredString($json, 'event', 128);
        if (!preg_match('/^[A-Za-z0-9_.:-]+$/', $event)) {
            throw new \Exception('Invalid webhook event');
        }
    }

    private function validatedWorkflowGraph(array $json) {
        $this->assertAllowedKeys($json, array('entry', 'nodes', 'edges'), 'workflow graph');
        $entry = $this->requiredString($json, 'entry', 36);
        $entry = $this->validateUuid($entry, 'entry');
        if (!isset($json['nodes']) || !is_array($json['nodes']) || !$this->isSequentialArray($json['nodes']) || empty($json['nodes'])) {
            throw new \Exception('Workflow nodes must be a non-empty list');
        }
        if (!isset($json['edges']) || !is_array($json['edges']) || !$this->isSequentialArray($json['edges'])) {
            throw new \Exception('Workflow edges must be a list');
        }

        $nodeMap = array();
        $nodes = array();
        foreach ($json['nodes'] as $nodeUuid) {
            if (!is_string($nodeUuid)) {
                throw new \Exception('Workflow nodes must reference node UUIDs');
            }
            $nodeUuid = $this->validateUuid($nodeUuid, 'node uuid');
            if (isset($nodeMap[$nodeUuid])) {
                throw new \Exception('Duplicate workflow node reference');
            }
            $node = $this->getNode($nodeUuid);
            if ($node === null || (int) $node['enabled'] !== 1) {
                throw new \Exception('Workflow references a missing or disabled node');
            }
            $nodeMap[$nodeUuid] = true;
            $nodes[] = $nodeUuid;
        }

        if (!isset($nodeMap[$entry])) {
            throw new \Exception('Workflow entry node is not listed in graph nodes');
        }

        $edges = array();
        foreach ($json['edges'] as $edge) {
            if (!is_array($edge)) {
                throw new \Exception('Workflow edge must be an object');
            }
            $this->assertAllowedKeys($edge, array('from', 'when', 'to'), 'workflow edge');
            $from = $this->validateUuid($this->requiredString($edge, 'from', 36), 'edge from');
            $to = $this->validateUuid($this->requiredString($edge, 'to', 36), 'edge to');
            $when = $this->requiredString($edge, 'when', 256);
            if (!isset($nodeMap[$from]) || !isset($nodeMap[$to])) {
                throw new \Exception('Workflow edge points to a missing node');
            }
            $edges[] = array(
                'from' => $from,
                'when' => $when,
                'to' => $to,
            );
        }

        return array(
            'entry' => $entry,
            'nodes' => $nodes,
            'edges' => $edges,
        );
    }

    private function expandWorkflowNodes(array $graphJson) {
        $nodes = array();
        if (!isset($graphJson['nodes']) || !is_array($graphJson['nodes'])) {
            return $nodes;
        }

        foreach ($graphJson['nodes'] as $nodeUuid) {
            $node = $this->getNode($nodeUuid);
            if ($node === null) {
                throw new \Exception('Workflow references a missing node');
            }
            $nodes[$nodeUuid] = $node;
        }

        return $nodes;
    }

    private function assertNodeIsNotReferenced($uuid) {
        $workflows = $this->fetchAll('SELECT `uuid`, `graph_json` FROM `satellite_agent_workflows` ORDER BY `id`');
        foreach ($workflows as $workflow) {
            $graph = $this->decodeJson($workflow['graph_json'], 'workflow graph');
            if (isset($graph['entry']) && $graph['entry'] === $uuid) {
                throw new \Exception('Satellite Agent node is referenced by a workflow');
            }
            if (isset($graph['nodes']) && is_array($graph['nodes']) && in_array($uuid, $graph['nodes'], true)) {
                throw new \Exception('Satellite Agent node is referenced by a workflow');
            }
        }
    }

    private function assertWorkflowExists($uuid) {
        $uuid = $this->validateUuid($uuid, 'uuid');
        $workflow = $this->fetchOne('SELECT `uuid` FROM `satellite_agent_workflows` WHERE `uuid` = ?', array($uuid));
        if ($workflow === null) {
            throw new \Exception('Satellite Agent workflow not found');
        }
    }

    private function validateWorkflowForDestination($workflowUuid, $requireEnabled) {
        $workflowUuid = $this->validateUuid($workflowUuid, 'workflow_uuid');
        $workflow = $this->getWorkflow($workflowUuid);
        if ($workflow === null) {
            throw new \Exception('Satellite Agent workflow not found');
        }
        if ($requireEnabled && (int) $workflow['enabled'] !== 1) {
            throw new \Exception('Satellite Agent workflow is disabled');
        }

        return $workflowUuid;
    }

    private function validateNodeType($type) {
        if (!is_string($type)) {
            throw new \Exception('Invalid node type');
        }

        $type = trim($type);
        if (!in_array($type, self::$nodeTypes, true)) {
            throw new \Exception('Invalid node type');
        }

        return $type;
    }

    private function validateUuid($uuid, $field) {
        if (!is_string($uuid)) {
            throw new \Exception('Invalid ' . $field);
        }

        $uuid = strtolower(trim($uuid));
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $uuid)) {
            throw new \Exception('Invalid ' . $field);
        }

        return $uuid;
    }

    private function validateText($value, $field, $maxLength) {
        if (!is_string($value)) {
            throw new \Exception('Invalid ' . $field);
        }

        $value = trim($value);
        if ($value === '') {
            throw new \Exception('Missing required field: ' . $field);
        }
        if (strlen($value) > $maxLength) {
            throw new \Exception('Field is too long: ' . $field);
        }

        return $value;
    }

    private function validateOptionalText($value, $field, $maxLength) {
        if ($value === null) {
            return '';
        }
        if (!is_string($value)) {
            throw new \Exception('Invalid ' . $field);
        }

        $value = trim($value);
        if (strlen($value) > $maxLength) {
            throw new \Exception('Field is too long: ' . $field);
        }

        return $value;
    }

    private function requiredString(array $json, $field, $maxLength) {
        if (!array_key_exists($field, $json)) {
            throw new \Exception('Missing required field: ' . $field);
        }

        return $this->validateText($json[$field], $field, $maxLength);
    }

    private function optionalString(array $json, $field, $maxLength) {
        if (!array_key_exists($field, $json)) {
            return null;
        }

        return $this->validateText($json[$field], $field, $maxLength);
    }

    private function optionalBoolean(array $json, $field) {
        if (!array_key_exists($field, $json)) {
            return null;
        }
        if (!is_bool($json[$field])) {
            throw new \Exception('Invalid boolean field: ' . $field);
        }

        return $json[$field];
    }

    private function optionalIntegerRange(array $json, $field, $minimum, $maximum) {
        if (!array_key_exists($field, $json)) {
            return null;
        }
        if (!is_int($json[$field]) || $json[$field] < $minimum || $json[$field] > $maximum) {
            throw new \Exception('Invalid integer field: ' . $field);
        }

        return $json[$field];
    }

    private function positiveInteger($value, $field) {
        if (is_string($value) && preg_match('/^[1-9][0-9]*$/', $value)) {
            return (int) $value;
        }
        if (is_int($value) && $value > 0) {
            return $value;
        }

        throw new \Exception('Invalid integer field: ' . $field);
    }

    private function enabledValue($enabled) {
        if (is_bool($enabled)) {
            return $enabled ? 1 : 0;
        }
        if ($enabled === 0 || $enabled === 1) {
            return (int) $enabled;
        }
        if ($enabled === '0' || $enabled === '1') {
            return (int) $enabled;
        }

        throw new \Exception('Invalid enabled value');
    }

    private function assertAllowedKeys(array $json, array $allowedKeys, $label) {
        foreach (array_keys($json) as $key) {
            if (!is_string($key) || !in_array($key, $allowedKeys, true)) {
                throw new \Exception('Invalid field in ' . $label . ': ' . $key);
            }
        }
    }

    private function canonicalJson(array $json) {
        $normalized = $this->sortJsonValue($json);
        $encoded = json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
        if ($encoded === false) {
            throw new \Exception('Failed to encode JSON');
        }

        return $encoded;
    }

    private function sortJsonValue($value) {
        if (!is_array($value)) {
            return $value;
        }
        if ($this->isSequentialArray($value)) {
            $normalizedList = array();
            foreach ($value as $item) {
                $normalizedList[] = $this->sortJsonValue($item);
            }

            return $normalizedList;
        }

        ksort($value);
        foreach ($value as $key => $item) {
            $value[$key] = $this->sortJsonValue($item);
        }

        return $value;
    }

    private function decodeJson($json, $field) {
        $decoded = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            throw new \Exception('Invalid JSON field: ' . $field);
        }

        return $decoded;
    }

    private function isSequentialArray(array $value) {
        if ($value === array()) {
            return true;
        }

        return array_keys($value) === range(0, count($value) - 1);
    }

    private function generateUuidV4() {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function markReloadRequired() {
        if (function_exists('needreload')) {
            needreload();
        }
    }
}