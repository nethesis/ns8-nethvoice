<?php
require __DIR__ . '/../../freepbx/var/www/html/freepbx/rest/lib/AgentApplicationClient.php';
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
