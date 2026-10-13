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
            $sql = file_get_contents(__DIR__ . '/migrations/001-foundation.sql');
            foreach (explode(';', $sql) as $statement) {
                if (trim($statement) !== '') $db->exec($statement);
            }
        } finally {
            $db->query("SELECT RELEASE_LOCK('voice_agent_schema_v1')");
        }
    }
}
