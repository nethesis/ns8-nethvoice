<?php

header('Content-Type: text/html; charset=utf-8');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/phplivex.php';
require_once 'traduzione.php';

connect_db();

$plx = new PHPLiveX('getGeografica,changePage,execFilter');
$plx->Run();
print_filter(array('getGeografica'), array('reports'));
?>


<div id="listing" style="display: none; margin: auto; width: 100%;" align="right"><?php echo _('Loading...');?></div> <!--Caricamento...-->

<div class='zone_filter'>
    <label for='zone_filter'><?php echo _('View by:');?></label> <!--Visualizza per:-->
    <select class="ui dropdown" name='zone_filter' id='zone_filter'>
      <option value='regione'><?php echo _('Region');?></option> <!--Regione-->
      <option value='siglaprov'><?php echo _('Area');?></option> <!--Provincia-->
      <option value='prefisso'><?php echo _('Prefix');?></option> <!--Prefisso-->
    </select>
    <input type='button' class="ui button" id='zone_submit' value='<?php echo _('Apply');?>' /><!--Applica-->
    <div class="ui divider"></div>
</div>

<div id="reports">
<?php
echo getGeografica('1', 'period ASC');
?>
</div>


 <script type='text/javascript'>
    $(document).ready(function() {
      $('#zone_submit').click(function(e) {
        e.preventDefault();
        data = { zone_filter:  $('#zone_filter option:selected').val(), zone_limit: $('#zone_limit option:selected').val() };
        $('#page_body').html(loading);
        $('#page_body').load('geografica.php', data );
      });
    });
 </script>
