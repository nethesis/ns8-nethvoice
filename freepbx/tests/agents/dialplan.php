<?php
// Exercise the real FreePBX extension classes with synthetic destinations only.
require_once getenv('VOICE_AGENT_EXTENSIONS_FILE') ?: '/var/www/html/freepbx/admin/libraries/extensions.class.php';
require_once __DIR__.'/../../var/www/html/freepbx/admin/modules/satellite/functions.inc.php';
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Native.php';
class FreePBX {
    public static bool $broken = false;
    public static function Satellite() { return new class {
        public function agentConsultationDevices() {return ['203'=>['203','91203']];}
        public function agentPublishedVersions() { return [['agent_id'=>'receptionist','workflow_version'=>1,'fallback_destination_id'=>'extension:203'],['agent_id'=>'custom_disabled','workflow_version'=>1,'fallback_destination_id'=>'extension:203']]; }
        public function cleverAiTransport($id) { return $id==='clever_test'?['trunk_name'=>'VoiceAgentTrunk_99','project_id'=>'proj_external']:null; }
        public function agentDirectory() { return ['items'=>[
            ['id'=>'queue:600','available'=>true,'native_destination'=>'ext-queues,600,1'],
            ['id'=>'ivr:7','available'=>true,'native_destination'=>'ivr-7,s,1'],
            ['id'=>'ivr:8','available'=>false,'native_destination'=>'ivr-8,s,1']]]; }
        public function agentExtensions() { return [['id'=>'extension:203','name'=>'Synthetic']]; }
        public function agentDestinations() { if (FreePBX::$broken) throw new RuntimeException('corrupt_agent'); return [
            ['agent_id'=>'receptionist','enabled'=>true,'routable'=>true,'name'=>'<script>test</script>','published'=>['fallback_destination_id'=>'extension:203']],
            ['agent_id'=>'custom_disabled','enabled'=>false,'routable'=>false,'name'=>'Disabled custom','published'=>['fallback_destination_id'=>'extension:203']],
            ['agent_id'=>'clever_test','agent_type'=>'cleverai','enabled'=>true,'routable'=>true,'name'=>'CleverAI','published'=>null,'draft'=>['fallback_destination_id'=>'extension:203']],
            ['agent_id'=>'clever_hangup','agent_type'=>'cleverai','enabled'=>true,'routable'=>false,'name'=>'CleverAI not ready','published'=>null,'draft'=>['fallback_destination_id'=>'hangup']],
            ['agent_id'=>'draft_test','enabled'=>false,'routable'=>false,'name'=>'Draft','published'=>null],
        ]; }
    }; }
}
$ext=new class {
    public array $lines=[];
    public function add($context,$extension,$label,$object) { $this->lines[$context][$extension][]=[$label,$object->output()]; }
};
satellite_get_config_late('asterisk'); // transcription is disabled; agents remain available.
$render=fn($context,$extension='s')=>array_column($ext->lines[$context][$extension],1);
assert(in_array('Stasis(voice-agent,caller,receptionist)',$render('voice-agent-receptionist')));
assert(in_array('Set(TIMEOUT(absolute)=35)',$render('voice-agent-receptionist')));
assert($render('voice-agent-receptionist','T')===['Set(TIMEOUT(absolute)=0)','Goto(${VOICE_AGENT_FALLBACK},s,1)']);
assert(in_array('Goto(from-did-direct,203,1)',$render(satellite_agent_fallback_context('receptionist','extension:203'))));
assert($render(satellite_agent_fallback_context('receptionist','extension:203'))===['Set(TIMEOUT(absolute)=0)','StopMusicOnHold()','Goto(from-did-direct,203,1)']);
assert(in_array('Goto(${VOICE_AGENT_FALLBACK},s,1)',$render('voice-agent-receptionist')));
assert(!in_array('Stasis(voice-agent,caller,custom_disabled)',$render('voice-agent-custom_disabled')));
assert(in_array('Goto(${VOICE_AGENT_FALLBACK},s,1)',$render('voice-agent-custom_disabled')));
// Existing route references must remain safe when publications are cleared.
assert($render('voice-agent-draft_test')===['Hangup()']);
assert(array_column(satellite_destinations(),'destination')===['voice-agent-receptionist,s,1','voice-agent-clever_test,s,1']);
assert($render('voice-agent-transfer','203')===['Set(TIMEOUT(absolute)=0)','UserEvent(VoiceAgentTransfer,token:${VOICE_AGENT_TRANSFER_TOKEN},destination_id:extension:203)','Goto(from-did-direct,203,1)']);
assert(count($render('voice-agent-headers'))===5);
// isTrunk marks an RTP-only destination in the NethVoice proxy, disabling SRTP.
assert(!str_contains(implode('\n',$render('voice-agent-headers')),'isTrunk'));
assert(str_contains($render('voice-agent-provider','_!')[0],'PJSIP/${AGENT_PROVIDER_TRUNK}/sip:${AGENT_PROVIDER_USER}@${AGENT_PROVIDER_HOST}:5061'));
assert($render('voice-agent-provider','h')===['Hangup()']);
assert(satellite_destinations()[0]['description']==='Agent: &lt;script&gt;test&lt;/script&gt;');
assert(satellite_getdestinfo('voice-agent-receptionist,s,1')['description']==='Agent: &lt;script&gt;test&lt;/script&gt;');
assert(satellite_check_destinations()[0]['description']==='Agent: &lt;script&gt;test&lt;/script&gt; fallback');
assert($render('voice-agent-transfer-queue','600')===['Set(TIMEOUT(absolute)=0)','UserEvent(VoiceAgentTransfer,token:${VOICE_AGENT_TRANSFER_TOKEN},destination_id:queue:600)','Goto(ext-queues,600,1)']);
assert(!isset($ext->lines['voice-agent-transfer-ivr']));
$consult=$render('voice-agent-consult','203');
assert(str_contains($consult[0],'DB(DND/203)') && str_contains($consult[0],'DB(CF/203)'));
assert($consult[1]==='Dial(${PJSIP_DIAL_CONTACTS(203)}&${PJSIP_DIAL_CONTACTS(91203)},20,i)');
assert($consult[2]==='Hangup()');
assert(!preg_match('/from-internal|from-did-direct|[Vv]oice[Mm]ail/',implode("\n",$consult)));
$voicemail=$render('voice-agent-voicemail','203');
assert(str_contains($voicemail[0],'DB(AMPUSER/203/voicemail)'));
assert(str_contains($voicemail[1],'VM_INFO(203@${VOICE_AGENT_MAILBOX_CONTEXT},exists)'));
assert(str_contains($voicemail[1],'DIALPLAN_EXISTS(ext-local,vmu203,1)'));
assert($voicemail[3]==='StopMusicOnHold()');
assert($voicemail[4]==='UserEvent(VoiceAgentTransfer,token:${VOICE_AGENT_TRANSFER_TOKEN},destination_id:extension:203,mode:voicemail)');
assert($voicemail[5]==='Goto(ext-local,vmu203,1)');
assert(str_contains($voicemail[7],'Stasis(voice-agent,voicemail_failed,'));
assert(!preg_match('/Dial\(|from-internal|from-did-direct/',implode("\n",$voicemail)));
$handoff=$render('voice-agent-handoff');
assert(in_array('Set(TIMEOUT(absolute)=0)',$handoff));
assert(in_array('Bridge(${VOICE_AGENT_HANDOFF_PEER},x)',$handoff));
assert(str_contains($handoff[2],'IMPORT(${VOICE_AGENT_HANDOFF_PEER},VOICE_AGENT_HANDOFF_TOKEN)'));
assert(str_contains($handoff[2],'VOICE_AGENT_HANDOFF_PEER_ID'));
assert(in_array('Wait(10)',$render('voice-agent-handoff-wait')));
assert(in_array('Stasis(voice-agent,handoff_failed,${AGENT_SESSION_ID},${VOICE_AGENT_HANDOFF_TOKEN})',$handoff));

