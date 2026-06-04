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

require_once __DIR__ . '/SatelliteAgent.class.php';

class Satellite extends \FreePBX_Helpers implements \BMO
{
    public function __construct($freepbx = null) {
        if ($freepbx == null)
            throw new Exception("Not given a FreePBX Object");

        $this->FreePBX = $freepbx;
        $this->db = $freepbx->Database;
        $this->Agent = new SatelliteAgent($freepbx);
    }

    public function install() {
        $this->Agent->install();
    }
    public function uninstall() {
        $this->Agent->uninstall();
    }
    public function backup() {
        return array('agent' => $this->Agent->backup());
    }
    public function restore($backup) {
        if (is_array($backup) && isset($backup['agent'])) {
            $this->Agent->restore($backup['agent']);
        }
    }

    public function agent() {
        return $this->Agent;
    }

    public function destinations() {
        return $this->Agent->destinations();
    }

    public function exportRuntimeWorkflow($workflowUuid) {
        return $this->Agent->exportRuntimeWorkflow($workflowUuid);
    }

    public function ajaxRequest($req, &$setting) {
        switch ($req) {
            case 'agent':
                return true;
            default:
                return false;
        }
    }

    public function ajaxHandler() {
        if (!isset($_REQUEST['command']) || $_REQUEST['command'] !== 'agent') {
            return false;
        }

        try {
            return array(
                'status' => true,
                'data' => $this->handleAgentAjax($this->agentAjaxPayload()),
            );
        } catch (\Exception $exception) {
            return array(
                'status' => false,
                'error' => $exception->getMessage(),
            );
        }
    }

