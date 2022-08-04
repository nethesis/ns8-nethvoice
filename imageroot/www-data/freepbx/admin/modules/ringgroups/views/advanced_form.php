<!--Ring-Group Number-->
<?php if (!empty($accountinput)) { ?>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="account"><?php echo _("Ring-Group Number") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="account"></i>
					</div>
					<div class="col-md-9">
						<?php echo $accountinput ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="account-help" class="help-block fpbx-help-block"><?php echo _("The number users will dial to ring extensions in this ring group")?></span>
		</div>
	</div>
</div>
<?php } ?>
<!--END Ring-Group Number-->
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
						<input type="text" maxlength="35" class="form-control maxlen" id="description" name="description" value="<?php echo htmlspecialchars($description); ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="description-help" class="help-block fpbx-help-block"><?php echo _("Provide a descriptive title for this Ring Group.")?></span>
		</div>
	</div>
</div>
<!--END Group Description-->
<!--Extension List-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="grplist"><?php echo _("Extension List") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="grplist"></i>
					</div>
					<div class="col-md-9">
						<div class="input-group">
							<textarea id="grplist" maxlength="255" class="form-control" cols="15" rows="<?php echo $glrows?>" name="grplist"><?php echo implode("\n",$grplist);?></textarea>
							<span class="input-group-addon">
								<select id="qsagents1" class="form-control" data-for="grplist" style="width:170px;">
									<option value="" SELECTED><?php echo("User Quick Select")?></option>
									<?php echo $qsagentlist ?>
								</select>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="grplist-help" class="help-block fpbx-help-block"><?php echo _("List extensions to ring, one per line, or use the Extension Quick Select insert them here.<br><br>You can include an extension on a remote system, or an external number by suffixing a number with a '#'.  ex:  2448089# would dial 2448089 on the appropriate trunk (see Outbound Routing)<br><br>Extensions without a '#' will not ring a user's Follow-Me. To dial Follow-Me, Queues and other numbers that are not extensions, put a '#' at the end.")?></span>
		</div>
	</div>
</div>
<!--END Static Agents-->
<!--Ring Strategy-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="strategy"><?php echo _("Ring Strategy") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="strategy"></i>
					</div>
					<div class="col-md-9">
						<select name="strategy" id="strategy" class="form-control">
							<?php echo $rsrows?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="strategy-help" class="help-block fpbx-help-block"><?php echo $rshelp?></span>
		</div>
	</div>
</div>
<!--END Ring Strategy-->
<!--Ring Time (max 300 sec)-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="grptime"><?php echo _("Ring Time (max 300 sec)") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="grptime"></i>
					</div>
					<div class="col-md-9">
						<input type="number" min="0" max="300" class="form-control" id="grptime" name="grptime" value="<?php  echo $grptime?$grptime:20 ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="grptime-help" class="help-block fpbx-help-block"><?php echo _("Time in seconds that the phones will ring. For all hunt style ring strategies, this is the time for each iteration of phone(s) that are rung")?></span>
		</div>
	</div>
</div>
<!--END Ring Time (max 300 sec)-->
<?php echo $announcementhtml?>
<?php echo $ringhtml ?>
<!--CID Name Prefix-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="grppre"><?php echo _("CID Name Prefix") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="grppre"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="grppre" name="grppre" value="<?php  echo $grppre ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="grppre-help" class="help-block fpbx-help-block"><?php echo _('You can optionally prefix the CallerID name when ringing extensions in this group. ie: If you prefix with "Sales:", a call from John Doe would display as "Sales:John Doe" on the extensions that ring.')?></span>
		</div>
	</div>
</div>
<!--END CID Name Prefix-->
<!--Alert Info-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="alertinfo"><?php echo _("Alert Info") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="alertinfo"></i>
					</div>
					<div class="col-md-9">
						<?php echo FreePBX::View()->alertInfoDrawSelect("alertinfo",(($alertinfo)?$alertinfo:''));?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="alertinfo-help" class="help-block fpbx-help-block"><?php echo _("ALERT_INFO can be used for distinctive ring with SIP devices.")?></span>
		</div>
	</div>
