-- SPDX-License-Identifier: GPL-3.0-or-later
-- Content-free call phases make SIP and conversation failures distinguishable.
ALTER TABLE asteriskcdrdb.voice_agent_run_events MODIFY COLUMN event_type ENUM('admitted','provider_connected','media_connected','response_completed','completed','fallback','failed','interrupted','tool_started','tool_completed','tool_failed','tool_denied','transfer_requested','transfer_committed','transfer_failed','transfer_uncertain') NOT NULL;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (7);