    public function get_available_voices() {
        $satellitePort = getenv('SATELLITE_HTTP_PORT') ?: '8080';
        $satelliteToken = getenv('SATELLITE_API_TOKEN') ?: '';
        $url = 'http://127.0.0.1:' . $satellitePort . '/api/get_models';

        $headers = array('Accept: application/json');
        if ($satelliteToken !== '') {
            $headers[] = 'Authorization: Bearer ' . $satelliteToken;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPGET, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errmsg = curl_error($ch);
        curl_close($ch);

        if ($errmsg) {
            throw new \Exception($errmsg);
        }

        if ($httpCode !== 200 || $response === false || $response === '') {
            throw new \Exception(is_string($response) ? $response : 'Satellite get_models request failed');
        }

        $payload = json_decode($response, true);
        if (!is_array($payload) || !isset($payload['models']) || !is_array($payload['models'])) {
            throw new \Exception('Invalid response from Satellite get_models API');
        }

        $voicesByLanguage = array();
        foreach ($payload['models'] as $model) {
            if (!is_string($model) || trim($model) === '') {
                continue;
            }

            $model = trim($model);
            $parts = explode('-', $model);
            $language = strtolower(end($parts));

            if ($language === '') {
                continue;
            }

            if (!isset($voicesByLanguage[$language])) {
                $voicesByLanguage[$language] = array();
            }
            $voicesByLanguage[$language][] = $model;
        }

        foreach ($voicesByLanguage as $language => $voices) {
            $voices = array_values(array_unique($voices));
            sort($voices);
            $voicesByLanguage[$language] = $voices;
        }

        ksort($voicesByLanguage);

        return $voicesByLanguage;
    }

    public function tts($text, $model = '', $language = 'en', $force = false) {
        $text = trim((string) $text);
        $model = trim((string) $model);
        $language = trim((string) $language);

        if ($text === '') {
            throw new \Exception('Missing required field: text');
        }

        $checksum = md5($text . '|' . $model . '|' . $language);
        if (!$force && file_exists('/tmp/satellite-' . $checksum . '.mp3')) {
            return $checksum;
        }

        $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';

        $satellitePort = getenv('SATELLITE_HTTP_PORT') ?: '8080';
        $satelliteToken = getenv('SATELLITE_API_TOKEN') ?: '';
        $url = 'http://127.0.0.1:' . $satellitePort . '/api/get_speech';

        $payload = array('text' => $text);
        if ($model !== '') {
            $payload['model'] = $model;
        }
        if ($language !== '') {
            $payload['language'] = $language;
        }

        $headers = array(
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: audio/mpeg',
        );
        if ($satelliteToken !== '') {
            $headers[] = 'Authorization: Bearer ' . $satelliteToken;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 300);

        $audio = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errmsg = curl_error($ch);
        curl_close($ch);

        if ($errmsg) {
            throw new \Exception($errmsg);
        }

        if ($httpCode !== 200 || $audio === false || $audio === '') {
            throw new \Exception(is_string($audio) ? $audio : 'Satellite TTS request failed');
        }

        if (file_put_contents($tmpfilepath, $audio) === false) {
            throw new \Exception('Failed to save TTS audio file to ' . $tmpfilepath);
        }

        return $checksum;
    }

    public function get_unsaved_audio($checksum) {
        $checksum = trim((string) $checksum);
        if ($checksum === '') {
            throw new \Exception('Missing required field: checksum');
        }

        if (!preg_match('/^[a-f0-9]{32}$/', $checksum)) {
            throw new \Exception('Invalid checksum format');
        }

        $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';
        if (!file_exists($tmpfilepath)) {
            throw new \Exception('TTS audio file not found: ' . $tmpfilepath);
        }

        $contents = file_get_contents($tmpfilepath);
        if ($contents === false) {
            throw new \Exception('Failed to read TTS audio file: ' . $tmpfilepath);
        }

        return base64_encode($contents);
    }

    public function delete_temp_audio($checksum) {
        $checksum = trim((string) $checksum);
        if ($checksum === '') {
            throw new \Exception('Missing required field: checksum');
        }

        if (!preg_match('/^[a-f0-9]{32}$/', $checksum)) {
            throw new \Exception('Invalid checksum format');
        }

        $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';
        if (!file_exists($tmpfilepath)) {
            throw new \Exception('TTS audio file not found: ' . $tmpfilepath);
        }

        if (!@unlink($tmpfilepath)) {
            throw new \Exception('Failed to delete TTS audio file: ' . $tmpfilepath);
        }

        return true;
    }

    public function save_recording($filename='', $language = 'en', $name = '', $description = '', $text = '', $model = '') {
        global $amp_conf;

        $filename = trim((string) $filename);
        if ($filename !== '' && !preg_match('/^[a-zA-Z0-9._-]+$/', $filename)) {
            throw new \Exception('Invalid filename format');
        }

        if ($language === '') {
            $language = 'en';
        } else {
            $language = trim((string) $language);
            if (!preg_match('/^[a-z]{2}$/', $language)) {
                throw new \Exception('Invalid language format');
            }
        }

        $tmpfilepath = '/tmp/satellite-' . $filename . '.mp3';

        if ($filename === '' || !file_exists($tmpfilepath)) {
            if ($text === '') {
                throw new \Exception('Missing required field: filename or text');
            } else {
                $checksum = $this->tts($text, $model, $language);
                $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';
                if (!file_exists($tmpfilepath)) {
                    throw new \Exception('Generated TTS audio file not found');
                }
                $filename = $checksum;
            }
        }

        if ($name === '') {
            $name = 'TTS Recording ' . date('Y-m-d H:i:s') . ' ' . $filename;
        }
        if ($description === '') {
            $description = 'TTS recording ' . date('Y-m-d H:i:s');
        }

        $dstfilepath = $amp_conf['ASTVARLIBDIR'] . '/sounds/' . $language . '/custom/' . $filename . '.wav';
        $dstdir = dirname($dstfilepath);
        if (!is_dir($dstdir)) {
            if (!mkdir($dstdir, 0755, true) && !is_dir($dstdir)) {
                throw new \Exception("Failed to create directory '{$dstdir}' for recording file");
            }
        }

        $media = FreePBX::Media();
        $media->load($tmpfilepath);
        $media->convert($dstfilepath);

        FreePBX::Recordings()->addRecording($name, $description, 'custom/' . $filename);
        foreach (FreePBX::Recordings()->getAll() as $recording) {
            if ($recording['filename'] === 'custom/' . $filename) {
                return $recording['id'];
            }
        }

        return false;
    }

    private function handleAgentAjax(array $payload) {
        $action = $this->agentAjaxString($payload, 'action');
        switch ($action) {
            case 'node-list':
                return $this->Agent->listNodes(
                    $this->agentAjaxOptionalString($payload, 'type'),
                    $this->agentAjaxOptionalEnabled($payload)
                );
            case 'node-get':
                return $this->agentAjaxFound($this->Agent->getNode($this->agentAjaxString($payload, 'uuid')), 'Satellite Agent node not found');
            case 'node-create':
                return $this->Agent->createNode(
                    $this->agentAjaxString($payload, 'name'),
                    $this->agentAjaxString($payload, 'type'),
                    $this->agentAjaxArray($payload, 'json')
                );
            case 'node-update':
                return $this->Agent->updateNode(
                    $this->agentAjaxString($payload, 'uuid'),
                    $this->agentAjaxArray($payload, 'json')
                );
            case 'node-delete':
                $this->Agent->deleteNode($this->agentAjaxString($payload, 'uuid'));
                return true;
            case 'workflow-list':
                return $this->Agent->listWorkflows($this->agentAjaxOptionalEnabled($payload));
            case 'workflow-get':
                return $this->agentAjaxFound(
                    $this->Agent->getWorkflow($this->agentAjaxWorkflowUuid($payload), $this->agentAjaxBool($payload, 'expand_nodes', false, array('expandNodes'))),
                    'Satellite Agent workflow not found'
                );
            case 'workflow-create':
                $graph = $this->agentAjaxArray($payload, 'graph_json', array('graphJson', 'graph'));
                return $this->Agent->createWorkflow(
                    $this->agentAjaxString($payload, 'name'),
                    $this->agentAjaxWorkflowEntryNode($payload, $graph),
                    $graph,
                    $this->agentAjaxOptionalString($payload, 'description', '')
                );
            case 'workflow-update':
                return $this->Agent->updateWorkflow(
                    $this->agentAjaxWorkflowUuid($payload),
                    $this->agentAjaxArray($payload, 'graph_json', array('graphJson', 'graph'))
                );
            case 'workflow-delete':
                $this->Agent->deleteWorkflow($this->agentAjaxWorkflowUuid($payload));
                return true;
            case 'destination-list':
                return $this->Agent->listDestinations($this->agentAjaxOptionalEnabled($payload));
            case 'destination-create':
                return $this->Agent->createDestination(
                    $this->agentAjaxWorkflowUuid($payload),
                    $this->agentAjaxString($payload, 'description')
                );
            case 'destination-update':
                return $this->Agent->updateDestination(
                    $this->agentAjaxWorkflowUuid($payload),
                    $this->agentAjaxString($payload, 'description'),
                    $this->agentAjaxBool($payload, 'enabled', true)
                );
            case 'destination-enable':
                return $this->setAgentDestinationEnabled($payload, true);
            case 'destination-disable':
                return $this->setAgentDestinationEnabled($payload, false);
            case 'destination-delete':
                $this->Agent->deleteDestination($this->agentAjaxWorkflowUuid($payload));
                return true;
            case 'destinations':
                return $this->Agent->destinations();
            case 'runtime-export':
                return $this->Agent->exportRuntimeWorkflow($this->agentAjaxWorkflowUuid($payload));
            default:
                throw new \Exception('Invalid Satellite Agent action');
        }
    }

    private function agentAjaxPayload() {
        $payload = $_REQUEST;
        $rawPayload = file_get_contents('php://input');
        if (is_string($rawPayload) && trim($rawPayload) !== '') {
            $decodedPayload = json_decode($rawPayload, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($decodedPayload)) {
                throw new \Exception('Invalid JSON request body: ' . json_last_error_msg());
            }
            $payload = array_merge($payload, $decodedPayload);
        }
        if (isset($payload['payload'])) {
            if (is_string($payload['payload'])) {
                $decodedPayload = json_decode($payload['payload'], true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($decodedPayload)) {
                    throw new \Exception('Invalid JSON payload: ' . json_last_error_msg());
                }
                $payload = array_merge($payload, $decodedPayload);
            } elseif (is_array($payload['payload'])) {
                $payload = array_merge($payload, $payload['payload']);
            } else {
                throw new \Exception('Invalid payload');
            }
        }

        return $payload;
    }

    private function agentAjaxValue(array $payload, $field, array $aliases = array()) {
        $fields = array_merge(array($field), $aliases);
        foreach ($fields as $candidate) {
            if (array_key_exists($candidate, $payload)) {
                return $payload[$candidate];
            }
        }

        return null;
    }

    private function agentAjaxString(array $payload, $field, array $aliases = array()) {
        $value = $this->agentAjaxValue($payload, $field, $aliases);
        if (!is_string($value)) {
            throw new \Exception('Missing or invalid field: ' . $field);
        }
        $value = trim($value);
        if ($value === '') {
            throw new \Exception('Missing or invalid field: ' . $field);
        }

        return $value;
    }

    private function agentAjaxOptionalString(array $payload, $field, $default = null, array $aliases = array()) {
        $value = $this->agentAjaxValue($payload, $field, $aliases);
        if ($value === null || $value === '') {
            return $default;
        }
        if (!is_string($value)) {
            throw new \Exception('Invalid field: ' . $field);
        }

        return trim($value);
    }

    private function agentAjaxArray(array $payload, $field, array $aliases = array()) {
        $value = $this->agentAjaxValue($payload, $field, $aliases);
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $decoded;
            }
            throw new \Exception('Invalid JSON field: ' . $field . ' (' . json_last_error_msg() . ')');
        }

