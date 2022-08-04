<?php
//    License for all code of this FreePBX module can be found in the license file inside the module directory
//    Copyright 2015 Sangoma Technologies.
//

$tresults = music_list();
$none = array_search('none',$tresults);
if ($none !== false) {
	unset($tresults[$none]);
}
if (isset($tresults)) {
	foreach ($tresults as $tresult) {
		$searchvalue="$tresult";
		$ttext = $tresult;
		if($tresult == 'default') $ttext = _("default");
		$mohopts .= '<option value="'.$tresult.'" '.($searchvalue == $parkedmusicclass ? 'SELECTED' : '').'>'.$ttext;
	}
}
if(function_exists('recordings_list')) { //only include if recordings is enabled
	$tresults = recordings_list();
	$announceopts = '<option value="">'._("None")."</option>";
	if (isset($tresults[0])) {
		foreach ($tresults as $tresult) {
			$announceopts .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $announcement_id ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
		}
	}
	$announcehtml  = '
	<!--Announcement-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="announcement_id">'. _("Announcement") .'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="announcement_id"></i>
						</div>
						<div class="col-md-9">
							<select class="form-control" id="announcement_id" name="announcement_id">
								'.$announceopts.'
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="announcement_id-help" class="help-block fpbx-help-block">'. _("Optional message to be played to the call prior to sending back to the Originator or the Alternate Destination.").'</span>
			</div>
		</div>
	</div>
	<!--END Announcement-->
	';
}else {
	$announcehtml = '<input type="hidden" name="announcement_id" value="'.$announcement_id.'">';
}

?>
<form id="parkform" action="" class='fpbx-submit' method="post">
<input type="hidden" name="display" value="parking">
<input type="hidden" name="action" value="update">
<input type="hidden" name="id" value="<?php echo $id?>">
<h2><?php echo _("Edit: "). $name ?></h2>
<div class="section-title" data-for="parkgeneral">
	<h3><i class="fa fa-minus"></i><?php echo _("General Settings")?></h3>
</div>
<div class="section" data-id="parkgeneral">
	<!--Parking Lot Extension-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="parkext"><?php echo _("Parking Lot Extension") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="parkext"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control extdisplay" id="parkext" name="parkext" value="<?php echo $parkext?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="parkext-help" class="help-block fpbx-help-block"><?php echo _("This is the extension where you will transfer a call to park it")?></span>
			</div>
		</div>
	</div>
	<!--END Parking Lot Extension-->
	<!--Parking Lot Name-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="name"><?php echo _("Parking Lot Name") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control" id="name" name="name" value="<?php echo $name?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="name-help" class="help-block fpbx-help-block"><?php echo _("Provide a Descriptive Title for this Parking Lot")?></span>
			</div>
		</div>
	</div>
	<!--END Parking Lot Name-->
	<!--Parking Lot Starting Position-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="parkpos"><?php echo _("Parking Lot Starting Position") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="parkpos"></i>
						</div>
						<div class="col-md-9">
							<input type="number" min="0" class="form-control extdisplay" id="parkpos" name="parkpos" value="<?php echo $parkpos?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="parkpos-help" class="help-block fpbx-help-block"><?php echo _("he starting postion of the parking lot")?></span>
			</div>
		</div>
	</div>
	<!--END Parking Lot Starting Position-->
	<!--Number of Slots-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="numslots"><?php echo _("Number of Slots") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="numslots"></i>
						</div>
						<div class="col-md-9">
							<div class="input-group">
								<input type="number" min="1" class="form-control" id="numslots" name="numslots" value="<?php echo $numslots?>">
								<span id="slotslist" class="input-group-addon"></span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="numslots-help" class="help-block fpbx-help-block"><?php echo _("The total number of parking lot spaces to configure. Example, if 70 is the extension and 8 slots are configured, the parking slots will be 71-78. Users can transfer a call directly into a parking slot.")?></span>
			</div>
		</div>
	</div>
	<!--END Number of Slots-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="slotrange"><?php echo _("Slot Range") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="slotrange"></i>
						</div>
						<div class="col-md-9">
							<span id="slotrange"></span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="slotrange-help" class="help-block fpbx-help-block"><?php echo _("The generated slot range")?></span>
			</div>
		</div>
	</div>
	<!--Parking Timeout (seconds)-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="parkingtime"><?php echo _("Parking Timeout (seconds)") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="parkingtime"></i>
						</div>
						<div class="col-md-9">
							<input type="number"  min="0" class="form-control" id="parkingtime" name="parkingtime" value="<?php echo $parkingtime?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="parkingtime-help" class="help-block fpbx-help-block"><?php echo _("The timeout period in seconds that a parked call will attempt to ring back the original parker if not answered")?></span>
			</div>
		</div>
	</div>
	<!--END Parking Timeout (seconds)-->
	<!--Parked Music Class-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="parkedmusicclass"><?php echo _("Parked Music Class") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="parkedmusicclass"></i>
						</div>
						<div class="col-md-9">
							<select class="form-control" id="parkedmusicclass" name="parkedmusicclass">
								<?php echo $mohopts?>
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="parkedmusicclass-help" class="help-block fpbx-help-block"><?php echo _("This is the music class that will be played to a parked call while in the parking lot UNLESS the call flow prior to parking the call explicitly set a different music class, such as if the call came in through a queue or ring group.")?></span>
			</div>
		</div>
	</div>
	<!--END Parked Music Class-->
	<!--Find Slot-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="findslot"><?php echo _("Find Slot") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="findslot"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" name="findslot" value="next" id="findslot_next" <?php echo ($findslot == 'next' ? 'checked' : '')?>>
							<label for="findslot_next"><?php echo _("Next") ?></label>
							<input type="radio" name="findslot" value="first" id="findslot_first" <?php echo ($findslot == 'first' ? 'checked' : '')?>>
							<label for="findslot_first"><?php echo _("First") ?></label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="findslot-help" class="help-block fpbx-help-block"><?php echo _("Next: If you want the parking lot to seek the next sequential parking slot relative to the the last parked call instead of seeking the first available slot. First: Use the first parking lot slot available")?></span>
			</div>
		</div>
	</div>
	<!--END Find Slot-->
