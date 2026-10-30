<?php
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Retention.php';
$db=new PDO(getenv('M0_TEST_DSN'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$id='22222222-2222-4222-a222-222222222222';
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,started_at,outcome,retention_until) VALUES (?,'internal',1,DATE_SUB(NOW(),INTERVAL 91 DAY),'completed',DATE_SUB(NOW(),INTERVAL 1 DAY))");
$q->execute([$id]);
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_run_events (event_id,run_id,event_type) VALUES (?,?,'completed')");
$q->execute(['33333333-3333-4333-a333-333333333333',$id]);
assert(\NethVoice\Agents\Retention::clean($db)===1);
assert((int)$db->query("SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_run_events WHERE run_id='22222222-2222-4222-a222-222222222222'")->fetchColumn()===0);
assert(\NethVoice\Agents\Retention::clean($db)===0);
$current='44444444-4444-4444-a444-444444444444';
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,started_at,outcome,retention_until) VALUES (?,'internal',1,NOW(),'running',DATE_ADD(NOW(),INTERVAL 7 DAY))");
$q->execute([$current]);
$run=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,started_at,outcome,retention_until) VALUES (?,'internal',1,DATE_SUB(NOW(),INTERVAL 91 DAY),?,DATE_SUB(NOW(),INTERVAL 1 DAY))");
$transcript=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_transcripts (event_id,run_id,position,content_encrypted,occurred_at,expires_at) VALUES (?,?,?,'synthetic-encrypted-content',NOW(),DATE_SUB(NOW(),INTERVAL 1 HOUR))");
$db->beginTransaction();
for ($i=1;$i<=1501;$i++) {
    $run->execute([sprintf('55555555-5555-4555-a555-%012d',$i),$i===1?'running':'completed']);
    $transcript->execute([sprintf('66666666-6666-4666-a666-%012d',$i),$current,$i]);
}
$db->commit();
assert(\NethVoice\Agents\Retention::clean($db)===1501);
assert((int)$db->query('SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_transcripts WHERE expires_at<=NOW()')->fetchColumn()===0);
$q=$db->prepare('SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_runs WHERE run_id=?');
$q->execute([$current]);
assert((int)$q->fetchColumn()===1,'A current running call must be preserved');
echo "Monitoring retention preserves current runs and removes expired metadata\n";
// A shorter environment policy applies to existing metadata and rollups.
$short='abababab-abab-4bab-abab-abababababab';
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,started_at,outcome,retention_until) VALUES (?,'retention_test',1,DATE_SUB(NOW(),INTERVAL 20 DAY),'completed',DATE_ADD(NOW(),INTERVAL 90 DAY))");
$q->execute([$short]);
$db->exec("INSERT INTO asteriskcdrdb.voice_agent_metric_hours (hour_start,agent_id,provider,adapter,metric,bucket,samples,total) VALUES (NOW()-INTERVAL 20 DAY,'retention_test','openai','realtime','run_duration',1000,1,1000),(NOW()-INTERVAL 3 DAY,'retention_test','openai','realtime','run_duration',1000,1,1000)");
putenv('VOICE_AGENT_MONITORING_RETENTION_DAYS=7');
\NethVoice\Agents\Retention::clean($db);
$q=$db->prepare('SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_runs WHERE run_id=?'); $q->execute([$short]); assert((int)$q->fetchColumn()===0);
$q->execute([$current]); assert((int)$q->fetchColumn()===1);
assert((int)$db->query("SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_metric_hours WHERE agent_id='retention_test'")->fetchColumn()===1);
putenv('VOICE_AGENT_MONITORING_RETENTION_DAYS');
echo "Environment-only retention override purges old history and metrics, preserving current runs\n";
