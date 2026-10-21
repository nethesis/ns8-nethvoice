-- SPDX-License-Identifier: GPL-3.0-or-later
-- Additive monitoring v2, independent of immutable published agent contracts.
ALTER TABLE asteriskcdrdb.voice_agent_runs
 ADD COLUMN IF NOT EXISTS monitoring_version TINYINT UNSIGNED NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS provider VARCHAR(16) CHARACTER SET ascii NULL,
 ADD COLUMN IF NOT EXISTS adapter VARCHAR(16) CHARACTER SET ascii NULL,
 ADD COLUMN IF NOT EXISTS model VARCHAR(128) CHARACTER SET ascii NULL,
 ADD COLUMN IF NOT EXISTS duration_ms INT UNSIGNED NULL,
 ADD COLUMN IF NOT EXISTS setup_duration_ms INT UNSIGNED NULL,
 ADD COLUMN IF NOT EXISTS first_output_ms INT UNSIGNED NULL,
 ADD COLUMN IF NOT EXISTS trace_status ENUM('legacy','recording','complete','partial') NOT NULL DEFAULT 'legacy',
 ADD COLUMN IF NOT EXISTS usage_json VARCHAR(1024) CHARACTER SET ascii NULL,
 ADD COLUMN IF NOT EXISTS usage_complete BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP(6) NULL,
 ADD INDEX IF NOT EXISTS runs_agent_started (agent_id,started_at,run_id),
 ADD INDEX IF NOT EXISTS runs_trace_status (trace_status,monitoring_version,started_at),
 ADD INDEX IF NOT EXISTS runs_outcome_started (outcome,started_at,run_id),
 ADD INDEX IF NOT EXISTS runs_provider_started (provider,adapter,started_at,run_id);
ALTER TABLE asteriskcdrdb.voice_agent_run_events
 MODIFY COLUMN event_type ENUM('admitted','provider_connected','media_connected','response_completed','completed','fallback','failed','interrupted','tool_started','tool_completed','tool_failed','tool_denied','transfer_requested','transfer_committed','transfer_failed','transfer_uncertain','trace_started','trace_finished','trace_gap','usage_snapshot','provider_output','transcription_failed') NOT NULL,
 ADD COLUMN IF NOT EXISTS monitoring_version TINYINT UNSIGNED NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS span_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD COLUMN IF NOT EXISTS parent_span_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD COLUMN IF NOT EXISTS phase VARCHAR(32) CHARACTER SET ascii NULL,
 ADD COLUMN IF NOT EXISTS status ENUM('running','completed','failed','cancelled') NULL,
 ADD COLUMN IF NOT EXISTS elapsed_ms INT UNSIGNED NULL,
 ADD COLUMN IF NOT EXISTS duration_ms INT UNSIGNED NULL,
 ADD COLUMN IF NOT EXISTS http_status SMALLINT UNSIGNED NULL,
 ADD COLUMN IF NOT EXISTS provider_code VARCHAR(64) CHARACTER SET ascii NULL,
 ADD INDEX IF NOT EXISTS events_tool (tool_id,run_id),
 ADD INDEX IF NOT EXISTS events_phase (phase,run_id);
CREATE TABLE IF NOT EXISTS asteriskcdrdb.voice_agent_metric_hours (
 hour_start TIMESTAMP NOT NULL,
 agent_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider VARCHAR(16) CHARACTER SET ascii NOT NULL,
 adapter VARCHAR(16) CHARACTER SET ascii NOT NULL,
 metric VARCHAR(32) CHARACTER SET ascii NOT NULL,
 dimension VARCHAR(64) CHARACTER SET ascii NOT NULL DEFAULT '',
 result VARCHAR(64) CHARACTER SET ascii NOT NULL DEFAULT '',
 bucket INT UNSIGNED NOT NULL DEFAULT 0,
 samples BIGINT UNSIGNED NOT NULL DEFAULT 0,
 total DECIMAL(26,3) UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(hour_start,agent_id,provider,adapter,metric,dimension,result,bucket),
 INDEX metrics_agent_hour(agent_id,hour_start)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS asteriskcdrdb.voice_agent_runtime_health (
 singleton TINYINT UNSIGNED PRIMARY KEY CHECK(singleton=1),
 observed_at TIMESTAMP(6) NOT NULL,
 ari_connected BOOLEAN NOT NULL,
 active_calls SMALLINT UNSIGNED NOT NULL,
 degraded BOOLEAN NOT NULL,
 spool_writable BOOLEAN NOT NULL DEFAULT TRUE,
 queue_depth INT UNSIGNED NOT NULL,
 pending_bytes INT UNSIGNED NOT NULL,
 oldest_pending_seconds INT UNSIGNED NOT NULL,
 dropped BIGINT UNSIGNED NOT NULL,
 retries BIGINT UNSIGNED NOT NULL,
 last_write_at TIMESTAMP(6) NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO asterisk.voice_agent_schema(version) VALUES(14);
