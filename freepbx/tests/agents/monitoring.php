<?php
// Synthetic metadata only; exercises real MariaDB queries and additive contracts.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Monitoring.php';
use NethVoice\Agents\Monitoring;
assert(Monitoring::retentionDays() === 90);
putenv('VOICE_AGENT_MONITORING_RETENTION_DAYS=30');
assert(Monitoring::retentionDays() === 30);
putenv('VOICE_AGENT_MONITORING_RETENTION_DAYS');
foreach (['from'=>[], 'page'=>'0', 'provider'=>'untrusted', 'phase'=>'arbitrary', 'query'=>str_repeat('x',101), 'outcome'=>'failed,untrusted', 'agent_id'=>'receptionist,Bad', 'adapter'=>'live,'] as $key=>$bad) {
    try { Monitoring::filters([$key=>$bad]); assert(false); }
    catch (RuntimeException $e) { assert($e->getCode()===422); }
}
$db=new PDO(getenv('M0_TEST_DSN').';dbname=asterisk','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$monitor=new Monitoring($db);
$id='77777777-7777-4777-a777-777777777777';
$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,started_at,ended_at,outcome,retention_until,provider,adapter,model,monitoring_version,trace_status,duration_ms) VALUES (?,'receptionist',11,NOW()-INTERVAL 20 DAY,NOW()-INTERVAL 20 DAY,'transferred',NOW()+INTERVAL 70 DAY,'openai','realtime','synthetic-model',2,'complete',1200)")->execute([$id]);
assert(count($monitor->runs(['query'=>$id])['items'])===1);
$db->prepare('UPDATE asteriskcdrdb.voice_agent_runs SET caller_number=?,called_number=? WHERE run_id=?')->execute(['+12025550159','+12025550170',$id]);
foreach (['5550159','5550170'] as $number) {
    assert($monitor->runs(['query'=>$number])['items']===[]);
    $numberMatches=$monitor->runs(['query'=>$number],searchNumbers:true)['items'];
    assert(count($numberMatches)===1 && $numberMatches[0]['run_id']===$id);
}
assert(count($monitor->runs(['query'=>$id,'outcome'=>'failed'])['items'])===0);
assert(count($monitor->runs(['query'=>$id,'outcome'=>'failed,transferred'])['items'])===1);
assert(count($monitor->runs(['query'=>$id,'agent_id'=>'other_agent,receptionist','provider'=>'grok,openai','adapter'=>'live,realtime'])['items'])===1);
assert(count($monitor->runs(['query'=>$id,'provider'=>'grok,unknown'])['items'])===0);
assert(Monitoring::filters(['provider'=>'openai,openai,grok'])['provider']===['openai','grok']);
assert(count($monitor->runs(['query'=>$id,'from'=>gmdate('Y-m-d\TH:i:s\Z',time()-86400)])['items'])===0);
$row=$monitor->run($id); assert($row['duration_ms']==1200 && $row['trace_status']==='complete');
assert($row['caller_number']==='+12025550159' && $row['called_number']==='+12025550170');
assert(!isset($row['linkedid'],$row['provider_call_id']));
$version=(int)$db->query('SELECT schema_version FROM asterisk.voice_agent_preview_schema WHERE singleton=1')->fetchColumn();
$db->exec('UPDATE asterisk.voice_agent_preview_schema SET schema_version=5 WHERE singleton=1');
try {
    $beforeMigration=new Monitoring($db);
    assert($beforeMigration->run($id)['caller_number']===null);
    assert($beforeMigration->runs(['query'=>'5550159'],searchNumbers:true)['items']===[]);
    assert(count($beforeMigration->runs(['query'=>$id])['items'])===1);
} finally {
    $db->exec('UPDATE asterisk.voice_agent_preview_schema SET schema_version='.$version.' WHERE singleton=1');
}
$db->prepare("UPDATE asteriskcdrdb.voice_agent_runs SET linkedid='synthetic-support',error_code='private_untrusted_detail' WHERE run_id=?")->execute([$id]);
$db->exec("INSERT INTO asteriskcdrdb.cdr (calldate,linkedid,uniqueid) VALUES (NOW()-INTERVAL 23 DAY,'synthetic-support','outside-window')");
assert($monitor->run($id)['call_record_url']===null);
$db->exec("INSERT INTO asteriskcdrdb.cdr (calldate,linkedid,uniqueid) VALUES (CONVERT_TZ(NOW(),'+00:00','SYSTEM')-INTERVAL 20 DAY,'synthetic-support','native-42')");
$detail=$monitor->run($id);
$cdrUrl=parse_url($detail['call_record_url']);
assert($cdrUrl['path']==='/freepbx/admin/config.php' && $cdrUrl['fragment']==='CDR');
parse_str($cdrUrl['query'],$cdrParams);
assert($cdrParams['display']==='cdr' && $cdrParams['action']==='cdr_record' && $cdrParams['uid']==='native-42');
assert($cdrParams['calldate']===$db->query("SELECT calldate FROM asteriskcdrdb.cdr WHERE uniqueid='native-42'")->fetchColumn());
assert($detail['error_code']==='other' && !isset($detail['src'],$detail['dst'],$detail['linkedid']));
$trace=$monitor->trace($id,[]); assert($trace['items']===[] && $trace['next_cursor']===null);
$warning='99999999-9999-4999-a999-000000000999';
$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_run_events (event_id,run_id,event_type,provider_code,occurred_at) VALUES (?,?,'provider_warning','input_audio_rate_limit_exceeded',NOW(6))")->execute([$warning,$id]);
$observed=$monitor->trace($id,[])['items'];
assert(count($observed)===1 && $observed[0]['event_type']==='provider_warning' && $observed[0]['provider_code']==='input_audio_rate_limit_exceeded');
$db->prepare('DELETE FROM asteriskcdrdb.voice_agent_run_events WHERE event_id=?')->execute([$warning]);
assert($monitor->summary([])['coverage']['instrumented_runs']>=0);
$utc=new DateTimeZone('UTC');
$nearMidnight=(new DateTimeImmutable('now',$utc))->modify('-2 days')->setTime(0,30);
$calendarRun='78787878-7878-4787-a787-787878787878';
$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,started_at,outcome,retention_until)
    VALUES (?,'monitoring_calendar',1,?,'completed',NOW()+INTERVAL 90 DAY)")->execute([$calendarRun,$nearMidnight->format('Y-m-d H:i:s')]);
