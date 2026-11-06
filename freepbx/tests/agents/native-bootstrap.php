<?php
// The REST bootstrap loads only the BMO class; destination hooks start absent.
interface BMO {}
class FreePBX_Helpers { public $FreePBX; public $db; }
require_once __DIR__.'/../../var/www/html/freepbx/admin/modules/satellite/Satellite.class.php';
assert(!function_exists('satellite_agent_destination_key'));
$destinations=new class {
    public int $calls=0;
    public function destinationUsageArray($destination) {
        assert($destination==='voice-agent-internal,s,1'); $this->calls++; return [];
    }
};
$freepbx=(object)['Database'=>null,'Destinations'=>$destinations];
$satellite=new Satellite($freepbx);
assert(!$satellite->agentDestinationInUse('internal'));
assert($destinations->calls===1);
try { $satellite->agentDestinationInUse('../bad'); throw new RuntimeException('unsafe_destination'); }
catch (InvalidArgumentException $error) { assert($error->getMessage()==='invalid_identifier'); }
echo "Lazy REST BMO bootstrap resolves native destination references safely\n";
