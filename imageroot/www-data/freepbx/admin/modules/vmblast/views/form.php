<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
extract($request, EXTR_SKIP);
if ($extdisplay != '') {
	// We need to populate grplist with the existing extension list.
	$thisgrp = vmblast_get($extdisplay);
	$grplist     = $thisgrp['grplist'];
	$description = $thisgrp['description'];
	$audio_label = $thisgrp['audio_label'];
	$password    = $thisgrp['password'];
	$default_group = $thisgrp['default_group'];
	unset($thisgrp);
	$usage_list = framework_display_destination_usage(vmblast_getdest($extdisplay));
	if (!empty($usage_list)) {
		$usagehtml = '<div class="well">';
		$usagehtml .= '<h3>'. $usage_list['text'] . '</h3>';
		$usagehtml .= '<p>' . $usage_list['tooltip'] . '</p>';
		$usagehtml .= '</div>';
	}
	$delURL='?display=vmblast&action=delGRP&account='.$extdisplay;
}else{
	$grplist = array();
	$strategy = '';
	$ringing = '';
	$delURL ='';
}
if(function_exists('recordings_list')) {
	$tresults = recordings_list();
	$default = (isset($audio_label) ? $audio_label : -1);
	$alopts = '';
	if (isset($tresults[0])) {
		foreach ($tresults as $tresult) {
			$alopts .= '<option value="'.$tresult[0].'" '.($tresult[0] == $default ? ' SELECTED' : '').'>'.$tresult[1]."</option>\n";
		}
	}
	$alabelhtml ='
		<!--Audio Label-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="audio_label">'. _("Audio Label") .'</label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="audio_label"></i>
							</div>
							<div class="col-md-9">
								<select class="form-control" id="audio_label" name="audio_label">
									<option value="-1">'._("Read Group Number").'</option>
									<option value="-2"'.(($default == -2) ? ' SELECTED':'').'>'._("Beep Only - No Confirmation").'</option>
									'.$alopts.'
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="audio_label-help" class="help-block fpbx-help-block">'. _("Play this message to the caller so they can confirm they have dialed the proper voice mail group number, or have the system simply read the group number.").'</span>
				</div>
			</div>
		</div>
		<!--END Audio Label-->
	';
}else{
	$default = (isset($audio_label) ? $audio_label : -1);
	$alabelhtml = '<input type="hidden" name="audio_label" value="'.$default.'">';
}

$results = core_users_list();
if (!is_array($results)){
	$results = array();
}
foreach ($results as $result) {
	if ($result[2] != 'novm') {
		$extenlopts .= '<option value="'.$result[0].'" ';
		if (array_search($result[0], $grplist) !== false){
			$extenlopts .= ' SELECTED ';
		}
		$extenlopts .= '>'.$result[0].' ('.$result[1].')</option>';
	}
}


echo $usagehtml;
?>

<form name="editGRP" class="fpbx-submit" action="" method="post" onsubmit="return checkGRP(editGRP);" data-fpbx-delete="<?php echo $delURL?>">
<input type="hidden" name="display" value="vmblast">
<input type="hidden" name="action" value="<?php echo ($extdisplay != '' ? 'editGRP' : 'addGRP'); ?>">
<input type="hidden" name="view" value="form">
<!--VMBlast Number-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="account"><?php echo _("VMBlast Number") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="account"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="account" name="account" value="<?php  echo $extdisplay; ?>" <?php echo (empty($extdisplay)?'':'readonly')?>>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="account-help" class="help-block fpbx-help-block"><?php echo _("The number users will dial to voicemail boxes in this VMBlast group")?></span>
		</div>
	</div>
</div>
<!--END VMBlast Number-->
<!--Group Description-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="description"><?php echo _("Group Description") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control maxlen" maxlength="35" id="description" name="description" value="<?php echo htmlspecialchars($description,ENT_COMPAT | ENT_HTML401, "UTF-8"); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="description-help" class="help-block fpbx-help-block"><?php echo _("Provide a descriptive title for this VMBlast Group.")?></span>
		</div>
	</div>
</div>
<!--END Group Description-->
<?php echo $alabelhtml?>
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
						<input type="password" class="form-control toggle-password clicktoedit" id="password" name="password" value="<?php echo $password ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="password-help" class="help-block fpbx-help-block"><?php echo _('You can optionally include a password to authenticate before providing access to this group voicemail list.')?></span>
		</div>
	</div>
</div>
<!--END Optional Password-->
<!--Voicemail Box List-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="xtnlist"><?php echo _("Voicemail Box List") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="xtnlist"></i>
					</div>
					<div class="col-md-9">
						<select multiple="multiple" name="vmblast_list[]" id="xtnlist" class="form-control">
							<?php echo $extenlopts ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="xtnlist-help" class="help-block fpbx-help-block"><?php echo _("Select voice mail boxes to add to this group. Use Ctrl key to select multiple.")?></span>
		</div>
	</div>
</div>
<!--END Voicemail Box List-->
<!--Default VMBlast Group-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="default_group"><?php echo _("Default VMBlast Group") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="default_group"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" class="form-control" id="default_group1" name="default_group" value="1" <?php echo ($default_group == $extdisplay )?'CHECKED':'';?>>
						<label for="default_group1"><?php echo _("Yes")?></label>
						<input type="radio" class="form-control" id="default_group0" name="default_group" value="0" <?php echo ($default_group == $extdisplay)?'':'CHECKED'; ?>>
						<label for="default_group0"><?php echo _("No")?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="default_group-help" class="help-block fpbx-help-block"><?php echo _("Each PBX system can have a single Default Voicemail Blast Group. If specified, extensions can be automatically added (or removed) from this default group in the Extensions (or Users) tab.<br />Making this group the default will uncheck the option from the current default group if specified.")?></span>
		</div>
	</div>
</div>
<!--END Default VMBlast Group-->
</form>
