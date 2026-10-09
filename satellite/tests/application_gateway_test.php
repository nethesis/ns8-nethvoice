<?php
require __DIR__ . '/../../freepbx/var/www/html/freepbx/rest/lib/AgentApplicationClient.php';
require __DIR__ . '/../../freepbx/var/www/html/freepbx/rest/lib/AgentWorkflowClient.php';
$cases = array(
    array('/resources/{kind:connector|preset}/{resourceId:[a-z][a-z0-9_-]{0,47}}', array('kind'=>'connector', 'resourceId'=>'business'), '/resources/connector/business'),
    array('/resources/{kind:connector|preset}/{resourceId:[a-z][a-z0-9_-]{0,47}}/publish', array('kind'=>'preset', 'resourceId'=>'support-request'), '/resources/preset/support-request/publish'),
    array('/versions/{kind:connector|preset}/{resourceId:[a-z][a-z0-9_-]{0,47}}/{version:[1-9][0-9]{0,5}}', array('kind'=>'connector', 'resourceId'=>'business', 'version'=>'12'), '/versions/connector/business/12'),
    array('/grants/{agentId:internal|external|support-request}', array('agentId'=>'internal'), '/grants/internal'),
    array('/runs/{runId:[a-f0-9]{32}}/cancel', array('runId'=>str_repeat('a',32)), '/runs/'.str_repeat('a',32).'/cancel')
);
foreach ($cases as $case) {
    if (AgentApplicationClient::path($case[0],$case[1]) !== $case[2]) { throw new RuntimeException('Incorrect gateway path'); }
}
$client = new AgentApplicationClient();
foreach (array(
    array('GET','https://external.example','admin'),
    array('POST','/configuration','admin'),
    array('PUT','/resources/connector/business}','admin'),
    array('GET','/inventory',"admin\r\nAuthorization: injected")
) as $operation) {
    try { $client->request($operation[0],$operation[1],$operation[2]); }
    catch (InvalidArgumentException $error) { continue; }
    throw new RuntimeException('Gateway accepted an invalid operation');
}
echo "Gateway paths and forbidden operations passed\n";

// An editor load/save must preserve objects and lists in both directions.
$wire = '{"definition":{"nodes":[{"id":"call","config":{},"inputs":{}}],"edges":[],"tool_grants":[],"input_schema":{"type":"object","properties":{}},"layout":{},"output":{"0":"first"}},"fixtures":{},"input":{},"caller":{}}';
$decoded = AgentWorkflowClient::decodeObject($wire);
if (json_encode($decoded) !== $wire) { throw new RuntimeException('Workflow JSON types changed during forwarding'); }
$graph = $decoded['definition'];
if (!$graph->nodes[0]->config instanceof stdClass || !is_array($graph->edges) ||
    !$graph->input_schema->properties instanceof stdClass || !$graph->output instanceof stdClass) {
    throw new RuntimeException('Workflow objects and lists are not distinct');
}
foreach (array('[]', 'null', 'true', '{invalid}', '{"definition":') as $invalid) {
    try { AgentWorkflowClient::decodeObject($invalid); }
    catch (InvalidArgumentException $error) { continue; }
    throw new RuntimeException('Workflow gateway accepted a non-object or malformed body');
}
echo "Workflow JSON object/list round trips passed\n";

// Application input uses the same decoder before cURL encoding.
$connector = '{"definition":{"operations":[{"query":{},"body":{},"projection":{},"input_schema":{"type":"object","properties":{}},"output_schema":{"type":"object","properties":{}}}]},"expected_revision":0}';
if (json_encode(AgentWorkflowClient::decodeObject($connector)) !== $connector) {
    throw new RuntimeException('Connector empty objects changed at the gateway');
}
require __DIR__ . '/../../freepbx/var/www/html/freepbx/rest/lib/AgentWorkflowData.php';
foreach (array('+', '-', '()', '393') as $phone) {
    try { (new AgentWorkflowData(null))->contacts($phone); }
    catch (InvalidArgumentException $error) { continue; }
    throw new RuntimeException('Empty or short caller number reached PBX data queries');
}
echo "Connector JSON types and empty phone rejection passed\n";
