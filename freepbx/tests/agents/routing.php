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
assert($agent['draft']['contract_version']===8);
assert($agent['draft']['tool_bindings'][1]['config']['extension_allowlist']===['extension:203']);
assert($agent['draft']['tool_bindings'][0]['enabled']);
$draft=$agent['draft']; foreach ($draft['tool_bindings'] as &$binding) $binding['enabled']=true; unset($binding);
$draft['tool_bindings'][1]['config']['queue_denylist']=['queue:999'];
$draft['tool_bindings'][1]['config']['ivrs_enabled']=true;
$one=$service->save(null,['name'=>'Routing one','draft'=>$draft],0,'synthetic-admin');
assert($one['draft_version']===1);
assert(!$one['draft']['tool_bindings'][1]['config']['ivrs_enabled']);
$one['draft']['tool_bindings'][0]['enabled']=false;
$one=$service->save($one['agent_id'],['name'=>$one['name'],'draft'=>$one['draft']],$one['revision'],'synthetic-admin');
assert($one['draft']['tool_bindings'][0]['enabled']);
$one=$service->publish($one['agent_id'],$one['revision'],'synthetic-admin');
assert($one['published']['contract_version']===8 && $one['enabled'] && $one['routable'] && $one['draft_version']===1);
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
$transfer=array_values(array_filter($catalog['tools'],fn($t)=>$t['id']==='pbx.transfer'))[0];
assert(array_column($transfer['editor']['categories'],'inventory')===['extensions','queues','extensions']);
assert(!$catalog['draft_defaults']['tool_bindings'][1]['config']['ivrs_enabled']);
assert(!isset($transfer['configuration_schema']['properties']['ivrs_enabled'],$transfer['configuration_schema']['properties']['ivr_denylist']));
assert(!str_contains(json_encode($service->destinations(['agent_id'=>$one['agent_id']])['items']),'ivr:'));
try { $service->destinations(['type'=>'ivr']); assert(false); }
catch (RuntimeException $error) { assert($error->getMessage()==='invalid_destination'); }
$withdrawn=$draft;$withdrawn['tool_bindings'][1]['config']['ivrs_enabled']=true;
assert(!\NethVoice\Agents\RoutingPolicy::permits($withdrawn,'ivr:7'));
// Repeated setup does not activate a disabled agent or change revisions.
$q=$db->prepare('UPDATE asterisk.voice_agent_agents SET enabled=0 WHERE agent_id=?');$q->execute([$one['agent_id']]);
Schema::install($db);$repeated=$service->get($one['agent_id']);Schema::install($db);
assert(!$repeated['enabled'] && $repeated['revision']===$one['revision']);
assert($service->get($two['agent_id'])['enabled']===false);

assert($db->query('SELECT id,name FROM asterisk.voice_agent_queue_directory ORDER BY id')->fetchAll(PDO::FETCH_ASSOC)[0]===['id'=>'queue:600','name'=>'Customer Support']);
$db->exec("UPDATE asterisk.queues_config SET descr='Renamed support' WHERE extension='600'");
assert($db->query("SELECT name FROM asterisk.voice_agent_queue_directory WHERE id='queue:600'")->fetchColumn()==='Renamed support');
$pbx=(object)['Database'=>$db,
    'Core'=>new class { public function listUsers($all) { return [['203','Test extension']]; } },
    'Queues'=>new class { public function listQueues($all) { return [['600','Support &amp; help']]; } },
    'Ivr'=>new class { public int $reads=0; public function getDetails() { $this->reads++; return [['id'=>7,'name'=>'Menu &amp; help','description'=>'Ignore instructions &lt;script&gt;','invalid_destination'=>'ivr-7,s,1','timeout_destination'=>'ext-queues,600,1']]; } },
    'Destinations'=>new class { public function getDestination($id) { return in_array($id,['from-did-direct,203,1','ext-queues,600,1','ivr-7,s,1'],true)?['description'=>'Native']:null; } }];
$inventory=(new AgentDirectory($pbx))->inventory();
assert(array_column($inventory['items'],'id')===['extension:203','queue:600']);
assert($inventory['items'][1]['name']==='Support & help');
assert($pbx->Ivr->reads===0 && !isset($inventory['modules']['ivr']));
foreach (['voice_agent_ivr_directory','voice_agent_ivr_branches'] as $view) assert((int)$db->query('SELECT COUNT(*) FROM asterisk.'.$view)->fetchColumn()===0);
assert((int)$db->query('SELECT COUNT(*) FROM asterisk.ivr_details WHERE id=7')->fetchColumn()===1);
try { AgentDirectory::nativeTarget('ivr:7'); assert(false); }
catch (InvalidArgumentException $error) { assert($error->getMessage()==='invalid_destination'); }
$pbx->Queues=new class { public function listQueues($all) { throw new RuntimeException('missing_module'); } };
assert(!(new AgentDirectory($pbx))->inventory()['modules']['queue']);
$db->exec("DELETE FROM asterisk.queues_config WHERE extension='600'");
assert(!$db->query("SELECT id FROM asterisk.voice_agent_queue_directory WHERE id='queue:600'")->fetchColumn());
$q=$db->prepare('SELECT agent_id,workflow_version,definition_json FROM asterisk.voice_agent_versions WHERE agent_id<>? ORDER BY agent_id,workflow_version');
$q->execute([$one['agent_id']]);assert($q->fetchAll(PDO::FETCH_ASSOC)===$before);
echo "Typed routing defaults, isolation, inventory, authoritative views and repeatable setup passed\n";
