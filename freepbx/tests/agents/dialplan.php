<?php
// Exercise the real FreePBX extension classes with synthetic destinations only.
require_once getenv('VOICE_AGENT_EXTENSIONS_FILE') ?: '/var/www/html/freepbx/admin/libraries/extensions.class.php';
require_once __DIR__.'/../../var/www/html/freepbx/admin/modules/satellite/functions.inc.php';
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Native.php';
class FreePBX {
    public static bool $broken = false;
    public static function Satellite() { return new class {
        public function agentPublishedVersions() { return [['agent_id'=>'internal','workflow_version'=>1,'fallback_destination_id'=>'extension:203'],['agent_id'=>'external','workflow_version'=>1,'fallback_destination_id'=>'extension:203']]; }
        public function agentDirectory() { return ['items'=>[
            ['id'=>'queue:600','available'=>true,'native_destination'=>'ext-queues,600,1'],
            ['id'=>'ivr:7','available'=>true,'native_destination'=>'ivr-7,s,1'],
            ['id'=>'ivr:8','available'=>false,'native_destination'=>'ivr-8,s,1']]]; }
        public function agentExtensions() { return [['id'=>'extension:203','name'=>'Synthetic']]; }
        public function agentDestinations() { if (FreePBX::$broken) throw new RuntimeException('corrupt_agent'); return [
            ['agent_id'=>'internal','enabled'=>true,'routable'=>true,'name'=>'<script>test</script>','published'=>['fallback_destination_id'=>'extension:203']],
            ['agent_id'=>'external','enabled'=>false,'routable'=>false,'name'=>'External','published'=>['fallback_destination_id'=>'extension:203']],
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
assert(in_array('Stasis(voice-agent,caller,internal)',$render('voice-agent-internal')));
assert(in_array('Set(TIMEOUT(absolute)=35)',$render('voice-agent-internal')));
assert($render('voice-agent-internal','T')===['Set(TIMEOUT(absolute)=0)','Goto(${VOICE_AGENT_FALLBACK},s,1)']);
assert(in_array('Goto(from-did-direct,203,1)',$render(satellite_agent_fallback_context('internal','extension:203'))));
assert(in_array('Goto(${VOICE_AGENT_FALLBACK},s,1)',$render('voice-agent-internal')));
assert(!in_array('Stasis(voice-agent,caller,external)',$render('voice-agent-external')));
assert(in_array('Goto(${VOICE_AGENT_FALLBACK},s,1)',$render('voice-agent-external')));
// Existing route references must remain safe when publications are cleared.
assert($render('voice-agent-draft_test')===['Hangup()']);
assert(array_column(satellite_destinations(),'destination')===['voice-agent-internal,s,1']);
assert($render('voice-agent-transfer','203')===['Set(TIMEOUT(absolute)=0)','UserEvent(VoiceAgentTransfer,token:${VOICE_AGENT_TRANSFER_TOKEN},destination_id:extension:203)','Goto(from-did-direct,203,1)']);
assert(count($render('voice-agent-headers'))===5);
// isTrunk marks an RTP-only destination in the NethVoice proxy, disabling SRTP.
assert(!str_contains(implode('\n',$render('voice-agent-headers')),'isTrunk'));
assert(str_contains($render('voice-agent-provider','_!')[0],'PJSIP/${AGENT_PROVIDER_TRUNK}/sip:${AGENT_PROVIDER_USER}@${AGENT_PROVIDER_HOST}:5061'));
assert($render('voice-agent-provider','h')===['Hangup()']);
assert(satellite_destinations()[0]['description']==='Agent: &lt;script&gt;test&lt;/script&gt;');
assert(satellite_getdestinfo('voice-agent-internal,s,1')['description']==='Agent: &lt;script&gt;test&lt;/script&gt;');
assert(satellite_check_destinations()[0]['description']==='Agent: &lt;script&gt;test&lt;/script&gt; fallback');
$before=$ext->lines;
FreePBX::$broken=true;
satellite_get_config_late('asterisk');
assert($ext->lines===$before, 'A corrupt agent must not emit partial contexts or break PBX reload');
echo "Native dialplan, correlation headers, transfer watchdog and disabled fallback passed\n";

assert($render('voice-agent-transfer-queue','600')===['Set(TIMEOUT(absolute)=0)','UserEvent(VoiceAgentTransfer,token:${VOICE_AGENT_TRANSFER_TOKEN},destination_id:queue:600)','Goto(ext-queues,600,1)']);
assert($render('voice-agent-transfer-ivr','7')===['Set(TIMEOUT(absolute)=0)','UserEvent(VoiceAgentTransfer,token:${VOICE_AGENT_TRANSFER_TOKEN},destination_id:ivr:7)','Goto(ivr-7,s,1)']);
assert(!isset($ext->lines['voice-agent-transfer-ivr']['8']));