</div>
<div class="section-title" data-for="parkcallback">
	<h3><i class="fa fa-minus"></i><?php echo _("Returned Call Behavior")?></h3>
</div>
<div class="section" data-id="parkcallback">
	<!--Pickup Courtesy Tone-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="parkedplay"><?php echo _("Pickup Courtesy Tone") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="parkedplay"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" name="parkedplay" id="parkedplay-caller" value="caller" <?php echo ($parkedplay == 'caller' ? 'checked' : '')?>/>
							<label for="parkedplay-caller"><?php echo _("Caller") ?></label>
							<input type="radio" name="parkedplay" id="parkedplay-callee" value="callee" <?php echo ($parkedplay == 'callee' ? 'checked' : '')?>/>
							<label for="parkedplay-callee"><?php echo _("Parked") ?></label>
							<input type="radio" name="parkedplay" id="parkedplay-both" value="both" <?php echo ($parkedplay == 'both' ? 'checked' : '')?>/>
							<label for="parkedplay-both"><?php echo _("Both") ?></label>
							<input type="radio" name="parkedplay" id="parkedplay-no" value="no" <?php echo ($parkedplay == 'no' ? 'checked' : '')?>/>
							<label for="parkedplay-no"><?php echo _("None") ?></label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="parkedplay-help" class="help-block fpbx-help-block"><?php echo _("Whom to play the courtesy tone to when a parked call is retrieved.")?></span>
			</div>
		</div>
	</div>
	<!--END Pickup Courtesy Tone-->
	<!--Transfer Capability-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="parkedcalltransfers"><?php echo _("Transfer Capability") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="parkedcalltransfers"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" name="parkedcalltransfers" id="parkedcalltransfers-caller" value="caller" <?php echo ($parkedcalltransfers == 'caller' ? 'checked' : '')?>/>
							<label for="parkedcalltransfers-caller"><?php echo _("Caller") ?></label>
							<input type="radio" name="parkedcalltransfers" id="parkedcalltransfers-callee" value="callee" <?php echo ($parkedcalltransfers == 'callee' ? 'checked' : '')?>/>
							<label for="parkedcalltransfers-callee"><?php echo _("Parked") ?></label>
							<input type="radio" name="parkedcalltransfers" id="parkedcalltransfers-both" value="both" <?php echo ($parkedcalltransfers == 'both' ? 'checked' : '')?>/>
							<label for="parkedcalltransfers-both"><?php echo _("Both") ?></label>
							<input type="radio" name="parkedcalltransfers" id="parkedcalltransfers-no" value="no" <?php echo ($parkedcalltransfers == 'no' ? 'checked' : '')?>/>
							<label for="parkedcalltransfers-no"><?php echo _("Neither") ?></label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="parkedcalltransfers-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: parkedcalltransfers. Enables or disables DTMF based transfers when picking up a parked call.")?></span>
			</div>
		</div>
	</div>
	<!--END Transfer Capability-->
	<!--Re-Parking Capability-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="parkedcallreparking"><?php echo _("Re-Parking Capability") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="parkedcallreparking"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" name="parkedcallreparking" id="parkedcallreparking-caller" value="caller" <?php echo ($parkedcallreparking == 'caller' ? 'checked' : '')?>/>
							<label for="parkedcallreparking-caller"><?php echo _("Caller") ?></label>
							<input type="radio" name="parkedcallreparking" id="parkedcallreparking-callee" value="callee" <?php echo ($parkedcallreparking == 'callee' ? 'checked' : '')?>/>
							<label for="parkedcallreparking-callee"><?php echo _("Parked") ?></label>
							<input type="radio" name="parkedcallreparking" id="parkedcallreparking-both" value="both" <?php echo ($parkedcallreparking == 'both' ? 'checked' : '')?>/>
							<label for="parkedcallreparking-both"><?php echo _("Both") ?></label>
							<input type="radio" name="parkedcallreparking" id="parkedcallreparking-no" value="no" <?php echo ($parkedcallreparking == 'no' ? 'checked' : '')?>/>
							<label for="parkedcallreparking-no"><?php echo _("Neither") ?></label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="parkedcallreparking-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: parkedcallreparking. Enables or disables DTMF based parking when picking up a parked call.")?></span>
			</div>
		</div>
	</div>
	<!--END Re-Parking Capability-->
	<!--Parking Alert-Info-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="alertinfo"><?php echo _("Parking Alert-Info") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="alertinfo"></i>
						</div>
						<div class="col-md-9">
							<?php echo FreePBX::View()->alertInfoDrawSelect("alertinfo",$alertinfo);?>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="alertinfo-help" class="help-block fpbx-help-block"><?php echo _("Alert-Info to add to the call prior to sending back to the Originator or to the Alternate Destination.")?></span>
			</div>
		</div>
	</div>
	<!--END Parking Alert-Info-->
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
								<option value="0"><?php echo _("None")?></option>
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
	<!--CallerID Prepend-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="cidpp"><?php echo _("CallerID Prepend") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="cidpp"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control" id="cidpp" name="cidpp" value="<?php echo htmlspecialchars($cidpp)?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="cidpp-help" class="help-block fpbx-help-block"><?php echo _("String to prepend to the current Caller ID associated with the parked call prior to sending back to the Originator or the Alternate Destination.")?></span>
			</div>
		</div>
	</div>
	<!--END CallerID Prepend-->
	<!--Auto CallerID Prepend-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="autocidpp"><?php echo _("Auto CallerID Prepend") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="autocidpp"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" name="autocidpp" id="autocidppnone" value="none" <?php echo ($autocidpp == 'none' ? 'CHECKED' : '')?>>
							<label for="autocidppnone"><?php echo _("None") ?></label>
							<input type="radio" name="autocidpp" id="autocidppslot" value="slot" <?php echo ($autocidpp == 'slot' ? 'CHECKED' : '')?>>
							<label for="autocidppslot"><?php echo _("Slot") ?></label>
							<input type="radio" name="autocidpp" id="autocidppexten" value="exten" <?php echo ($autocidpp == 'exten' ? 'CHECKED' : '')?>>
							<label for="autocidppexten"><?php echo _("Extension") ?></label>
							<input type="radio" name="autocidpp" id="autocidppname" value="name" <?php echo ($autocidpp == 'name' ? 'CHECKED' : '')?>>
							<label for="autocidppname"><?php echo _("Name") ?></label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="autocidpp-help" class="help-block fpbx-help-block"><?php echo _("These options will be appended after CallerID Prepend if set. Otherwise they will appear first. The automatic options are as follows:<ul><li><strong>None:</strong> No Automatic Prepend</li><li><strong>Slot:</strong> Parking lot they were parked on</li><li><strong>Extension:</strong> The extension number that parked the call</li><li><strong>Name:</strong> The user who parked the call</li></ul>")?></span>
			</div>
		</div>
	</div>
	<!--END Auto CallerID Prepend-->
	<?php echo $announcehtml ?>
