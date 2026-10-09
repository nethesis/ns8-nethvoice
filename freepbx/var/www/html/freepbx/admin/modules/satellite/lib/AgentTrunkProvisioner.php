<?php

require_once __DIR__ . '/AgentCrypto.php';

/**
 * Provision Agent trunks through FreePBX Core's PJSIP trunk API.
 *
 * The module repository owns Agent metadata and secrets. Only SIP credentials
 * needed for digest authentication are passed to the PJSIP driver.
 */
class AgentTrunkProvisioner
{
    private $core;
    private $crypto;

    // Use FreePBX trunk operations for managed provider bindings.
    public function __construct($core = null, $crypto = null)
    {
        $this->core = $core === null ? \FreePBX::Core() : $core;
        $this->crypto = $crypto === null ? new AgentCrypto() : $crypto;
    }

    /** Return the FreePBX trunk ID for a new AgentTrunk_<module ID>. */
    public function createManagedTrunk(array $agentTrunk)
    {
        $name = $this->trunkName($agentTrunk);
        $settings = $this->pjsipSettings($agentTrunk);
        if ($this->findTrunkByName($name) !== null) {
            throw new \RuntimeException('Managed trunk already exists: ' . $name);
        }

        try {
            return $this->addTrunk($name, $this->baseSettings($name, $agentTrunk), $settings);
        } catch (\Throwable $error) {
            // Core::addTrunk can fail after writing part of the trunk.
            try {
                $partial = $this->findTrunkByName($name);
                if ($partial !== null && isset($partial['trunkid'])) {
                    $this->core->deleteTrunk((int) $partial['trunkid'], 'pjsip', true);
                }
            } catch (\Throwable $cleanupError) {
                // Report the original failure.
            }
            throw $error;
        }
    }

    /** Replace an existing managed trunk while retaining its FreePBX trunk ID. */
    public function updateManagedTrunk(array $agentTrunk, array $previousTrunk = null)
    {
        $name = $this->trunkName($agentTrunk);
        $trunkId = $this->ownedTrunkId($agentTrunk, $name);
        $settings = $this->pjsipSettings($agentTrunk);
        $base = $this->baseSettings($name, $agentTrunk);
        $base['trunknum'] = $trunkId;

        if ($previousTrunk !== null) {
            if ($this->trunkName($previousTrunk) !== $name || $this->ownedTrunkId($previousTrunk, $name) !== $trunkId) {
                throw new \InvalidArgumentException('Previous managed trunk does not match the trunk being updated');
            }
            $previousSettings = $this->pjsipSettings($previousTrunk);
            $previousBase = $this->baseSettings($name, $previousTrunk);
            $previousBase['trunknum'] = $trunkId;
        }

        $deleted = $this->core->deleteTrunk($trunkId, 'pjsip', true);
        if ($deleted !== true) {
            throw new \RuntimeException('Could not replace managed trunk ' . $name);
        }

        try {
            return $this->addTrunk($name, $base, $settings, true);
        } catch (\Throwable $error) {
            if ($previousTrunk === null) {
                throw $error;
            }

            $rollbackErrors = array();
            try {
                if ($this->core->deleteTrunk($trunkId, 'pjsip', true) !== true) {
                    throw new \RuntimeException('partial trunk cleanup failed');
                }
            } catch (\Throwable $cleanupError) {
                $rollbackErrors[] = $cleanupError->getMessage();
            }
            try {
                if ((int) $this->addTrunk($name, $previousBase, $previousSettings, true) !== $trunkId) {
                    throw new \RuntimeException('previous trunk was restored under a different ID');
                }
            } catch (\Throwable $restoreError) {
                $rollbackErrors[] = $restoreError->getMessage();
            }
            if ($rollbackErrors) {
                throw new \RuntimeException(
                    'Could not update managed trunk ' . $name . ': ' . $error->getMessage()
                    . '; rollback failed: ' . implode('; ', $rollbackErrors),
                    0,
                    $error
                );
            }
            throw $error;
        }
    }

