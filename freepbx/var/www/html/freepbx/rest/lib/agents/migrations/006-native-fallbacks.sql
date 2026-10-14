-- SPDX-License-Identifier: GPL-3.0-or-later
-- Keep immutable v1 documents. Only new publications use v2.
SET @voice_agent_check = (SELECT CONSTRAINT_NAME FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='asterisk' AND TABLE_NAME='voice_agent_versions' AND CHECK_CLAUSE LIKE '%contract_version%' AND CONSTRAINT_NAME<>'voice_agent_contract_check' LIMIT 1);
SET @voice_agent_ddl = IF(@voice_agent_check IS NULL, 'DO 0', CONCAT('ALTER TABLE asterisk.voice_agent_versions DROP CONSTRAINT `', @voice_agent_check, '`'));
PREPARE voice_agent_statement FROM @voice_agent_ddl;
EXECUTE voice_agent_statement;
DEALLOCATE PREPARE voice_agent_statement;
ALTER TABLE asterisk.voice_agent_versions ADD CONSTRAINT IF NOT EXISTS voice_agent_contract_check CHECK (workflow_version > 0 AND contract_version IN (1,2));
ALTER TABLE asterisk.voice_agent_agents MODIFY COLUMN synced_fallback VARCHAR(160) CHARACTER SET ascii NULL;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (6);
