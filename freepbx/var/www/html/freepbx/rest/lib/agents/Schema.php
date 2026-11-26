<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__.'/ReceptionistDefaults.php';
require_once __DIR__.'/RecentCallerViews.php';

final class Schema
{
    /** MariaDB DDL commits implicitly: each statement is repeatable after interruption. */
    public static function install(\PDO $db): void
    {
        if ((int)$db->query("SELECT GET_LOCK('voice_agent_installation', 30)")->fetchColumn() !== 1) {
            throw new \RuntimeException('schema_busy');
        }
        try {
            $version=self::version($db);
            if ($version<1) {
                $db->exec("CREATE TABLE IF NOT EXISTS asterisk.voice_agent_preview_schema (
                    singleton TINYINT UNSIGNED PRIMARY KEY CHECK(singleton=1),
                    schema_version SMALLINT UNSIGNED NOT NULL
                ) ENGINE=InnoDB");
                $db->exec("INSERT IGNORE INTO asterisk.voice_agent_preview_schema VALUES (1,0)");
                foreach (['configuration','execution'] as $schema) {
                    foreach (explode(';',file_get_contents(__DIR__.'/schema/'.$schema.'.sql')) as $statement) {
                        if (trim($statement)!=='') $db->exec($statement);
                    }
                }
                self::seed($db);
                $db->exec("UPDATE asterisk.voice_agent_preview_schema SET schema_version=1 WHERE singleton=1");
            }
            if ($version<2) {
                $db->exec("ALTER TABLE asterisk.voice_agent_bindings ADD COLUMN IF NOT EXISTS webhook_verified_at TIMESTAMP NULL");
                $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_webhook_verification AS
                    SELECT binding_id,secrets_encrypted,webhook_verified_at FROM asterisk.voice_agent_bindings
                    WHERE removed=0 AND provider='openai' WITH CASCADED CHECK OPTION");
                $db->exec("UPDATE asterisk.voice_agent_preview_schema SET schema_version=2 WHERE singleton=1");
            }
            if ($version<3) {
                $db->exec("ALTER TABLE asterisk.voice_agent_versions ADD COLUMN IF NOT EXISTS published_by VARCHAR(100) DEFAULT NULL");
                $db->exec("ALTER TABLE asteriskcdrdb.voice_agent_runtime_health ADD COLUMN IF NOT EXISTS invalid_webhook_signatures BIGINT UNSIGNED NOT NULL DEFAULT 0");
                $db->exec("UPDATE asterisk.voice_agent_preview_schema SET schema_version=3 WHERE singleton=1");
            }
            if ($version<4) {
                $db->exec("ALTER TABLE asteriskcdrdb.voice_agent_run_events MODIFY COLUMN `event_type` enum('admitted','provider_connected','media_connected','response_completed','completed','fallback','failed','interrupted','tool_started','tool_completed','tool_failed','tool_denied','transfer_requested','transfer_committed','transfer_failed','transfer_uncertain','trace_started','trace_finished','trace_gap','usage_snapshot','provider_output','transcription_failed','consultation_announced','consultation_held','consultation_phone','consultation_phone_failed','consultation_chat','consultation_connecting','consultation_clarification','consultation_transferred','consultation_uncertain','consultation_replied','consultation_declined','consultation_unavailable','consultation_timed_out','consultation_cancelled','consultation_failed','consultation_recovery_failed','provider_warning') NOT NULL");
                $db->exec("UPDATE asterisk.voice_agent_preview_schema SET schema_version=4 WHERE singleton=1");
            }
            if ($version<5) {
                self::runtimeCredentials($db);
                $db->exec("UPDATE asterisk.voice_agent_preview_schema SET schema_version=5 WHERE singleton=1");
            }
            self::directoryViews($db);
            RecentCallerViews::install($db);
        } finally {
            $db->query("SELECT RELEASE_LOCK('voice_agent_installation')");
        }
    }

    /** Inspect pre-preview and unknown databases before writing even the marker. */
    private static function version(\PDO $db): int
    {
        $objects=$db->query("SELECT CONCAT(table_schema,'.',table_name) FROM information_schema.tables WHERE table_schema IN ('asterisk','asteriskcdrdb') AND LEFT(table_name,12)='voice_agent_'")->fetchAll(\PDO::FETCH_COLUMN);
        if (!$objects) return 0;
        $marker='asterisk.voice_agent_preview_schema';
        if (!in_array($marker,$objects,true) || in_array('asterisk.voice_agent_installation',$objects,true) || in_array('asterisk.voice_agent_schema',$objects,true)) {
            throw new \RuntimeException('unsupported_development_database');
        }
        $version=$db->query("SELECT schema_version FROM $marker WHERE singleton=1")->fetchColumn();
        if ($version===false && count($objects)===1) return 0; // Interrupted immediately after CREATE.
        if ($version===false || !in_array((string)$version,['0','1','2','3','4','5'],true)) throw new \RuntimeException('unsupported_schema_version');
        return (int)$version;
    }

