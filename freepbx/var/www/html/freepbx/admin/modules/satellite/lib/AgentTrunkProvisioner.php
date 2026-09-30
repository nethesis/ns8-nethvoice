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

        return $this->addTrunk($name, $this->baseSettings($name, $agentTrunk), $settings);
    }

    /** Replace an existing managed trunk while retaining its FreePBX trunk ID. */
    public function updateManagedTrunk(array $agentTrunk)
    {
        $name = $this->trunkName($agentTrunk);
        $trunkId = $this->ownedTrunkId($agentTrunk, $name);
        $settings = $this->pjsipSettings($agentTrunk);
        $base = $this->baseSettings($name, $agentTrunk);
        $base['trunknum'] = $trunkId;

        $deleted = $this->core->deleteTrunk($trunkId, 'pjsip', true);
        if ($deleted !== true) {
            throw new \RuntimeException('Could not replace managed trunk ' . $name);
        }

        return $this->addTrunk($name, $base, $settings, true);
    }

    public function deleteManagedTrunk(array $agentTrunk)
    {
        $name = $this->trunkName($agentTrunk);
        $trunkId = $this->ownedTrunkId($agentTrunk, $name);
        if ($this->core->deleteTrunk($trunkId, 'pjsip') !== true) {
            throw new \RuntimeException('Could not delete managed trunk ' . $name);
        }
        return true;
    }

    /** Validate local configuration and the presence of an enabled TLS transport. */
    public function validateManagedTrunk(array $agentTrunk)
    {
        $this->trunkName($agentTrunk);
        $this->pjsipSettings($agentTrunk);
        return true;
    }

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

    private function pjsipSettings(array $agentTrunk)
    {
        if (isset($agentTrunk['runtime_owner']) && $agentTrunk['runtime_owner'] !== 'cleverai') {
            throw new \InvalidArgumentException('Phase 1 supports only the CleverAI runtime');
        }

        $transport = $this->tlsTransport();
        $provider = isset($agentTrunk['provider']) ? $agentTrunk['provider'] : '';
        $settings = array(
            'registration' => 'none',
            'authentication' => 'none',
            'transport' => $transport,
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

    private function tlsTransport()
    {
        $driver = $this->core->getDriver('pjsip');
        if ($driver === false || !method_exists($driver, 'getActiveTransports')) {
            throw new \RuntimeException('FreePBX PJSIP driver is unavailable');
        }
        foreach ($driver->getActiveTransports() as $transport) {
            if (isset($transport['value']) && is_string($transport['value']) && preg_match('/-tls$/', $transport['value'])) {
                return $transport['value'];
            }
        }
        throw new \RuntimeException('No active PJSIP TLS transport is configured');
    }

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

    private function findTrunkByName($name)
    {
        foreach ($this->core->listTrunks() as $trunk) {
            if (isset($trunk['channelid']) && $trunk['channelid'] === $name) {
                return $trunk;
            }
        }
        return null;
    }

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