</div>
<div class="section-title" data-for="parkalt">
	<h3><i class="fa fa-minus"></i><?php echo _("Alternate Destination")?></h3>
</div>
<div class="section" data-id="parkalt">
	<!--Come Back to Origin-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="comebacktoorigin"><?php echo _("Come Back to Origin") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="comebacktoorigin"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" name="comebacktoorigin" id="parking_dest-device" value="yes" <?php echo ($comebacktoorigin == 'yes' ? 'checked' : '')?>/>
							<label for="parking_dest-device"><?php echo _("Yes") ?></label>
							<input type="radio" name="comebacktoorigin" id="parking_dest-dest" value="no" <?php echo ($comebacktoorigin == 'no' ? 'checked' : '')?>/>
							<label for="parking_dest-dest"><?php echo _("No") ?></label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="comebacktoorigin-help" class="help-block fpbx-help-block"><?php echo _("Where to send a parked call that has timed out. If set to yes then the parked call will be sent back to the originating device that sent the call to this parking lot. If the origin is busy then we will send the call to the Destination selected below. If set to no then we will send the call directly to the destination selected below")?></span>
			</div>
		</div>
	</div>
	<!--END Come Back to Origin-->
	<!--Destination-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="goto0"><?php echo _("Destination") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
						</div>
						<div class="col-md-9">
							<?php echo drawselects($dest,0,false,false);?>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Failover Destination.")?></span>
			</div>
		</div>
	</div>
	<!--END Destination-->
</div>
</form>
