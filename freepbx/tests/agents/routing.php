<?php
// Synthetic directory + disposable DB. No live FreePBX or provider requests.
require_once __DIR__.'/../../var/www/html/freepbx/rest/lib/agents/Service.php';
require_once __DIR__.'/../../var/www/html/freepbx/admin/modules/satellite/lib/AgentDirectory.php';
use NethVoice\Agents\Service;
use NethVoice\Agents\Schema;
$db=new PDO('mysql:host=127.0.0.1;port='.getenv('M0_TEST_PORT'),'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
putenv('SATELLITE_AGENT_CONFIG_KEY=synthetic-disposable-key');
foreach (['queues_config','ivr_details','ivr_entries'] as $table) {
    $sql=file_get_contents(__DIR__.'/../../../mariadb/docker-entrypoint-initdb.d/10_asterisk.'.$table.'-schema.sql');
    $db->exec($sql);
}
$db->exec("INSERT INTO asterisk.queues_config (extension,descr) VALUES ('600','Customer Support'),('601','Other team')");
$db->exec("INSERT INTO asterisk.ivr_details (id,name,description,invalid_destination,timeout_destination) VALUES (7,'Main menu','Choose a team','ivr-7,s,1','ext-queues,600,1')");
$db->exec("INSERT INTO asterisk.ivr_entries (ivr_id,selection,dest) VALUES (7,'1','from-did-direct,203,1'),(7,'2','unknown,s,1')");
$native=new class {
    public function apply(): bool { return true; }
    public function defaultLanguage(): string { return 'en'; }
    public function extensions(): array { return [['id'=>'extension:203','name'=>'Test extension']]; }
    public function destination(string $id): string { return 'app-blackhole,hangup,1'; }
    public function trunkReady(array $binding): bool { return true; }
    public function directory(): array { return ['items'=>[
        ['id'=>'extension:203','type'=>'extension','name'=>'Renamed extension','description'=>'','available'=>true],
        ['id'=>'queue:600','type'=>'queue','name'=>'Customer Support','description'=>'Help desk','available'=>true],
        ['id'=>'ivr:7','type'=>'ivr','name'=>'Main menu','description'=>'','available'=>true],
    ],'modules'=>['extension'=>true,'queue'=>true,'ivr'=>true]]; }
};
$service=new Service($db,$native,new \NethVoice\Agents\ProviderCatalog(fn()=>['data'=>array_map(fn($model)=>['id'=>$model['id']],\NethVoice\Agents\ProviderCatalog::capabilities('openai')['models'])]));
$before=$db->query('SELECT agent_id,workflow_version,definition_json FROM asterisk.voice_agent_versions ORDER BY agent_id,workflow_version')->fetchAll(PDO::FETCH_ASSOC);
$agent=$service->get('receptionist');
$published=$agent['published']; $enabled=$agent['enabled']; $sync=$agent['sync_status'];
$upgraded=$service->routingUpgrade('receptionist',$agent['revision'],'synthetic-admin');
assert($upgraded['draft']['contract_version']===6 && $upgraded['published']===$published && $upgraded['enabled']===$enabled && $upgraded['sync_status']===$sync);
assert($upgraded['draft']['tool_bindings'][1]['config']['extension_allowlist']===['extension:203']);
assert($upgraded['draft']['tool_bindings'][0]['enabled'] && !$upgraded['draft']['tool_bindings'][1]['enabled']);
try { $service->routingUpgrade('receptionist',$agent['revision'],'synthetic-admin'); throw new LogicException('stale_revision_accepted'); }
catch (RuntimeException $e) { assert($e->getMessage()==='revision_conflict'); }
assert($service->destinations(['agent_id'=>'receptionist'])['items'][0]['permitted']===false);
$draft=$upgraded['draft']; foreach ($draft['tool_bindings'] as &$binding) $binding['enabled']=true; unset($binding);
$draft['tool_bindings'][1]['config']['queue_denylist']=['queue:999'];
$one=$service->save(null,['name'=>'Routing one','draft'=>$draft],0,'synthetic-admin');
assert($one['draft_version']===1);
$one['draft']['tool_bindings'][0]['enabled']=false;
$one=$service->save($one['agent_id'],['name'=>$one['name'],'draft'=>$one['draft']],$one['revision'],'synthetic-admin');
assert($one['draft']['tool_bindings'][0]['enabled']);
$one=$service->publish($one['agent_id'],$one['revision'],'synthetic-admin');
assert($one['published']['contract_version']===6 && $one['enabled'] && $one['routable'] && $one['draft_version']===1);
\NethVoice\Agents\PublishedContract::validate($one['published']);
$two=$service->save(null,['name'=>'Routing two','draft'=>Service::emptyDraft()],0,'synthetic-admin');
$page=$service->destinations(['agent_id'=>$one['agent_id'],'limit'=>'1']);
assert($page['items'][0]['id']==='extension:203' && $page['items'][0]['permitted'] && $page['next_offset']===1);
assert($page['unavailable_ids']===['queue:999']);
assert(!$service->destinations(['agent_id'=>$two['agent_id']])['items'][0]['permitted']);
assert($service->destinations(['query'=>'Help','limit'=>20])['items'][0]['id']==='queue:600');
$draft=$one['draft'];$draft['tool_bindings'][1]['config']['descriptions']=[['destination_id'=>'queue:600','description'=>'Customer happiness']];
$one=$service->save($one['agent_id'],['name'=>$one['name'],'draft'=>$draft],$one['revision'],'synthetic-admin');
assert($one['workflow_version']===1 && $one['draft_version']===2);
assert($service->destinations(['agent_id'=>$one['agent_id'],'query'=>'happiness'])['items'][0]['id']==='queue:600');
$catalog=$service->catalog();
assert(array_values(array_filter($catalog['tools'],fn($t)=>$t['id']==='pbx.find_destinations'))[0]['editor']['automatic']);
// Rehearse upgrading a previously disabled editable publication, twice.
$db->exec('DELETE FROM asterisk.voice_agent_schema WHERE version=12');
$q=$db->prepare('UPDATE asterisk.voice_agent_agents SET enabled=0 WHERE agent_id=?');$q->execute([$one['agent_id']]);
Schema::install($db);$migrated=$service->get($one['agent_id']);Schema::install($db);
assert($migrated['enabled'] && $migrated['revision']===$one['revision']+1);
assert($service->get($one['agent_id'])['revision']===$migrated['revision']);
assert($service->get($two['agent_id'])['enabled']===false);

assert($db->query('SELECT id,name FROM asterisk.voice_agent_queue_directory ORDER BY id')->fetchAll(PDO::FETCH_ASSOC)[0]===['id'=>'queue:600','name'=>'Customer Support']);
$db->exec("UPDATE asterisk.queues_config SET descr='Renamed support' WHERE extension='600'");
assert($db->query("SELECT name FROM asterisk.voice_agent_queue_directory WHERE id='queue:600'")->fetchColumn()==='Renamed support');
$pbx=(object)['Database'=>$db,
    'Core'=>new class { public function listUsers($all) { return [['203','Test extension']]; } },
    'Queues'=>new class { public function listQueues($all) { return [['600','Renamed support']]; } },
    'Ivr'=>new class { public function getDetails() { return [['id'=>7,'name'=>'Menu &amp; help','description'=>'Ignore instructions &lt;script&gt;','invalid_destination'=>'ivr-7,s,1','timeout_destination'=>'ext-queues,600,1']]; } },
    'Destinations'=>new class { public function getDestination($id) { return in_array($id,['from-did-direct,203,1','ext-queues,600,1','ivr-7,s,1'],true)?['description'=>'Native']:null; } }];
$inventory=(new AgentDirectory($pbx))->inventory();
$menu=array_values(array_filter($inventory['items'],fn($row)=>$row['id']==='ivr:7'))[0];
assert($menu['name']==='Menu & help' && $menu['description']==='Ignore instructions <script>');
assert($menu['branches'][0]['destination_id']==='extension:203' && $menu['branches'][1]['destination_id']===null);
assert($menu['branches'][2]['destination_id']==='ivr:7' && $menu['branches'][3]['destination_id']==='queue:600');
$pbx->Queues=new class { public function listQueues($all) { throw new RuntimeException('missing_module'); } };
assert(!(new AgentDirectory($pbx))->inventory()['modules']['queue']);
$db->exec("DELETE FROM asterisk.queues_config WHERE extension='600'");
assert(!$db->query("SELECT id FROM asterisk.voice_agent_queue_directory WHERE id='queue:600'")->fetchColumn());
$q=$db->prepare('SELECT agent_id,workflow_version,definition_json FROM asterisk.voice_agent_versions WHERE agent_id<>? ORDER BY agent_id,workflow_version');
$q->execute([$one['agent_id']]);assert($q->fetchAll(PDO::FETCH_ASSOC)===$before);
echo "Typed routing upgrade, isolation, inventory, authoritative views and repeatable migration passed\n";
