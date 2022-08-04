<?php
header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_grafici.inc.php';
require_once 'traduzione.php';

connect_db();
if (isset($_REQUEST['type'])) {
    switch ($_REQUEST['type']) {
        case 1:return getDashboard1();
        case 2:return getDashboard2();
        case 3:return getDashboard3();
        case 4:return getDashboard4();
        case 5:return getDashboard5();
    }
}
?>
<h2 class="ui dividing header center aligned"> <?php echo _('Last year summary');?> </h2>  <!--Riepilogo ultimo anno-->
<div id='dashboard'>

<div id="dashboard1">
<?php getDashboard1();?>
</div>
<div id="dashboard2"></div>
<div id="dashboard3"></div>
<div id="dashboard4"></div>
<div id="dashboard5"></div>

</div>
