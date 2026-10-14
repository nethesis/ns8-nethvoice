<?php
require_once __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/VisualPlan.php';
use NethVoice\Agents\VisualPlan;
$agent=['agent_id'=>'internal','name'=>'Internal','kind'=>'builtin','routable'=>true,'published'=>['fallback_destination_id'=>'extension:203'],'revision'=>3];
$widget=VisualPlan::widget($agent, ['base_agent_string'=>'Agent','base_details_string'=>'Configure']);
assert($widget['userData']['agent_id']==='internal');
assert(VisualPlan::resolve($widget, fn($id)=>$agent)==='voice-agent-internal,s,1');
assert(count(array_filter($widget['entities'], fn($e)=>$e['type']==='output'))===1);
$connection=['source'=>['node'=>'incoming%test','port'=>'output_incoming%test'],'target'=>['node'=>$widget['id'],'port'=>'input_'.$widget['id']]];
VisualPlan::validateGraph([$widget],[$connection],fn($id)=>$agent);
foreach ([[[],[$connection]],[[$widget],[array_replace($connection,['source'=>['node'=>$widget['id']]])]],[[$widget],[array_replace($connection,['target'=>['node'=>$widget['id'],'port'=>'forged']])]]] as [$widgets,$connections]) {
    try { VisualPlan::validateGraph($widgets,$connections,fn($id)=>$agent); throw new Exception('unsafe_graph_accepted'); }
    catch (RuntimeException $error) { assert($error->getMessage()==='invalid_agent_reference'); }
}
foreach ([['id'=>'satellite-agent-destination%../bad','userData'=>['agent_id'=>'../bad']], ['id'=>'satellite-agent-destination%internal','userData'=>['agent_id'=>'external']]] as $invalid) {
    try { VisualPlan::resolve($invalid,fn($id)=>$agent); throw new Exception('unsafe_widget_accepted'); }
    catch (RuntimeException $error) { assert($error->getMessage()==='invalid_agent_reference'); }
}
$hangup=['id'=>'app-blackhole%hangup'];
$fallback=['source'=>['node'=>$widget['id'],'port'=>'output_agent_fallback%internal'],'target'=>['node'=>$hangup['id'],'port'=>'input_'.$hangup['id']]];
VisualPlan::validateGraph([$widget,$hangup],[$connection,$fallback],fn($id)=>$agent);
$back=['source'=>['node'=>$hangup['id'],'port'=>'output_back'],'target'=>['node'=>$widget['id'],'port'=>'input_'.$widget['id']]];
foreach ([[$fallback,$fallback],[$fallback,$back],[array_replace($fallback,['source'=>['node'=>$widget['id'],'port'=>'output_forged']])],[array_replace($fallback,['target'=>['node'=>'missing','port'=>'input_missing']])]] as $edges) {
    try { VisualPlan::validateGraph([$widget,$hangup],$edges,fn($id)=>$agent); throw new Exception('unsafe_fallback_accepted'); }
    catch (RuntimeException $error) { assert($error->getMessage()==='invalid_agent_reference'); }
}
$agent['routable']=false;
try { VisualPlan::resolve($widget,fn($id)=>$agent); throw new Exception('disabled_agent_accepted'); }
catch (RuntimeException $error) { assert($error->getMessage()==='agent_not_ready'); }
echo "VisualPlan stable references and readiness passed\n";
