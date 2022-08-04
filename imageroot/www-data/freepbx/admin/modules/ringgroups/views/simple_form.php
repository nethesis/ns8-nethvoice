<!--Group Description-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="description"><?php echo _("Ring Group Name") ?></label>
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
			<span id="description-help" class="help-block fpbx-help-block"><?php echo _("Provide a name for this Ring Group.")?></span>
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
									<option value="" SELECTED><?php echo("Extension Quick Select")?></option>
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
			<span id="grplist-help" class="help-block fpbx-help-block"><?php echo _("List extensions to ring, one per line, or use the Extension Quick Select to insert them here.<br><br>You can include an extension on a remote system, or an external number by suffixing a number with a '#'.  ex:  2448089# would dial 2448089")?></span>
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
							<option value="ringall"><?php echo _("Simultaneous")?></option>
							<option value="hunt"><?php echo _("Sequential")?></option>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="strategy-help" class="help-block fpbx-help-block"><?php echo _("<strong>Simultaneous:</strong> Rings all extensions at once.</br><strong>Sequential:</strong> Rings each extension separately in the order defined in the list")?></span>
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
						<label class="control-label" for="grptime"><?php echo _("Ring Time") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="grptime"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" name="grptime" id="grptime">
							<?php  $grptime = isset($grptime) && trim($grptime) != "" ? $grptime : 20; ?>
							<?php for($i=1;$i<=120;$i++) { ?>
								<option value="<?php echo $i?>" <?php echo ($grptime == $i)?"selected":"" ?>><?php echo $i?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="grptime-help" class="help-block fpbx-help-block"><?php echo _("Time in seconds that the phones will ring. For sequential ring strategies, this is the time for each iteration of phone(s) that are rung")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="alertinfo"><?php echo _("Ring Tone") ?></label>
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
			<span id="alertinfo-help" class="help-block fpbx-help-block"><?php echo _("Select a Ring Tone from the list of options above. This will determine how your phone sounds when it is rung from this group.")?></span>
		</div>
	</div>
</div>
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
						<?php echo drawselects($goto,0,array("core" => array("extensions","voicemail")),false)?>
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
<input type="hidden" id="grpre" name="grppre" value="<?php echo $grppre?>">
<input type="hidden" id="cfignore" name="cfignore"  value="<?php echo $cfignore?>">
<input type="hidden" id="cwignore" name="cwignore"  value="<?php echo $cwignore?>">
<input type="hidden" id="cpickup" name="cpickup"  value="<?php echo $cpickup?>">
<input type="hidden" id="needsconf" name="needsconf"  value="<?php echo $needsconf?>">
<?php $changecid = (isset($changecid) ? $changecid : 'default');?>
<input type="hidden" id="changecid" name="changecid"  value="<?php echo $changecid?>">
<input type="hidden" id="fixedcid" name="fixedcid" value="<?php echo $fixedcid ?>" <?php echo $fixedcid_disabled ?>>
<input type="hidden" id="recording" name="recording" value="<?php echo $recording ?>">
<input type="hidden" id="remotealert_id" name="remotealert_id" value="<?php echo !empty($remotealert_id) ? $remotealert_id : "" ?>">
<input type="hidden" id="toolate_id" name="toolate_id" value="<?php echo !empty($toolate_id) ? $toolate_id : "" ?>">
<input type="hidden" id="annmsg_id" name="annmsg_id" value="<?php echo !empty($annmsg_id) ? $annmsg_id : "" ?>">
<input type="hidden" id="ringing" name="ringing" value="<?php echo !empty($ringing) ? $ringing : "" ?>">
