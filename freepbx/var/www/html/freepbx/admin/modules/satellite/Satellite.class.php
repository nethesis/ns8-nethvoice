<?php
require_once __DIR__ . '/lib/AgentSchema.php';
require_once __DIR__ . '/lib/AgentTrunkRepository.php';
require_once __DIR__ . '/lib/AgentDestinationRepository.php';
require_once __DIR__ . '/lib/AgentTrunkProvisioner.php';
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

class Satellite extends \FreePBX_Helpers implements \BMO
{
    private $agentTrunks;
    private $agentDestinations;
    private $agentPageError = '';
    private $agentPageNotice = '';
    private $agentSubmittedForm = null;

    public function __construct($freepbx = null) {
        if ($freepbx == null)
            throw new Exception("Not given a FreePBX Object");

        $this->FreePBX = $freepbx;
        $this->db = $freepbx->Database;
        $this->agentTrunks = new AgentTrunkRepository($this->db);
        $this->agentDestinations = new AgentDestinationRepository($this->db);
    }

    public function install() {
        AgentSchema::install($this->db);
    }
    public function uninstall() {
    }
    public function backup() {
    }
    public function restore($backup) {
    }

    public function getAgentTrunks() {
        $rows = $this->agentTrunks->listAll();
        foreach ($rows as &$row) {
            if (empty($row['enabled'])) {
                $row['status'] = 'Disabled';
            } elseif (empty($row['freepbx_trunk_id'])) {
                $row['status'] = 'FreePBX trunk missing';
            } elseif (getenv('CLEVERAI_WEBHOOK') === false || getenv('CLEVERAI_WEBHOOK') === '') {
                $row['status'] = 'CleverAI webhook missing';
            } elseif (empty($row['api_key_configured'])) {
                $row['status'] = 'API key missing';
            } else {
                $row['status'] = 'Configured';
            }
        }
        unset($row);
        return $rows;
    }

    public function getAgentTrunk($id) {
        if ((int) $id < 1) {
            return null;
        }
        return $this->agentTrunks->getById($id);
    }

    public function getAgentDestinations() {
        return $this->agentDestinations->listAll();
    }

    public function getAgentDestination($id) {
        return $this->agentDestinations->getById($id);
    }

    public function changeAgentFallbackDestination($old, $new) {
        $changed = $this->agentDestinations->replaceFallbackDestination($old, $new);
        if ($changed) {
            needreload();
        }
        return $changed;
    }

