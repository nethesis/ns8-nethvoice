<?php
header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';
require_once '../includes/phplivex.php';
require_once 'traduzione.php';

connect_db();

$plx = new PHPLiveX('getGeneraleEvase,getGeneraleAbbandoni,getGeneraleTimeout,getGeneraleExitempty,getGeneraleExitkey,getGeneraleFull,getGeneraleNull,changePage,execFilter');
$plx->Run();
print_filter(array('getGeneraleEvase', 'getGeneraleAbbandoni', 'getGeneraleTimeout', 'getGeneraleExitempty', 'getGeneraleExitkey', 'getGeneraleFull', 'getGeneraleNull'), array('evase', 'abbandoni', 'timeout', 'exitempty', 'exitwithkey', 'full', 'null'));
?>
<div id='reports'>
<div id="evase">
<?php echo getGeneraleEvase('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="abbandoni">
<?php echo getGeneraleAbbandoni('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="timeout">
<?php echo getGeneraleTimeout('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="exitempty">
<?php echo getGeneraleExitempty('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="exitwithkey">
<?php echo getGeneraleExitkey('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="full">
<?php echo getGeneraleFull('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="joinempty">
<?php echo getGeneraleJoinempty('1', 'period ASC');?>
</div>
<br/><br/><br/>
<div id="null">
<?php echo getGeneraleNull('1', 'period ASC');?>
</div>
<br/><br/><br/>
</div>
