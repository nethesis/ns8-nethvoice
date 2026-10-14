<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Privileged maintenance is separate from the runtime monitoring writer. */
final class Retention
{
    /** Explicit maintenance cleanup, separate from the insert-only runtime. */
    public static function purgeRunContent(\PDO $db, string $runId): int
    {
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$runId)) throw new \InvalidArgumentException('invalid_identifier');
        $q=$db->prepare('DELETE FROM asteriskcdrdb.voice_agent_transcripts WHERE run_id=?');
        $q->execute([$runId]);
        return $q->rowCount();
    }
    public static function clean(\PDO $db): int
    {
        $db->beginTransaction();
        try {
            $db->exec('DELETE FROM asteriskcdrdb.voice_agent_transcripts WHERE expires_at<=NOW() LIMIT 1000');
            $ids=$db->query("SELECT run_id FROM asteriskcdrdb.voice_agent_runs WHERE retention_until<NOW() AND outcome<>'running' ORDER BY retention_until LIMIT 1000 FOR UPDATE")->fetchAll(\PDO::FETCH_COLUMN);
            if ($ids) {
                $marks=implode(',',array_fill(0,count($ids),'?'));
                foreach (['voice_agent_transcripts','voice_agent_pending_calls','voice_agent_run_events','voice_agent_runs'] as $table) {
                    $q=$db->prepare('DELETE FROM asteriskcdrdb.'.$table.' WHERE run_id IN ('.$marks.')');
                    $q->execute($ids);
                }
            }
            $db->commit(); return count($ids);
        } catch (\Throwable $error) { $db->rollBack(); throw $error; }
    }
}
