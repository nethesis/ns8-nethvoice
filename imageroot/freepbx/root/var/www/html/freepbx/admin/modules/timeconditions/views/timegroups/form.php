<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
extract($request, EXTR_SKIP);
if($extdisplay){
	$savedtimegroup= timeconditions_timegroups_get_group($extdisplay);
	$timegroup = $savedtimegroup[0];
	$description = $savedtimegroup[1];
	$delURL = '?display=timegroups&action=del&extdisplay='.$extdisplay;
	$timelist = timeconditions_timegroups_get_times($extdisplay);
	$usage =  timeconditions_timegroups_list_usage($extdisplay);
}
$timehtml ='';
if(!empty($timelist)){
	foreach ($timelist as $val) {
		$timehtml .= timeconditions_timegroups_drawtimeselects('times['.$val[0].']',$val[1]);
	}
}else{
	$timehtml = timeconditions_timegroups_drawtimeselects('times[0]',null);
}
if(isset($usage) && !empty($usage)){
	echo '<script>$(document).ready(function(){$("#delete").attr("disabled",true);});</script>';
	echo '<div class="alert alert-warning">';
	echo '<strong>'._("This time group is currently in use and cannot be deleted").'</strong><br/>';
	echo '<table class="table">';
	foreach ($usage as $key => $value) {
		echo '<tr><td><a href="'.$value['url_query'].'">'.$value['description'].'</a></td></tr>';
	}
	echo '</table>';
	echo '</div>';
}
?>

<form autocomplete="off" name="edit" id="edit" action="" method="post" onsubmit="" class="fpbx-submit" data-fpbx-delete="<?php echo $delURL?>">
<input type="hidden" name="display" value="timegroups">
<input type="hidden" name="action" value="<?php echo ($extdisplay ? 'edit' : 'add') ?>">
<!--Description-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="description"><?php echo _("Description") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="description" name="description" onchange="check_empty(this.value);" value="<?php echo ($description== "")? "tg-".strtotime("now") : htmlspecialchars($description) ?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="description-help" class="help-block fpbx-help-block"><?php echo _("This will display as the name of this Time Group")?></span>
		</div>
	</div>
</div>
<!--END Description-->
<!--Time-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="timewraper"><?php echo _("Time(s)") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="timewraper"></i>
					</div>
					<div class="col-md-9" id="timerows">
						<?php echo $timehtml ?>
						<a href="#" id="addTime"><i class="fa fa-plus"></i> <?php echo _("Add Time")?></a>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="timewraper-help" class="help-block fpbx-help-block"><?php echo _("Add a time for this time condition")?></span>
		</div>
	</div>
</div>
<!--END Time-->
</form>
<script>
	var timegrouplist  = '<?php echo json_encode(FreePBX::Timeconditions()->listTimegroups(true))?>';
	var currenttimegroup = '<?php echo htmlspecialchars($description,ENT_QUOTES)?>';
	
	function check_empty(description){
		if (description == ""){
			var content = "tg-"+ jQuery.now();
			$("#description").val(content);
		}
		
	}
</script>