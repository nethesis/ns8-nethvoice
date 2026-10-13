<?php
// Exercise the real FreePBX extension classes with synthetic destinations only.
require_once '/var/www/html/freepbx/admin/libraries/extensions.class.php';
require_once __DIR__.'/../../var/www/html/freepbx/admin/modules/satellite/functions.inc.php';
class FreePBX {
    public static function Satellite() { return new class {
        public function agentExtensions() { return [['id'=>'extension:203','name'=>'Synthetic']]; }
        public function agentDestinations() { return [
            ['agent_id'=>'internal','enabled'=>true,'routable'=>true,'name'=>'Internal','published'=>['fallback_destination_id'=>'extension:203']],
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
assert(in_array('Goto(from-did-direct,203,1)',$render('voice-agent-internal')));
assert(!in_array('Stasis(voice-agent,caller,external)',$render('voice-agent-external')));
assert(in_array('Goto(from-did-direct,203,1)',$render('voice-agent-external')));
assert(!isset($ext->lines['voice-agent-draft_test']));
assert($render('voice-agent-transfer','203')===['Set(TIMEOUT(absolute)=0)','Goto(from-did-direct,203,1)']);
assert(count($render('voice-agent-headers'))===5);
assert(str_contains($render('voice-agent-provider','_!')[0],'PJSIP/${AGENT_PROVIDER_USER}@${AGENT_PROVIDER_TRUNK}'));
echo "Native dialplan, correlation headers, transfer watchdog and disabled fallback passed\n";
