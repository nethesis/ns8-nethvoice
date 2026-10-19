<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__.'/ReceptionistDefaults.php';

final class Schema
{
    /** MariaDB DDL commits implicitly: each statement is repeatable after interruption. */
    public static function install(\PDO $db): void
    {
        if ((int)$db->query("SELECT GET_LOCK('voice_agent_schema_v1', 30)")->fetchColumn() !== 1) {
            throw new \RuntimeException('schema_busy');
        }
        try {
            $exists = $db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='asterisk' AND table_name='voice_agent_schema'")->fetchColumn();
            $installed = $exists ? $db->query('SELECT version FROM asterisk.voice_agent_schema')->fetchAll(\PDO::FETCH_COLUMN) : [];
            foreach (glob(__DIR__ . '/migrations/*.sql') as $migration) {
                $version = (int) basename($migration);
                if (in_array($version, $installed)) continue;
                $sql = file_get_contents($migration);
                foreach (explode(';', $sql) as $statement) {
                    if (trim($statement) !== '') $db->exec($statement);
                }
            }
            self::directoryViews($db);
            // Initialize only an untouched installation seed. Never rewrite an
            // edited draft or any immutable publication, including on upgrades.
            $seed=$db->prepare("UPDATE asterisk.voice_agent_drafts d JOIN asterisk.voice_agent_agents a ON a.agent_id=d.agent_id SET d.definition_json=JSON_SET(d.definition_json,'$.conversation.instructions',?) WHERE a.agent_id='receptionist' AND a.kind='builtin' AND a.revision=1 AND d.revision=1 AND a.removed=0 AND a.enabled=0 AND a.active_workflow_version IS NULL AND JSON_TYPE(JSON_EXTRACT(d.definition_json,'$.provider_binding_id'))='NULL' AND JSON_UNQUOTE(JSON_EXTRACT(d.definition_json,'$.conversation.instructions'))=''");
            $seed->execute([ReceptionistDefaults::INSTRUCTIONS]);
        } finally {
            $db->query("SELECT RELEASE_LOCK('voice_agent_schema_v1')");
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
        $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_ivr_directory AS ".
            (in_array('ivr_details',$tables,true)?"SELECT CONCAT('ivr:',id) id,name,description FROM asterisk.ivr_details WHERE id>0".$active('ivr'):$empty));
        $branches="SELECT CAST(NULL AS CHAR(64)) id,CAST(NULL AS CHAR(30)) selection,CAST(NULL AS CHAR(200)) destination WHERE 0";
        if (in_array('ivr_details',$tables,true)) {
            $branches="SELECT CONCAT('ivr:',id) id,'invalid' selection,invalid_destination destination FROM asterisk.ivr_details WHERE id>0".$active('ivr').
                " UNION ALL SELECT CONCAT('ivr:',id),'timeout',timeout_destination FROM asterisk.ivr_details WHERE id>0".$active('ivr');
            if (in_array('ivr_entries',$tables,true)) $branches.=" UNION ALL SELECT CONCAT('ivr:',ivr_id),selection,dest FROM asterisk.ivr_entries WHERE ivr_id>0".$active('ivr');
        }
        $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_ivr_branches AS ".$branches);
    }

}
