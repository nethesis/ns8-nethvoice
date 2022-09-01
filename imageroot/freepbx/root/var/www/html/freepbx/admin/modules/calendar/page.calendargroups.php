<?php
$cal = FreePBX::Calendar();
echo $cal->showCalendarGroupsPage();
/*
$cal = FreePBX::Calendar();
if(isset($_REQUEST['view']) && $_REQUEST['view'] == 'form'){
  $vars = array();
  $id = isset($_REQUEST['id'])?$_REQUEST['id']:'';
  $event = $cal->getGroup($id);
  $vars['eventopts'] = $cal->getEventOptions($id);
  $vars['description'] = $event['description'];
  $vars['id'] = $id;
  $content = load_view(__DIR__.'/views/calendargroups.php',$vars);
}else{
  $content = load_view(__DIR__.'/views/calendargroupgrid.php',array());
}
?>
<script>
  var timezone = "<?php echo FreePBX::View()->getTimezone();?>";
  var daysOfWeek = ['<?php echo _("Sunday")?>', '<?php echo _("Monday")?>', '<?php echo _("Tuesday")?>', '<?php echo _("Wednesday")?>','<?php echo _("Thursday")?>', '<?php echo _("Friday")?>', '<?php echo _("Saturday")?>'];
  var daysOfWeekShort = ['<?php echo _("Sun")?>', '<?php echo _("Mon")?>', '<?php echo _("Tue")?>', '<?php echo _("Wed")?>','<?php echo _("Thu")?>', '<?php echo _("Fri")?>', '<?php echo _("Sat")?>'];
</script>
<div class="container-fluid">
  <h1>
    <span><?php echo _('Calendar Event Groups')?></span>
  </h1>
</div>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display full-border">
						<?php echo $content?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
*/
