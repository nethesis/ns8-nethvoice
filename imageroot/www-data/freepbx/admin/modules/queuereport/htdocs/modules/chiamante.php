<?php

header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';
require_once '../includes/phplivex.php';
require_once 'traduzione.php';

connect_db();

$plx = new PHPLiveX('getPerChiamante,changePage,execFilter');
$plx->Run();
print_filter(array('getPerChiamante'), array('reports'));
?>
<div id="reports">
<?php
echo getPerChiamante('1', 'cid ASC');
?>
</div>
