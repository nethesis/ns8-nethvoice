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

$plx = new PHPLiveX('getGraficiCarico,execFilter');
$plx->Run();
print_filter(array('getGraficiCarico'), array('grafici'), true, false);
?>

<div id="listing" style="display: none; margin: auto; width: 100%;" align="right"><?php echo _('Loading...');?></div> <!--Caricamento...-->
<div id="grafici" style='text-align: center; margin-left: auto; margin-right: auto; margin-top: 50px;'>

<?php
echo getGraficiCarico();
?>
</div>
<script type='text/javascript'>
$(document).ready(function() {
$('#zone_submit').click(function(e) {
   e.preventDefault();
   data = { zone_filter:  $('#zone_filter option:selected').val(), zone_limit: $('#zone_limit option:selected').val() };
   $('#page_body').html(loading);
   $('#page_body').load('grafici_carico.php', data );
});
});
</script>
