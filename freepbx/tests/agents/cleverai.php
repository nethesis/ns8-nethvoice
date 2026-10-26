<?php
// Reuse the disposable service harness, never a live PBX database.
require __DIR__.'/services.php';
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/VisualPlan.php';
$versions=$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN);
putenv('SATELLITE_AGENT_CONFIG_KEY');
$clever=$service->saveTrunk(null,['name'=>'CleverAI transport','provider'=>'cleverai','openai_project_id'=>'proj_external'],0,'test-admin');
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
check($clever['provider']==='cleverai' && !$clever['api_key_configured'] && !$clever['webhook_secret_configured'],'external_credentials_not_discovered');
$raw=$db->query("SELECT * FROM asterisk.voice_agent_bindings WHERE binding_id=".$db->quote($clever['binding_id']))->fetch(PDO::FETCH_ASSOC);
check($raw['provider']==='openai' && $raw['secrets_encrypted']==='','external_reuses_transport_without_secrets');
check(!$db->query("SELECT binding_id FROM asterisk.voice_agent_runtime_bindings WHERE binding_id=".$db->quote($clever['binding_id']))->fetchColumn(),'external_binding_hidden_from_runtime');
denied(fn()=>$service->saveTrunk(null,['name'=>'Secrets forbidden','provider'=>'cleverai','openai_project_id'=>'proj_external','api_key'=>'forbidden'],0,'test-admin'),'invalid_fields');
denied(fn()=>$service->models(['provider'=>'openai','binding_id'=>$clever['binding_id']]),'invalid_provider');
denied(fn()=>$service->voices($clever['binding_id']),'incompatible_trunk');
$local=$service->get('receptionist');$bad=$local['draft'];$bad['provider_binding_id']=$clever['binding_id'];
denied(fn()=>$service->save(null,['name'=>'Bad local','draft'=>$bad],0,'test-admin'),'incompatible_trunk');
$config=['execution'=>'cleverai','provider_binding_id'=>$clever['binding_id'],'fallback_destination_id'=>'hangup'];
$native->applyOk=false;
$remote=$service->save(null,['name'=>'External agent','draft'=>$config],0,'test-admin');
check($remote['kind']==='custom' && $remote['agent_type']==='cleverai' && $remote['enabled'] && !$remote['published'] && !$remote['workflow_version'],'external_saved_without_publication');
check(!$remote['routable'] && $remote['sync_status']==='error','external_reload_failure_safe');
$native->applyOk=true;$service->synchronize('test-admin');$remote=$service->get($remote['agent_id']);
check($remote['routable'],'external_save_activation');
check($service->cleverAiTransport($remote['agent_id'])===['trunk_name'=>'VoiceAgentTrunk_'.$raw['id'],'project_id'=>'proj_external'],'external_managed_native_transport');
check(!$db->query("SELECT agent_id FROM asterisk.voice_agent_published WHERE agent_id=".$db->quote($remote['agent_id']))->fetchColumn(),'external_absent_from_runtime_publications');
check((int)$db->query("SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_runs WHERE agent_id=".$db->quote($remote['agent_id']))->fetchColumn()===0,'no_synthetic_external_runs');
$writes=0;$service->saveVisualPlan([$remote['agent_id']=>$remote['revision']],function() use (&$writes) { $writes++; });check($writes===1,'external_visualplan_save');
$native->ready=false;check(!$service->get($remote['agent_id'])['routable'],'external_waits_for_trunk_readiness');$native->ready=true;
$other=$service->save(null,['name'=>'Other external','draft'=>$config],0,'test-admin');
denied(fn()=>$service->setFallbacks([
    $remote['agent_id']=>['expected_revision'=>$remote['revision'],'destination_id'=>'native:voice-agent-'.$other['agent_id'].',s,1'],
    $other['agent_id']=>['expected_revision'=>$other['revision'],'destination_id'=>'native:voice-agent-'.$remote['agent_id'].',s,1'],
],'test-admin'),'fallback_cycle');
$service->remove($other['agent_id'],$other['revision'],'test-admin');
check(\NethVoice\Agents\VisualPlan::resolve(\NethVoice\Agents\VisualPlan::widget($remote),fn()=>$remote)==='voice-agent-'.$remote['agent_id'].',s,1','external_native_visualplan_identity');
denied(fn()=>$service->publish($remote['agent_id'],$remote['revision'],'test-admin'),'external_agent_not_publishable');
$bad=$config;$bad['provider_binding_id']=$trunk['binding_id'];
denied(fn()=>$service->save($remote['agent_id'],['name'=>'Bad external','draft'=>$bad],$remote['revision'],'test-admin'),'incompatible_trunk');
$bad=$config;$bad['conversation']=[];
denied(fn()=>$service->save($remote['agent_id'],['name'=>'Bad external','draft'=>$bad],$remote['revision'],'test-admin'),'invalid_fields');
denied(fn()=>$service->save($remote['agent_id'],['name'=>'Type switch','draft'=>$local['draft']],$remote['revision'],'test-admin'),'invalid_agent_type');
$service->setFallbacks([$remote['agent_id']=>['expected_revision'=>$remote['revision'],'destination_id'=>'extension:203']],'test-admin');
$remote=$service->get($remote['agent_id']);
check($remote['draft']['fallback_destination_id']==='extension:203' && !$remote['published'],'external_fallback_without_publication');
check(\NethVoice\Agents\VisualPlan::widget($remote)['entities'][1]['destination']==='from-did-direct,203,1','external_visualplan_fallback');
\NethVoice\Agents\Schema::install($db);check($service->get($remote['agent_id'])===$remote,'repeat_install_preserves_external_configuration');
check($versions===$db->query('SELECT definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_COLUMN),'external_does_not_mutate_publications');
denied(fn()=>$service->removeTrunk($clever['binding_id'],$clever['revision'],'test-admin'),'trunk_in_use');
$native->inUse=true;denied(fn()=>$service->remove($remote['agent_id'],$remote['revision'],'test-admin'),'agent_in_use');$native->inUse=false;
denied(fn()=>$service->remove($remote['agent_id'],$remote['revision']-1,'test-admin'),'revision_conflict');
$service->remove($remote['agent_id'],$remote['revision'],'test-admin');
$clever=$service->saveTrunk($clever['binding_id'],['name'=>'Renamed CleverAI','provider'=>'cleverai','openai_project_id'=>'proj_updated'],$clever['revision'],'test-admin');
check($clever['provider']==='cleverai' && !$clever['api_key_configured'],'external_safe_trunk_edit');
$service->removeTrunk($clever['binding_id'],$clever['revision'],'test-admin');
echo "CleverAI transport, compatibility, Save activation, VisualPlan, immutable publications and safe deletion passed\n";
