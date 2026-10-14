-- SPDX-License-Identifier: GPL-3.0-or-later
-- Historical publications remain unchanged. Content capture is opt-in in v4.
ALTER TABLE asterisk.voice_agent_versions DROP CONSTRAINT IF EXISTS voice_agent_contract_check;
ALTER TABLE asterisk.voice_agent_versions ADD CONSTRAINT IF NOT EXISTS voice_agent_contract_check CHECK (workflow_version > 0 AND contract_version IN (1,2,3,4));
ALTER TABLE asteriskcdrdb.voice_agent_run_events ADD COLUMN IF NOT EXISTS result_count SMALLINT UNSIGNED NULL;
ALTER TABLE asteriskcdrdb.voice_agent_run_events MODIFY COLUMN event_type ENUM('admitted','provider_connected','media_connected','response_completed','completed','fallback','failed','interrupted','tool_started','tool_completed','tool_failed','tool_denied','transfer_requested','transfer_committed','transfer_failed','transfer_uncertain','transcription_failed') NOT NULL;
CREATE TABLE IF NOT EXISTS asteriskcdrdb.voice_agent_transcripts (
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 position SMALLINT UNSIGNED NOT NULL,
 content_encrypted TEXT CHARACTER SET ascii NOT NULL,
 occurred_at TIMESTAMP(6) NOT NULL,
 expires_at TIMESTAMP NOT NULL,
 FOREIGN KEY (run_id) REFERENCES asteriskcdrdb.voice_agent_runs(run_id),
 INDEX transcript_run (run_id,position,event_id),
 INDEX transcript_expiry (expires_at),
 CHECK (position BETWEEN 1 AND 2048 AND OCTET_LENGTH(content_encrypted) <= 24000)
) ENGINE=InnoDB;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (9);