    // Delete only the FreePBX trunk owned by this binding.
    public function deleteManagedTrunk(array $agentTrunk)
    {
        $name = $this->trunkName($agentTrunk);
        if (empty($agentTrunk['freepbx_trunk_id']) || $this->findTrunkByName($name) === null) {
            // The FreePBX trunk is already gone; only the Agent row remains.
            return true;
        }
        $trunkId = $this->ownedTrunkId($agentTrunk, $name);
        if ($this->core->deleteTrunk($trunkId, 'pjsip') !== true) {
            throw new \RuntimeException('Could not delete managed trunk ' . $name);
        }
        return true;
    }

    /** Validate local configuration and the proxy-facing UDP transport. */
    public function validateManagedTrunk(array $agentTrunk)
    {
        $this->trunkName($agentTrunk);
        $this->pjsipSettings($agentTrunk);
        return true;
    }

    // Build the generated name for an agent trunk.
    private function trunkName(array $agentTrunk)
    {
        if (!isset($agentTrunk['id']) || !ctype_digit((string) $agentTrunk['id']) || (int) $agentTrunk['id'] < 1) {
            throw new \InvalidArgumentException('A positive Agent trunk ID is required');
        }
        $name = 'AgentTrunk_' . (int) $agentTrunk['id'];
        if (isset($agentTrunk['freepbx_trunk_name']) && $agentTrunk['freepbx_trunk_name'] !== $name) {
            throw new \InvalidArgumentException('Managed trunk name does not match its ID');
        }
        return $name;
    }

    // Build provider-specific PJSIP settings.
    private function pjsipSettings(array $agentTrunk)
    {
        $owner = isset($agentTrunk['runtime_owner']) ? $agentTrunk['runtime_owner'] : 'cleverai';
        if (!in_array($owner, array('cleverai', 'builtin'), true)) {
            throw new \InvalidArgumentException('Unsupported Agent trunk owner');
        }

        $transport = $this->udpTransport();
        $proxyIp = isset($_ENV['PROXY_IP']) ? $_ENV['PROXY_IP'] : '';
        $proxyPort = isset($_ENV['PROXY_PORT']) ? (string) $_ENV['PROXY_PORT'] : '';
        if (!is_string($proxyIp) || !filter_var($proxyIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)
            || !ctype_digit($proxyPort) || (int) $proxyPort < 1 || (int) $proxyPort > 65535) {
            throw new \RuntimeException('NethVoice SIP proxy address and port are required');
        }
        $provider = isset($agentTrunk['provider']) ? $agentTrunk['provider'] : '';
        $settings = array(
            'registration' => 'none',
            'authentication' => 'none',
            'transport' => $transport,
            'outbound_proxy' => 'sip:' . $proxyIp . ':' . $proxyPort . ';lr',
            'context' => 'from-pstn',
            'direct_media' => 'no',
            'rtp_symmetric' => 'yes',
            'rewrite_contact' => 'no',
            'force_rport' => 'yes',
            'media_encryption' => 'sdes',
            'dtmfmode' => 'rfc4733',
            'codec' => array('ulaw' => true, 'alaw' => true, 'g722' => true),
        );

        if ($provider === 'openai') {
            if (isset($agentTrunk['sip_auth_mode']) && $agentTrunk['sip_auth_mode'] !== 'none') {
                throw new \InvalidArgumentException('OpenAI SIP authentication must be none');
            }
            $settings['media_encryption'] = 'no';
            $projectId = isset($agentTrunk['openai_project_id']) ? $agentTrunk['openai_project_id'] : '';
            if (!is_string($projectId) || strlen($projectId) > 128 || !preg_match('/^proj_[A-Za-z0-9_-]+$/D', $projectId)) {
                throw new \InvalidArgumentException('Invalid OpenAI project ID');
            }
            $settings['sip_server'] = 'sip.api.openai.com';
            $settings['sip_server_port'] = '5061';
            $settings['aor_contact'] = 'sip:sip.api.openai.com:5061;transport=tls';
        } elseif ($provider === 'grok') {
            $number = isset($agentTrunk['grok_phone_number']) ? $agentTrunk['grok_phone_number'] : '';
            if (!is_string($number) || !preg_match('/^\+[1-9][0-9]{1,14}$/D', $number)) {
                throw new \InvalidArgumentException('Grok Direct SIP number must be E.164');
            }
            $settings['sip_server'] = 'sip.voice.x.ai';
            $settings['sip_server_port'] = '5061';
            $settings['aor_contact'] = 'sip:' . $number . '@sip.voice.x.ai:5061;transport=tls';

            $mode = isset($agentTrunk['sip_auth_mode']) ? $agentTrunk['sip_auth_mode'] : 'none';
            if ($mode === 'digest') {
                $username = isset($agentTrunk['sip_auth_username']) ? $agentTrunk['sip_auth_username'] : '';
                $password = $this->crypto->decryptSecret(isset($agentTrunk['sip_auth_password_encrypted'])
                    ? $agentTrunk['sip_auth_password_encrypted'] : null);
                if (!is_string($username) || $username === '' || strlen($username) > 128
                    || preg_match('/[\x00-\x20\x7F]/', $username) || !is_string($password)
                    || $password === '' || preg_match('/[\r\n\x00]/', $password)) {
                    throw new \InvalidArgumentException('Grok SIP digest username and password are required');
                }
                $settings['authentication'] = 'outbound';
                $settings['username'] = $username;
                $settings['auth_username'] = $username;
                $settings['secret'] = $password;
            } elseif ($mode !== 'none') {
                throw new \InvalidArgumentException('Unsupported Grok SIP authentication mode');
            }
        } else {
            throw new \InvalidArgumentException('Unsupported Agent trunk provider');
        }

        return $settings;
    }

