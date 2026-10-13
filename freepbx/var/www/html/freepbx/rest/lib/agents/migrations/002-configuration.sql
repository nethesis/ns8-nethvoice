-- SPDX-License-Identifier: GPL-3.0-or-later
ALTER TABLE asterisk.voice_agent_agents ADD COLUMN IF NOT EXISTS kind ENUM('builtin','custom') NOT NULL DEFAULT 'custom';
ALTER TABLE asterisk.voice_agent_agents ADD COLUMN IF NOT EXISTS removed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE asterisk.voice_agent_agents ADD COLUMN IF NOT EXISTS sync_status ENUM('pending','synced','error') NOT NULL DEFAULT 'pending';
ALTER TABLE asterisk.voice_agent_agents ADD COLUMN IF NOT EXISTS synced_fallback VARCHAR(64) CHARACTER SET ascii NULL;
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_bindings (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 binding_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL,
 provider ENUM('openai','grok') NOT NULL,
 runtime_owner ENUM('builtin') NOT NULL DEFAULT 'builtin',
 settings_json LONGTEXT NOT NULL CHECK (JSON_VALID(settings_json)),
 secrets_encrypted TEXT NOT NULL,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
 freepbx_trunk_id INT UNSIGNED NULL,
 sync_status ENUM('pending','synced','error') NOT NULL DEFAULT 'pending',
 removed BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_binding_audit (
 audit_id CHAR(36) CHARACTER SET ascii PRIMARY KEY,
 binding_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor VARCHAR(100) NOT NULL,
 action VARCHAR(32) CHARACTER SET ascii NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO asterisk.voice_agent_agents (agent_id,name,destination_id,kind)
 VALUES ('internal','Internal','agent:internal','builtin'), ('external','External','agent:external','builtin');
INSERT IGNORE INTO asterisk.voice_agent_drafts (agent_id,definition_json)
 SELECT agent_id, '{"provider_binding_id":null,"conversation":{"language":"en","voice":"","greeting":"","instructions":""},"enabled_tools":[],"approved_destination_ids":[],"fallback_destination_id":null,"max_call_duration_seconds":600}'
 FROM asterisk.voice_agent_agents WHERE kind='builtin';
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_published AS
 SELECT a.agent_id, a.destination_id, v.workflow_version, v.contract_version, v.definition_json
 FROM asterisk.voice_agent_agents a JOIN asterisk.voice_agent_versions v
 ON v.agent_id=a.agent_id AND v.workflow_version=a.active_workflow_version
 WHERE a.enabled=1 AND a.removed=0 AND a.sync_status='synced';
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_runtime_bindings AS
 SELECT b.binding_id,b.provider,b.settings_json,b.secrets_encrypted,b.freepbx_trunk_id,CONCAT('VoiceAgentTrunk_',b.id) AS trunk_name
 FROM asterisk.voice_agent_bindings b WHERE b.removed=0 AND b.sync_status='synced';
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (2);
