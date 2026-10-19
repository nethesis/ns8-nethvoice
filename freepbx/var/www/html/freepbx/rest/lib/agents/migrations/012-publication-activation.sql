-- Published editable agents are available to native routes without a second switch.
-- Legacy retired/read-only identities and removed agents retain their prior state.
START TRANSACTION;
INSERT INTO asterisk.voice_agent_audit (audit_id,agent_id,actor,action,revision)
 SELECT UUID(),a.agent_id,'schema-migration','publication_activated',a.revision+1
 FROM asterisk.voice_agent_agents a JOIN asterisk.voice_agent_versions v
 ON v.agent_id=a.agent_id AND v.workflow_version=a.active_workflow_version
 WHERE a.removed=0 AND a.enabled=0 AND v.contract_version>=5;
UPDATE asterisk.voice_agent_agents a JOIN asterisk.voice_agent_versions v
 ON v.agent_id=a.agent_id AND v.workflow_version=a.active_workflow_version
 SET a.enabled=1,a.revision=a.revision+1,a.sync_status='pending'
 WHERE a.removed=0 AND a.enabled=0 AND v.contract_version>=5;
INSERT IGNORE INTO asterisk.voice_agent_schema (version) VALUES (12);
COMMIT;
