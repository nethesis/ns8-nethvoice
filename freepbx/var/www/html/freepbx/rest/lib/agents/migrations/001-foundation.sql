-- SPDX-License-Identifier: GPL-3.0-or-later
-- New namespace avoids adopting the legacy module-owned configuration tables.
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_schema (
 version INT UNSIGNED PRIMARY KEY, installed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_agents (
 agent_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 destination_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
 active_workflow_version INT UNSIGNED NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CHECK (revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_drafts (
 agent_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
 definition_json LONGTEXT NOT NULL CHECK (JSON_VALID(definition_json) AND OCTET_LENGTH(definition_json) <= 65536),
 FOREIGN KEY (agent_id) REFERENCES asterisk.voice_agent_agents(agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_versions (
 agent_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 workflow_version INT UNSIGNED NOT NULL,
 contract_version INT UNSIGNED NOT NULL DEFAULT 1,
 definition_json LONGTEXT NOT NULL CHECK (JSON_VALID(definition_json) AND OCTET_LENGTH(definition_json) <= 65536),
 published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (agent_id, workflow_version),
 FOREIGN KEY (agent_id) REFERENCES asterisk.voice_agent_agents(agent_id),
 CHECK (workflow_version > 0 AND contract_version = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_audit (
 audit_id CHAR(36) CHARACTER SET ascii PRIMARY KEY,
 agent_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor VARCHAR(100) NOT NULL,
 action VARCHAR(32) CHARACTER SET ascii NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_published AS
 SELECT a.agent_id, a.destination_id, v.workflow_version, v.contract_version, v.definition_json
 FROM asterisk.voice_agent_agents a JOIN asterisk.voice_agent_versions v
 ON v.agent_id = a.agent_id AND v.workflow_version = a.active_workflow_version
 WHERE a.enabled = 1;
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_versions_no_update
 BEFORE UPDATE ON asterisk.voice_agent_versions FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'immutable_published_version';
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_versions_no_delete
 BEFORE DELETE ON asterisk.voice_agent_versions FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'immutable_published_version';
CREATE TABLE IF NOT EXISTS asteriskcdrdb.voice_agent_runs (
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 agent_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 workflow_version INT UNSIGNED NOT NULL,
 linkedid VARCHAR(128) CHARACTER SET ascii NULL,
 provider_call_id VARCHAR(128) CHARACTER SET ascii NULL,
 started_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 ended_at TIMESTAMP(6) NULL,
 outcome ENUM('running','completed','fallback','failed','interrupted','transferred') NOT NULL DEFAULT 'running',
 error_code VARCHAR(64) CHARACTER SET ascii NULL,
 retention_until TIMESTAMP NOT NULL,
 INDEX runs_started (started_at, run_id),
 CHECK (workflow_version > 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS asteriskcdrdb.voice_agent_run_events (
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_type ENUM('admitted','completed','fallback','failed','interrupted','tool_denied','transfer_requested','transfer_committed','transfer_failed','transfer_uncertain') NOT NULL,
 occurred_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 error_code VARCHAR(64) CHARACTER SET ascii NULL,
 FOREIGN KEY (run_id) REFERENCES asteriskcdrdb.voice_agent_runs(run_id),
 INDEX events_run (run_id, occurred_at, event_id)
) ENGINE=InnoDB;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (1);
