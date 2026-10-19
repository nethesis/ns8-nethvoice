<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__.'/Service.php';

/** Explicit development maintenance only; never registered as an HTTP action. */
final class DevelopmentReset
{
    public const CONFIG_TABLES=['voice_agent_audit','voice_agent_drafts','voice_agent_versions','voice_agent_agents'];
    public const EVENT_TABLES=['voice_agent_transcripts','voice_agent_run_events','voice_agent_pending_calls','voice_agent_runs'];
    public function __construct(private \PDO $db, private object $native) {}

    public function inspect(): array
    {
        $tables=[];
        foreach (['asterisk'=>self::CONFIG_TABLES,'asteriskcdrdb'=>self::EVENT_TABLES] as $schema=>$names) {
            foreach ($names as $name) $tables[$schema.'.'.$name]=(int)$this->db->query("SELECT COUNT(*) FROM $schema.$name")->fetchColumn();
        }
        foreach ($this->db->query('SELECT agent_id FROM asterisk.voice_agent_agents')->fetchAll(\PDO::FETCH_COLUMN) as $id) {
            if ($id!=='receptionist' && $this->native->inUse($id)) throw new \RuntimeException('agent_in_use');
        }
        // Disabling FK checks must never orphan another component's rows.
        $references=$this->db->query("SELECT TABLE_SCHEMA,TABLE_NAME,REFERENCED_TABLE_SCHEMA,REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_NAME IS NOT NULL AND REFERENCED_TABLE_SCHEMA IN ('asterisk','asteriskcdrdb')")->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($references as $ref) {
            if (isset($tables[$ref['REFERENCED_TABLE_SCHEMA'].'.'.$ref['REFERENCED_TABLE_NAME']]) && !isset($tables[$ref['TABLE_SCHEMA'].'.'.$ref['TABLE_NAME']])) throw new \RuntimeException('external_agent_reference');
        }
        return ['tables'=>$tables,'preserves_trunks'=>true,'preserves_native_cdr'=>true];
    }

    public function clear(string $confirmation): array
    {
        if (PHP_SAPI!=='cli' || $confirmation!=='clear-development-agent-data:nethvoice57') throw new \RuntimeException('development_reset_confirmation_required');
        $this->inspect();
        if ((int)$this->db->query("SELECT GET_LOCK('voice_agent_configuration',5)")->fetchColumn()!==1) throw new \RuntimeException('configuration_busy');
        try {
            $this->inspect();
            $this->db->exec('SET FOREIGN_KEY_CHECKS=0');
            try {
                // TRUNCATE is deliberately restricted to this maintenance command.
                // Ordinary immutable-version UPDATE/DELETE triggers stay intact.
                foreach (self::EVENT_TABLES as $table) $this->db->exec('TRUNCATE TABLE asteriskcdrdb.'.$table);
                foreach (self::CONFIG_TABLES as $table) $this->db->exec('TRUNCATE TABLE asterisk.'.$table);
            } finally { $this->db->exec('SET FOREIGN_KEY_CHECKS=1'); }
            $draft=Service::receptionistDraft();$draft['conversation']['language']=$this->native->defaultLanguage();
            $this->db->beginTransaction();
            $this->db->exec("INSERT INTO asterisk.voice_agent_agents (agent_id,name,destination_id,kind,enabled,sync_status) VALUES ('receptionist','Receptionist','agent:receptionist','builtin',0,'synced')");
            $q=$this->db->prepare("INSERT INTO asterisk.voice_agent_drafts (agent_id,definition_json) VALUES ('receptionist',?)");
            $q->execute([json_encode($draft,JSON_THROW_ON_ERROR)]);
            $this->db->commit();
            if (!$this->native->apply()) throw new \RuntimeException('native_sync_failed');
            return $this->inspect()+['reset'=>true,'receptionist_enabled'=>false,'receptionist_published'=>false];
        } finally {
            if ($this->db->inTransaction()) $this->db->rollBack();
            $this->db->query("SELECT RELEASE_LOCK('voice_agent_configuration')");
        }
    }
}
