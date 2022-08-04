<?php
header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';
require_once '../includes/phplivex.php';
require_once 'traduzione.php';

connect_db();

$plx = new PHPLiveX('getSessioniAgente,changePage,execFilter');
$plx->Run();
print_filter(array('getSessioniAgente'), array('report'));
?>


<div id="report">
<?php
echo getSessioniAgente('1', 'agent ASC');
?>
</div>

