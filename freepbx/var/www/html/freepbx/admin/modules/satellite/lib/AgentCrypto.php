<?php

/** Encrypts module secrets with the per-instance NS8 configuration key. */
class AgentCrypto
{
    // Derive the secretbox key from the module configuration key.
    private function key()
    {
        $master = getenv('SATELLITE_AGENT_CONFIG_KEY');
        if (!is_string($master) || $master === '') {
            throw new \RuntimeException('SATELLITE_AGENT_CONFIG_KEY is not configured');
        }

        return hash('sha256', $master, true);
    }

    // Encrypt a secret with the module configuration key.
    public function encryptSecret($plaintext)
    {
        if ($plaintext === null || $plaintext === '') {
            return null;
        }
        if (!is_string($plaintext)) {
            throw new \InvalidArgumentException('Secret must be a string');
        }

        $key = $this->key();
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return base64_encode($nonce . sodium_crypto_secretbox($plaintext, $nonce, $key));
    }

    // Decrypt a stored secret with the module configuration key.
    public function decryptSecret($encoded)
    {
        if ($encoded === null || $encoded === '') {
            return '';
        }
        if (!is_string($encoded)) {
            throw new \InvalidArgumentException('Invalid encrypted secret');
        }

        $key = $this->key();
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + SODIUM_CRYPTO_SECRETBOX_MACBYTES) {
            throw new \RuntimeException('Invalid encrypted secret');
        }

        $nonce = substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plaintext = sodium_crypto_secretbox_open($cipher, $nonce, $key);
        if ($plaintext === false) {
            throw new \RuntimeException('Unable to decrypt secret');
        }
        return $plaintext;
    }

    // Return the explicit or permitted environment provider key.
    public function resolveProviderApiKey(array $trunk)
    {
        if (isset($trunk['provider']) && $trunk['provider'] === 'openai') {
            if (!empty($trunk['api_key_encrypted'])) {
                return $this->decryptSecret($trunk['api_key_encrypted']);
            }
            $key = getenv('OPENAI_API_KEY');
            if (is_string($key) && $key !== '') {
                return $key;
            }
            throw new \RuntimeException('No OpenAI API key configured for this trunk');
        }
        if (isset($trunk['provider']) && $trunk['provider'] === 'grok') {
            if (!empty($trunk['api_key_encrypted'])) {
                return $this->decryptSecret($trunk['api_key_encrypted']);
            }
            throw new \RuntimeException('An API key is required for Grok');
        }
        throw new \InvalidArgumentException('Unsupported provider');
    }

    // Return whether a provider key is configured without exposing it.
    public function apiKeyStatus(array $trunk)
    {
        if (!empty($trunk['api_key_encrypted'])) {
            return array('api_key_configured' => true, 'api_key_source' => 'explicit');
        }
        $environment = isset($trunk['provider']) && $trunk['provider'] === 'openai'
            && getenv('OPENAI_API_KEY') !== false && getenv('OPENAI_API_KEY') !== '';
        return array(
            'api_key_configured' => $environment,
            'api_key_source' => $environment ? 'environment' : null,
        );
    }
}
