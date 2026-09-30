<?php

require_once __DIR__ . '/../../lib/AgentCrypto.php';
require_once __DIR__ . '/../../lib/AgentValidation.php';

function agent_assert($condition, $message)
{
    if (!$condition) {
        throw new \RuntimeException($message);
    }
}

function agent_reject($callback, $message)
{
    try {
        $callback();
    } catch (\InvalidArgumentException $error) {
        return;
    } catch (\RuntimeException $error) {
        return;
    }
    throw new \RuntimeException($message);
}

$oldMaster = getenv('SATELLITE_AGENT_CONFIG_KEY');
$oldOpenAI = getenv('OPENAI_API_KEY');
try {
    putenv('SATELLITE_AGENT_CONFIG_KEY=agent-test-master-key');
    putenv('OPENAI_API_KEY=environment-openai-key');
    $crypto = new AgentCrypto();

    $secret = 'private-provider-key';
    $encrypted = $crypto->encryptSecret($secret);
    agent_assert(is_string($encrypted) && strpos($encrypted, $secret) === false, 'Secret appears in ciphertext');
    agent_assert($crypto->decryptSecret($encrypted) === $secret, 'Secret round trip failed');
    agent_assert($crypto->encryptSecret($secret) !== $encrypted, 'Nonce was reused');
    agent_assert($crypto->encryptSecret('') === null, 'Empty secret should not be stored');
    agent_assert($crypto->decryptSecret(null) === '', 'Missing secret should decrypt to empty');
    agent_reject(function () use ($crypto, $encrypted) {
        $raw = base64_decode($encrypted, true);
        $raw[strlen($raw) - 1] = chr(ord($raw[strlen($raw) - 1]) ^ 1);
        $crypto->decryptSecret(base64_encode($raw));
    }, 'Tampered secret was accepted');
    agent_reject(function () use ($crypto) {
        $crypto->decryptSecret('not base64!');
    }, 'Malformed ciphertext was accepted');

    $openai = array('provider' => 'openai', 'api_key_encrypted' => null);
    agent_assert($crypto->resolveProviderApiKey($openai) === 'environment-openai-key', 'OpenAI environment fallback failed');
    $openai['api_key_encrypted'] = $encrypted;
    agent_assert($crypto->resolveProviderApiKey($openai) === $secret, 'Explicit OpenAI key lost precedence');
    agent_assert($crypto->apiKeyStatus($openai)['api_key_source'] === 'explicit', 'Explicit key status is wrong');
    $openai['api_key_encrypted'] = 'broken';
    agent_reject(function () use ($crypto, $openai) {
        $crypto->resolveProviderApiKey($openai);
    }, 'Broken explicit key silently fell back to environment');
    agent_reject(function () use ($crypto) {
        $crypto->resolveProviderApiKey(array('provider' => 'grok', 'api_key_encrypted' => null));
    }, 'Missing Grok key was accepted');

    foreach (array('foo', 'sales', 'customer-care', 'it.support', 'company:reception') as $flow) {
        agent_assert(AgentValidation::validateFlow($flow) === $flow, 'Valid flow rejected');
    }
    foreach (array("foo\r\nX-Evil: yes", 'foo bar', '<foo>', '', str_repeat('a', 129)) as $flow) {
        agent_reject(function () use ($flow) {
            AgentValidation::validateFlow($flow);
        }, 'Invalid flow accepted');
    }
    agent_assert(AgentValidation::validateProjectId('proj_ABC-123') === 'proj_ABC-123', 'Project ID rejected');
    agent_assert(AgentValidation::validateGrokPhoneNumber('+390721123456') === '+390721123456', 'Direct SIP number rejected');
    agent_reject(function () {
        AgentValidation::validateProjectId('wrong_project');
    }, 'Bad project ID accepted');
    agent_reject(function () {
        AgentValidation::validateGrokPhoneNumber('390721123456');
    }, 'Bad Direct SIP number accepted');
    agent_assert(AgentValidation::validateFallback('ext-local,203,1') === 'ext-local,203,1', 'FreePBX fallback rejected');
    agent_reject(function () {
        AgentValidation::validateFallback("ext-local,203,1\nSystem(evil)");
    }, 'Unsafe fallback accepted');
    agent_reject(function () {
        AgentValidation::validateFallback('ext-local,203');
    }, 'Incomplete fallback accepted');
    foreach (array("digest\rpassword", "digest\npassword", "digest\0password", 123) as $password) {
        agent_reject(function () use ($password) {
            AgentValidation::validateSecretInput($password, 'SIP authentication password');
        }, 'Unsafe SIP password accepted');
    }
    echo "Agent crypto and validation tests passed\n";
} finally {
    if ($oldMaster === false) {
        putenv('SATELLITE_AGENT_CONFIG_KEY');
    } else {
        putenv('SATELLITE_AGENT_CONFIG_KEY=' . $oldMaster);
    }
    if ($oldOpenAI === false) {
        putenv('OPENAI_API_KEY');
    } else {
        putenv('OPENAI_API_KEY=' . $oldOpenAI);
    }
}
