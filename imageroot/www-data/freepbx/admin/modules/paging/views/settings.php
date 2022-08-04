<?php
global $astman;
$rec_list['none'] = _('None');
$rec_list['beep'] = _('Default');
$P_quiet = $astman->database_show("paging/quiet");
$quiet = ($P_quiet["/paging/quiet"] == "1")? "1" : "";
if (!function_exists('recordings_list')) {
	$announce = 'default';
} else {
	//build recordings list
	foreach (recordings_list() as $rec) {
		$rec_list[$rec['id']] = $rec['displayname'];
	}

	//get paging defaults
	$def = paging_get_autoanswer_defaults(true);
	$announce = 'beep';
	if (isset($def['DOPTIONS'])) {
		preg_match('/A\((.*?)\)/', $def['DOPTIONS'], $m);
		//blank file? That would be 'none'
		if (isset($m[0]) && (!isset($m[1]) || !$m[1])) {
			$announce = 'none';
		//otherwise, get the ID of the system recording
		} elseif(isset($m[0], $m[1])) {
			foreach (recordings_list() as $raw) {
				if ($raw['filename'] == $m[1]) {
					$announce = $raw['id'];
					break;
				}
			}
		}
	}
}
$aopts = '';
foreach ($rec_list as $key => $value) {
	$aopts .= '<option value='.$key.' '.(($key == $announce)?'SELECTED':'').'>'.$value.'</option>';
}


$drop_silence = \FreePBX::Paging()->getDropSilence();
?>
<h3><?php echo _('Paging and Intercom settings')?></h3>
<form class="fpbx-submit" name="frm_extensions" action="" method="post" data-fpbx-delete="" role="form">
<input type="hidden" name="action" value="save_settings">
<input type="hidden" name="display" value="paging">

<!--Auto-answer defaults-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="announce"><?php echo _("Auto-answer defaults") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="announce"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="announce" name="announce">
							<?php echo $aopts?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="announce-help" class="help-block fpbx-help-block"><?php echo _("Annoucement to be played to remote party. Default is a beep")?></span>
		</div>
	</div>
</div>
<!--END Auto-answer defaults-->
<!--Duplex-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="drop_silence"><?php echo _("Drop Silence") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="drop_silence"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="drop_silence" id="drop_silenceyes" value="1" <?php echo (($drop_silence)?"CHECKED":"") ?>>
						<label for="drop_silenceyes"><?php echo _("Yes");?></label>
						<input type="radio" name="drop_silence" id="drop_silenceno" value="0" <?php echo (($drop_silence)?"":"CHECKED") ?>>
						<label for="drop_silenceno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="drop_silence-help" class="help-block fpbx-help-block"><?php echo _('This option drops what Asterisk detects as silence from entering into the bridge. Enabling this option will drastically improve performance and help remove the buildup of background noise from the conference. Highly recommended for large conferences due to its performance enhancements.')?></span>
		</div>
	</div>
</div>
<!--END Duplex-->
<!--Quiet-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="quiet"><?php echo _("Quiet") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="quiet"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="quiet" id="quietyes" value="1" <?php echo (($quiet)?"CHECKED":"") ?>>
						<label for="quietyes"><?php echo _("Yes");?></label>
						<input type="radio" name="quiet" id="quietno" value="0" <?php echo (($quiet)?"":"CHECKED") ?>>
						<label for="quietno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="quiet-help" class="help-block fpbx-help-block"><?php echo _('This option removes the beep from caller.')?></span>
		</div>
	</div>
</div>
<!--END Quiet-->
<p></p>
<input type="submit" id="submit" value="<?php echo _("Submit")?>" class="btn btn-default ">
</form>

