-- SPDX-License-Identifier: GPL-3.0-or-later
-- Explicit read-only PBX directory projection, rather than unrestricted DB access.
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_extension_directory AS
 SELECT CONCAT('extension:',extension) AS id, name FROM asterisk.users
 WHERE extension REGEXP '^[0-9]{1,20}$';
CREATE TABLE IF NOT EXISTS asteriskcdrdb.voice_agent_pending_calls (
 session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider ENUM('openai','grok') NOT NULL,
 binding_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 agent_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider_leg_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider_call_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 state ENUM('pending','accepted','finished') NOT NULL DEFAULT 'pending',
 expires_at TIMESTAMP(6) NOT NULL,
 UNIQUE KEY provider_session (provider,provider_call_id),
 INDEX pending_expiry (state,expires_at),
 FOREIGN KEY (run_id) REFERENCES asteriskcdrdb.voice_agent_runs(run_id)
) ENGINE=InnoDB;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (3);
