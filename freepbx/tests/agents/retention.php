<?php
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Retention.php';
$db=new PDO(getenv('M0_TEST_DSN'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$id='22222222-2222-4222-a222-222222222222';
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,outcome,retention_until) VALUES (?,'internal',1,'completed',DATE_SUB(NOW(),INTERVAL 1 DAY))");
$q->execute([$id]);
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_run_events (event_id,run_id,event_type) VALUES (?,?,'completed')");
$q->execute(['33333333-3333-4333-a333-333333333333',$id]);
assert(\NethVoice\Agents\Retention::clean($db)===1);
assert((int)$db->query("SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_run_events WHERE run_id='22222222-2222-4222-a222-222222222222'")->fetchColumn()===0);
assert(\NethVoice\Agents\Retention::clean($db)===0);
echo "Monitoring retention preserves current runs and removes expired metadata\n";
