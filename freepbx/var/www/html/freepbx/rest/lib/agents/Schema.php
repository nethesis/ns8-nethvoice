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
            self::preflight($db);
            // A fixed format identity is written before any other DDL. It is not
            // a migration ledger. Its presence permits an interrupted install
            // to resume without adopting an unknown development database.
            $db->exec("CREATE TABLE IF NOT EXISTS asterisk.voice_agent_installation (singleton TINYINT UNSIGNED PRIMARY KEY CHECK(singleton=1), format VARCHAR(32) CHARACTER SET ascii NOT NULL CHECK(format='alpha-v8')) ENGINE=InnoDB");
            $db->exec("INSERT IGNORE INTO asterisk.voice_agent_installation VALUES (1,'alpha-v8')");
            foreach (['configuration','execution'] as $schema) {
                foreach (explode(';',file_get_contents(__DIR__.'/schema/'.$schema.'.sql')) as $statement) {
                    if (trim($statement)!=='') $db->exec($statement);
                }
            }
            self::directoryViews($db);
            RecentCallerViews::install($db);
            require_once __DIR__.'/Service.php';
            $db->beginTransaction();
            try {
                $insert=$db->prepare('INSERT IGNORE INTO asterisk.voice_agent_builtin_tools (tool_id,tool_version,manifest_json) VALUES (?,?,?)');
                foreach (json_decode(file_get_contents(__DIR__.'/contracts/tools-v5.json'),true,512,JSON_THROW_ON_ERROR) as $tool) {
                    $insert->execute([$tool['id'],$tool['version'],json_encode($tool,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
                }
                $db->exec("INSERT IGNORE INTO asterisk.voice_agent_agents (agent_id,name,destination_id,kind) VALUES ('receptionist','Receptionist','agent:receptionist','builtin')");
                $seed=$db->prepare("INSERT IGNORE INTO asterisk.voice_agent_drafts (agent_id,definition_json) VALUES ('receptionist',?)");
                $seed->execute([json_encode(Service::receptionistDraft(),JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
                $db->commit();
            } catch (\Throwable $error) {
                if ($db->inTransaction()) $db->rollBack();
                throw $error;
            }
        } finally {
            $db->query("SELECT RELEASE_LOCK('voice_agent_installation')");
        }
    }
    /** Fail before any DDL or seed write on unsupported development state. */
    private static function preflight(\PDO $db): void
    {
        $objects=$db->query("SELECT CONCAT(table_schema,'.',table_name) FROM information_schema.tables WHERE table_schema IN ('asterisk','asteriskcdrdb') AND LEFT(table_name,12)='voice_agent_'")->fetchAll(\PDO::FETCH_COLUMN);
        $marker='asterisk.voice_agent_installation';
        if (in_array('asterisk.voice_agent_schema',$objects,true) || ($objects && !in_array($marker,$objects,true))) {
            throw new \RuntimeException('unsupported_development_database');
        }
        if (in_array($marker,$objects,true)) {
            $format=$db->query('SELECT format FROM asterisk.voice_agent_installation WHERE singleton=1')->fetchColumn();
            if (($format===false && count($objects)>1) || ($format!==false && $format!=='alpha-v8')) {
                throw new \RuntimeException('unsupported_development_database');
            }
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
            (in_array('queues_config',$tables,true)?"SELECT CONCAT('queue:',extension) id,descr name,'' description FROM asterisk.queues_config WHERE extension REGEXP '^[0-9]{1,20}$'".$active('queues'):$empty));
        // Empty v8 views keep the pinned runtime readable during a matching-image upgrade.
        $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_ivr_directory AS ".$empty);
        $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_ivr_branches AS ".
            "SELECT CAST(NULL AS CHAR(64)) id,CAST(NULL AS CHAR(30)) selection,CAST(NULL AS CHAR(200)) destination WHERE 0");
    }

}
