-- SPDX-License-Identifier: GPL-3.0-or-later
-- Current monitoring format, with durable delivery and encrypted transcripts.
CREATE TABLE IF NOT EXISTS asteriskcdrdb.`voice_agent_runs` (
  `run_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `agent_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `workflow_version` int(10) unsigned NOT NULL,
  `linkedid` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `provider_call_id` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `started_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `ended_at` timestamp(6) NULL DEFAULT NULL,
  `outcome` enum('running','completed','fallback','failed','interrupted','transferred','ended_by_agent') NOT NULL DEFAULT 'running',
  `error_code` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `retention_until` timestamp NOT NULL,
  `monitoring_version` tinyint(3) unsigned NOT NULL DEFAULT 2 CHECK (`monitoring_version` = 2),
  `provider` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `adapter` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `model` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `duration_ms` int(10) unsigned DEFAULT NULL,
  `setup_duration_ms` int(10) unsigned DEFAULT NULL,
  `first_output_ms` int(10) unsigned DEFAULT NULL,
  `trace_status` enum('recording','complete','partial') NOT NULL DEFAULT 'recording',
  `usage_json` varchar(1024) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `usage_complete` tinyint(1) NOT NULL DEFAULT 0,
  `deadline_at` timestamp(6) NULL DEFAULT NULL,
  PRIMARY KEY (`run_id`),
  KEY `runs_started` (`started_at`,`run_id`),
  KEY `runs_agent_started` (`agent_id`,`started_at`,`run_id`),
  KEY `runs_trace_status` (`trace_status`,`monitoring_version`,`started_at`),
  KEY `runs_outcome_started` (`outcome`,`started_at`,`run_id`),
  KEY `runs_provider_started` (`provider`,`adapter`,`started_at`,`run_id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`workflow_version` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asteriskcdrdb.`voice_agent_metric_hours` (
  `hour_start` timestamp NOT NULL,
  `agent_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `adapter` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `metric` varchar(32) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `dimension` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '',
  `result` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '',
  `bucket` int(10) unsigned NOT NULL DEFAULT 0,
  `samples` bigint(20) unsigned NOT NULL DEFAULT 0,
  `total` decimal(26,3) unsigned NOT NULL DEFAULT 0.000,
  PRIMARY KEY (`hour_start`,`agent_id`,`provider`,`adapter`,`metric`,`dimension`,`result`,`bucket`),
  KEY `metrics_agent_hour` (`agent_id`,`hour_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asteriskcdrdb.`voice_agent_pending_calls` (
  `session_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `run_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider` enum('openai','grok') NOT NULL,
  `binding_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `agent_id` varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_leg_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_call_id` varchar(128) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `state` enum('pending','accepted','finished') NOT NULL DEFAULT 'pending',
  `expires_at` timestamp(6) NOT NULL,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `provider_session` (`provider`,`provider_call_id`),
  KEY `pending_expiry` (`state`,`expires_at`),
  KEY `run_id` (`run_id`),
  CONSTRAINT `voice_agent_pending_calls_ibfk_1` FOREIGN KEY (`run_id`) REFERENCES asteriskcdrdb.`voice_agent_runs` (`run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asteriskcdrdb.`voice_agent_run_events` (
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `run_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_type` enum('admitted','provider_connected','media_connected','response_completed','completed','fallback','failed','interrupted','tool_started','tool_completed','tool_failed','tool_denied','transfer_requested','transfer_committed','transfer_failed','transfer_uncertain','trace_started','trace_finished','trace_gap','usage_snapshot','provider_output','transcription_failed') NOT NULL,
  `occurred_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `error_code` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `tool_id` enum('pbx.find_destinations','pbx.transfer','pbx.find_recent_callers','telephony.hangup') DEFAULT NULL,
  `destination_id` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `result_count` smallint(5) unsigned DEFAULT NULL,
  `monitoring_version` tinyint(3) unsigned NOT NULL DEFAULT 2 CHECK (`monitoring_version` = 2),
  `span_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `parent_span_id` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `phase` varchar(32) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `status` enum('running','completed','failed','cancelled') DEFAULT NULL,
  `elapsed_ms` int(10) unsigned DEFAULT NULL,
  `duration_ms` int(10) unsigned DEFAULT NULL,
  `http_status` smallint(5) unsigned DEFAULT NULL,
  `provider_code` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `events_run` (`run_id`,`occurred_at`,`event_id`),
  KEY `events_tool` (`tool_id`,`run_id`),
  KEY `events_phase` (`phase`,`run_id`),
  CONSTRAINT `voice_agent_run_events_ibfk_1` FOREIGN KEY (`run_id`) REFERENCES asteriskcdrdb.`voice_agent_runs` (`run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asteriskcdrdb.`voice_agent_runtime_health` (
  `singleton` tinyint(3) unsigned NOT NULL CHECK (`singleton` = 1),
  `observed_at` timestamp(6) NOT NULL,
  `ari_connected` tinyint(1) NOT NULL,
  `active_calls` smallint(5) unsigned NOT NULL,
  `degraded` tinyint(1) NOT NULL,
  `spool_writable` tinyint(1) NOT NULL DEFAULT 1,
  `queue_depth` int(10) unsigned NOT NULL,
  `pending_bytes` int(10) unsigned NOT NULL,
  `oldest_pending_seconds` int(10) unsigned NOT NULL,
  `dropped` bigint(20) unsigned NOT NULL,
  `retries` bigint(20) unsigned NOT NULL,
  `last_write_at` timestamp(6) NULL DEFAULT NULL,
  PRIMARY KEY (`singleton`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS asteriskcdrdb.`voice_agent_transcripts` (
  `event_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `run_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` smallint(5) unsigned NOT NULL,
  `content_encrypted` text CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `occurred_at` timestamp(6) NOT NULL,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`event_id`),
  KEY `transcript_run` (`run_id`,`position`,`event_id`),
  KEY `transcript_expiry` (`expires_at`),
  CONSTRAINT `voice_agent_transcripts_ibfk_1` FOREIGN KEY (`run_id`) REFERENCES asteriskcdrdb.`voice_agent_runs` (`run_id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`position` between 1 and 2048 and octet_length(`content_encrypted`) <= 24000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
