<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__.'/Monitoring.php';

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
    public static function clean(\PDO $db, int $budgetSeconds = 30): int
    {
        $db->exec("SET time_zone='+00:00'");
        $deadline=microtime(true)+max(1,$budgetSeconds);
        $removed=0;
        do {
            $db->beginTransaction();
            try {
                $transcripts=$db->exec('DELETE FROM asteriskcdrdb.voice_agent_transcripts WHERE expires_at<=NOW() LIMIT 1000');
                // The effective metadata policy also expires orphaned running rows.
                $q=$db->prepare('SELECT run_id FROM asteriskcdrdb.voice_agent_runs WHERE started_at<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL ? DAY) ORDER BY started_at LIMIT 1000 FOR UPDATE');
                $q->execute([Monitoring::retentionDays()]);
                $ids=$q->fetchAll(\PDO::FETCH_COLUMN);
                if ($ids) {
                    $marks=implode(',',array_fill(0,count($ids),'?'));
                    foreach (['voice_agent_transcripts','voice_agent_pending_calls','voice_agent_run_events','voice_agent_runs'] as $table) {
                        $q=$db->prepare('DELETE FROM asteriskcdrdb.'.$table.' WHERE run_id IN ('.$marks.')');
                        $q->execute($ids);
                    }
                }
                $q=$db->prepare('DELETE FROM asteriskcdrdb.voice_agent_metric_hours WHERE hour_start<DATE_SUB(UTC_TIMESTAMP(),INTERVAL ? DAY) LIMIT 1000');
                $q->execute([Monitoring::retentionDays()]);
                $metrics=$q->rowCount();
                $db->commit();
                $removed+=count($ids);
            } catch (\Throwable $error) { $db->rollBack(); throw $error; }
        } while (($transcripts===1000 || $metrics===1000 || count($ids)===1000) && microtime(true)<$deadline);
        return $removed;
    }
}