    public function doConfigPageInit($page) {
        if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return;
        }
        if ($page !== 'satellite_agents') {
            return;
        }
        try {
            if (!hash_equals($this->agentCsrfToken(), isset($_POST['csrf_token']) && is_string($_POST['csrf_token']) ? $_POST['csrf_token'] : '')) {
                throw new \RuntimeException('Invalid or missing security token, reload the page and retry');
            }
            if (isset($_POST['section']) && $_POST['section'] === 'trunks') {
                $this->handleAgentTrunkRequest();
            } else {
                $this->handleAgentDestinationRequest();
            }
            $this->redirectAfterAgentPost();
        } catch (\Throwable $error) {
            // Do not leak SQL details to the page.
            $this->agentPageError = $error instanceof \PDOException
                ? _('Database error, the change was not saved')
                : $error->getMessage();
            if (isset($_POST['action']) && $_POST['action'] === 'save') {
                $this->agentSubmittedForm = $_POST;
                unset($this->agentSubmittedForm['api_key'], $this->agentSubmittedForm['sip_auth_password']);
            }
        }
    }

    public function getActionBar($request) {
        $display = isset($request['display']) ? $request['display'] : '';
        if (!$display === 'satellite_agents' ||
            ((isset($_GET['view']) ? $_GET['view'] : '') !== 'form' && $this->agentSubmittedForm === null)) {
            return array();
        }
        return array(
            'reset' => array('name' => 'reset', 'id' => 'reset', 'value' => _('Reset')),
            'submit' => array('name' => 'submit', 'id' => 'submit', 'value' => _('Submit')),
        );
    }

    private function agentCsrfToken() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (empty($_SESSION['satellite_agent_csrf']) || !is_string($_SESSION['satellite_agent_csrf'])) {
            $_SESSION['satellite_agent_csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['satellite_agent_csrf'];
    }

    /** Post/Redirect/Get so a reload does not replay the action. */
    private function redirectAfterAgentPost() {
        if ($this->agentPageNotice === '' || headers_sent()) {
            return;
        }
        $_SESSION['satellite_agent_notice'] = $this->agentPageNotice;
        $tab = isset($_POST['section']) && $_POST['section'] === 'trunks' ? 'trunks' : 'destinations';
        header('Location: config.php?display=satellite_agents&tab=' . $tab);
        exit;
    }

    /** True when following fallbacks from $fallback leads back to destination $id. */
    private function fallbackReaches($id, $fallback) {
        $seen = array();
        while (is_string($fallback) && preg_match('/^satellite-agent-destination-([0-9]+),s,1$/D', $fallback, $match)) {
            $next = (int) $match[1];
            if ($next === (int) $id) {
                return true;
            }
            if (isset($seen[$next])) {
                return false;
            }
            $seen[$next] = true;
            $row = $this->agentDestinations->getById($next);
            $fallback = $row ? $row['fallback_destination'] : null;
        }
        return false;
    }

    private function agentRequestId() {
        $id = isset($_POST['id']) ? $_POST['id'] : null;
        if ($id === null || $id === '') {
            return null;
        }
        if (filter_var($id, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false) {
            throw new \InvalidArgumentException('Invalid agent ID');
        }
        return (int) $id;
    }

    private function handleAgentTrunkRequest() {
        $action = isset($_POST['action']) ? $_POST['action'] : '';
        $id = $this->agentRequestId();
        if ($action === 'save') {
            $input = array(
                'name' => isset($_POST['name']) ? trim($_POST['name']) : '',
                'provider' => isset($_POST['provider']) ? $_POST['provider'] : '',
                'openai_project_id' => isset($_POST['openai_project_id']) ? trim($_POST['openai_project_id']) : null,
                'grok_phone_number' => isset($_POST['grok_phone_number']) ? trim($_POST['grok_phone_number']) : null,
                'api_key' => isset($_POST['api_key']) ? $_POST['api_key'] : '',
                'sip_auth_mode' => isset($_POST['sip_auth_mode']) ? $_POST['sip_auth_mode'] : 'none',
                'sip_auth_username' => isset($_POST['sip_auth_username']) ? trim($_POST['sip_auth_username']) : null,
                'sip_auth_password' => isset($_POST['sip_auth_password']) ? $_POST['sip_auth_password'] : ''
            );
            if ($id === null) {
                $id = $this->agentTrunks->create($input);
                $freepbxId = null;
                $provisioner = new AgentTrunkProvisioner();
                try {
                    $stored = $this->agentTrunks->getStoredById($id);
                    $this->agentTrunks->resolveProviderApiKey($stored);
                    $freepbxId = $provisioner->createManagedTrunk($stored);
                    $this->agentTrunks->setProvisionedTrunkId($id, $freepbxId);
                } catch (\Throwable $error) {
                    if ($freepbxId !== null) {
                        try {
                            $stored['freepbx_trunk_id'] = $freepbxId;
                            $provisioner->deleteManagedTrunk($stored);
                        } catch (\Throwable $cleanupError) {
                            throw new \RuntimeException(
                                'Agent trunk creation failed and FreePBX cleanup failed: ' . $cleanupError->getMessage(),
                                0,
                                $error
                            );
                        }
                    }
                    $this->agentTrunks->delete($id);
                    throw $error;
                }
            } else {
                $previous = $this->agentTrunks->getStoredById($id);
                if (!$previous) {
                    throw new \RuntimeException('Agent trunk not found');
                }
                $this->agentTrunks->update($id, $input);
                try {
                    $stored = $this->agentTrunks->getStoredById($id);
                    $this->agentTrunks->resolveProviderApiKey($stored);
                    (new AgentTrunkProvisioner())->updateManagedTrunk($stored, $previous);
                } catch (\Throwable $error) {
                    try {
                        $this->restoreAgentTrunk($id, $previous);
                    } catch (\Throwable $restoreError) {
                        throw new \RuntimeException(
                            'Agent trunk update failed and metadata restore failed: ' . $restoreError->getMessage(),
                            0,
                            $error
                        );
                    }
                    throw $error;
                }
            }
            needreload();
            $this->agentPageNotice = 'Agent trunk saved';
            return;
        }
        if ($id === null) {
            throw new \InvalidArgumentException('Agent trunk ID is required');
        }
        $stored = $this->agentTrunks->getStoredById($id);
        if (!$stored) {
            throw new \RuntimeException('Agent trunk not found');
        }
        if ($action === 'validate') {
            (new AgentTrunkProvisioner())->validateManagedTrunk($stored);
            $this->agentTrunks->resolveProviderApiKey($stored);
            if (!getenv('CLEVERAI_WEBHOOK')) {
                throw new \RuntimeException('CLEVERAI_WEBHOOK is not configured');
            }
            $this->agentPageNotice = 'Local trunk configuration is valid';
        } elseif ($action === 'delete') {
            foreach ($this->agentDestinations->listAll() as $destination) {
                if ((int) $destination['cleverai_trunk_id'] === $id) {
                    throw new \RuntimeException('Agent trunk is used by a destination');
                }
            }
            (new AgentTrunkProvisioner())->deleteManagedTrunk($stored);
            $this->agentTrunks->delete($id);
            needreload();
            $this->agentPageNotice = 'Agent trunk deleted';
        }
    }

    private function restoreAgentTrunk($id, array $previous) {
        $crypto = new AgentCrypto();
        $restore = array(
            'name' => $previous['name'],
            'provider' => $previous['provider'],
            'openai_project_id' => $previous['openai_project_id'],
            'grok_phone_number' => $previous['grok_phone_number'],
            'api_key' => $crypto->decryptSecret($previous['api_key_encrypted']),
            'clear_api_key' => empty($previous['api_key_encrypted']),
            'sip_auth_mode' => $previous['sip_auth_mode'],
            'sip_auth_username' => $previous['sip_auth_username'],
            'sip_auth_password' => $crypto->decryptSecret($previous['sip_auth_password_encrypted']),
            'enabled' => $previous['enabled']
        );
        $this->agentTrunks->update($id, $restore);
    }

    private function handleAgentDestinationRequest() {
        $action = isset($_POST['action']) ? $_POST['action'] : '';
        $id = $this->agentRequestId();
        if ($action === 'save') {
            $fallback = AgentValidation::submittedFallback($_POST);
            $_POST['fallback_destination'] = $fallback;
            $input = array(
                'cleverai_trunk_id' => isset($_POST['cleverai_trunk_id']) ? $_POST['cleverai_trunk_id'] : null,
                'cleverai_flow' => isset($_POST['cleverai_flow']) ? trim($_POST['cleverai_flow']) : '',
                'fallback_destination' => $fallback
            );
            if ($id === null) {
                $id = $this->agentDestinations->create($input);
            } else {
                if ($this->fallbackReaches($id, $input['fallback_destination'])) {
                    throw new \InvalidArgumentException('A destination cannot fall back to itself, directly or through other destinations');
                }
                $this->agentDestinations->update($id, $input);
            }
            needreload();
            $this->agentPageNotice = 'Agent destination saved';
        } elseif ($action === 'delete') {
            if ($id === null) {
                throw new \InvalidArgumentException('Agent destination ID is required');
            }
            $destination = satellite_agent_destination_key($id);
            $usage = FreePBX::Destinations()->destinationUsageArray($destination);
            if (!empty($usage) || $this->agentDestinations->listByFallbackDestination($destination)) {
                throw new \RuntimeException('Destination is currently in use');
            }
            $this->agentDestinations->delete($id);
            needreload();
            $this->agentPageNotice = 'Agent destination deleted';
        }
    }

    public function showAgentsPage($defaultTab = 'destinations') {
        $trunks = $this->getAgentTrunks();
        $destinations = $this->getAgentDestinations();
        $error = $this->agentPageError;
        $notice = $this->agentPageNotice;
        $csrfToken = $this->agentCsrfToken();
        if (isset($_SESSION['satellite_agent_notice'])) {
            $notice = (string) $_SESSION['satellite_agent_notice'];
            unset($_SESSION['satellite_agent_notice']);
        }
        $tab = isset($_POST['section']) ? $_POST['section'] : (isset($_GET['tab']) ? $_GET['tab'] : $defaultTab);
        if (!in_array($tab, array('destinations', 'trunks'), true)) {
            $tab = $defaultTab;
        }
        $form = $this->agentSubmittedForm;
        if ($form === null && isset($_GET['view']) && $_GET['view'] === 'form' &&
            isset($_GET['id']) && ctype_digit((string) $_GET['id']) && (int) $_GET['id'] > 0) {
            $form = $tab === 'trunks'
                ? $this->getAgentTrunk((int) $_GET['id'])
                : $this->getAgentDestination((int) $_GET['id']);
        }
        $showForm = (isset($_GET['view']) && $_GET['view'] === 'form') || $form !== null;
        $formMode = $showForm;
        $destinationForm = $tab === 'destinations' ? $form : null;
        $trunkForm = $tab === 'trunks' ? $form : null;
        $destinationsContent = load_view(__DIR__ . '/views/agent/agents.php', array(
            'trunks' => $trunks, 'destinations' => $destinations,
            'form' => $destinationForm, 'showForm' => $showForm && $tab === 'destinations',
            'csrfToken' => $csrfToken,
        ));
        $trunksContent = load_view(__DIR__ . '/views/agent/trunks.php', array(
            'trunks' => $trunks, 'form' => $trunkForm, 'showForm' => $showForm && $tab === 'trunks',
            'csrfToken' => $csrfToken,
        ));
        return load_view(__DIR__ . '/views/agent/index.php', compact(
            'tab', 'formMode', 'error', 'notice', 'destinationsContent', 'trunksContent'
        ));
    }

    public function showWebhooksPage() {
        $trunks = $this->getAgentTrunks();
        $webhook = getenv('CLEVERAI_WEBHOOK') ?: '';
        return load_view(__DIR__ . '/views/agent/webhooks.php', compact('trunks', 'webhook'));
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


}
