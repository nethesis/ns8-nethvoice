<?php
require_once __DIR__ . '/AgentProfileRepository.php';
require_once __DIR__ . '/AgentTrunkRepository.php';
require_once __DIR__ . '/AgentContextSource.php';
require_once __DIR__ . '/AgentSatelliteClient.php';
require_once __DIR__ . '/AgentCrypto.php';
require_once __DIR__ . '/AgentMonitoringRepository.php';
/** Produces immutable, encrypted retry snapshots and a separately refreshed PBX context. */
class AgentConfigurationBuilder
{
    private $freepbx;
    private $state;
    private $client;
    // Set the database and module adapters used by this object.
    public function __construct($freepbx, $client = null)
    {
        $this->freepbx = $freepbx;
        $this->state = new AgentConfigurationState($freepbx->Database);
        $this->client = $client ?: new AgentSatelliteClient();
    }
    // Read configuration revisions, hashes and errors.
    public function status() { return $this->state->status(); }

    // Encode ordered configuration data for a stable hash.
    public static function canonicalJson($value)
    {
        return json_encode(self::ordered($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR);
    }
    // Sort object fields while preserving list order.
    private static function ordered($value)
    {
        if (is_object($value)) {
            $fields = get_object_vars($value); ksort($fields, SORT_STRING);
            foreach ($fields as &$field) { $field = self::ordered($field); }
            return (object) $fields;
        }
        if (is_array($value)) {
            if ($value && array_keys($value) !== range(0, count($value) - 1)) {
                ksort($value, SORT_STRING);
                foreach ($value as &$field) { $field = self::ordered($field); }
                return (object) $value;
            }
            return array_map(array(__CLASS__, 'ordered'), $value);
        }
        return $value;
    }

    // Build or reuse the encrypted runtime configuration snapshot.
    public function envelope($attempt = 0)
    {
        $status = $this->state->status();
        $cached = $this->state->storedSnapshot();
        $crypto = new AgentCrypto();
        if ($cached && (int) $cached['snapshot_revision'] === $status['desired_revision'] && $cached['payload_encrypted']) {
            $envelope = json_decode($crypto->decryptSecret($cached['payload_encrypted']));
            if ($envelope && hash_equals($cached['snapshot_hash'], hash('sha256', self::canonicalJson($envelope->payload)))) {
                return $envelope;
            }
            throw new \RuntimeException('Stored Agent configuration snapshot is invalid');
        }
        $db = $this->freepbx->Database;
        $profiles = array();
        foreach ((new AgentProfileRepository($db))->listAll() as $profile) {
            $item = array();
            foreach (array('flow', 'model', 'voice', 'language', 'greeting', 'prompt', 'fallback_destination') as $field) {
                $item[$field] = $field === 'fallback_destination' ? $profile[$field] : (string) $profile[$field];
            }
            $item['trunk_id'] = empty($profile['trunk_id']) ? null : (string) $profile['trunk_id'];
            $item['max_call_duration_seconds'] = (int) $profile['max_call_duration_seconds'];
            foreach (array('permissions', 'tools', 'company', 'calendar_services') as $field) {
                $item[$field] = (object) $profile[$field];
            }
            // PDO may decode selected time-condition IDs as integers.
            $item['calendar_services'] = (object) array_map('strval', $profile['calendar_services']);
            $profiles[$profile['profile_key']] = (object) $item;
        }
        $bindings = array();
        $repository = new AgentTrunkRepository($db);
        foreach ($repository->listAll() as $public) {
            if ($public['runtime_owner'] !== 'builtin') { continue; }
            $trunk = $repository->getStoredById($public['id']);
            $bindings[] = array('id' => (string) $trunk['id'], 'provider' => $trunk['provider'],
                'runtime_owner' => 'builtin', 'trunk_name' => $trunk['freepbx_trunk_name'],
                'provider_user' => $trunk['provider'] === 'openai' ? $trunk['openai_project_id'] : $trunk['grok_phone_number'],
                'provider_host' => $trunk['provider'] === 'openai' ? 'sip.api.openai.com' : 'sip.voice.x.ai',
                'api_key' => $repository->resolveProviderApiKey($trunk),
                'webhook_secret' => $repository->resolveWebhookSigningSecret($trunk));
        }
        $destinations = array();
        foreach ((new AgentDestinationRepository($db))->listAll() as $row) {
            if ($row['agent_type'] === 'workflow' && empty($row['enabled'])) { continue; }
            $key = $row['agent_type'] === 'builtin_internal' ? 'internal' : ($row['agent_type'] === 'builtin_external' ? 'external' : null);
            $destinations[] = array('id' => (int) $row['id'], 'agent_type' => $row['agent_type'],
                'profile_key' => $key, 'fallback_destination' => $row['fallback_destination']);
            if ($row['agent_type'] === 'workflow') {
                $index = count($destinations) - 1;
                $destinations[$index]['workflow_agent_id'] = $row['workflow_agent_id'];
                $destinations[$index]['workflow_version'] = (int) $row['workflow_version'];
            }
        }
        $source = new AgentContextSource($this->freepbx);
        $payload = (object) array('profiles' => (object) $profiles, 'bindings' => $bindings,
            'destinations' => $destinations, 'directory' => $source->directory(), 'calendars' => $source->calendars(),
            'monitoring' => (new AgentMonitoringRepository($db))->policy());
        $envelope = (object) array('schema_version' => 1, 'revision' => $status['desired_revision'],
            'payload_hash' => hash('sha256', self::canonicalJson($payload)), 'payload' => $payload);
        try {
            $this->state->cacheSnapshot($envelope->revision, $envelope->payload_hash,
                $crypto->encryptSecret(self::canonicalJson($envelope)));
        } catch (\RuntimeException $conflict) {
            // A concurrent builder may have won the atomic cache write. Reuse
            // its exact payload rather than regenerate observation timestamps.
            if ($attempt < 2) { return $this->envelope($attempt + 1); }
            throw $conflict;
        }
        return $envelope;
    }

    // Send the desired configuration and record its acknowledgement.
    public function synchronize()
    {
        try {
            $envelope = $this->envelope();
            $ack = $this->client->request('PUT', '/configuration', $envelope);
            if (!isset($ack['revision'], $ack['payload_hash']) || (int) $ack['revision'] !== $envelope->revision
                || !hash_equals($envelope->payload_hash, $ack['payload_hash'])) {
                throw new \RuntimeException('Satellite Agent did not acknowledge this configuration');
            }
            $source = new AgentContextSource($this->freepbx);
            $this->client->request('PUT', '/context', array('payload_hash' => $ack['payload_hash'], 'directory' => $source->directory(), 'calendars' => $source->calendars()));
            $this->state->acknowledge($ack['revision'], $ack['payload_hash']);
            return $ack;
        } catch (\Throwable $error) {
            // Do not persist provider exceptions or SQL text containing secrets.
            $this->state->recordError('Agent configuration synchronization failed; check local Satellite readiness.');
            throw new \RuntimeException('Agent configuration was saved, but synchronization failed.');
        }
    }
}
