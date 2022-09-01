<?php

header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_grafici.inc.php';
require_once '../includes/phplivex.php';
require_once 'traduzione.php';

connect_db();

if ($HTTP_GET_VARS['date']) {
    if (strpos($HTTP_GET_VARS['date'], '-') === false) {
        $date = $HTTP_GET_VARS['date'];
    } else {
        $date = strtotime($HTTP_GET_VARS['date']);
    }
} else {
    $date = time();
}

$plx = new PHPLiveX('getGraficiAgente,execFilter');
$plx->Run();
print_filter(array('getGraficiAgente'), array('grafici'), true, false);
?>

<div id="listing" style="display: none; margin: auto; width: 100%; font-size: 12px:" align="right"><?php echo _('Loading...');?></div> <!--Caricamento...-->
<div id="grafici" style='text-align: center; margin-left: auto; margin-right: auto; margin-top: 50px;'>
<?php
echo getGraficiAgente();
?>
</div>
