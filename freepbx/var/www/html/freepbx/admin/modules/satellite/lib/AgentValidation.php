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
        if (!in_array($owner, array('cleverai', 'builtin'), true)) {
            throw new \InvalidArgumentException('Unsupported Agent trunk owner');
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

    public static function validateProfile(array $profile)
    {
        foreach (array('display_name' => 100, 'language' => 16) as $field => $limit) {
            if (!isset($profile[$field]) || !is_string($profile[$field]) || $profile[$field] === ''
                || strlen($profile[$field]) > $limit || preg_match('/[\x00-\x1f\x7f]/', $profile[$field])) {
                throw new \InvalidArgumentException('Invalid profile ' . $field);
            }
        }
        foreach (array('model' => 128, 'voice' => 128, 'greeting' => 4096, 'prompt' => 65535) as $field => $limit) {
            if ($profile[$field] !== null && (!is_string($profile[$field]) || strlen($profile[$field]) > $limit
                || strpos($profile[$field], "\0") !== false)) {
                throw new \InvalidArgumentException('Invalid profile ' . $field);
            }
        }
        if ($profile['trunk_id'] === '') {
            $profile['trunk_id'] = null;
        }
        if ($profile['trunk_id'] !== null) {
            if (filter_var($profile['trunk_id'], FILTER_VALIDATE_INT,
                array('options' => array('min_range' => 1))) === false) {
                throw new \InvalidArgumentException('Invalid profile trunk');
            }
            $profile['trunk_id'] = (int) $profile['trunk_id'];
        }
        if (filter_var($profile['max_call_duration_seconds'], FILTER_VALIDATE_INT,
            array('options' => array('min_range' => 60, 'max_range' => 7200))) === false) {
            throw new \InvalidArgumentException('Invalid maximum call duration');
        }
        $profile['max_call_duration_seconds'] = (int) $profile['max_call_duration_seconds'];
        $profile['fallback_destination'] = self::validateFallback($profile['fallback_destination']);
        foreach (array('permissions', 'tools') as $field) {
            if (!is_array($profile[$field])) {
                throw new \InvalidArgumentException('Invalid profile ' . $field);
            }
            $catalog = $field === 'permissions' ? AgentProfileRepository::permissionsCatalog()
                : AgentProfileRepository::toolsCatalog();
            $default = $field === 'permissions' ? 'deny' : 'disabled';
            $allowed = $field === 'permissions' ? array('allow', 'deny') : array('enabled', 'disabled');
            $normalized = array_fill_keys($catalog, $default);
            foreach ($profile[$field] as $key => $value) {
                if (!array_key_exists($key, $normalized) || !in_array($value, $allowed, true)) {
                    throw new \InvalidArgumentException('Invalid profile ' . $field . ' entry');
                }
                $normalized[$key] = $value;
            }
            $profile[$field] = $normalized;
        }
        foreach (array('transfer_policy', 'knowledge', 'company', 'calendar_services') as $field) {
            if (!is_array($profile[$field]) || strlen(json_encode($profile[$field])) > 65535) {
                throw new \InvalidArgumentException('Invalid profile ' . $field);
            }
        }
        foreach ($profile['calendar_services'] as $service => $calendarId) {
            if ((!is_string($service) && !is_int($service)) || !preg_match('/^[A-Za-z0-9_.:-]{1,64}$/D', (string) $service)
                || !is_string($calendarId) && !is_int($calendarId)
                || !preg_match('/^[0-9]{1,10}$/D', (string) $calendarId)) {
                throw new \InvalidArgumentException('Invalid calendar service reference');
            }
        }
        return $profile;
    }

    public static function validateDirectoryRuleKey($key)
    {
        if (!is_string($key) || !preg_match('/^(extension|queue|ivr):[A-Za-z0-9_-]{1,100}$/D', $key)
            || strlen($key) > 128) {
            throw new \InvalidArgumentException('Invalid directory resource key');
        }
        return $key;
    }

    public static function validateDirectoryRule($key, $rule)
    {
        self::validateDirectoryRuleKey($key);
        if (!is_array($rule)) {
            throw new \InvalidArgumentException('Invalid directory rule');
        }
        $type = explode(':', $key, 2)[0];
        if (isset($rule['resource_type']) && $rule['resource_type'] !== $type) {
            throw new \InvalidArgumentException('Directory resource type does not match its key');
        }
        $description = isset($rule['description']) ? $rule['description'] : null;
        if ($description !== null && (!is_string($description) || strlen($description) > 4096
            || strpos($description, "\0") !== false)) {
            throw new \InvalidArgumentException('Invalid directory description');
        }
        $synonyms = isset($rule['synonyms']) ? $rule['synonyms'] : array();
        if (!is_array($synonyms) || count($synonyms) > 50) {
            throw new \InvalidArgumentException('Invalid directory synonyms');
        }
        foreach ($synonyms as $synonym) {
            if (!is_string($synonym) || $synonym === '' || strlen($synonym) > 100
                || strpos($synonym, "\0") !== false) {
                throw new \InvalidArgumentException('Invalid directory synonym');
            }
        }
        foreach (array('internal_allowed', 'external_allowed') as $field) {
            if (!array_key_exists($field, $rule)) {
                $rule[$field] = false;
            }
            if (!in_array($rule[$field], array(true, false, 0, 1, '0', '1'), true)) {
                throw new \InvalidArgumentException('Invalid directory visibility');
            }
        }
        return array('resource_type' => $type, 'description' => $description,
            'synonyms' => array_values($synonyms), 'internal_allowed' => (bool) $rule['internal_allowed'],
            'external_allowed' => (bool) $rule['external_allowed']);
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

    /** Read the dynamic destination fields emitted by FreePBX drawselects(). */
    public static function submittedFallback(array $request)
    {
        $fallback = isset($request['fallback_destination']) && is_string($request['fallback_destination'])
            ? trim($request['fallback_destination']) : '';
        if (!array_key_exists('goto0', $request)) {
            return $fallback;
        }
        $selection = $request['goto0'];
        if ($selection === '') {
            return '';
        }
        if (!is_string($selection) || !preg_match('/^[A-Za-z0-9_-]{1,80}$/D', $selection) ||
            !isset($request[$selection . '0']) || !is_string($request[$selection . '0'])) {
            throw new \InvalidArgumentException('Invalid fallback destination selection');
        }
        return trim($request[$selection . '0']);
    }

    public static function validateSecretInput($secret, $label)
    {
        if (!is_string($secret) || preg_match('/[\x00\r\n]/', $secret)) {
            throw new \InvalidArgumentException('Invalid ' . $label);
        }
        return $secret;
    }
}