$clever=$render('voice-agent-clever_test');
assert(!str_contains(implode("\n",$clever),'Stasis('));
assert(!str_contains(implode("\n",$clever),'Answer('));
assert(!str_contains(implode("\n",$clever),'UserEvent('));
assert(in_array('Set(__CLEVERAI_IDENTITY=agent:clever_test)',$clever));
assert(in_array('Set(__CLEVERAI_CALLER=${FILTER(\\x20-\\x7e\\x80-\\xff,${CALLERID(num)})})',$clever));
assert(in_array('Set(__CLEVERAI_CALLER_NAME=${FILTER(\\x20-\\x7e\\x80-\\xff,${CALLERID(name)})})',$clever));
assert(in_array('Set(__CLEVERAI_DID=${FILTER(0-9+*#a-zA-Z_:-,${FROM_DID})})',$clever));
assert(in_array('ExecIf($["${CLEVERAI_DID}" = ""]?Set(__CLEVERAI_DID=${CLEVERAI_IDENTITY}))',$clever));
assert(in_array('Dial(PJSIP/VoiceAgentTrunk_99/sip:proj_external@sip.api.openai.com:5061\\;transport=tls,20,b(voice-agent-cleverai-headers^s^1))',$clever));
assert($render('voice-agent-cleverai-headers')===['Set(PJSIP_HEADER(add,X-OS-Caller)=${CLEVERAI_CALLER})','Set(PJSIP_HEADER(add,X-OS-Caller-Name)=${CLEVERAI_CALLER_NAME})','Set(PJSIP_HEADER(add,X-OS-DID)=${CLEVERAI_DID})','Set(PJSIP_HEADER(add,X-OS-Extension)=${CLEVERAI_IDENTITY})','Return()']);
$guard=array_search('GotoIf($["${DIALSTATUS}" = "ANSWER" | "${DIALSTATUS}" = "CANCEL"]?finished)',$clever,true);
assert($guard!==false && $clever[$guard+1]==='Set(TIMEOUT(absolute)=0)' && $clever[$guard+2]==='Goto(${CLEVERAI_FALLBACK})');
assert(end($clever)==='Hangup()');
assert(array_column($ext->lines['voice-agent-clever_test']['s'],0)[count($clever)-1]==='finished');
assert(!str_contains(implode("\n",$render('voice-agent-clever_hangup')),'Dial('));
assert(in_array('Set(__CLEVERAI_FALLBACK=app-blackhole,hangup,1)',$render('voice-agent-clever_hangup')));
assert(in_array('Set(__CLEVERAI_FALLBACK=from-did-direct,203,1)',$clever));
assert(satellite_check_destinations()[2]['description']==='Agent: CleverAI fallback');

FreePBX::$broken=true;
try {
    satellite_get_config_late('asterisk');
    assert(false, 'Agent dialplan errors must propagate to the PBX reload');
} catch (RuntimeException $error) {
    assert($error->getMessage()==='corrupt_agent');
}
echo "Native dialplan, correlation headers, transfer watchdog, disabled fallback and error propagation passed\n";
