<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.

extract($request);
$itemid = isset($itemid) ? $itemid : "";
$dests = daynight_get_obj($itemid);
extract($dests);
$indexopts = '';
$ids = daynight_get_avail();
if(empty($ids) && ($itemid == '')) {
	?>
	<div class="alert alert-danger" role="alert"><?php echo _('You have reached the maximum limit for flow controls. Delete one to add a new one')?></div>
	<?php
	return;
}
if(!empty($ids) && is_array($ids)) {
	foreach ($ids as $id) {
		$indexopts .= '<option value='.$id.'>'.$id.'</option>';
	}
}
if($itemid == ''){
	$indexinput = '<select class="form-control" id="itemid" name="itemid">';
	$indexinput .= isset($indexopts) ? $indexopts : "";
	$indexinput .= '</select>';
}else{
	$indexinput = '<input type="text"  class="form-control" name="itemid" id="itemid" value="'.$itemid.'" readonly>';
}
$nightopts = $dayopts = array();
if(function_exists('recordings_list')) {
	$tresults = recordings_list();
	$daydefault = (isset($day_recording_id) ? $day_recording_id : '');
	$nightdefault = (isset($night_recording_id) ? $night_recording_id : '');
	$dayopts .= '<option value="0">' ._("Default") ."</option>\n";
	$nightopts .= '<option value="0">' ._("Default") ."</option>\n";
	if (isset($tresults[0])) {
		foreach ($tresults as $tresult) {
			$dayopts .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $daydefault ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
			$nightopts .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $nightdefault ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
		}
	}
	$recordinghtml = '
		<!--Recording for Normal Mode-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="day_recording_id">'. _("Recording for Normal Mode").'</label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="day_recording_id"></i>
							</div>
							<div class="col-md-9">
								<select class="form-control" id="day_recording_id" name="day_recording_id">
									'.$dayopts.'
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="day_recording_id-help" class="help-block fpbx-help-block">'._("Message to be played in normal mode (Green/BLF off).<br>To add additional recordings use the \"System Recordings\" MENU above").'</span>
				</div>
			</div>
		</div>
		<!--END Recording for Normal Mode-->
		<!--"Recording for Override Mode-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="night_recording_id">'. _("Recording for Override Mode").'</label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="night_recording_id"></i>
							</div>
							<div class="col-md-9">
								<select class="form-control" id="night_recording_id" name="night_recording_id">
									'.$nightopts.'
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="night_recording_id-help" class="help-block fpbx-help-block">'._("Message to be played in override mode (Red/BLF on).<br>To add additional recordings use the \"System Recordings\" MENU to the above").'</span>
				</div>
			</div>
		</div>
		<!--END Recording for Override Mode-->
	';
}
//Usage
$timeconditions_refs = daynight_list_timecondition($itemid);
if (!empty($timeconditions_refs)) {
	foreach($timeconditions_refs as $ref) {
		$dmode = ($ref['dmode'] == 'timeday') ? _("Forces to Normal Mode (Green/BLF off)") : _("Forces to Override Mode (Red/BLF on)");
		$timecondition_id = $ref['dest'];
		$tcURL = $_SERVER['PHP_SELF'].'?'."display=timeconditions&itemid=$timecondition_id";
		$label = sprintf(_("Linked to Time Condition %s - %s"),$timecondition_id,$dmode);
		$reflist .= '<li><i class="fa fa-clock-o"></i> <a href="'.$tcURL.'">'.$label.'</a></li>';
	}
	$refhtml = '<div class="well well-info">';
	$refhtml .='<h4>'._("Time Condition Reference").'</h4>';
	$refhtml .= '<ul>' . $reflist . '</ul>';
	$refhtml .= '</div>';
}
?>

<?php echo !empty($refhtml) ? $refhtml : "" ?>

<form name="prompt" id="prompt" class="fpbx-submit" action="?display=daynight" method="post" onsubmit="return prompt_onsubmit();" data-fpbx-delete="?display=daynight&itemid=<?php echo $itemid?>&action=delete">
<input type="hidden" name="action" value="<?php echo isset($itemid)?'edit':'add' ?>" />
<input type="hidden" name="display" value="daynight" />
<!--Call Flow Toggle Feature Code Index-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="itemid"><?php echo _("Call Flow Toggle Feature Code Index") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="itemid"></i>
					</div>
					<div class="col-md-9">
						<?php echo $indexinput ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="itemid-help" class="help-block fpbx-help-block"><?php echo sprintf(_("There are a total of %s Feature code objects, %s, each can control a call flow and be toggled using the call flow toggle feature code plus the index."),'100','0-99')?></span>
		</div>
	</div>
</div>
<!--END Call Flow Toggle Feature Code Index-->
<!--Description-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="fc_description"><?php echo _("Description") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="fc_description"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="fc_description" name="fc_description" value="<?php echo !empty($fc_description) ? $fc_description : "" ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="fc_description-help" class="help-block fpbx-help-block"><?php echo _("Description for this Call Flow Toggle Control")?></span>
		</div>
	</div>
</div>
<!--END Description-->
<!--Current Mode-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="state"><?php echo _("Current Mode") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="state"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" class="form-control" id="stateday" name="state" value="DAY" <?php echo ($state == 'DAY' ? 'CHECKED':'') ?>>
						<label for="stateday"><?php echo _("Normal (Green/BLF off)")?></label>
						<input type="radio" class="form-control" id="statenight" name="state" value="NIGHT" <?php echo ($state == 'NIGHT' ? 'CHECKED':'') ?>>
						<label for="statenight"><?php echo _("Override (Red/BLF on)")?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="state-help" class="help-block fpbx-help-block"><?php echo _("This will change the current state for this Call Flow Toggle Control, or set the initial state when creating a new one.")?></span>
		</div>
	</div>
</div>
<!--END Current Mode-->
<?php echo $recordinghtml //if function_exists('recordings_list')?>
<!--Optional Password-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="password"><?php echo _("Optional Password") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="password"></i>
					</div>
					<div class="col-md-9">
						<div class="input-group">
							<input type="password" class="form-control clicktoedit" id="password" name="password" value="<?php echo !empty($password) ? $password : "" ?>">
							<span class="input-group-addon toggle-password" id="pwtoggle" data-id="password"><i class="fa fa-eye"></i></a></span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="password-help" class="help-block fpbx-help-block"><?php echo _("You can optionally include a password to authenticate before toggling the call flow. If left blank anyone can use the feature code and it will be un-protected")?></span>
		</div>
	</div>
</div>
<!--END Optional Password-->
<!--Normal Flow (Green/BLF off)-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="goto0"><?php echo _("Normal Flow (Green/BLF off)") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
					</div>
					<div class="col-md-9">
						<?php echo drawselects((isset($dests['day'])?$dests['day']:''),0); ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Destination to use when set to Normal Flow (Green/BLF off) mode")?></span>
		</div>
	</div>
</div>
<!--END Normal Flow (Green/BLF off)-->
<!--Override Flow (Red/BLF on)-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="goto1"><?php echo _("Override Flow (Red/BLF on)") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="goto1"></i>
					</div>
					<div class="col-md-9">
						<?php echo drawselects((isset($dests['night'])?$dests['night']:''),1); ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="goto1-help" class="help-block fpbx-help-block"><?php echo _("Destination to use when set to Override Flow (Red/BLF on) mode")?></span>
		</div>
	</div>
</div>
<!--END Override Flow (Red/BLF on)-->
</form>
