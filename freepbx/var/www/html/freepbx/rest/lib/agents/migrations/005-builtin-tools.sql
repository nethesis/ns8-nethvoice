-- SPDX-License-Identifier: GPL-3.0-or-later
CREATE TABLE IF NOT EXISTS asterisk.voice_agent_builtin_tools (
 tool_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 tool_version INT UNSIGNED NOT NULL,
 manifest_json LONGTEXT NOT NULL CHECK (JSON_VALID(manifest_json) AND OCTET_LENGTH(manifest_json)<=4096),
 PRIMARY KEY (tool_id,tool_version)
) ENGINE=InnoDB;
INSERT IGNORE INTO asterisk.voice_agent_builtin_tools VALUES ('directory.find_destinations',1,'{"id":"directory.find_destinations","version":1,"name":"Find approved extensions","wire_name":"nv_find_destinations_v1","description":"Find approved extensions by name or number.","input_schema":{"type":"object","properties":{"query":{"type":"string","maxLength":100}},"additionalProperties":false}}');
INSERT IGNORE INTO asterisk.voice_agent_builtin_tools VALUES ('telephony.transfer',1,'{"id":"telephony.transfer","version":1,"name":"Transfer to an approved extension","wire_name":"nv_transfer_v1","description":"Transfer the caller to an approved extension ID.","input_schema":{"type":"object","properties":{"destination_id":{"type":"string"}},"required":["destination_id"],"additionalProperties":false}}');
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_tools_no_update BEFORE UPDATE ON asterisk.voice_agent_builtin_tools FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable_builtin_tool';
CREATE TRIGGER IF NOT EXISTS asterisk.voice_agent_tools_no_delete BEFORE DELETE ON asterisk.voice_agent_builtin_tools FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='immutable_builtin_tool';
CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_runtime_tools AS SELECT tool_id,tool_version,manifest_json FROM asterisk.voice_agent_builtin_tools WHERE tool_version=1;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (5);
