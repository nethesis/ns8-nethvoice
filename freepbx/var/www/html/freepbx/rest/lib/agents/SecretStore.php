<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__.'/Preview.php';

/** Adapted from legacy AgentCrypto: one per-instance NS8 secretbox key. */
final class SecretStore
{
    private function key(): string
    {
        $master = Preview::value('SATELLITE_AGENT_CONFIG_KEY');
        if (!is_string($master) || $master === '') throw new \RuntimeException('encryption_unavailable', 503);
        return hash('sha256', $master, true);
    }
    public function encryptSecret(?string $plaintext): ?string
    {
        if ($plaintext === null || $plaintext === '') return null;
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return base64_encode($nonce . sodium_crypto_secretbox($plaintext, $nonce, $this->key()));
    }
    public function encryptRuntimeCredentials(array $secrets): string
    {
        $credentials=array_intersect_key($secrets,['api_key'=>true,'webhook_secret'=>true]);
        return $this->encryptSecret(json_encode((object)$credentials,JSON_THROW_ON_ERROR));
    }
    public function webhookKeyGeneration(string $provider,string $apiKey): string
    {
        return hash_hmac('sha256',"voice-agent-webhook-key\0".$provider."\0".$apiKey,$this->key());
    }
    public function decryptSecret(?string $encoded): string
    {
        if (!$encoded) return '';
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + SODIUM_CRYPTO_SECRETBOX_MACBYTES) {
            throw new \RuntimeException('invalid_encrypted_secret', 503);
        }
        $plaintext = sodium_crypto_secretbox_open(substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $this->key());
        if ($plaintext === false) throw new \RuntimeException('encryption_unavailable', 503);
        return $plaintext;
    }
}
