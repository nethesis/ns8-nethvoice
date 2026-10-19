-- Additive contract support. Configured drafts and immutable v1-v4 are untouched.
ALTER TABLE asterisk.voice_agent_versions DROP CONSTRAINT IF EXISTS voice_agent_contract_check;
ALTER TABLE asterisk.voice_agent_versions ADD CONSTRAINT IF NOT EXISTS voice_agent_contract_check CHECK (workflow_version > 0 AND contract_version IN (1,2,3,4,5));
UPDATE asterisk.voice_agent_drafts d JOIN asterisk.voice_agent_agents a ON a.agent_id=d.agent_id SET d.definition_json=JSON_SET(d.definition_json,'$.conversation.model',NULL,'$.conversation.options',NULL) WHERE a.agent_id='receptionist' AND a.revision=1 AND a.active_workflow_version IS NULL AND a.enabled=0 AND JSON_TYPE(JSON_EXTRACT(d.definition_json,'$.provider_binding_id'))='NULL' AND JSON_UNQUOTE(JSON_EXTRACT(d.definition_json,'$.conversation.instructions'))='' AND JSON_EXTRACT(d.definition_json,'$.conversation.model') IS NULL;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (10);