    // Find the PBX UDP transport used by the provider trunk.
    private function udpTransport()
    {
        $driver = $this->core->getDriver('pjsip');
        if ($driver === false || !method_exists($driver, 'getActiveTransports')) {
            throw new \RuntimeException('FreePBX PJSIP driver is unavailable');
        }
        foreach ($driver->getActiveTransports() as $transport) {
            if (isset($transport['value']) && $transport['value'] === '0.0.0.0-udp') {
                return $transport['value'];
            }
        }
        throw new \RuntimeException('PJSIP transport 0.0.0.0-udp is not active');
    }

    // Build the common FreePBX trunk settings.
    private function baseSettings($name, array $agentTrunk)
    {
        return array(
            'channelid' => $name,
            'dialoutprefix' => '',
            'maxchans' => '',
            'outcid' => '',
            'peerdetails' => '',
            'usercontext' => '',
            'userconfig' => '',
            'register' => '',
            'keepcid' => 'off',
            'failtrunk' => '',
            'disabletrunk' => !isset($agentTrunk['enabled']) || $agentTrunk['enabled'] ? 'off' : 'on',
            'provider' => 'satellite-agent',
            'continue' => 'off',
            'dialopts' => false,
        );
    }

    // Create a FreePBX trunk with the checked settings.
    private function addTrunk($name, array $base, array $settings, $edit = false)
    {
        $originalPost = $_POST;
        try {
            // The PJSIP generator names endpoint sections from this stored key.
            $settings['trunk_name'] = $name;
            $_POST = $settings;
            return $this->core->addTrunk($name, 'pjsip', $base, $edit);
        } finally {
            $_POST = $originalPost;
        }
    }

    // Find a FreePBX trunk by its generated name.
    private function findTrunkByName($name)
    {
        foreach ($this->core->listTrunks() as $trunk) {
            if (isset($trunk['channelid']) && $trunk['channelid'] === $name) {
                return $trunk;
            }
        }
        return null;
    }

    // Return a trunk ID only when ownership matches.
    private function ownedTrunkId(array $agentTrunk, $name)
    {
        if (!isset($agentTrunk['freepbx_trunk_id']) || !ctype_digit((string) $agentTrunk['freepbx_trunk_id'])) {
            throw new \InvalidArgumentException('A FreePBX trunk ID is required');
        }
        $trunkId = (int) $agentTrunk['freepbx_trunk_id'];
        foreach ($this->core->listTrunks() as $trunk) {
            if (isset($trunk['trunkid']) && (int) $trunk['trunkid'] === $trunkId
                && isset($trunk['channelid'], $trunk['tech'], $trunk['provider'])
                && $trunk['channelid'] === $name && strtolower($trunk['tech']) === 'pjsip'
                && $trunk['provider'] === 'satellite-agent') {
                return $trunkId;
            }
        }
        throw new \RuntimeException('Managed FreePBX trunk was not found: ' . $name);
    }
}
