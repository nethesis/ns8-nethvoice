<?php
/** Isolated MariaDB migration, binding and prepared phonebook/CDR acceptance. */
$root = dirname(__DIR__, 2);
$module = $root . '/freepbx/var/www/html/freepbx/admin/modules/satellite';
require_once $module . '/lib/AgentSchema.php';
require_once $module . '/lib/AgentWorkflowDestination.php';
require_once $module . '/lib/AgentDestinationRepository.php';
require_once $root . '/freepbx/var/www/html/freepbx/rest/lib/AgentWorkflowData.php';
function checkWorkflow($condition, $message) { if (!$condition) { throw new RuntimeException($message); } }
$dsn = 'mysql:host=127.0.0.1;port=' . getenv('PHASE5_DB_PORT') . ';dbname=asterisk;charset=utf8mb4';
$db = new PDO($dsn, 'root', 'phase5-isolated', array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
AgentSchema::install($db);
$readerGrants = implode("\n", $db->query("SHOW GRANTS FOR 'satellite_workflow'@'127.0.0.1'")->fetchAll(PDO::FETCH_COLUMN));
checkWorkflow(strpos($readerGrants, 'SELECT ON `phonebook`.`phonebook`') !== false, 'Workflow phonebook grant missing');
checkWorkflow(strpos($readerGrants, 'SELECT ON `asteriskcdrdb`.`cdr`') !== false, 'Workflow CDR grant missing');
checkWorkflow(strpos($readerGrants, 'ALL PRIVILEGES') === false, 'Workflow grant is not read-only');

// Exercise additive upgrade from the prior destination schema.
$db->exec('ALTER TABLE satellite_agent_destinations DROP COLUMN workflow_agent_id, DROP COLUMN workflow_version, DROP COLUMN workflow_binding_id');
AgentSchema::install($db);
$db->exec("INSERT INTO satellite_agent_trunks(name,provider,runtime_owner,freepbx_trunk_name) VALUES('Fixture','openai','builtin','AgentTrunk_1')");
$binding = new AgentWorkflowDestination($db);
$graph = array('agent_id'=>'fixture-agent','entrypoints'=>array('voice'),'provider_binding_ref'=>'1','fallback'=>'ext-queues,600,1');
$binding->synchronize('fixture-agent',1,$graph,true);
$row = $db->query("SELECT * FROM satellite_agent_destinations WHERE workflow_agent_id='fixture-agent'")->fetch(PDO::FETCH_ASSOC);
$id = $row['id']; $revision = (new AgentConfigurationState($db))->status()['desired_revision'];
$again = $binding->synchronize('fixture-agent',1,$graph,true);
checkWorkflow(!$again['changed'] && (new AgentConfigurationState($db))->status()['desired_revision'] === $revision, 'Reconciliation changed an identical binding');
$api = $graph; $api['entrypoints'] = array('api');
$binding->synchronize('fixture-agent',2,$api,true);
$disabled = $db->query("SELECT * FROM satellite_agent_destinations WHERE id=" . (int) $id)->fetch(PDO::FETCH_ASSOC);
checkWorkflow((int) $disabled['enabled'] === 0 && (int) $disabled['workflow_version'] === 2, 'API-only activation retained a callable voice binding');
$binding->synchronize('fixture-agent',3,$graph,true);
$row = $db->query("SELECT * FROM satellite_agent_destinations WHERE id=" . (int) $id)->fetch(PDO::FETCH_ASSOC);
checkWorkflow((int) $row['enabled'] === 1 && (int) $row['workflow_version'] === 3, 'Activation replaced the stable destination ID');
$cycle = $graph; $cycle['fallback'] = 'satellite-agent-destination-' . $id . ',s,1';
try { $binding->synchronize('fixture-agent',4,$cycle,true); throw new RuntimeException('Self fallback accepted'); }
catch (InvalidArgumentException $expected) { checkWorkflow($expected->getMessage() === 'workflow_fallback_cycle', 'Unexpected cycle validation'); }
$destinations = new AgentDestinationRepository($db);
$cleared = $destinations->validateUpdateInput($id, array('agent_type'=>'workflow','fallback_destination'=>null));
checkWorkflow($cleared['fallback_destination'] === null, 'VisualPlan cannot remove the workflow fallback');
try { $destinations->validateUpdateInput($id, array('agent_type'=>'builtin_external')); throw new RuntimeException('Workflow identity changed'); }
catch (InvalidArgumentException $expected) {}
$reader = new PDO(str_replace('dbname=asterisk', 'dbname=phonebook', $dsn), 'satellite_workflow', 'phase5-reader', array(PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION));
$data = new AgentWorkflowData($reader);
$contacts = $data->contacts('+393331234567');
checkWorkflow($contacts['status'] === 'success' && count($contacts['numbers']) === 2, 'Company lookup exposed private or unrelated contacts');
$history = $data->history($contacts['numbers'], array('201','202','203','205'), 90);
$operators = array_column($history['operators'], 'call_count', 'destination_id');
checkWorkflow($operators === array('extension:201'=>1,'extension:202'=>1) || $operators === array('extension:202'=>1,'extension:201'=>1), 'CDR legs were duplicated or empty linked IDs joined unrelated callers');
try { $reader->exec("INSERT INTO phonebook.phonebook(name) VALUES('Forbidden')"); throw new RuntimeException('Workflow reader can write'); }
catch (PDOException $expected) {}
try { $data->contacts("1') OR 1=1 --"); throw new RuntimeException('Phonebook accepted SQL input'); }
catch (InvalidArgumentException $expected) {}
echo "MariaDB additive migration, stable/reconciled voice bindings, VisualPlan protection, company/CDR scope and SELECT-only grants passed\n";
