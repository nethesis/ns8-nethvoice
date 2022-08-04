<div class="form-group">
	<label for="cfringtimer" class="help"><?php echo _('CallForward Ringtimer') ?> <i class="fa fa-question-circle"></i></label><br/>
	<select name="cfringtimer" id="cfringtimer" class="form-control" data-toggle="select">
		<option value="0"><?php echo _("Default")?></option>
		<option value="-1" <?php echo ($ringtime == -1) ? 'selected' : ''?>><?php echo _("Always")?></option>
		<?php foreach($cfringtimes as $key => $value) { ?>
			<option value="<?php echo $key?>" <?php echo ($ringtime == $key) ? 'selected' : ''?>><?php echo $value?> <?php echo _('Seconds')?></option>
		<?php } ?>
	</select>
	<span class="help-block help-hidden" data-for="cfringtimer"><?php echo _('Number of seconds to ring prior to going to voicemail or other fail over destinations that may be setup by an administrator on this account. The Always setting will ring the call forward destinaiton until answered or the caller hangs up. The Default setting will use the value set in Ring Time. Your setting here will be forced to Always if there is no Voicemail or alternartive fail over destination for a call to go to.')?></span>
</div>
