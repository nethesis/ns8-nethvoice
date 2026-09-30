<?php

/** Validation for values that enter SIP headers or managed trunk settings. */
class AgentValidation
{
    public static function validateFlow($flow)
    {
        if (!is_string($flow) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/D', $flow)) {
            throw new \InvalidArgumentException('Invalid CleverAI flow');
        }
        return $flow;
    }

    public static function validateProjectId($projectId)
    {
        if (!is_string($projectId) || !preg_match('/^proj_[A-Za-z0-9_-]+$/D', $projectId) || strlen($projectId) > 128) {
            throw new \InvalidArgumentException('Invalid OpenAI project ID');
        }
        return $projectId;
    }

    public static function validateGrokPhoneNumber($number)
    {
        if (!is_string($number) || !preg_match('/^\+[1-9][0-9]{1,14}$/D', $number)) {
            throw new \InvalidArgumentException('Invalid Grok Direct SIP number');
        }
        return $number;
    }

    public static function validateTrunk(array $trunk)
    {
        $name = isset($trunk['name']) ? $trunk['name'] : null;
        if (!is_string($name) || $name === '' || strlen($name) > 100 || preg_match('/[\x00-\x1F\x7F]/', $name)) {
            throw new \InvalidArgumentException('Invalid agent trunk name');
        }

        $provider = isset($trunk['provider']) ? $trunk['provider'] : null;
        if ($provider === 'openai') {
            self::validateProjectId(isset($trunk['openai_project_id']) ? $trunk['openai_project_id'] : null);
        } elseif ($provider === 'grok') {
            self::validateGrokPhoneNumber(isset($trunk['grok_phone_number']) ? $trunk['grok_phone_number'] : null);
        } else {
            throw new \InvalidArgumentException('Unsupported provider');
        }

        $owner = isset($trunk['runtime_owner']) ? $trunk['runtime_owner'] : 'cleverai';
        if ($owner !== 'cleverai') {
            throw new \InvalidArgumentException('Phase 1 supports CleverAI-owned trunks only');
        }

        $mode = isset($trunk['sip_auth_mode']) ? $trunk['sip_auth_mode'] : 'none';
        if (!in_array($mode, array('none', 'digest'), true)) {
            throw new \InvalidArgumentException('Unsupported SIP authentication mode');
        }
        if ($provider === 'openai' && $mode !== 'none') {
            throw new \InvalidArgumentException('OpenAI SIP authentication must be none');
        }
        if ($mode === 'digest') {
            $username = isset($trunk['sip_auth_username']) ? $trunk['sip_auth_username'] : null;
            if (!is_string($username) || $username === '' || strlen($username) > 128 || preg_match('/[\x00-\x20\x7F]/', $username)) {
                throw new \InvalidArgumentException('Invalid SIP authentication username');
            }
        }
        return $trunk;
    }

    public static function validateFallback($destination)
    {
        if ($destination === null || $destination === '') {
            return null;
        }
        if (!is_string($destination) || strlen($destination) > 255 ||
            !preg_match('~^[A-Za-z0-9_-]+,(?:[A-Za-z0-9_.*+#-]+|\$\{EXTEN\}),[1-9][0-9]*$~D', $destination)) {
            throw new \InvalidArgumentException('Invalid fallback destination');
        }
        return $destination;
    }

    public static function validateSecretInput($secret, $label)
    {
        if (!is_string($secret) || preg_match('/[\x00\r\n]/', $secret)) {
            throw new \InvalidArgumentException('Invalid ' . $label);
        }
        return $secret;
    }
}
