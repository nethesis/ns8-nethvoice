<?php
require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_grafici.inc.php';
require_once 'traduzione.php';

//phplivex
require_once '../includes/phplivex.php';

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

$plx = new PHPLiveX('getGraficiDurata,execFilter');
$plx->Run();
print_filter(array('getGraficiDurata'), array('grafici'), true, false);
?>

<div id="listing" style="display: none; margin: auto; width: 100%;" align="right"><?php echo _('Loading...');?></div> <!--Caricamento...-->
<div id="grafici" style='text-align: center; margin-left: auto; margin-right: auto; margin-top: 50px;'>

<?php
echo getGraficiDurata();
?>
</div>
