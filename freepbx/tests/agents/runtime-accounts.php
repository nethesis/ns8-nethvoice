<?php
// Last disposable-DB check: real generated identities and column grants.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/RuntimeAccounts.php';
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/SecretStore.php';
$dsn=getenv('M0_TEST_DSN');
$db=new PDO($dsn,'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach (['localhost','%'] as $host) $db->exec("ALTER USER 'root'@".$db->quote($host)." IDENTIFIED BY 'synthetic-root-only'");
putenv('MARIADB_ROOT_PASSWORD=synthetic-root-only');
putenv('NETHVOICE_MARIADB_PORT='.getenv('M0_TEST_PORT'));
putenv('VOICE_AGENT_CONFIG_PASSWORD=synthetic-config-only');
putenv('VOICE_AGENT_MONITOR_PASSWORD=synthetic-monitor-only');
assert(\NethVoice\Agents\RuntimeAccounts::install());
assert(\NethVoice\Agents\RuntimeAccounts::install());
$reader=new PDO($dsn,'voice_agent_config','synthetic-config-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$writer=new PDO($dsn,'voice_agent_monitor','synthetic-monitor-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
assert($reader->query('SELECT COUNT(*) FROM asterisk.voice_agent_runtime_tools')->fetchColumn()===5);
function forbidden($db,$sql) {
    try { $db->exec($sql); throw new RuntimeException('unexpected_runtime_grant'); }
    catch (PDOException $error) { assert(in_array($error->errorInfo[1],[1142,1143],true)); }
}
foreach (['voice_agent_queue_directory','voice_agent_ivr_directory','voice_agent_ivr_branches'] as $view) $reader->query('SELECT * FROM asterisk.'.$view.' LIMIT 0');
foreach (['voice_agent_recent_cdr','voice_agent_callback_devices','voice_agent_callback_trunks','voice_agent_callback_patterns'] as $view) $reader->query('SELECT * FROM asterisk.'.$view.' LIMIT 0');
forbidden($reader,'SELECT * FROM asteriskcdrdb.cdr LIMIT 0');
forbidden($writer,'SELECT * FROM asteriskcdrdb.cdr LIMIT 0');
forbidden($writer,'SELECT * FROM asterisk.voice_agent_recent_cdr LIMIT 0');
forbidden($reader,"UPDATE asterisk.voice_agent_recent_cdr SET dst='forged'");
forbidden($reader,'SELECT * FROM asterisk.queues_config LIMIT 0');
forbidden($reader,'SELECT * FROM asterisk.ivr_details LIMIT 0');
forbidden($reader,'SELECT * FROM asterisk.voice_agent_bindings LIMIT 0');
forbidden($writer,'SELECT * FROM asterisk.voice_agent_bindings LIMIT 0');
forbidden($writer,'SELECT * FROM asterisk.voice_agent_runtime_bindings LIMIT 0');
forbidden($reader,'SELECT signing_generation FROM asterisk.voice_agent_webhook_verification LIMIT 0');
forbidden($writer,'SELECT * FROM asterisk.voice_agent_webhook_verification LIMIT 0');
forbidden($writer,'SELECT webhook_verified_key_generation FROM asterisk.voice_agent_webhook_verification LIMIT 0');
forbidden($reader,'SELECT * FROM asteriskcdrdb.voice_agent_runs LIMIT 0');
forbidden($writer,'SELECT * FROM asterisk.voice_agent_published LIMIT 0');
forbidden($writer,'UPDATE asteriskcdrdb.voice_agent_runs SET agent_id=agent_id');
forbidden($writer,'DELETE FROM asteriskcdrdb.voice_agent_runs');
forbidden($writer,'SELECT * FROM asteriskcdrdb.voice_agent_transcripts LIMIT 0');
forbidden($writer,'DELETE FROM asteriskcdrdb.voice_agent_transcripts');
forbidden($reader,'SELECT * FROM asteriskcdrdb.voice_agent_transcripts LIMIT 0');
foreach (['voice_agent_metric_hours','voice_agent_runtime_health'] as $table) {
    forbidden($writer,'DELETE FROM asteriskcdrdb.'.$table);
    forbidden($reader,'SELECT * FROM asteriskcdrdb.'.$table.' LIMIT 0');
    $writer->query('SELECT * FROM asteriskcdrdb.'.$table.' LIMIT 0');
}
$writer->exec('UPDATE asteriskcdrdb.voice_agent_runs SET outcome=outcome');
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
$store=new \NethVoice\Agents\SecretStore();
$binding=$reader->query("SELECT binding_id,secrets_encrypted FROM asterisk.voice_agent_runtime_bindings
    WHERE JSON_UNQUOTE(JSON_EXTRACT(settings_json,'$.openai_project_id'))='proj_test'")->fetch(PDO::FETCH_ASSOC);
assert(json_decode($store->decryptSecret($binding['secrets_encrypted']),true)['api_key']==='synthetic-api');
$read=$writer->prepare('SELECT signing_generation FROM asterisk.voice_agent_webhook_verification WHERE binding_id=?');
$read->execute([$binding['binding_id']]);
$generation=$read->fetchColumn();
assert($generation===hash('sha256',$binding['secrets_encrypted']));
$verify=$writer->prepare('UPDATE asterisk.voice_agent_webhook_verification SET webhook_verified_at=NOW(),webhook_verified_key_generation=?
    WHERE binding_id=? AND signing_generation=?');
$db->prepare('UPDATE asterisk.voice_agent_bindings SET webhook_verified_at=NULL WHERE binding_id=?')->execute([$binding['binding_id']]);
$verify->execute([$store->webhookKeyGeneration('openai','synthetic-api'),$binding['binding_id'],$generation]);
assert($verify->rowCount()===1);
$newProjection=$store->encryptRuntimeCredentials(['api_key'=>'synthetic-rotated-api']);
$db->prepare('UPDATE asterisk.voice_agent_bindings SET runtime_secrets_encrypted=?,webhook_verified_at=NULL WHERE binding_id=?')->execute([$newProjection,$binding['binding_id']]);
$verifiedKeyGeneration=$store->webhookKeyGeneration('openai','synthetic-rotated-api');
$verify->execute([$verifiedKeyGeneration,$binding['binding_id'],$generation]);
assert($verify->rowCount()===0);
$verify->execute([$verifiedKeyGeneration,$binding['binding_id'],hash('sha256',$newProjection)]);
assert($verify->rowCount()===1);
$q=$db->prepare('SELECT webhook_verified_key_generation FROM asterisk.voice_agent_bindings WHERE binding_id=?');
$q->execute([$binding['binding_id']]);
assert($q->fetchColumn()===$verifiedKeyGeneration);
$db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.voice_agent_webhook_verification AS
    SELECT binding_id,secrets_encrypted,webhook_verified_at FROM asterisk.voice_agent_bindings
    WHERE removed=0 AND provider='openai' WITH CASCADED CHECK OPTION");
foreach (['127.0.0.1','localhost'] as $host) {
    $db->exec("GRANT SELECT (binding_id,secrets_encrypted) ON asterisk.voice_agent_webhook_verification TO 'voice_agent_monitor'@".$db->quote($host));
}
assert(is_string($writer->query('SELECT secrets_encrypted FROM asterisk.voice_agent_webhook_verification LIMIT 1')->fetchColumn()));
$installer=__DIR__.'/../../var/www/html/freepbx/rest/lib/agents/install-runtime.php';
$disable=escapeshellarg(PHP_BINARY).' '.escapeshellarg($installer).' --disable-accounts';
passthru($disable,$status);
assert($status===0);
forbidden($writer,'SELECT secrets_encrypted FROM asterisk.voice_agent_webhook_verification LIMIT 0');
forbidden($reader,'SELECT secrets_encrypted FROM asterisk.voice_agent_runtime_bindings LIMIT 0');
echo "Separate runtime identities and least-privilege grants passed twice\n";
