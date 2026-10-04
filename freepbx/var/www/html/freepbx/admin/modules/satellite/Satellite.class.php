<?php
require_once __DIR__ . '/lib/AgentSchema.php';
require_once __DIR__ . '/lib/AgentTrunkRepository.php';
require_once __DIR__ . '/lib/AgentDestinationRepository.php';
require_once __DIR__ . '/lib/AgentTrunkProvisioner.php';
require_once __DIR__ . '/lib/AgentSession.php';
require_once __DIR__ . '/lib/AgentProfileRepository.php';
require_once __DIR__ . '/lib/AgentConfigurationBuilder.php';
require_once __DIR__ . '/lib/AgentSatelliteClient.php';
require_once __DIR__ . '/lib/AgentContextSource.php';
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
    private $agentProfiles;
    private $agentPageError = '';
    private $agentPageNotice = '';
    private $agentPageWarning = '';
    private $agentSubmittedForm = null;

    public function __construct($freepbx = null) {
        if ($freepbx == null)
            throw new Exception("Not given a FreePBX Object");

        $this->FreePBX = $freepbx;
        $this->db = $freepbx->Database;
        $this->agentTrunks = new AgentTrunkRepository($this->db);
        $this->agentDestinations = new AgentDestinationRepository($this->db);
        $this->agentProfiles = new AgentProfileRepository($this->db);
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
            } elseif (isset($row['runtime_owner']) && $row['runtime_owner'] === 'builtin' && empty($row['webhook_signing_secret_configured'])) {
                $row['status'] = 'Signing secret missing';
            } elseif ((!isset($row['runtime_owner']) || $row['runtime_owner'] === 'cleverai') && !getenv('CLEVERAI_WEBHOOK')) {
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

    public function getAgentProfiles() {
        return $this->agentProfiles->listAll();
    }

    public function changeAgentFallbackDestination($old, $new) {
        $old = AgentValidation::validateFallback($old);
        $new = AgentValidation::validateFallback($new);
        $profileChanges = array();
        foreach ($this->agentProfiles->listAll() as $profile) {
            if ($profile['fallback_destination'] === $old) {
                $profileChanges[$profile['profile_key']] = $new;
            }
        }
        $destinationChanges = array();
        $roots = array();
        foreach ($this->agentDestinations->listAll() as $destination) {
            if ($destination['fallback_destination'] === $old) {
                $destinationChanges[(int) $destination['id']] = array('fallback_destination' => $new);
                $roots[] = 'destination:' . (int) $destination['id'];
            }
        }
        foreach (array_keys($profileChanges) as $key) {
            $roots[] = 'profile:' . $key;
        }
        $this->assertAgentFallbackGraphSafe($destinationChanges, $profileChanges, $roots);
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $changed = $this->agentDestinations->replaceFallbackDestination($old, $new);
            foreach ($profileChanges as $key => $fallback) {
                $this->agentProfiles->save($key, array('fallback_destination' => $fallback));
                $changed++;
            }
            if ($ownTransaction) {
                $this->db->commit();
            }
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
        if ($changed) {
            needreload();
            $this->synchronizeAgentConfiguration();
        }
        return $changed;
    }

    public function doConfigPageInit($page) {
        if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
            return;
        }
        if ($page !== 'satellite_agents' && $page !== 'satellite_webhooks') {
            return;
        }
        try {
            $this->assertAgentCsrfToken(isset($_POST['csrf_token']) ? $_POST['csrf_token'] : null);
            if ($page === 'satellite_webhooks') {
                $this->handleAgentWebhookRequest();
            } elseif (isset($_POST['section']) && $_POST['section'] === 'trunks') {
                $this->handleAgentTrunkRequest();
            } elseif (isset($_POST['section']) && in_array($_POST['section'], array('internal', 'external'), true)) {
                $this->handleAgentProfileRequest($_POST['section']);
            } else {
                $this->handleAgentDestinationRequest();
            }
            $this->redirectAfterAgentPost($page);
        } catch (\Throwable $error) {
            // Do not leak SQL details to the page.
            $this->agentPageError = $error instanceof \PDOException
                ? _('Database error, the change was not saved')
                : $error->getMessage();
            if (isset($_POST['action']) && $_POST['action'] === 'save') {
                $this->agentSubmittedForm = $_POST;
                unset($this->agentSubmittedForm['api_key'], $this->agentSubmittedForm['sip_auth_password'],
                    $this->agentSubmittedForm['webhook_signing_secret']);
            }
        }
    }

    public function getActionBar($request) {
        $display = isset($request['display']) ? $request['display'] : '';
        $tab = isset($request['tab']) ? $request['tab'] : (isset($_GET['tab']) ? $_GET['tab'] : 'destinations');
        if ($display !== 'satellite_agents' ||
            ($tab !== 'internal' && $tab !== 'external' &&
            (isset($_GET['view']) ? $_GET['view'] : '') !== 'form' && $this->agentSubmittedForm === null)) {
            return array();
        }
        return array(
            'reset' => array('name' => 'reset', 'id' => 'reset', 'value' => _('Reset')),
            'submit' => array('name' => 'submit', 'id' => 'submit', 'value' => _('Submit')),
        );
    }

    public function agentCsrfToken() {
        return AgentSession::csrfToken();
    }

    public function assertAgentCsrfToken($token) {
        AgentSession::assertCsrfToken($token);
    }

    /** Post/Redirect/Get so a reload does not replay the action. */
    private function redirectAfterAgentPost($page = 'satellite_agents') {
        if ($this->agentPageNotice === '' || headers_sent()) {
            return;
        }
        $_SESSION['satellite_agent_notice'] = $this->agentPageNotice;
        if ($this->agentPageWarning !== '') {
            $_SESSION['satellite_agent_warning'] = $this->agentPageWarning;
        }
        $tab = isset($_POST['section']) && in_array($_POST['section'], array('trunks', 'internal', 'external'), true)
            ? $_POST['section'] : 'destinations';
        header('Location: config.php?display=' . $page . ($page === 'satellite_agents' ? '&tab=' . $tab : ''));
        exit;
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
            $this->saveAgentTrunk($_POST, $id);
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
            if ($stored['runtime_owner'] === 'cleverai' && !getenv('CLEVERAI_WEBHOOK')) {
                throw new \RuntimeException('CLEVERAI_WEBHOOK is not configured');
            }
            $this->agentPageNotice = 'Local trunk configuration is valid';
        } elseif ($action === 'delete') {
            foreach ($this->agentDestinations->listAll() as $destination) {
                if ((int) $destination['cleverai_trunk_id'] === $id) {
                    throw new \RuntimeException('Agent trunk is used by a destination');
                }
            }
            foreach ($this->agentProfiles->listAll() as $profile) {
                if (isset($profile['trunk_id']) && (int) $profile['trunk_id'] === $id) {
                    throw new \RuntimeException('Agent trunk is used by a built-in profile');
                }
            }
            (new AgentTrunkProvisioner())->deleteManagedTrunk($stored);
            $this->agentTrunks->delete($id);
            needreload();
            $this->synchronizeAgentConfiguration();
            $this->agentPageNotice = 'Agent trunk deleted';
        }
    }

    /** Save an Agent trunk through the same validation and provisioning path as the admin form. */
    public function saveAgentTrunk(array $input, $id = null) {
        $existingOwner = 'cleverai';
        if ($id !== null && !array_key_exists('runtime_owner', $input)) {
            $existing = $this->agentTrunks->getById($id);
            $existingOwner = $existing && isset($existing['runtime_owner']) ? $existing['runtime_owner'] : 'cleverai';
        }
        $fields = array('name', 'provider', 'openai_project_id', 'grok_phone_number',
            'api_key', 'sip_auth_mode', 'sip_auth_username', 'sip_auth_password', 'runtime_owner');
        $input = array_merge(array(
            'name' => '', 'provider' => '', 'openai_project_id' => null,
            'grok_phone_number' => null, 'api_key' => '', 'sip_auth_mode' => 'none',
            'sip_auth_username' => null, 'sip_auth_password' => '',
            'runtime_owner' => $existingOwner,
        ), array_intersect_key($input, array_flip($fields)));
        foreach (array('name', 'openai_project_id', 'grok_phone_number', 'sip_auth_username') as $field) {
            if (isset($input[$field]) && is_string($input[$field])) {
                $input[$field] = trim($input[$field]);
            }
        }
        if ($input['sip_auth_password'] === null) {
            $input['sip_auth_password'] = '';
        }
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
        $this->synchronizeAgentConfiguration();
        return (int) $id;
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
            'runtime_owner' => $previous['runtime_owner'],
            'webhook_signing_secret' => $crypto->decryptSecret($previous['webhook_signing_secret_encrypted']),
            'clear_webhook_signing_secret' => empty($previous['webhook_signing_secret_encrypted']),
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
                'cleverai_flow' => isset($_POST['cleverai_flow']) ? $_POST['cleverai_flow'] : '',
                'agent_type' => isset($_POST['agent_type']) ? $_POST['agent_type'] : 'cleverai',
                'fallback_destination' => $fallback
            );
            $this->saveAgentDestination($input, $id);
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
            foreach ($this->agentProfiles->listAll() as $profile) {
                if (isset($profile['fallback_destination']) && $profile['fallback_destination'] === $destination) {
                    throw new \RuntimeException('Destination is used as a built-in profile fallback');
                }
            }
            $this->agentDestinations->delete($id);
            needreload();
            $this->synchronizeAgentConfiguration();
            $this->agentPageNotice = 'Agent destination deleted';
        }
    }

    /** Validate an Agent destination, including editability for an existing ID. */
    public function validateAgentDestination(array $input, $id = null) {
        foreach (array('cleverai_flow', 'fallback_destination') as $field) {
            if (isset($input[$field]) && is_string($input[$field])) {
                $input[$field] = trim($input[$field]);
            }
        }
        return $id === null ? $this->agentDestinations->validateInput($input)
            : $this->agentDestinations->validateUpdateInput($id, $input);
    }

    public function saveAgentDestination(array $input, $id = null) {
        if ($id !== null) {
            $this->saveAgentDestinationBatch(array($id => $input));
            return (int) $id;
        }
        $normalized = $this->validateAgentDestination($input);
        $id = $this->agentDestinations->create($normalized);
        needreload();
        $this->synchronizeAgentConfiguration();
        return (int) $id;
    }

    /** Check changed destinations against the full stored graph before updating any row. */
    public function saveAgentDestinationBatch(array $changes) {
        if (!$changes) {
            return;
        }
        $this->db->beginTransaction();
        try {
            $fallbacks = array();
            foreach ($this->agentDestinations->listAll() as $destination) {
                $fallbacks[(int) $destination['id']] = $destination['fallback_destination'];
            }
            $validated = array();
            foreach ($changes as $id => $input) {
                if (filter_var($id, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false
                    || !is_array($input)) {
                    throw new \InvalidArgumentException('Invalid Agent destination change');
                }
                $id = (int) $id;
                $validated[$id] = $this->validateAgentDestination($input, $id);
                $fallbacks[$id] = $validated[$id]['fallback_destination'];
            }
            foreach ($validated as $id => $input) {
                $fallback = $fallbacks[$id];
                $seen = array($id => true);
                while (is_string($fallback) &&
                    preg_match('/^satellite-agent-destination-([0-9]+),s,1$/D', $fallback, $match)) {
                    $next = (int) $match[1];
                    if (isset($seen[$next])) {
                        throw new \InvalidArgumentException('A destination cannot fall back to itself, directly or through other destinations');
                    }
                    $seen[$next] = true;
                    $fallback = isset($fallbacks[$next]) ? $fallbacks[$next] : null;
                }
            }
            $roots = array();
            foreach (array_keys($validated) as $id) {
                $roots[] = 'destination:' . $id;
            }
            $this->assertAgentFallbackGraphSafe($validated, array(), $roots);
            foreach ($validated as $id => $input) {
                $this->agentDestinations->update($id, $input);
            }
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
        needreload();
        $this->synchronizeAgentConfiguration();
    }

    private function handleAgentWebhookRequest() {
        $id = $this->agentRequestId();
        $stored = $id === null ? null : $this->agentTrunks->getStoredById($id);
        if (!$stored || $stored['runtime_owner'] !== 'builtin') {
            throw new \InvalidArgumentException('Built-in Agent trunk not found');
        }
        $action = isset($_POST['action']) ? $_POST['action'] : '';
        if ($action === 'replace_secret') {
            $secret = isset($_POST['webhook_signing_secret']) ? $_POST['webhook_signing_secret'] : '';
            AgentValidation::validateSecretInput($secret, 'webhook signing secret');
            if ($secret === '') {
                throw new \InvalidArgumentException('Enter a webhook signing secret to replace the current value');
            }
            $this->agentTrunks->update($id, array('webhook_signing_secret' => $secret));
            $this->agentPageNotice = 'Webhook signing secret saved';
        } elseif ($action === 'remove_secret') {
            $this->agentTrunks->update($id, array('clear_webhook_signing_secret' => true));
            $this->agentPageNotice = 'Webhook signing secret removed';
        } else {
            throw new \InvalidArgumentException('Unsupported webhook action');
        }
        $this->synchronizeAgentConfiguration();
    }

    private function handleAgentProfileRequest($key) {
        if (!isset($_POST['action']) || $_POST['action'] !== 'save') {
            throw new \InvalidArgumentException('Unsupported profile action');
        }
        $fallbackIndex = $key === 'internal' ? 1 : 2;
        $fallbackRequest = $_POST;
        if (array_key_exists('goto' . $fallbackIndex, $_POST)) {
            $fallbackRequest['goto0'] = $_POST['goto' . $fallbackIndex];
            $selected = $_POST['goto' . $fallbackIndex];
            if (is_string($selected) && isset($_POST[$selected . $fallbackIndex])) {
                $fallbackRequest[$selected . '0'] = $_POST[$selected . $fallbackIndex];
            }
        }
        $fallback = AgentValidation::submittedFallback($fallbackRequest);
        $this->assertProfileFallbackSafe($key, $fallback);
        $permissions = $this->submittedPolicy('permissions', AgentProfileRepository::permissionsCatalog(), array('allow', 'deny'));
        $tools = $this->submittedPolicy('tools', AgentProfileRepository::toolsCatalog(), array('enabled', 'disabled'));
        $services = array();
        $serviceIds = isset($_POST['calendar_service_id']) && is_array($_POST['calendar_service_id']) ? $_POST['calendar_service_id'] : array();
        $conditionIds = isset($_POST['calendar_time_condition_id']) && is_array($_POST['calendar_time_condition_id']) ? $_POST['calendar_time_condition_id'] : array();
        $validConditions = array();
        foreach ($this->agentContextSource()->timeConditions() as $condition) {
            if (isset($condition['id'])) {
                $validConditions[(string) $condition['id']] = true;
            }
        }
        foreach ($serviceIds as $index => $serviceId) {
            if (!is_string($serviceId) || !preg_match('/^[A-Za-z0-9_.:-]{0,64}$/D', $serviceId)) {
                throw new \InvalidArgumentException('Invalid calendar service ID');
            }
            $conditionId = isset($conditionIds[$index]) ? (string) $conditionIds[$index] : '';
            if ($serviceId === '' && $conditionId === '') {
                continue;
            }
            if ($serviceId === '' || !isset($validConditions[$conditionId]) || isset($services[$serviceId])) {
                throw new \InvalidArgumentException('Select a unique service ID and FreePBX time condition');
            }
            $services[$serviceId] = $conditionId;
        }
        $input = array(
            'trunk_id' => isset($_POST['trunk_id']) ? $_POST['trunk_id'] : null,
            'model' => isset($_POST['model']) ? $_POST['model'] : '',
            'voice' => isset($_POST['voice']) ? $_POST['voice'] : '',
            'language' => isset($_POST['language']) ? $_POST['language'] : '',
            'greeting' => isset($_POST['greeting']) ? $_POST['greeting'] : '',
            'prompt' => isset($_POST['prompt']) ? $_POST['prompt'] : '',
            'max_call_duration_seconds' => isset($_POST['max_call_duration_seconds']) ? $_POST['max_call_duration_seconds'] : null,
            'fallback_destination' => $fallback,
            'permissions' => $permissions,
            'tools' => $tools,
            'company' => isset($_POST['company']) && is_array($_POST['company']) ? $_POST['company'] : array(),
            'calendar_services' => $services,
        );
        $directory = isset($_POST['directory']) && is_array($_POST['directory']) ? $_POST['directory'] : array();
        $existingRules = $this->agentDestinations->directoryRules();
        $rules = array();
        foreach ($this->agentContextSource()->directory() as $item) {
            if (!isset($item['id']) || !isset($item['type'])) {
                continue;
            }
            $resourceKey = $item['id'];
            $submitted = isset($directory[$resourceKey]) && is_array($directory[$resourceKey]) ? $directory[$resourceKey] : array();
            $existing = isset($existingRules[$resourceKey]) ? $existingRules[$resourceKey] : array();
            $synonyms = isset($submitted['synonyms']) && is_string($submitted['synonyms'])
                ? array_values(array_filter(array_map('trim', explode(',', $submitted['synonyms'])), 'strlen')) : array();
            $rules[$resourceKey] = array_merge($existing, array(
                'resource_type' => $item['type'],
                'description' => isset($submitted['description']) ? $submitted['description'] : '',
                'synonyms' => $synonyms,
                $key . '_allowed' => isset($submitted['allowed']) && $submitted['allowed'] === '1' ? 1 : 0,
            ));
            AgentValidation::validateDirectoryRule($resourceKey, $rules[$resourceKey]);
        }
        $previous = $this->agentProfiles->getByKey($key);
        $this->db->beginTransaction();
        try {
            $this->agentProfiles->save($key, $input);
            if ($rules) {
                $this->agentDestinations->saveDirectoryRules($rules);
            }
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
        if ((string) (isset($previous['trunk_id']) ? $previous['trunk_id'] : '') !== (string) $input['trunk_id'] ||
            (string) (isset($previous['fallback_destination']) ? $previous['fallback_destination'] : '') !== (string) $fallback) {
            needreload();
        }
        $this->synchronizeAgentConfiguration();
        $this->agentPageNotice = $key === 'internal' ? 'Builtin Internal profile saved' : 'Builtin External profile saved';
    }

    private function submittedPolicy($field, array $catalog, array $values) {
        $submitted = isset($_POST[$field]) && is_array($_POST[$field]) ? $_POST[$field] : array();
        $result = array();
        foreach ($catalog as $catalogKey => $catalogValue) {
            $key = is_int($catalogKey) ? $catalogValue : $catalogKey;
            if (!isset($submitted[$key]) || !in_array($submitted[$key], $values, true)) {
                throw new \InvalidArgumentException('Choose a value for every ' . $field . ' entry');
            }
            $result[$key] = $submitted[$key];
        }
        return $result;
    }

    private function assertProfileFallbackSafe($key, $fallback) {
        $this->assertAgentFallbackGraphSafe(array(), array($key => AgentValidation::validateFallback($fallback)),
            array('profile:' . $key));
    }

    private function assertAgentFallbackGraphSafe(array $destinationChanges, array $profileFallbacks, array $roots) {
        $profiles = array();
        if (isset($this->agentProfiles)) {
            foreach ($this->agentProfiles->listAll() as $profile) {
                $profiles[$profile['profile_key']] = $profile;
            }
        }
        foreach ($profileFallbacks as $key => $fallback) {
            $profiles[$key]['fallback_destination'] = $fallback;
        }
        $destinations = array();
        foreach ($this->agentDestinations->listAll() as $row) {
            $destinations[(int) $row['id']] = $row;
        }
        foreach ($destinationChanges as $id => $change) {
            $destinations[(int) $id] = array_merge(isset($destinations[(int) $id]) ? $destinations[(int) $id] : array(), $change);
        }
        $active = array();
        $done = array();
        $visit = function ($node) use (&$visit, &$active, &$done, $profiles, $destinations) {
            if (isset($active[$node])) {
                throw new \InvalidArgumentException('Agent fallback cycle detected');
            }
            if (isset($done[$node])) {
                return;
            }
            $active[$node] = true;
            $edges = array();
            if (strpos($node, 'profile:') === 0) {
                $key = substr($node, 8);
                $fallback = isset($profiles[$key]['fallback_destination']) ? $profiles[$key]['fallback_destination'] : null;
            } else {
                $id = (int) substr($node, 12);
                $row = isset($destinations[$id]) ? $destinations[$id] : array();
                $fallback = isset($row['fallback_destination']) ? $row['fallback_destination'] : null;
                if (($fallback === null || $fallback === '') && isset($row['agent_type']) &&
                    in_array($row['agent_type'], array('builtin_internal', 'builtin_external'), true)) {
                    $edges[] = 'profile:' . ($row['agent_type'] === 'builtin_internal' ? 'internal' : 'external');
                }
            }
            if (is_string($fallback) && preg_match('/^satellite-agent-destination-([0-9]+),s,1$/D', $fallback, $match)) {
                $edges[] = 'destination:' . (int) $match[1];
            }
            foreach ($edges as $next) {
                $visit($next);
            }
            unset($active[$node]);
            $done[$node] = true;
        };
        foreach ($roots as $root) {
            $visit($root);
        }
    }

    private function synchronizeAgentConfiguration() {
        if (!class_exists('AgentConfigurationBuilder') || !isset($this->FreePBX)) {
            return;
        }
        try {
            (new AgentConfigurationBuilder($this->FreePBX))->synchronize();
        } catch (\Throwable $error) {
            $this->agentPageWarning = _('Saved, but Satellite synchronization is pending. Check local Satellite readiness.');
        }
    }

    private function agentContextSource() {
        return new AgentContextSource($this->FreePBX);
    }

    public function showAgentsPage($defaultTab = 'destinations') {
        $trunks = $this->getAgentTrunks();
        $destinations = $this->getAgentDestinations();
        $error = $this->agentPageError;
        $notice = $this->agentPageNotice;
        $warning = $this->agentPageWarning;
        $csrfToken = $this->agentCsrfToken();
        if (isset($_SESSION['satellite_agent_notice'])) {
            $notice = (string) $_SESSION['satellite_agent_notice'];
            unset($_SESSION['satellite_agent_notice']);
        }
        if (isset($_SESSION['satellite_agent_warning'])) {
            $warning = (string) $_SESSION['satellite_agent_warning'];
            unset($_SESSION['satellite_agent_warning']);
        }
        $tab = isset($_POST['section']) ? $_POST['section'] : (isset($_GET['tab']) ? $_GET['tab'] : $defaultTab);
        if (!in_array($tab, array('destinations', 'trunks', 'internal', 'external'), true)) {
            $tab = $defaultTab;
        }
        $form = $this->agentSubmittedForm;
        if ($form === null && isset($_GET['view']) && $_GET['view'] === 'form' &&
            isset($_GET['id']) && ctype_digit((string) $_GET['id']) && (int) $_GET['id'] > 0) {
            $form = $tab === 'trunks'
                ? $this->getAgentTrunk((int) $_GET['id'])
                : $this->getAgentDestination((int) $_GET['id']);
        }
        if ($tab === 'destinations' && is_array($form) && !empty($form['id'])) {
            $storedForm = $this->getAgentDestination((int) $form['id']);
            if ($storedForm && !empty($storedForm['system_managed'])) {
                $form = array_merge($storedForm, $form, array('system_managed' => 1));
            }
        }
        $showForm = (isset($_GET['view']) && $_GET['view'] === 'form') || ($form !== null && !in_array($tab, array('internal', 'external'), true));
        $formMode = $showForm || $tab === 'internal' || $tab === 'external';
        $builtinStatuses = array('internal' => _('Not configured'), 'external' => _('Not configured'));
        try {
            $configStatus = (new AgentConfigurationBuilder($this->FreePBX))->status();
            $ready = array();
            try { $ready = (new AgentSatelliteClient())->readiness(); } catch (\Throwable $unavailable) { }
            $reloadPending = function_exists('check_reload_needed') && check_reload_needed();
            foreach ($this->agentProfiles->listAll() as $profileStatus) {
                $bound = null;
                foreach ($trunks as $trunkStatus) {
                    if ((int) $trunkStatus['id'] === (int) $profileStatus['trunk_id'] && $trunkStatus['runtime_owner'] === 'builtin') {
                        $bound = $trunkStatus; break;
                    }
                }
                if (!$bound || $bound['status'] !== 'Configured') { continue; }
                $key = $profileStatus['profile_key'];
                if (!empty($configStatus['sync_error'])) {
                    $builtinStatuses[$key] = _('Error');
                } elseif ($reloadPending || $configStatus['desired_revision'] !== $configStatus['acknowledged_revision'] ||
                    $configStatus['desired_hash'] !== $configStatus['acknowledged_hash']) {
                    $builtinStatuses[$key] = _('Pending synchronization/reload');
                } else {
                    $builtinStatuses[$key] = !empty($ready['ready']) &&
                        (int) $ready['revision'] === $configStatus['acknowledged_revision'] &&
                        $ready['payload_hash'] === $configStatus['acknowledged_hash'] ? _('Ready') : _('Not ready');
                }
            }
        } catch (\Throwable $ignored) { }
        $destinationForm = $tab === 'destinations' ? $form : null;
        $trunkForm = $tab === 'trunks' ? $form : null;
        $destinationsContent = load_view(__DIR__ . '/views/agent/agents.php', array(
            'trunks' => $trunks, 'destinations' => $destinations,
            'form' => $destinationForm, 'showForm' => $showForm && $tab === 'destinations',
            'csrfToken' => $csrfToken, 'builtinStatuses' => $builtinStatuses,
        ));
        $trunksContent = load_view(__DIR__ . '/views/agent/trunks.php', array(
            'trunks' => $trunks, 'form' => $trunkForm, 'showForm' => $showForm && $tab === 'trunks',
            'csrfToken' => $csrfToken,
        ));
        $profileViews = array('internal' => '', 'external' => '');
        if ($tab === 'internal' || $tab === 'external') {
            $permissionCatalog = AgentProfileRepository::permissionsCatalog();
            $toolCatalog = AgentProfileRepository::toolsCatalog();
            $directory = $this->agentContextSource()->directory();
            $directoryRules = $this->agentDestinations->directoryRules();
            $timeConditions = $this->agentContextSource()->timeConditions();
            $profileKey = $tab;
            $profileStatus = $builtinStatuses[$profileKey];
            $profile = $this->agentProfiles->getByKey($profileKey);
            if (is_array($this->agentSubmittedForm)) {
                $profile = array_merge($profile ?: array(), $this->agentSubmittedForm);
            }
            $profileViews[$profileKey] = load_view(__DIR__ . '/views/agent/profile.php', compact(
                'profile', 'profileKey', 'trunks', 'permissionCatalog', 'toolCatalog',
                'directory', 'directoryRules', 'timeConditions', 'csrfToken', 'profileStatus'
            ));
        }
        $internalContent = $profileViews['internal'];
        $externalContent = $profileViews['external'];
        $syncStatus = '';
        try {
            $status = (new AgentConfigurationBuilder($this->FreePBX))->status();
            if (is_array($status) && !empty($status['sync_error'])) {
                $syncStatus = _('Satellite configuration synchronization failed; retry is pending.');
            } elseif (is_array($status) && isset($status['desired_revision']) && isset($status['acknowledged_revision']) &&
                (int) $status['desired_revision'] > (int) $status['acknowledged_revision']) {
                $syncStatus = _('Satellite configuration is pending synchronization.');
            }
        } catch (\Throwable $ignored) {
            $syncStatus = _('Satellite configuration status is unavailable.');
        }
        return load_view(__DIR__ . '/views/agent/index.php', compact(
            'tab', 'formMode', 'error', 'notice', 'warning', 'syncStatus',
            'destinationsContent', 'trunksContent', 'internalContent', 'externalContent'
        ));
    }

    public function showWebhooksPage() {
        $trunks = $this->getAgentTrunks();
        $webhook = getenv('CLEVERAI_WEBHOOK') ?: '';
        $builtinWebhook = AgentSatelliteClient::publicWebhookUrl();
        $builtinStatus = _('Not configured');
        if ($builtinWebhook !== '') {
            try {
                $status = (new AgentConfigurationBuilder($this->FreePBX))->status();
                if (!empty($status['sync_error'])) {
                    $builtinStatus = _('Error');
                } elseif ((int) $status['desired_revision'] > (int) $status['acknowledged_revision']) {
                    $builtinStatus = _('Pending synchronization/reload');
                } else {
                    $readiness = (new AgentSatelliteClient())->readiness();
                    $reloadPending = function_exists('check_reload_needed') && check_reload_needed();
                    $builtinStatus = $reloadPending ? _('Pending synchronization/reload') :
                        (!empty($readiness['ready']) && (int) $readiness['revision'] === (int) $status['acknowledged_revision'] &&
                        $readiness['payload_hash'] === $status['acknowledged_hash'] ? _('Ready') : _('Error'));
                }
            } catch (\Throwable $ignored) {
                $builtinStatus = _('Error');
            }
        }
        $csrfToken = $this->agentCsrfToken();
        $error = $this->agentPageError;
        $notice = $this->agentPageNotice;
        $warning = $this->agentPageWarning;
        if (isset($_SESSION['satellite_agent_notice'])) {
            $notice = (string) $_SESSION['satellite_agent_notice'];
            unset($_SESSION['satellite_agent_notice']);
        }
        if (isset($_SESSION['satellite_agent_warning'])) {
            $warning = (string) $_SESSION['satellite_agent_warning'];
            unset($_SESSION['satellite_agent_warning']);
        }
        return load_view(__DIR__ . '/views/agent/webhooks.php', compact(
            'trunks', 'webhook', 'builtinWebhook', 'builtinStatus', 'csrfToken', 'error', 'notice', 'warning'
        ));
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
