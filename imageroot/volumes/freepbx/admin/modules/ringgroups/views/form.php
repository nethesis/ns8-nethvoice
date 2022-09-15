<?php
extract($request);
if ($extdisplay) {
	// We need to populate grplist with the existing extension list.
	$account = ltrim($extdisplay,'GRP-');
	$thisgrp = ringgroups_get(ltrim($extdisplay,'GRP-'));
	$grpliststr = $thisgrp['grplist'];
	$grplist = explode("-", $grpliststr);
	$strategy = $thisgrp['strategy'];
	$grppre = $thisgrp['grppre'];
	$progress = isset($thisgrp['progress'])?$thisgrp['progress']:'yes';
	$elsewhere = isset($thisgrp['elsewhere'])?$thisgrp['elsewhere']:'no';
	$grptime = $thisgrp['grptime'];
	$goto = $thisgrp['postdest'];
	$annmsg_id = $thisgrp['annmsg_id'];
	$description = $thisgrp['description'];
	$alertinfo = $thisgrp['alertinfo'];
	$rvolume = $thisgrp['rvolume'];
	$remotealert_id = $thisgrp['remotealert_id'];
	$needsconf = $thisgrp['needsconf'];
	$cwignore = $thisgrp['cwignore'];
	$cpickup = $thisgrp['cpickup'];
	$cfignore = $thisgrp['cfignore'];
	$toolate_id = $thisgrp['toolate_id'];
	$ringing = $thisgrp['ringing'];
	$changecid   = isset($thisgrp['changecid'])   ? $thisgrp['changecid']   : 'default';
	$fixedcid    = isset($thisgrp['fixedcid'])    ? $thisgrp['fixedcid']    : '';
	$recording = $thisgrp['recording'];
	unset($grpliststr);
	unset($thisgrp);
}else{
	//defaults
	$grplist = explode("-", '');;
	$strategy = '';
	$grppre = '';
	$grptime = '';
	$progress = 'yes';
	$elsewhere = 'no';
	$goto = '';
	$annmsg_id = '';
	$alertinfo = '';
	$rvolume = '';
	$remotealert_id = '';
	$needsconf = '';
	$cwignore = '';
	$cpickup = '';
	$cfignore = '';
	$toolate_id = '';
	$ringing = '';
	$recording = 'dontcare';
	$accountinput = '<input type="text" class="form-control" id="account" name="account" value="">';
}
//Ring Strategy Help
$rshelp = '<b>' . _("ringall")				.'</b>: '. _("Ring all available channels until one answers (default)")
		. '<br>'
		. '<b>'. _("hunt")				.'</b>: '. _("Take turns ringing each available extension")
		. '<br>'
		. '<b>'. _("memoryhunt") 		.'</b>: '. _("Ring first extension in the list, then ring the 1st and 2nd extension, then ring 1st 2nd and 3rd extension in the list.... etc. This strategy will work only when Confirm Calls is disabled.")
		. '<br>'
		. '<b>'. _("*-prim")  			.'</b>: '. _("These modes act as described above. However, if the primary extension (first in list) is occupied, the other extensions will not be rung. If the primary is FreePBX DND, it won't be rung. If the primary is FreePBX CF unconditional, then all will be rung")
		. '<br>'
		. '<b>'. _("firstavailable")  	.'</b>: '. _("ring only the first available channel. This strategy will work only when Confirm Calls is disabled.")
		. '<br>'
		. '<b>'. _("firstnotonphone")	.'</b>: '. _("ring only the first channel which is not offhook - ignore CW. This strategy will work only when Confirm Calls is disabled.")
		. '<br>'
		. '<b>'. _("random") 			.'</b>: '. _("Makes a call could hop between the included extensions without a predefined priority to ensure that calls in the groups are (almost) evenly spread. Simulates a Queue when a Queue can not otherwise be used.")
		. '<br>';
//End Ring Strategy Help

