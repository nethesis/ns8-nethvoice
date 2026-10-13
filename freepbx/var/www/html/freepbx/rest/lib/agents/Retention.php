<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Privileged maintenance is separate from the runtime monitoring writer. */
final class Retention
{
    public static function clean(\PDO $db): int
    {
        $db->beginTransaction();
        try {
            $ids=$db->query("SELECT run_id FROM asteriskcdrdb.voice_agent_runs WHERE retention_until<NOW() AND outcome<>'running' ORDER BY retention_until LIMIT 1000 FOR UPDATE")->fetchAll(\PDO::FETCH_COLUMN);
            if ($ids) {
                $marks=implode(',',array_fill(0,count($ids),'?'));
                foreach (['voice_agent_pending_calls','voice_agent_run_events','voice_agent_runs'] as $table) {
                    $q=$db->prepare('DELETE FROM asteriskcdrdb.'.$table.' WHERE run_id IN ('.$marks.')');
                    $q->execute($ids);
                }
            }
            $db->commit(); return count($ids);
        } catch (\Throwable $error) { $db->rollBack(); throw $error; }
    }
}
