<?php

/** Persisted synchronization state for the complete Agent configuration. */
class AgentConfigurationState
{
    private $db;

    // Set the database and module adapters used by this object.
    public function __construct($db)
    {
        $this->db = $db;
    }

    /** Call in the same transaction as the configuration mutation. */
    public function bump()
    {
        $this->db->exec('UPDATE `satellite_agent_configuration_state` SET `desired_revision` = `desired_revision` + 1,
            `desired_hash` = NULL, `snapshot_revision` = NULL, `snapshot_hash` = NULL,
            `payload_encrypted` = NULL, `sync_error` = NULL WHERE `id` = 1');
        return (int) $this->status()['desired_revision'];
    }

    // Read configuration revisions, hashes and errors.
    public function status()
    {
        $statement = $this->db->prepare('SELECT `desired_revision`, `desired_hash`, `acknowledged_revision`,
            `acknowledged_hash`, `sync_error`, `snapshot_revision`, `snapshot_hash`
            FROM `satellite_agent_configuration_state` WHERE `id` = 1');
        $statement->execute();
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            throw new \RuntimeException('Agent configuration state is not installed');
        }
        $row['desired_revision'] = (int) $row['desired_revision'];
        $row['acknowledged_revision'] = (int) $row['acknowledged_revision'];
        $row['snapshot_revision'] = $row['snapshot_revision'] === null ? null : (int) $row['snapshot_revision'];
        return $row;
    }

    // Store the encrypted snapshot for the expected revision.
    public function cacheSnapshot($revision, $hash, $ciphertext)
    {
        $revision = $this->revision($revision);
        $this->assertHash($hash);
        if (!is_string($ciphertext) || $ciphertext === '') {
            throw new \InvalidArgumentException('Encrypted configuration snapshot is required');
        }
        $status = $this->status();
        if ($status['desired_revision'] !== $revision) {
            throw new \RuntimeException('Configuration changed while caching the snapshot');
        }
        if ($status['desired_hash'] !== null && !hash_equals($status['desired_hash'], $hash)) {
            throw new \RuntimeException('Configuration revision has a conflicting payload hash');
        }
        $statement = $this->db->prepare('UPDATE `satellite_agent_configuration_state` SET `desired_hash` = ?,
            `snapshot_revision` = ?, `snapshot_hash` = ?, `payload_encrypted` = ?
            WHERE `id` = 1 AND `desired_revision` = ?
            AND (`desired_hash` IS NULL OR `desired_hash` = ?)
            AND (`snapshot_hash` IS NULL OR `snapshot_hash` = ?)');
        $statement->execute(array($hash, $revision, $hash, $ciphertext, $revision, $hash, $hash));
        if ($statement->rowCount() === 0) {
            $current = $this->status();
            if ($current['desired_revision'] !== $revision || $current['snapshot_hash'] !== $hash) {
                throw new \RuntimeException('Configuration changed while caching the snapshot');
            }
        }
    }

    /** Backend only: ciphertext may contain provider credentials. */
    public function storedSnapshot()
    {
        $statement = $this->db->prepare('SELECT `snapshot_revision`, `snapshot_hash`, `payload_encrypted`
            FROM `satellite_agent_configuration_state` WHERE `id` = 1');
        $statement->execute();
        return $statement->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    // Store the hash of the desired configuration.
    public function setDesiredHash($revision, $hash)
    {
        $this->assertHash($hash);
        $status = $this->status();
        if ($status['desired_hash'] !== null && !hash_equals($status['desired_hash'], $hash)) {
            throw new \RuntimeException('Configuration revision has a conflicting payload hash');
        }
        $statement = $this->db->prepare('UPDATE `satellite_agent_configuration_state` SET `desired_hash` = ?
            WHERE `id` = 1 AND `desired_revision` = ? AND (`desired_hash` IS NULL OR `desired_hash` = ?)');
        $statement->execute(array($hash, $this->revision($revision), $hash));
        if ($statement->rowCount() === 0) {
            $current = $this->status();
            if ($current['desired_revision'] !== (int) $revision || $current['desired_hash'] !== $hash) {
                throw new \RuntimeException('Configuration changed while building the snapshot');
            }
        }
    }

    // Record the runtime acknowledgement of a configuration revision.
    public function acknowledge($revision, $hash)
    {
        $revision = $this->revision($revision);
        $this->assertHash($hash);
        $status = $this->status();
        if ($revision !== $status['desired_revision']) {
            throw new \RuntimeException('Cannot acknowledge a stale configuration revision');
        }
        if ($status['desired_hash'] !== null && !hash_equals($status['desired_hash'], $hash)) {
            throw new \RuntimeException('Configuration acknowledgement has a conflicting payload hash');
        }
        if ($status['acknowledged_revision'] === $revision && $status['acknowledged_hash'] !== null
            && !hash_equals($status['acknowledged_hash'], $hash)) {
            throw new \RuntimeException('Configuration revision has a conflicting hash');
        }
        $statement = $this->db->prepare('UPDATE `satellite_agent_configuration_state` SET `desired_hash` = ?,
            `acknowledged_revision` = ?, `acknowledged_hash` = ?, `sync_error` = NULL
            WHERE `id` = 1 AND `desired_revision` = ? AND `desired_hash` = ?');
        $statement->execute(array($hash, $revision, $hash, $revision, $hash));
        return $this->status();
    }

    // Store a safe synchronization error.
    public function recordError($error)
    {
        if (!is_string($error)) {
            throw new \InvalidArgumentException('Invalid configuration sync error');
        }
        $statement = $this->db->prepare('UPDATE `satellite_agent_configuration_state` SET `sync_error` = ? WHERE `id` = 1');
        $statement->execute(array(substr($error, 0, 500)));
    }

    // Check and return a positive configuration revision.
    private function revision($revision)
    {
        if (filter_var($revision, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1))) === false) {
            throw new \InvalidArgumentException('Invalid configuration revision');
        }
        return (int) $revision;
    }

    // Reject an invalid SHA-256 hash.
    private function assertHash($hash)
    {
        if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)) {
            throw new \InvalidArgumentException('Invalid configuration payload hash');
        }
    }
}
