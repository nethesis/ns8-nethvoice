<?php

header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';
require_once '../includes/phplivex.php';
require_once 'traduzione.php';

connect_db();

$plx = new PHPLiveX('getOrariaTotali,getOrariaEvase,getOrariaInevase,getOrariaNonGestite,getOrariaNulle,changePage,execFilter');
$plx->Run();
print_filter(array('getOrariaTotali', 'getOrariaEvase', 'getOrariaInevase', 'getOrariaNonGestite', 'getOrariaNulle'), array('totali', 'evase', 'inevase','nongestite', 'nulle'));
?>
<div id='reports'>
<div id="totali">
<?php echo getOrariaTotali('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="evase">
<?php echo getOrariaEvase('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="inevase">
<?php echo getOrariaInevase('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="nongestite">
<?php echo getOrariaNonGestite('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="nulle">
<?php echo getOrariaNulle('1', 'period ASC');?>
</div>
<br/><br/><br/>
</div>