foreach (['UTC','Europe/Rome','America/Los_Angeles'] as $zone) {
    $result=$monitor->summary(['agent_id'=>'monitoring_calendar','timezone'=>$zone]);
    assert($result['coverage']['total_runs']===1 && count($result['trends'])===1);
    assert($result['trends'][0]['day']===$nearMidnight->setTimezone(new DateTimeZone($zone))->format('Y-m-d'));
}
try { $monitor->summary(['timezone'=>"Europe/Rome' --"]); assert(false); }
catch (RuntimeException $error) { assert($error->getMessage()==='invalid_monitoring_timezone'); }
$db->prepare('DELETE FROM asteriskcdrdb.voice_agent_runs WHERE run_id=?')->execute([$calendarRun]);
assert($monitor->health()['stale']===true);
try { $monitor->trace($id,['cursor'=>'not-a-cursor']); assert(false); } catch (RuntimeException $e) { assert($e->getCode()===422); }
echo "Monitoring history filters, current format, retention and health passed\n";
// Cursor paging is explicit, including equal timestamps and the final page.
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_run_events (event_id,run_id,event_type,phase,status,elapsed_ms,occurred_at) VALUES (?,?,'trace_started','tool','running',?,NOW(6))");
for ($i=0;$i<101;$i++) $q->execute([sprintf('99999999-9999-4999-a999-%012d',$i),$id,$i]);
$first=$monitor->trace($id,[]); assert(count($first['items'])===100 && $first['next_cursor']!==null);
$last=$monitor->trace($id,['cursor'=>$first['next_cursor']]); assert(count($last['items'])===1 && $last['next_cursor']===null);

// A controlled 100,000-run history exercises server search and query budgets.
$digits='(SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)';
$number='d0.n+10*d1.n+100*d2.n+1000*d3.n+10000*d4.n';
try {
    $db->exec("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,started_at,outcome,retention_until) SELECT CONCAT('88888888-8888-4888-a888-',LPAD($number,12,'0')),'monitoring_load',1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL MOD(($number)*7777,7776000) SECOND),'completed',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 90 DAY) FROM $digits d0 CROSS JOIN $digits d1 CROSS JOIN $digits d2 CROSS JOIN $digits d3 CROSS JOIN $digits d4");
    $start=microtime(true);
    assert(!in_array($id,array_column($monitor->runs([])['items'],'run_id'),true));
    assert(count($monitor->runs(['query'=>$id])['items'])===1);
    assert($monitor->runs(['query'=>"%' OR 1=1 --"])['items']===[]);
    $summary=$monitor->summary(['agent_id'=>'monitoring_load']);
    assert($summary['coverage']['total_runs']===100000 && count($summary['trends'])>=89);
    printf("100,000 synthetic runs: history, search and 90-day summary %.3fs\n",microtime(true)-$start);
    $db->exec("INSERT INTO asteriskcdrdb.voice_agent_metric_hours (hour_start,agent_id,provider,adapter,metric,dimension,result,bucket,samples,total) VALUES (DATE_FORMAT(NOW(),'%Y-%m-%d %H:00:00'),'monitoring_load','openai','realtime','tool_duration','pbx.transfer','completed',1000,90,90000),(DATE_FORMAT(NOW(),'%Y-%m-%d %H:00:00'),'monitoring_load','openai','realtime','tool_duration','pbx.transfer','completed',2500,10,25000)");
    $tool=$monitor->summary(['agent_id'=>'monitoring_load'])['tools'][0];
    assert($tool['samples']===100 && $tool['p50_ms']===1000 && $tool['p95_ms']===2500 && $tool['mean_ms']==1150);
} finally {
    $db->exec("DELETE FROM asteriskcdrdb.voice_agent_runs WHERE agent_id='monitoring_load'");
    $db->exec("DELETE FROM asteriskcdrdb.voice_agent_metric_hours WHERE agent_id='monitoring_load'");
}
