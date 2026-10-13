-- SPDX-License-Identifier: GPL-3.0-or-later
ALTER TABLE asteriskcdrdb.voice_agent_run_events MODIFY COLUMN event_type ENUM('admitted','completed','fallback','failed','interrupted','tool_denied','transfer_requested','transfer_committed','transfer_failed','transfer_uncertain','tool_completed','tool_failed') NOT NULL;
ALTER TABLE asteriskcdrdb.voice_agent_run_events ADD COLUMN IF NOT EXISTS tool_id ENUM('directory.find_destinations','telephony.transfer') NULL;
ALTER TABLE asteriskcdrdb.voice_agent_run_events ADD COLUMN IF NOT EXISTS destination_id VARCHAR(64) CHARACTER SET ascii NULL;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (4);