        throw new \Exception('Missing or invalid JSON field: ' . $field);
    }

    private function agentAjaxBool(array $payload, $field, $default = false, array $aliases = array()) {
        $value = $this->agentAjaxValue($payload, $field, $aliases);
        if ($value === null || $value === '') {
            return $default;
        }
        if (is_bool($value)) {
            return $value;
        }
        if ($value === 0 || $value === 1 || $value === '0' || $value === '1') {
            return (bool) $value;
        }
        if (is_string($value)) {
            $value = strtolower(trim($value));
            if ($value === 'true') {
                return true;
            }
            if ($value === 'false') {
                return false;
            }
        }

        throw new \Exception('Invalid boolean field: ' . $field);
    }

    private function agentAjaxOptionalEnabled(array $payload) {
        if ($this->agentAjaxValue($payload, 'enabled') === null) {
            return null;
        }

        return $this->agentAjaxBool($payload, 'enabled');
    }

    private function agentAjaxWorkflowUuid(array $payload) {
        return $this->agentAjaxString($payload, 'workflow_uuid', array('workflowUuid', 'uuid'));
    }

    private function agentAjaxWorkflowEntryNode(array $payload, array $graph) {
        $entryNodeUuid = $this->agentAjaxOptionalString($payload, 'entry_node_uuid', null, array('entryNodeUuid'));
        if ($entryNodeUuid !== null) {
            return $entryNodeUuid;
        }
        if (isset($graph['entry']) && is_string($graph['entry']) && trim($graph['entry']) !== '') {
            return trim($graph['entry']);
        }

        throw new \Exception('Missing or invalid field: entry_node_uuid');
    }

    private function agentAjaxFound($value, $message) {
        if ($value === null) {
            throw new \Exception($message);
        }

        return $value;
    }

    private function setAgentDestinationEnabled(array $payload, $enabled) {
        $workflowUuid = $this->agentAjaxWorkflowUuid($payload);
        foreach ($this->Agent->listDestinations() as $destination) {
            if (isset($destination['workflow_uuid']) && $destination['workflow_uuid'] === $workflowUuid) {
                return $this->Agent->updateDestination($workflowUuid, $destination['description'], $enabled);
            }
        }

        throw new \Exception('Satellite Agent destination not found');
    }


}
