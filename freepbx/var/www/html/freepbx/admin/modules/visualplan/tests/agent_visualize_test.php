<?php

define('NETHVPLAN_VISUALIZE_LIBRARY_MODE', true);
require_once __DIR__ . '/../htdocs/visualize.php';

function check($condition, $message)
{
    if (!$condition) { throw new RuntimeException($message); }
}

foreach (array('en', 'it') as $language) {
    $source = file_get_contents(__DIR__ . '/../htdocs/i18n/' . $language . '.js');
    foreach (array($source, rtrim($source), rtrim($source) . "\r\n") as $assignment) {
        $labels = nethvplan_read_labels($assignment);
        check(isset($labels['base_agent_string']) && isset($labels['base_incoming_string']), 'Existing and Agent translations did not load');
    }
}

$langArray = array('base_agent_string' => 'Agent', 'view_agent_flow_string' => 'Flow',
    'view_agent_trunk_string' => 'Trunk', 'base_agent_fallback_string' => 'Fallback',
    'base_alternative_string' => 'Alternative', 'base_disable_string' => 'Disabled');
$widgetTemplate = array('userData' => array(), 'entities' => array());
$connectionTemplate = array('type' => 'MyConnection');
$xPos = $yPos = 10;
$data = array('satellite-agent-destination' => array(), 'agent-trunks' => array(1 => array('name' => 'Provider trunk')));
foreach (array(10 => 'satellite-agent-destination-20,s,1', 20 => 'custom-handler,entry,7') as $id => $fallback) {
    $data['satellite-agent-destination'][$id] = array('id' => $id, 'freepbx_name' => 'CleverAI_' . $id,
        'cleverai_trunk_id' => 1, 'cleverai_flow' => 'sales', 'fallback_destination' => $fallback);
}
check(nethvplan_getDestination('satellite-agent-destination-10,s,1') === array('satellite-agent-destination', '10'), 'Agent destination parser failed');
$widget = nethvplan_bindData($data, 'satellite-agent-destination', 10);
check($widget['id'] === 'satellite-agent-destination%10', 'Existing Agent identity changed');
check($widget['entities'][0]['id'] === $widget['id'], 'Input port does not match incoming connections');
check($widget['entities'][3]['destination'] === 'satellite-agent-destination-20,s,1', 'Existing selection cannot expand fallback');
check($widget['userData']['fallback_touched'] === false, 'Imported fallback is marked modified');
check($widget['entities'][2]['text'] === 'Trunk: Provider trunk', 'Trunk details missing');
$connection = nethvplan_bindConnection($data, 'satellite-agent-destination', 10);
check($connection['source']['port'] === 'output_agent_fallback%10', 'Fallback output port mismatch');
check($connection['target']['port'] === 'input_satellite-agent-destination%20', 'Agent target port mismatch');
$widgets = $connections = array();
nethvplan_explore($data, 'satellite-agent-destination-10,s,1', array());
check(count($widgets) === 3 && count($connections) === 2, 'Fallback branch reconstruction failed');
check($widgets[1]['userData']['fallback_destination'] === 'custom-handler,entry,7', 'Opaque fallback priority was lost');

$data['satellite-agent-destination'][10]['fallback_destination'] = 'satellite-agent-destination-999,s,1';
check(nethvplan_bindConnection($data, 'satellite-agent-destination', 10) === array(), 'Stale Agent fallback must not produce a dangling connection');
$widget = nethvplan_bindData($data, 'satellite-agent-destination', 10);
check($widget['userData']['fallback_destination'] === 'satellite-agent-destination-999,s,1', 'Stale fallback value was discarded');
$data['satellite-agent-destination'][10]['fallback_destination'] = null;
$widgets = $connections = array();
nethvplan_explore($data, 'satellite-agent-destination-10,s,1', array());
check(count($widgets) === 1 && !$connections, 'Empty fallback rendered an extra block');

echo "VisualPlan Agent visualization tests passed\n";
