<?php
// Disposable MariaDB plus synthetic HTTP responses. Never connects to a provider.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
use NethVoice\Agents\{Service,OpenAiWebhook,SecretStore,ProviderCatalog};
$db=new PDO(getenv('M0_TEST_DSN'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
function check($ok,string $name): void { if (!$ok) throw new RuntimeException($name); }
function denied(callable $call,string $code): void {
    try { $call(); } catch (Throwable $error) { check($error->getMessage()===$code,'expected '.$code.', got '.$error->getMessage());return; }
    throw new LogicException('expected '.$code);
}
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
putenv('NETHVOICE_HOST=pbx.example');
putenv('OPENAI_API_KEY=synthetic-environment-api');
$native=new class {
    public int $reloads=0;
    public function defaultLanguage(): string { return 'en'; }
    public function destination(string $id): string { return 'app-blackhole,hangup,1'; }
    public function trunkExists(array $row): bool { return true; }
    public function trunkReady(array $row): bool { return true; }
    public function provision(string $op,array $row,?array $previous): int { return 9003; }
    public function apply(): bool { $this->reloads++;return true; }
    public function directory(): array { return ['items'=>[],'modules'=>[]]; }
    public function extensions(): array { return []; }
};
$remote=[];$calls=[];$mode='ok';$secret='whsec_'.base64_encode('synthetic-automatic-webhook-secret');
$provider=new OpenAiWebhook(function($method,$query,$key,$data) use (&$calls,&$remote,&$mode,$secret,$db) {
    $calls[]=[$method,$query,$key,$data];
    // The same lock must cover discovery, creation and local persistence.
    $other=new PDO(getenv('M0_TEST_DSN'),'root','');
    check((int)$other->query("SELECT GET_LOCK('voice_agent_configuration',0)")->fetchColumn()===0,'configuration_lock_held');
    if ($mode==='forbidden') return ['status'=>403,'body'=>'synthetic-api '.$secret];
    if ($mode==='post_forbidden' && $method==='POST') return ['status'=>403,'body'=>'synthetic-api '.$secret];
    if ($mode==='invalid') return ['status'=>401,'body'=>'synthetic-api '.$secret];
    if ($mode==='list_fail' && $method==='GET') return ['status'=>500,'body'=>'private'];
    if ($method==='GET') return ['status'=>200,'body'=>json_encode(['data'=>$remote,'has_more'=>false])];
    $id=explode(' ',$data['name'])[1];
    $raw=$db->query('SELECT secrets_encrypted FROM asterisk.voice_agent_bindings WHERE binding_id='.$db->quote($id))->fetchColumn();
    $pending=json_decode((new SecretStore())->decryptSecret($raw),true)['openai_webhook_pending'];
    check(in_array($data['name'],array_column($pending,'name'),true),'durable_pending_before_post');
    if ($mode==='uncertain_absent') throw new RuntimeException('timeout synthetic-api '.$secret);
    $endpoint=['id'=>'we_'.count($calls),'name'=>$data['name'],'url'=>$data['url'],'event_types'=>$data['event_types'],
        'signing_secret_hint'=>$mode==='null_hint'?null:'safe_hint','updated_at'=>100];
    $remote[]=$endpoint;
    if ($mode==='timeout') throw new RuntimeException('timeout synthetic-api '.$secret);
    if ($mode==='malformed') return ['status'=>200,'body'=>json_encode($endpoint)];
    return ['status'=>200,'body'=>json_encode($endpoint+['signing_secret'=>$secret])];
});
$service=new Service($db,$native,new ProviderCatalog(fn()=>['data'=>[['id'=>'gpt-realtime-2.1']]]),$provider);
$make=fn($name,$extra=[])=>$service->saveTrunk(null,$extra+['name'=>$name,'provider'=>'openai','openai_project_id'=>'proj_entered','api_key'=>'synthetic-explicit-api'],0,'test-admin');
$edit=fn($trunk,$extra)=>$service->saveTrunk($trunk['binding_id'],$extra+['name'=>$trunk['name'],'provider'=>'openai','openai_project_id'=>$trunk['openai_project_id']],$trunk['revision'],'test-admin');
$setup=fn($trunk)=>$service->configureWebhook($trunk['binding_id'],$trunk['revision'],'test-admin');
$raw=fn($id)=>$db->query('SELECT * FROM asterisk.voice_agent_bindings WHERE binding_id='.$db->quote($id))->fetch(PDO::FETCH_ASSOC);
$stored=fn($id)=>json_decode((new SecretStore())->decryptSecret($raw($id)['secrets_encrypted']),true);
$countPosts=function() use (&$calls) { return count(array_filter($calls,fn($call)=>$call[0]==='POST')); };
$trunk=$make('Automatic setup');
denied(fn()=>$make('Invalid manual secret',['webhook_secret'=>'0']),'invalid_secret');
check(!$trunk['webhook_secret_configured'] && $trunk['webhook_status']==='not_configured' && !$calls,'save_has_no_provider_side_effects');
$draft=Service::emptyDraft();$draft['provider_binding_id']=$trunk['binding_id'];$draft['conversation']=['model'=>'gpt-realtime-2.1','options'=>null,'language'=>'en','voice'=>'ash','instructions'=>'Test','greeting'=>''];
$agent=$service->save(null,['name'=>'Webhook test','draft'=>$draft],0,'test-admin');
$versions=fn()=>$db->query('SELECT definition_json FROM asterisk.voice_agent_versions WHERE agent_id<>'.$db->quote($agent['agent_id']).' ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN);
$beforeVersions=$versions();
denied(fn()=>$service->publish($agent['agent_id'],$agent['revision'],'test-admin'),'webhook_not_configured');
$reloads=$native->reloads;
$result=$setup($trunk);
check($result['webhook_status']==='configured' && $result['revision']===$trunk['revision']+1 && $result['webhook_secret_configured'],'successful_setup');
check($countPosts()===1 && $calls[0][0]==='GET' && $calls[1][2]==='synthetic-explicit-api','resolved_stored_key');
check($calls[1][3]['url']==='https://pbx.example/satellite-webhooks/openai','server_derived_callback');
check($stored($trunk['binding_id'])['webhook_secret']===$secret && !str_contains($raw($trunk['binding_id'])['secrets_encrypted'],$secret),'encrypted_secret');
check($stored($trunk['binding_id'])['openai_webhook']['endpoint_id']===$remote[0]['id'],'endpoint_association_persisted');
check($native->reloads===$reloads,'setup_does_not_reload_native');
$repeat=$setup($result);check($repeat===$result && $countPosts()===1,'repeat_reuses_without_revision_churn');
denied(fn()=>$setup($trunk),'revision_conflict');
$other=$make('Shared project');$other=$setup($other);check($countPosts()===1 && $other['webhook_status']==='configured','shared_endpoint_reuses_associated_secret');
$discovered=$remote;$remote=[];
denied(fn()=>$setup($result),'webhook_creation_uncertain');
$otherKey=$make('Same project, different key',['api_key'=>'synthetic-another-project-key']);
denied(fn()=>$setup($otherKey),'webhook_creation_uncertain');
check($countPosts()===1,'temporarily_missing_endpoint_does_not_trigger_duplicate_post');
$remote=$discovered;
foreach ([$result,$repeat,$service->trunks(),$service->catalog()] as $response) {
    $json=json_encode($response);
    foreach ([$secret,'synthetic-explicit-api','synthetic-environment-api','key_hash','secret_hint','signing_secret'] as $sensitive) check(!str_contains($json,$sensitive),'secret_redaction');
}
$staleSecret='whsec_'.base64_encode('synthetic-stale-webhook-secret');
$other=$edit($other,['webhook_secret'=>$staleSecret]);
check($setup($result)===$result && $stored($result['binding_id'])['webhook_secret']===$secret,'sibling_manual_edit_does_not_replace_working_secret');
$remote[0]['signing_secret_hint']='rotated';
denied(fn()=>$setup($result),'webhook_secret_recovery_required');check($countPosts()===1,'external_rotation_never_overwrites');
denied(fn()=>$service->publish($agent['agent_id'],$agent['revision'],'test-admin'),'webhook_secret_recovery_required');
$manual=$setup($edit($result,['webhook_secret'=>$secret]));
check($manual['webhook_status']==='manual' && $countPosts()===1,'explicit_manual_recovery');
$new=$make('Cannot inherit manual secret');
denied(fn()=>$setup($new),'webhook_secret_recovery_required');
check(!isset($stored($new['binding_id'])['webhook_secret']),'manual_secret_is_local_to_edited_trunk');
$recoveredAgent=$service->publish($agent['agent_id'],$agent['revision'],'test-admin');
check($recoveredAgent['published']!==null,'manual_replacement_restores_publication');
// The original implementation recorded a manually recovered secret as configured.
$saved=$stored($manual['binding_id']);
$saved['openai_webhook']['state']='configured';
unset($saved['openai_webhook']['automatic'],$saved['openai_webhook']['endpoint_updated_at'],$saved['openai_webhook_pending']);
$db->prepare('UPDATE asterisk.voice_agent_bindings SET secrets_encrypted=? WHERE binding_id=?')
    ->execute([(new SecretStore())->encryptSecret(json_encode($saved,JSON_THROW_ON_ERROR)),$manual['binding_id']]);
check($setup($manual)['webhook_status']==='configured','legacy_association_can_be_reused_in_place');
denied(fn()=>$setup($new),'webhook_secret_recovery_required');
check(!isset($stored($new['binding_id'])['webhook_secret']),'legacy_secret_with_unknown_source_is_never_shared');
// An existing matching endpoint without an associated local secret is never recreated.
$remote=[['id'=>'we_existing','name'=>'Manually created','url'=>'https://pbx.example/satellite-webhooks/openai','event_types'=>['realtime.call.incoming']]];
$missing=$make('Missing secret');denied(fn()=>$setup($missing),'webhook_secret_recovery_required');check($countPosts()===1,'missing_secret_no_create');
$remote[0]['event_types']=['batch.completed'];denied(fn()=>$setup($missing),'webhook_endpoint_conflict');
$remote[0]['event_types']=['realtime.call.incoming'];$remote[]=$remote[0]+['id'=>'we_other'];denied(fn()=>$setup($missing),'webhook_provider_response_invalid');
$remote[1]['id']='we_other';denied(fn()=>$setup($missing),'webhook_endpoint_conflict');
foreach (['forbidden'=>'webhook_permission_denied','invalid'=>'provider_credentials_rejected','list_fail'=>'webhook_provider_unavailable'] as $testMode=>$code) {
    $remote=[];$mode=$testMode;$failed=$make('Failure '.$testMode);$before=$countPosts();denied(fn()=>$setup($failed),$code);check($countPosts()===$before,'discovery_failure_prevents_post');
}
$mode='post_forbidden';$remote=[];$rejected=$make('Rejected creation',['api_key'=>'synthetic-rejected-creation','openai_project_id'=>'proj_rejected']);
$before=$countPosts();denied(fn()=>$setup($rejected),'webhook_permission_denied');
check(!isset($stored($rejected['binding_id'])['openai_webhook']),'definitive_rejection_clears_attempt');
$mode='ok';$rejected=$setup($rejected);check($countPosts()===$before+2 && $rejected['webhook_status']==='configured','definitive_rejection_can_retry');
$remote=[];$moved=$setup($edit($rejected,['openai_project_id'=>'proj_moved','api_key'=>'synthetic-moved-key']));
check($moved['webhook_status']==='configured' && $countPosts()===$before+3,'completed_association_allows_new_project');
putenv('NETHVOICE_HOST=new-pbx.example');
$moved=$setup($moved);
check($moved['webhook_status']==='configured' && $countPosts()===$before+4 && count($remote)===2,'completed_association_allows_new_callback');
putenv('NETHVOICE_HOST=pbx.example');
$mode='null_hint';$remote=[];$noHint=$setup($make('Provider omits secret hint',['openai_project_id'=>'proj_no_hint','api_key'=>'synthetic-no-hint']));
check($setup($noHint)===$noHint,'matching_update_timestamp_without_hint');
$remote[0]['updated_at']++;
denied(fn()=>$setup($noHint),'webhook_secret_recovery_required');
foreach (['timeout'=>'webhook_provider_unavailable','malformed'=>'webhook_provider_response_invalid','uncertain_absent'=>'webhook_provider_unavailable'] as $testMode=>$code) {
    $project='proj_'.$testMode;
    $mode=$testMode;$remote=[];$failed=$make('Uncertain '.$testMode,['api_key'=>'synthetic-'.$testMode,'openai_project_id'=>$project]);$before=$countPosts();denied(fn()=>$setup($failed),$code);
    check(count($stored($failed['binding_id'])['openai_webhook_pending'])===1,'uncertain_marker_survives');
    $mode='ok';denied(fn()=>$setup($failed),$testMode==='uncertain_absent'?'webhook_creation_uncertain':'webhook_secret_recovery_required');
    check($countPosts()===$before+1,'uncertain_retry_never_duplicates');
    if ($testMode==='uncertain_absent') {
        $failed=$edit($failed,['webhook_secret'=>$secret]);
        $saved=$stored($failed['binding_id']);
        check(count($saved['openai_webhook_pending'])===1,'manual_save_preserves_pending_attempt');
        // A manual edit in the original implementation could overwrite the pending state.
        $saved['openai_webhook']=$saved['openai_webhook_pending'][0]+['state'=>'manual'];
        unset($saved['openai_webhook_pending']);
        $db->prepare('UPDATE asterisk.voice_agent_bindings SET secrets_encrypted=? WHERE binding_id=?')
            ->execute([(new SecretStore())->encryptSecret(json_encode($saved,JSON_THROW_ON_ERROR)),$failed['binding_id']]);
        $differentKey=$make('Shared unresolved project',['api_key'=>'synthetic-second-key','openai_project_id'=>$project]);
        $differentProjectLabel=$make('Same key with different project label',['api_key'=>'synthetic-'.$testMode,'openai_project_id'=>'proj_alternative_label']);
        denied(fn()=>$setup($differentKey),'webhook_creation_uncertain');
        denied(fn()=>$setup($differentProjectLabel),'webhook_creation_uncertain');
        check($countPosts()===$before+1,'shared_project_uncertain_retry_never_duplicates');
        $newScope=$setup($edit($failed,['api_key'=>'synthetic-independent-key','openai_project_id'=>'proj_independent']));
        check($newScope['webhook_status']==='configured' && $countPosts()===$before+2,'unrelated_scope_can_configure');
        $remote=[];
        denied(fn()=>$setup($differentKey),'webhook_creation_uncertain');
        check($countPosts()===$before+2,'unrelated_setup_preserves_pending_attempt');
    }
}
$mode='ok';$remote=[];$environment=$make('Environment key',['api_key'=>'','openai_project_id'=>'proj_environment']);$environment=$setup($environment);
check($calls[count($calls)-1][2]==='synthetic-environment-api','environment_resolution');
$remote=[];$before=$countPosts();$failed=$make('Local save failure',['api_key'=>'synthetic-save-failure','openai_project_id'=>'proj_save_failure']);
$db->exec("CREATE TRIGGER asterisk.webhook_test_failure BEFORE INSERT ON asterisk.voice_agent_binding_audit FOR EACH ROW BEGIN IF NEW.action='webhook_configured' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic persistence failure'; END IF; END");
try { denied(fn()=>$setup($failed),'webhook_persistence_failed'); }
finally { $db->exec('DROP TRIGGER asterisk.webhook_test_failure'); }
check(count($stored($failed['binding_id'])['openai_webhook_pending'])===1 && !isset($stored($failed['binding_id'])['webhook_secret']),'failed_commit_retains_pending_not_plaintext');
denied(fn()=>$setup($failed),'webhook_secret_recovery_required');check($countPosts()===$before+1,'persistence_retry_reconciles');
$remote=[];$failed=$make('Preflight save failure',['api_key'=>'synthetic-preflight-failure','openai_project_id'=>'proj_preflight']);$before=$countPosts();
$db->exec("CREATE TRIGGER asterisk.webhook_test_failure BEFORE INSERT ON asterisk.voice_agent_binding_audit FOR EACH ROW BEGIN IF NEW.action='webhook_creation_started' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic persistence failure'; END IF; END");
try { denied(fn()=>$setup($failed),'webhook_persistence_failed'); }
finally { $db->exec('DROP TRIGGER asterisk.webhook_test_failure'); }
check($countPosts()===$before,'no_provider_change_without_durable_marker');
$before=count($calls);
$clever=$service->saveTrunk(null,['name'=>'Excluded CleverAI','provider'=>'cleverai','openai_project_id'=>'proj_external'],0,'test-admin');denied(fn()=>$setup($clever),'webhook_unsupported');
$grok=$service->saveTrunk(null,['name'=>'Excluded Grok','provider'=>'grok','grok_phone_number'=>'+390721123456','api_key'=>'synthetic-xai','webhook_secret'=>$secret],0,'test-admin');denied(fn()=>$setup($grok),'webhook_unsupported');
$live=$make('Excluded GPT-Live');$draft['provider_binding_id']=$live['binding_id'];$draft['conversation']['model']='gpt-live-1';
$draft['conversation']['options']=json_decode(file_get_contents(__DIR__.'/../../var/www/html/freepbx/rest/lib/agents/contracts/provider-models-v2.json'),true)['openai']['models'][4]['defaults'];
$draft['conversation']['options']['backend_instructions']='Test backend';
$service->save(null,['name'=>'Live-only','draft'=>$draft],0,'test-admin');denied(fn()=>$setup($live),'webhook_unsupported');
check(count($calls)===$before,'excluded_providers_not_contacted');
check($beforeVersions===$versions(),'existing_publications_unchanged');
echo "OpenAI automatic webhook setup, reuse, recovery, persistence, exclusions and secret redaction passed\n";