//Ring Strategy Rows
$default = (isset($strategy) ? $strategy : 'ringall');
$items = array('ringall','ringall-prim','hunt','hunt-prim','memoryhunt','memoryhunt-prim','firstavailable','firstnotonphone','random');
$rsrows = '';
foreach ($items as $item) {
	$rsrows .= '<option value="'.$item.'" '.($default == $item ? 'SELECTED' : '').'>'._($item) .'</option>';
}
//For Quick Select
$users = $results = core_users_list();
$qsagentlist = '';
foreach($results as $result){
	$qsagentlist .= "<option value='".$result[0]."'>".$result[0]." (".$result[1].")</option>\n";
}
$glrows = count($grplist)+1;
$glrows = ($glrows < 4) ? 4 : (($glrows > 20) ? 20 : $glrows);

$display_mode = "advanced";
$mode = \FreePBX::Config()->get("FPBXOPMODE");
if(!empty($mode)) {
	$display_mode = $mode;
}

if(function_exists('recordings_list')) {
	$announcementhtml = '
		<!--Announcement-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="annmsg_id">'._("Announcement").'</label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="annmsg_id"></i>
							</div>
							<div class="col-md-9">
								<select name="annmsg_id" id="annmsg_id" class="form-control">';
								$tresults = recordings_list();
								$default = (isset($annmsg_id) ? $annmsg_id : '');
								$announcementhtml .= '<option value="">'._("None")."</option>";
								if (isset($tresults[0])) {
									foreach ($tresults as $tresult) {
										$announcementhtml .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
									}
								}
	$announcementhtml .='	</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="annmsg_id-help" class="help-block fpbx-help-block">'. _("Message to be played to the caller before dialing this group.<br><br>To add additional recordings please use the \"System Recordings\" MENU above").'</span>
				</div>
			</div>
		</div>
		<!--END Announcement-->
	';
	$remoteahtml = '
		<!--Remote Announce-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="remotealert_id">'._("Remote Announce").'</label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="remotealert_id"></i>
							</div>
							<div class="col-md-9">
								<select name="remotealert_id" id="remotealert_id" class="form-control">';
								$tresults = recordings_list();
								$default = (isset($remotealert_id) ? $remotealert_id : '');
								$remoteahtml .= '<option value="">'._("Default")."</option>";
								if (isset($tresults[0])) {
									foreach ($tresults as $tresult) {
										$remoteahtml .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
									}
								}
	$remoteahtml .='			</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="remotealert_id-help" class="help-block fpbx-help-block">'. _("Message to be played to the person RECEIVING the call, if 'Confirm Calls' is enabled.<br><br>To add additional recordings use the \"System Recordings\" MENU above").'</span>
				</div>
			</div>
		</div>
		<!--END Remote Announce-->
	';
	$toolatehtml = '
		<!--Too-Late Announce-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="toolate_id">'._("Too-Late Announce").'</label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="toolate_id"></i>
							</div>
							<div class="col-md-9">
								<select name="toolate_id" id="toolate_id" class="form-control">';
								$tresults = recordings_list();
								$default = (isset($toolate_id) ? $toolate_id : '');
								$toolatehtml .= '<option value="">'._("Default")."</option>";
								if (isset($tresults[0])) {
									foreach ($tresults as $tresult) {
										$toolatehtml .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
									}
								}
	$toolatehtml .='			</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="toolate_id-help" class="help-block fpbx-help-block">'. _("Message to be played to the person RECEIVING the call, if the call has already been accepted before they push 1.<br><br>To add additional recordings use the \"System Recordings\" MENU above").'</span>
				</div>
			</div>
		</div>
		<!--END Too-late Announce-->
	';
}else{
	$default = (isset($annmsg_id) ? $annmsg_id : '');
	$announcementhtml = '<input type="hidden" name="annmsg_id" value="'.$default.'">';
}
if(function_exists('music_list')) {
	$ringhtml='
	<!--Play Music On Hold-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="ringing">'._("Play Music On Hold").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="ringing"></i>
						</div>
						<div class="col-md-9">
							<select name="ringing" id="ringing" class="form-control">';
							$cur = (isset($ringing) ? $ringing : 'Ring');
							$tresults = \music_list();
							$ringhtml .= '<option value="Ring">'._("Ring").'</option>';
							$ringhtml .= '<option value="inherit" '.($cur == 'inherit' ? ' SELECTED' : '').'>'._("Inherit").'</option>';
							if (isset($tresults[0])) {
							foreach ($tresults as $tresult) {
							    ( $tresult == 'none' ? $ttext = _("none") : $ttext = $tresult );
							    ( $tresult == 'default' ? $ttext = _("default") : $ttext = $tresult );
								$ringhtml .= '<option value="'.$tresult.'"'.($tresult == $cur ? ' SELECTED' : '').'>'._($ttext)."</option>\n";
							}
						}

	$ringhtml .= '			</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="ringing-help" class="help-block fpbx-help-block">'._("If you select a Music on Hold class to play, instead of 'Ring', they will hear that instead of Ringing while they are waiting for someone to pick up.").'</span>
			</div>
		</div>
	</div>
	<!--END Music on Hold Class-->
	';
}
$ccidhelp = _("Mode").':'
			.'<br>'
			.'<b>'. _("Default") 						.'</b>: '. _("Transmits the Callers CID if allowed by the trunk.")
			.'<br>'
			.'<b>'. _("Fixed CID Value") 				.'</b>: '. _("Always transmit the Fixed CID Value below.")
			.'<br>'
			.'<b>'. _("Outside Calls Fixed CID Value") 	.'</b>: '. _("Transmit the Fixed CID Value below on calls that come in from outside only. Internal extension to extension calls will continue to operate in default mode.")
			.'<br>'
			.'<b>'. _("Use Dialed Number")				.'</b>: '. _("Transmit the number that was dialed as the CID for calls coming from outside. Internal extension to extension calls will continue to operate in default mode. There must be a DID on the inbound route for this. This will be BLOCKED on trunks that block foreign CallerID")
			.'<br>'
			.'<b>'. _("Force Dialed Number")			.'</b>: '. _("Transmit the number that was dialed as the CID for calls coming from outside. Internal extension to extension calls will continue to operate in default mode. There must be a DID on the inbound route for this. This WILL be transmitted on trunks that block foreign CallerID")
			.'<br>';

