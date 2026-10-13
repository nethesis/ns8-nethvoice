<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

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
        } finally {
            $db->query("SELECT RELEASE_LOCK('voice_agent_schema_v1')");
        }
    }
}