</div>
<!--END Alert Info-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="rvolume"><?php echo _("Ringer Volume Override") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="rvolume"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="rvolume" name="rvolume">
							<option value=""><?php echo _("None")?></option>
							<?php for($i = 1; $i <= 14; $i++) { ?>
								<option value="<?php echo $i?>" <?php echo ($rvolume == $i) ? 'selected' : ''?>><?php echo $i?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="rvolume-help" class="help-block fpbx-help-block"><?php echo sprintf(_("Override the ringer volume. Note: This is only valid for %s phones at this time"),"Sangoma")?></span>
		</div>
	</div>
</div>
<!--Send Progress-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="progress"><?php echo _("Send Progress") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="progress"></i>
					</div>
					<div class="col-md-9 radioset">
            <input type="radio" name="progress" id="progressyes" value="yes" <?php echo ($progress == "yes"?"CHECKED":"") ?>>
            <label for="progressyes"><?php echo _("Yes");?></label>
            <input type="radio" name="progress" id="progressno" value="no" <?php echo ($progress == "yes"?"":"CHECKED") ?>>
            <label for="progressno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="progress-help" class="help-block fpbx-help-block"><?php echo _("Should this ringgroup indicate call progress to digital channels where supported.")?></span>
		</div>
	</div>
</div>
<!--END Send Progress-->
<!--Mark Answered Elsewhere-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="elsewhere"><?php echo _("Mark Answered Elsewhere") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="elsewhere"></i>
					</div>
					<div class="col-md-9 radioset">
            <input type="radio" name="elsewhere" id="elsewhereyes" value="yes" <?php echo ($elsewhere == "yes"?"CHECKED":"") ?>>
            <label for="elsewhereyes"><?php echo _("Yes");?></label>
            <input type="radio" name="elsewhere" id="elsewhereno" value="no" <?php echo ($elsewhere == "yes"?"":"CHECKED") ?>>
            <label for="elsewhereno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="elsewhere-help" class="help-block fpbx-help-block"><?php echo _("Should calls indicate answered elsewhere when a user answers.")?></span>
		</div>
	</div>
</div>
<!--END Mark Answered Elsewhere-->
<!--Ignore CF Settings-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="cfignorew"><?php echo _("Ignore CF Settings") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="cfignorew"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="cfignore" id="cfignoreyes" value="CHECKED" <?php echo ($cfignore == "CHECKED"?"CHECKED":"") ?>>
						<label for="cfignoreyes"><?php echo _("Yes");?></label>
						<input type="radio" name="cfignore" id="cfignoreno" value = "" <?php echo ($cfignore == "CHECKED"?"":"CHECKED") ?>>
						<label for="cfignoreno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="cfignorew-help" class="help-block fpbx-help-block"><?php echo _("When set to Yes, agents who attempt to Call Forward will be ignored, this applies to CF, CFU and CFB. Extensions entered with '#' at the end, for example to access the extension's Follow-Me, might not honor this setting .")?></span>
		</div>
	</div>
</div>
<!--END Ignore CF Settings-->
<!--Skip Busy Agent-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="cwignorew"><?php echo _("Skip Busy Agent") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="cwignorew"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="cwignore" id="cwignoreyes" value="CHECKED" <?php echo ($cwignore == "CHECKED"?"CHECKED":"") ?>>
						<label for="cwignoreyes"><?php echo _("Yes");?></label>
						<input type="radio" name="cwignore" id="cwignoreno" value="" <?php echo ($cwignore == "CHECKED"?"":"CHECKED") ?>>
						<label for="cwignoreno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="cwignorew-help" class="help-block fpbx-help-block"><?php echo _("When enabled, agents who are on an occupied phone will be skipped as if the line were returning busy. This means that Call Waiting or multi-line phones will not be presented with the call and in the various hunt style ring strategies, the next agent will be attempted.")?></span>
		</div>
	</div>
</div>
<!--END Skip Busy Agent-->
<!--Enable Call Pickup-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="cpickupw"><?php echo _("Enable Call Pickup") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="cpickupw"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="cpickup" id="cpickupyes" value="CHECKED" <?php echo ($cpickup == "CHECKED"?"CHECKED":"") ?>>
						<label for="cpickupyes"><?php echo _("Yes");?></label>
						<input type="radio" name="cpickup" id="cpickupno" value="" <?php echo ($cpickup == "CHECKED"?"":"CHECKED") ?>>
						<label for="cpickupno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="cpickupw-help" class="help-block fpbx-help-block"><?php echo _("When enabled, this will allow calls to the Ring Group to be picked up with the directed call pickup feature using the group number from any extension. When not checked, individual extensions that are part of the group can still be picked up by doing a directed call pickup by dialing the group number. Any extensions can still be picked up by doing a directed call pickup to the ringing extension , which works whether or not this is checked.")?></span>
		</div>
	</div>
</div>
<!--END Enable Call Pickup-->
<!--Confirm Calls-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="needsconfw"><?php echo _("Confirm Calls") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="needsconfw"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="needsconf" id="needsconfyes" value="CHECKED" <?php echo ($needsconf == "CHECKED"?"CHECKED":"") ?>>
						<label for="needsconfyes"><?php echo _("Yes");?></label>
						<input type="radio" name="needsconf" id="needsconfno" value="" <?php echo ($needsconf == "CHECKED"?"":"CHECKED") ?>>
						<label for="needsconfno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="needsconfw-help" class="help-block fpbx-help-block"><?php echo _('Enable this if you\'re calling external numbers that need confirmation - eg, a mobile phone may go to voicemail which will pick up the call. Enabling this requires the remote side push 1 on their phone before the call is put through. This feature only works with the ringall ring strategy')?></span>
		</div>
	</div>
</div>
<!--END Confirm Calls-->
<?php echo $remoteahtml ?>
<?php echo $toolatehtml ?>
<!--Change External CID Configuration-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="changecid"><?php echo _("Change External CID Configuration") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="changecid"></i>
					</div>
					<div class="col-md-9">
						<select name="changecid" id="changecid" class="form-control">
							<?php echo $ccidrows ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="changecid-help" class="help-block fpbx-help-block"><?php echo $ccidhelp?></span>
		</div>
	</div>
</div>
<!--END Change External CID Configuration-->
<!--Fixed CID Value-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="fixedcid"><?php echo _("Fixed CID Value") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="fixedcid"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="fixedcid" name="fixedcid" value="<?php echo $fixedcid ?>" <?php echo $fixedcid_disabled ?>>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="fixedcid-help" class="help-block fpbx-help-block"><?php echo _("Fixed value to replace the CID with used with some of the modes above. Should be in a format of digits only with an option of E164 format using a leading '+'.")?></span>
		</div>
	</div>
</div>
<!--END Fixed CID Value-->
<!--Call Recording-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="recordingw"><?php echo _("Call Recording") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="recordingw"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" id="record_force" name="recording" value="force" <?php echo ($recording=='force'?'checked':'');?>>
						<label for="record_force"><?php echo _('Force'); ?></label>
						<input type="radio" id="record_dontcare" name="recording" value="dontcare" <?php echo ($recording=='dontcare'?'checked':'');?>>
						<label for="record_dontcare"><?php echo _("Dont Care")?></label>
						<input type="radio" id="record_never" name="recording" value="never" <?php echo ($recording=='never'?'checked':'');?>>
						<label for="record_never"><?php echo _('Never'); ?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="recordingw-help" class="help-block fpbx-help-block"><?php echo _('You can always record calls that come into this ring group (Force), never record them (Never), or allow the extension that answers to do on-demand recording (Dont Care). If recording is denied then one-touch on demand recording will be blocked, unless they have the "Override" call recording setting.')?></span>
		</div>
	</div>
</div>
<!--END Call Recording-->
<?php
// implementation of module hook
$module_hook = \moduleHook::create();
echo $module_hook->hookHtml;
?>
<!--Destination if no answer-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="goto0"><?php echo _("Destination if no answer") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
					</div>
					<div class="col-md-9">
						<?php echo drawselects($goto,0,false,false);?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Where to send callers if there is no answer.")?></span>
		</div>
	</div>
</div>
<!--END Destination if no answer-->