$default = (isset($changecid) ? $changecid : 'default');
$ccidrows = '<option value="default" '.($default == 'default' ? 'SELECTED' : '').'>'._("Default").'</option>';
$ccidrows .= '<option value="fixed" '.($default == 'fixed' ? 'SELECTED' : '').'>'._("Fixed CID Value").'</option>';
$ccidrows .= '<option value="extern" '.($default == 'extern' ? 'SELECTED' : '').'>'._("Outside Calls Fixed CID Value").'</option>';
$ccidrows .= '<option value="did" '.($default == 'did' ? 'SELECTED' : '').'>'._("Use Dialed Number").'</option>';
$ccidrows .= '<option value="forcedid" '.($default == 'forcedid' ? 'SELECTED' : '').'>'._("Force Dialed Number").'</option>';
$fixedcid_disabled = ($default != 'fixed' && $default != 'extern') ? ' disabled':'';
?>
<form class="popover-form fpbx-submit" name="editGRP" action="" method="post" onsubmit="return checkGRP(editGRP);" data-fpbx-delete="config.php?display=ringgroups&action=delGRP&account=<?php echo $account ?>">
<input type="hidden" name="display" value="ringgroups">
<input type="hidden" name="view" value="form">
<input type="hidden" name="action" value="<?php echo ($extdisplay ? 'edtGRP' : 'addGRP'); ?>">
<?php if($extdisplay) { ?>
	<input type="hidden" name="account" id="account" value="<?php echo ltrim($extdisplay,'GRP-')?>">
<?php } ?>
<?php
	if($display_mode == "basic") {
		if (!$extdisplay) {
			//figure out last extension
			$map = framework_get_extmap();
			if(!empty($map)) {
				ksort($map);
				end($map);
				$key = key($map);
				$digit = preg_replace("/\D/","",$key);
				$last_ext = !empty($digit) ? (int)$digit + 1 : 500;
			} else {
				$last_ext = 500;
			}
			$grplist = explode("-", '');;
			$strategy = '';
			$grppre = '';
			$grptime = '';
			$goto = '';
			$annmsg_id = '';
			$alertinfo = '';
			$remotealert_id = '';
			$needsconf = '';
			$cwignore = 'CHECKED';
			$cpickup = 'CHECKED';
			$cfignore = 'CHECKED';
			$toolate_id = '';
			$ringing = '';
			$recording = 'dontcare';
			$fixedcid_disabled = 'disabled';
		}
		include(__DIR__."/simple_form.php");
	} else {
		include(__DIR__."/advanced_form.php");
	}
?>
</form>