    private static function runtimeCredentials(\PDO $db): void
    {
        require_once __DIR__.'/SecretStore.php';
        if ((int)$db->query("SELECT GET_LOCK('voice_agent_configuration', 30)")->fetchColumn()!==1) {
            throw new \RuntimeException('configuration_busy');
        }
        try {
            $db->exec("ALTER TABLE asterisk.voice_agent_bindings ADD COLUMN IF NOT EXISTS runtime_secrets_encrypted TEXT NULL");
            $secrets=new SecretStore();
            $db->beginTransaction();
            $rows=$db->query("SELECT binding_id,secrets_encrypted FROM asterisk.voice_agent_bindings
                WHERE removed=0 AND runtime_secrets_encrypted IS NULL
                    AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(settings_json,'$.execution')),'local')<>'cleverai'")->fetchAll(\PDO::FETCH_ASSOC);
            $save=$db->prepare("UPDATE asterisk.voice_agent_bindings SET runtime_secrets_encrypted=? WHERE binding_id=?");
            foreach ($rows as $row) {
                $private=json_decode($secrets->decryptSecret($row['secrets_encrypted']),true,512,JSON_THROW_ON_ERROR);
                $save->execute([$secrets->encryptRuntimeCredentials($private),$row['binding_id']]);
            }
            $db->commit();
            $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_runtime_bindings AS
                SELECT b.binding_id,b.provider,b.settings_json,b.runtime_secrets_encrypted AS secrets_encrypted,
                    b.freepbx_trunk_id,CONCAT('VoiceAgentTrunk_',b.id) AS trunk_name
                FROM asterisk.voice_agent_bindings b
                WHERE b.removed=0 AND b.sync_status='synced' AND b.runtime_secrets_encrypted IS NOT NULL
                    AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(b.settings_json,'$.execution')),'local')<>'cleverai'");
            $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_webhook_verification AS
                SELECT binding_id,SHA2(runtime_secrets_encrypted,256) AS signing_generation,webhook_verified_at
                FROM asterisk.voice_agent_bindings WHERE removed=0 AND provider='openai' AND runtime_secrets_encrypted IS NOT NULL
                WITH CASCADED CHECK OPTION");
        } finally {
            if ($db->inTransaction()) $db->rollBack();
            $db->query("SELECT RELEASE_LOCK('voice_agent_configuration')");
        }
    }

    private static function seed(\PDO $db): void
    {
        require_once __DIR__.'/Service.php';
        $db->beginTransaction();
        try {
            $insert=$db->prepare('INSERT IGNORE INTO asterisk.voice_agent_builtin_tools (tool_id,tool_version,manifest_json) VALUES (?,?,?)');
            foreach (json_decode(file_get_contents(__DIR__.'/contracts/tools-v5.json'),true,512,JSON_THROW_ON_ERROR) as $tool) {
                $insert->execute([$tool['id'],$tool['version'],json_encode($tool,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
            }
            foreach (json_decode(file_get_contents(__DIR__.'/contracts/tools-v6.json'),true,512,JSON_THROW_ON_ERROR) as $tool) $insert->execute([$tool['id'],$tool['version'],json_encode($tool,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
            $agentSeed=$db->prepare("INSERT IGNORE INTO asterisk.voice_agent_agents (agent_id,name,destination_id,kind) VALUES (?,?,?,'builtin')");
            $draftSeed=$db->prepare('INSERT IGNORE INTO asterisk.voice_agent_drafts (agent_id,definition_json) VALUES (?,?)');
            foreach (['receptionist'=>['Receptionist',Service::receptionistDraft()],
                      'consultation_assistant'=>['Consultation assistant',Service::consultationDraft()]] as $id=>[$name,$draft]) {
                $agentSeed->execute([$id,$name,'agent:'.$id]);
                $draftSeed->execute([$id,json_encode($draft,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
            }
            $db->commit();
        } catch (\Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }
    }
    /** Re-evaluated on install/reload so optional PBX modules can appear later.
     * These views expose names and routing metadata only, never queue secrets. */
    private static function directoryViews(\PDO $db): void
    {
        $tables=$db->query("SELECT table_name FROM information_schema.tables WHERE table_schema='asterisk'")->fetchAll(\PDO::FETCH_COLUMN);
        $active=function(string $module) use ($tables): string {
            return in_array('modules',$tables,true)?" AND EXISTS (SELECT 1 FROM asterisk.modules WHERE modulename='".$module."' AND enabled=1)":'';
        };
        $empty="SELECT CAST(NULL AS CHAR(64)) id,CAST(NULL AS CHAR(100)) name,CAST(NULL AS CHAR(500)) description WHERE 0";
        $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_queue_directory AS ".
            (in_array('queues_config',$tables,true)?"SELECT CONVERT(CONCAT('queue:',extension) USING utf8mb4) COLLATE utf8mb4_unicode_ci id,CONVERT(descr USING utf8mb4) COLLATE utf8mb4_unicode_ci name,CAST('' AS CHAR(500) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci description FROM asterisk.queues_config WHERE extension REGEXP '^[0-9]{1,20}$'".$active('queues'):$empty));
        // Empty v8 views keep the pinned runtime readable during a matching-image upgrade.
        $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_ivr_directory AS ".$empty);
        $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_ivr_branches AS ".
            "SELECT CAST(NULL AS CHAR(64)) id,CAST(NULL AS CHAR(30)) selection,CAST(NULL AS CHAR(200)) destination WHERE 0");
    }

}
