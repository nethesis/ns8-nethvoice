<?php
// Disposable databases and synthetic history only.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\Schema;
use NethVoice\Agents\RoutingPolicy;
$db=new PDO(getenv('M0_TEST_DSN'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$draft=Service::emptyDraft();
assert($draft['contract_version']===7);
assert($draft['tool_bindings'][1]['enabled']);
$config=$draft['tool_bindings'][1]['config'];
assert($config['recent_callers_enabled'] && $config['recent_caller_lookback_days']===7);
assert(!$config['extensions_enabled'] && $config['extension_allowlist']===[] && $config['recent_caller_denylist']===[]);
assert(!RoutingPolicy::permits($draft,'extension:203'));
assert(RoutingPolicy::permitsRecent($draft,'extension:203'));
foreach (['master','recent','excluded','lookup'] as $denial) {
    $bad=$draft;
    if ($denial==='master') $bad['tool_bindings'][1]['enabled']=false;
    if ($denial==='recent') $bad['tool_bindings'][1]['config']['recent_callers_enabled']=false;
    if ($denial==='excluded') $bad['tool_bindings'][1]['config']['recent_caller_denylist']=['extension:203'];
    if ($denial==='lookup') $bad['tool_bindings'][2]['enabled']=false;
    assert(!RoutingPolicy::permitsRecent($bad,'extension:203'));
}
$versions=$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN);
$drafts=$db->query('SELECT definition_json FROM asterisk.voice_agent_drafts ORDER BY agent_id')->fetchAll(PDO::FETCH_COLUMN);
foreach (['devices','trunks','trunk_dialpatterns','outbound_route_patterns'] as $table) {
    $db->exec(file_get_contents(__DIR__.'/../../../mariadb/docker-entrypoint-initdb.d/10_asterisk.'.$table.'-schema.sql'));
}
$db->exec(file_get_contents(__DIR__.'/../../../mariadb/docker-entrypoint-initdb.d/20_asteriskcdrdb.cdr-schema.sql'));
$db->exec("INSERT INTO asterisk.devices (id,tech,user) VALUES ('203','pjsip','203')");
$db->exec("INSERT INTO asterisk.trunks (trunkid,tech,channelid) VALUES (991,'pjsip','outbound-test')");
Schema::install($db);
Schema::install($db);
assert($versions===$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN));
assert($drafts===$db->query('SELECT definition_json FROM asterisk.voice_agent_drafts ORDER BY agent_id')->fetchAll(PDO::FETCH_COLUMN));
foreach (['voice_agent_recent_cdr','voice_agent_callback_devices','voice_agent_callback_trunks','voice_agent_callback_patterns'] as $view) {
    $db->exec("GRANT SELECT ON asterisk.$view TO 'm0_reader'@'%'");
}
$insert=$db->prepare("INSERT INTO asteriskcdrdb.cdr (calldate,src,dst,channel,dstchannel,lastapp,lastdata,disposition,linkedid,uniqueid,sequence) VALUES (UTC_TIMESTAMP()-INTERVAL 2 HOUR,'203',?,'PJSIP/203-00000001','','Dial',?,'NO ANSWER',?,?,?)");
$insert->execute(['+390212345678','PJSIP/+390212345678@outbound-test,30','recent-one','recent-one',1]);
$insert->execute(['+390299999999','SIP/user:synthetic-private@custom.invalid,30','unsafe-dial','unsafe-dial',0]);
assert($db->query("SELECT lastdata FROM asterisk.voice_agent_recent_cdr WHERE uniqueid='unsafe-dial'")->fetchColumn()==='');
$db->beginTransaction();
for ($i=0;$i<1001;$i++) $insert->execute(['+390212340999','PJSIP/+390212340999@outbound-test,30','large-'.$i,'large-'.$i,$i+2]);
$db->commit();
echo "Recent-callback defaults, independent policies, additive views and synthetic CDR fixtures passed\n";
