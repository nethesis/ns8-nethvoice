<?php
// Synthetic content in the disposable database only.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Retention.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\SecretStore;
use NethVoice\Agents\Retention;
$db=new PDO(getenv('M0_TEST_DSN'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-debug-key');
$service=new Service($db);
$run='55555555-5555-4555-a555-555555555555';
$q=$db->prepare("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,outcome,retention_until) VALUES (?,'receptionist',1,'completed',DATE_ADD(NOW(),INTERVAL 7 DAY))");$q->execute([$run]);
$q=$db->prepare('INSERT INTO asteriskcdrdb.voice_agent_transcripts (event_id,run_id,position,content_encrypted,occurred_at,expires_at) VALUES (?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL ? HOUR))');
$vault=new SecretStore();
foreach (['valid'=>1,'expired'=>-1,'wrong_run'=>1] as $kind=>$hours) {
    $id=['valid'=>'77777777-7777-4777-a777-777777777777','expired'=>'88888888-8888-4888-a888-888888888888','wrong_run'=>'99999999-9999-4999-a999-999999999999'][$kind];
    $content=['event_id'=>$id,'run_id'=>$kind==='wrong_run'?'66666666-6666-4666-a666-666666666666':$run,'role'=>'caller','text'=>'<script>synthetic text</script>','interrupted'=>false];
    $q->execute([$id,$run,1,$vault->encryptSecret(json_encode($content)),$hours]);
}
$turns=$service->run($run)['transcripts'];
if(count($turns)!==1 || $turns[0]['text']!=='<script>synthetic text</script>')throw new RuntimeException('transcript_expiry_or_identity_failed');
$before=(int)$db->query('SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_transcripts')->fetchColumn();
Retention::clean($db);
$after=(int)$db->query('SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_transcripts')->fetchColumn();
if($after!==$before-1)throw new RuntimeException('transcript_expiry_cleanup_failed');
if((int)$db->query("SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_runs WHERE run_id='$run'")->fetchColumn()!==1)throw new RuntimeException('metadata_not_preserved');
if(Retention::purgeRunContent($db,$run)!==2 || $service->run($run)['transcripts']!==[])throw new RuntimeException('purge_failed');
echo "Encrypted debug content, identity checks and expiry preserve run metadata\n";
