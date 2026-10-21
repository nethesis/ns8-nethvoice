<?php
// Last disposable-DB check: real generated identities and column grants.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/RuntimeAccounts.php';
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
assert($reader->query('SELECT COUNT(*) FROM asterisk.voice_agent_runtime_tools')->fetchColumn()===8);
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
echo "Separate runtime identities and least-privilege grants passed twice\n";
