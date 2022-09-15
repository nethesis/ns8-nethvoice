<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
extract($request);
$action = "add";
if ($extdisplay) {
	// load
	$row = announcement_get($extdisplay);
	$action = "edit";
	$description = $row['description'];
	$recording_id = $row['recording_id'];
	$allow_skip = $row['allow_skip'];
	$post_dest = $row['post_dest'];
	$return_ivr = $row['return_ivr'];
	$noanswer = $row['noanswer'];
	$repeat_msg = $row['repeat_msg'];
} else {
	$description = "";
	$recording_id = "";
	$allow_skip = "";
	$post_dest =  "";
	$return_ivr = "";
	$noanswer = "";
	$repeat_msg = "";
}
$recopts = '';
if(function_exists('recordings_list')){
	$tresults = recordings_list();
	$default = (isset($recording_id) ? $recording_id : '');
	if (isset($tresults[0])) {
		$recopts .= '<option value="">'._("None")."</option>\n";
		foreach ($tresults as $tresult) {
			$recopts .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
		}
	}
	$recordinghtml ='
	<!--Recording-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="recording_id">'. _("Recording") .'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="recording_id"></i>
						</div>
						<div class="col-md-9">
							<select class="form-control" id="recording_id" name="recording_id">
								'.$recopts.'
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="recording_id-help" class="help-block fpbx-help-block">'. _("Message to be played.<br>To add additional recordings use the \"System Recordings\" MENU above").'</span>
			</div>
		</div>
	</div>
	<!--END Recording-->
	';
}
$default = isset($repeat_msg) ? $repeat_msg : '';
for ($i=0; $i<=9; $i++ ) {
	$digits[]="$i";
}
$digits[] = '*';
$digits[] = '#';
$repeatopts = '<option value=""'.($default == '' ? ' SELECTED' : '').'>'._("Disable")."</option>";
foreach ($digits as $digit) {
	$repeatopts .= '<option value="'.$digit.'"'.($digit == $default ? ' SELECTED' : '').'>'.$digit."</option>\n";
}
?>

<form class="fpbx-submit" name="editAnnouncement" action="?display=announcement" method="post" onsubmit="return checkAnnouncement(editAnnouncement);" data-fpbx-delete="config.php?display=announcement&amp;extdisplay=<?php echo $extdisplay ?>&amp;action=delete">
<input type="hidden" name="extdisplay" value="<?php echo $extdisplay; ?>">
<input type="hidden" name="announcement_id" value="<?php echo $extdisplay; ?>">
<input type="hidden" name="action" value="<?php echo $action; ?>">
<input type="hidden" name="display" value="announcement">
<input type="hidden" name="view" value="form">
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
						<input type="text" class="form-control" id="description" name="description" value="<?php  echo $description; ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="description-help" class="help-block fpbx-help-block"><?php echo _("The name of this announcement.")?></span>
		</div>
	</div>
</div>
<!--END Description-->
<?php echo $recordinghtml ?>
<!--Repeat-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="repeat_msg"><?php echo _("Repeat") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="repeat_msg"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="repeat_msg" name="repeat_msg">
							<?php echo $repeatopts ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="repeat_msg-help" class="help-block fpbx-help-block"><?php echo _("Key to press that will allow for the message to be replayed. If you choose this option there will be a short delay inserted after the message. If a longer delay is needed it should be incorporated into the recording.")?></span>
		</div>
	</div>
</div>
<!--END Repeat-->
<!--Allow Skip-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="allow_skip"><?php echo _("Allow Skip") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="allow_skip"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="allow_skip" id="allow_skipyes" value="1" <?php echo ($allow_skip?"CHECKED":"") ?>>
						<label for="allow_skipyes"><?php echo _("Yes");?></label>
						<input type="radio" name="allow_skip" id="allow_skipno" <?php echo ($allow_skip?"":"CHECKED") ?> value="">
						<label for="allow_skipno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="allow_skip-help" class="help-block fpbx-help-block"><?php echo _("If the caller is allowed to press a key to skip the message.")?></span>
		</div>
	</div>
</div>
<!--END Allow Skip-->
<!--Return to IVR-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="return_ivr"><?php echo _("Return to IVR") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="return_ivr"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="return_ivr" id="return_ivryes" value="1" <?php echo ($return_ivr?"CHECKED":"") ?>>
						<label for="return_ivryes"><?php echo _("Yes");?></label>
						<input type="radio" name="return_ivr" id="return_ivrno" <?php echo ($return_ivr?"":"CHECKED") ?> value="">
						<label for="return_ivrno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="return_ivr-help" class="help-block fpbx-help-block"><?php echo _("If this announcement came from an IVR and this is set to yes, the destination below will be ignored and instead it will return to the calling IVR. Otherwise, the destination below will be taken. Don't check if not using in this mode. <br>The IVR return location will be to the last IVR in the call chain that was called so be careful to only check when needed. For example, if an IVR directs a call to another destination which eventually calls this announcement and this box is checked, it will return to that IVR which may not be the expected behavior.")?></span>
		</div>
	</div>
</div>
<!--END Return to IVR-->
<!--Don't Answer Channel-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="noanswer"><?php echo _("Don't Answer Channel") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="noanswer"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="noanswer" id="noansweryes" value="1" <?php echo ($noanswer?"CHECKED":"") ?>>
						<label for="noansweryes"><?php echo _("Yes");?></label>
						<input type="radio" name="noanswer" id="noanswerno" <?php echo ($noanswer?"":"CHECKED") ?> value="">
						<label for="noanswerno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="noanswer-help" class="help-block fpbx-help-block"><?php echo _("Set this to yes, to keep the channel from explicitly being answered. When checked, the message will be played and if the channel is not already answered it will be delivered as early media if the channel supports that. When not checked, the channel is answered followed by a 1 second delay. When using an announcement from an IVR or other sources that have already answered the channel, that 1 second delay may not be desired.")?></span>
		</div>
	</div>
</div>
<!--END Don't Answer Channel-->
<!--Destination-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="goto0"><?php echo _("Destination after Playback") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
					</div>
					<div class="col-md-9">
						<?php echo drawselects($post_dest,0); ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Where to send the caller after the announcement is played.")?></span>
		</div>
	</div>
</div>
<!--END Destination-->

</form>
<script>
var announcementnames = <?php print json_encode(\FreePBX::Announcement()->getALLAnnouncements($extdisplay)); ?>;
</script>
