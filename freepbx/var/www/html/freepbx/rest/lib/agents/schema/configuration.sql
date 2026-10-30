-- SPDX-License-Identifier: GPL-3.0-or-later
-- Fresh alpha-v8 configuration. No development database upgrades.
CREATE TABLE IF NOT EXISTS asterisk.`voice_agent_agents` (
  `agent_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(100) NOT NULL,
  `destination_id` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `revision` bigint(20) unsigned NOT NULL DEFAULT 1,
  `active_workflow_version` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `kind` enum('builtin','custom') NOT NULL DEFAULT 'custom',
  `removed` tinyint(1) NOT NULL DEFAULT 0,
  `sync_status` enum('pending','synced','error') NOT NULL DEFAULT 'pending',
  `synced_fallback` varchar(160) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`agent_id`),
  UNIQUE KEY `destination_id` (`destination_id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`revision` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asterisk.`voice_agent_audit` (
  `audit_id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `agent_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actor` varchar(100) NOT NULL,
  `action` varchar(32) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `revision` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asterisk.`voice_agent_bindings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `binding_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(100) NOT NULL,
  `provider` enum('openai','grok') NOT NULL,
  `runtime_owner` enum('builtin') NOT NULL DEFAULT 'builtin',
  `settings_json` longtext NOT NULL CHECK (json_valid(`settings_json`)),
  `secrets_encrypted` text NOT NULL,
  `revision` bigint(20) unsigned NOT NULL DEFAULT 1,
  `freepbx_trunk_id` int(10) unsigned DEFAULT NULL,
  `sync_status` enum('pending','synced','error') NOT NULL DEFAULT 'pending',
  `removed` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `binding_id` (`binding_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asterisk.`voice_agent_binding_audit` (
  `audit_id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `binding_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actor` varchar(100) NOT NULL,
  `action` varchar(32) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `revision` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asterisk.`voice_agent_builtin_tools` (
  `tool_id` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `tool_version` int(10) unsigned NOT NULL,
  `manifest_json` longtext NOT NULL CHECK (json_valid(`manifest_json`) and octet_length(`manifest_json`) <= 4096),
  PRIMARY KEY (`tool_id`,`tool_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asterisk.`voice_agent_drafts` (
  `agent_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `revision` bigint(20) unsigned NOT NULL DEFAULT 1,
  `definition_json` longtext NOT NULL CHECK (json_valid(`definition_json`) and octet_length(`definition_json`) <= 65536),
  PRIMARY KEY (`agent_id`),
  CONSTRAINT `voice_agent_drafts_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES asterisk.`voice_agent_agents` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asterisk.`voice_agent_versions` (
  `agent_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `workflow_version` int(10) unsigned NOT NULL,
  `contract_version` int(10) unsigned NOT NULL DEFAULT 8,
  `definition_json` longtext NOT NULL CHECK (json_valid(`definition_json`) and octet_length(`definition_json`) <= 65536),
  `published_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`agent_id`,`workflow_version`),
  CONSTRAINT `voice_agent_versions_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES asterisk.`voice_agent_agents` (`agent_id`),
  CONSTRAINT `voice_agent_contract_check` CHECK (`workflow_version` > 0 and `contract_version` = 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_published AS
 SELECT a.agent_id, a.destination_id, v.workflow_version, v.contract_version, v.definition_json
 FROM asterisk.voice_agent_agents a JOIN asterisk.voice_agent_versions v
 ON v.agent_id=a.agent_id AND v.workflow_version=a.active_workflow_version
 WHERE a.enabled=1 AND a.removed=0 AND a.sync_status='synced';
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_runtime_bindings AS
 SELECT b.binding_id,b.provider,b.settings_json,b.secrets_encrypted,b.freepbx_trunk_id,CONCAT('VoiceAgentTrunk_',b.id) AS trunk_name
 FROM asterisk.voice_agent_bindings b WHERE b.removed=0 AND b.sync_status='synced' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(b.settings_json,'$.execution')),'local')<>'cleverai';
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_runtime_tools AS
 SELECT tool_id,tool_version,manifest_json FROM asterisk.voice_agent_builtin_tools;
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_extension_directory AS
 SELECT CONCAT('extension:',extension) AS id,name FROM asterisk.users u
 WHERE extension REGEXP '^[0-9]{1,20}$'
 AND EXISTS (SELECT 1 FROM asterisk.userman_users m WHERE m.default_extension=u.extension);
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_versions_no_update BEFORE UPDATE ON asterisk.voice_agent_versions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable_published_version';
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_versions_no_delete BEFORE DELETE ON asterisk.voice_agent_versions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable_published_version';
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_tools_no_update BEFORE UPDATE ON asterisk.voice_agent_builtin_tools FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable_builtin_tool';
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_tools_no_delete BEFORE DELETE ON asterisk.voice_agent_builtin_tools FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable_builtin_tool';
