<?php
header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';
require_once '../includes/phplivex.php';
require_once 'traduzione.php';

connect_db();

$plx = new PHPLiveX('getPerformance,getQoS,changePage,execFilter');
$plx->Run();
print_filter(array('getPerformance', 'getQoS'), array('performance', 'qos'));
?>
<div id='reports'>
<div id="performance">
<?php echo getPerformance('1', 'period ASC');?>
</div>
<br/><br/>
<div id="qos" align="center">
<?php echo getQoS(-1);?>
</div>
</div>
