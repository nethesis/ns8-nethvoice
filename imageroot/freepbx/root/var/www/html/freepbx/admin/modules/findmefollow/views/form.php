<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
extract($request);
$groups = (FreePBX::Modules()->checkStatus('calendar'))?FreePBX::Calendar()->listGroups():array();
$calendars = (FreePBX::Modules()->checkStatus('calendar'))?FreePBX::Calendar()->listCalendars():array();

if ($extdisplay != "") {
	// We need to populate grplist with the existing extension list.
	$extdisplay = ltrim($extdisplay,'GRP-');
	$followme_exten = $extdisplay;
	$thisgrp = FreePBX::Findmefollow()->get($extdisplay, 1);
	$grpliststr = isset($thisgrp['grplist']) ? $thisgrp['grplist'] : '';
	$grplist = explode("-", $grpliststr);
	$strategy    = isset($thisgrp['strategy'])    ? $thisgrp['strategy']    : '';
	$grppre      = isset($thisgrp['grppre'])      ? $thisgrp['grppre']      : '';
	$grptime     = isset($thisgrp['grptime'])     ? $thisgrp['grptime']     : '';
	$annmsg_id   = isset($thisgrp['annmsg_id'])      ? $thisgrp['annmsg_id']      : '';
	$dring       = isset($thisgrp['dring'])       ? $thisgrp['dring']       : '';
	$remotealert_id = isset($thisgrp['remotealert_id']) ? $thisgrp['remotealert_id'] : '';
	$needsconf   = isset($thisgrp['needsconf'])   ? $thisgrp['needsconf']   : '';
	$toolate_id  = isset($thisgrp['toolate_id'])     ? $thisgrp['toolate_id']     : '';
	$ringing     = isset($thisgrp['ringing'])     ? $thisgrp['ringing']     : '';
	$pre_ring    = isset($thisgrp['pre_ring'])    ? $thisgrp['pre_ring']    : '';
	$ddial       = isset($thisgrp['ddial'])       ? $thisgrp['ddial']       : '';
	$changecid   = isset($thisgrp['changecid'])   ? $thisgrp['changecid']   : 'default';
	$fixedcid    = isset($thisgrp['fixedcid'])    ? $thisgrp['fixedcid']    : '';
	$calendar_enable    = isset($thisgrp['calendar_enable'])    ? $thisgrp['calendar_enable']    : '0';
	$calendar_id    = isset($thisgrp['calendar_id'])    ? $thisgrp['calendar_id']    : '';
	$calendar_group_id    = isset($thisgrp['calendar_group_id'])    ? $thisgrp['calendar_group_id']    : '';
	$calendar_match    = isset($thisgrp['calendar_match'])    ? $thisgrp['calendar_match']    : 'yes';
	$rvolume     = isset($thisgrp['rvolume'])     ? $thisgrp['rvolume']     : '';
	$goto = isset($thisgrp['postdest'])?$thisgrp['postdest']:((isset($thisgrp['voicemail']) && $thisgrp['voicemail'] != 'novm')?"ext-local,vmu$extdisplay,1":'');
	unset($grpliststr);
	unset($thisgrp);
}
//Ring Strategy Help

$rshelp =    '<b>' . _("ringallv2"). 		'</b>: ' . _("ring Extension for duration set in Initial Ring Time, and then, while continuing call to extension (only if extension is in the Group List), ring Follow-Me List for duration set in Ring Time.")
			.'<br>'
			.'<b>' . _("ringall"). 			'</b>: ' . _("ring Extension for duration set in Initial Ring Time, and then terminate call to Extension and ring Follow-Me List for duration set in Ring Time.")
			.'<br>'
			.'<b>' . _("hunt"). 			'</b>: ' . _("take turns ringing each available extension")
			.'<br>'
			.'<b>' . _("memoryhunt").		'</b>: ' . _("ring first extension in the list, then ring the 1st and 2nd extension, then ring 1st 2nd and 3rd extension in the list.... etc. This strategy will work only when Confirm Calls is disabled.")
			.'<br>'
			.'<b>' . _("*-prim"). 			'</b>: ' . _("these modes act as described above. However, if the primary extension (first in list) is occupied, the other extensions will not be rung. If the primary is FreePBX DND, it won't be rung. If the primary is FreePBX CF unconditional, then all will be rung")
			.'<br>'
			.'<b>' . _("firstavailable").	'</b>: ' . _("ring only the first available channel. This strategy will work only when Confirm Calls is disabled.")
			.'<br>'
			.'<b>' . _("firstnotonphone"). 	'</b>: ' . _("ring only the first channel which is not off hook - ignore CW. This strategy will work only when Confirm Calls is disabled.")
			.'<br>';
//Ring Strategy Select Options
$default = (isset($strategy) ? $strategy : 'ringall');
$items = array('ringallv2','ringallv2-prim','ringall','ringall-prim','hunt','hunt-prim','memoryhunt','memoryhunt-prim','firstavailable','firstnotonphone');
$rsrows = '';
foreach ($items as $item) {
	$rsrows .= '<option value="'.$item.'" '.($default == $item ? 'SELECTED' : '').'>'._($item).'</option>';
}
//For Quick Select
$results = core_users_list();
$qsagentlist = '';
foreach($results as $result){
	$qsagentlist .= "<option value='".$result[0]."'>".$result[0]." (".$result[1].")</option>\n";
}
$glrows = count($grplist)+1;
$glrows = ($glrows < 4) ? 4 : (($glrows > 20) ? 20 : $glrows);
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
								<select name="remotealert_id" id="remotealert_id" class="form-control fmfm_remotealert_id" '.(($needsconf == "CHECKED") ? "" : "disabled").'>';
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
								<select name="toolate_id" id="toolate_id" class="form-control fmfm_remotealert_id" '.(($needsconf == "CHECKED") ? "" : "disabled").'>';
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
$default = (isset($changecid) ? $changecid : 'default');
$ccidrows = '<option value="default" '.($default == 'default' ? 'SELECTED' : '').'>'._("Default").'</option>';
$ccidrows .= '<option value="fixed" '.($default == 'fixed' ? 'SELECTED' : '').'>'._("Fixed CID Value").'</option>';
$ccidrows .= '<option value="extern" '.($default == 'extern' ? 'SELECTED' : '').'>'._("Outside Calls Fixed CID Value").'</option>';
$ccidrows .= '<option value="did" '.($default == 'did' ? 'SELECTED' : '').'>'._("Use Dialed Number").'</option>';
$ccidrows .= '<option value="forcedid" '.($default == 'forcedid' ? 'SELECTED' : '').'>'._("Force Dialed Number").'</option>';
$fixedcid_disabled = ($default != 'fixed' && $default != 'extern') ? 'disabled = "disabled"':'';
//Goto...
if (empty($goto)) {
	$goto = "from-did-direct,$extdisplay,1";
}

?>
<form class="fpbx-submit" name="editGRP" action="" method="post" onsubmit="return checkGRP(editGRP);">
<input type="hidden" name="display" value="findmefollow">
<input type="hidden" name="action" value="<?php echo (($extdisplay != "") ? 'edtGRP' : 'addGRP'); ?>">
<input type="hidden" name="view" value="form">
<!--Group Number-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="account"><?php echo _("Group Number") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="account"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="account" name="account" value="<?php  echo $extdisplay; ?>" <?php echo ($extdisplay != ''?'readonly':'')?>>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="account-help" class="help-block fpbx-help-block"><?php echo _("The number users will dial to ring extensions in this Followme group")?></span>
		</div>
	</div>
</div>
<!--END Group Number-->
<!--Enable Followme-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="ddialw"><?php echo _("Enable Followme") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="ddialw"></i>
					</div>
					<div class="col-md-9 radioset">
						<input type="radio" name="ddial" id="ddialyes" value='' <?php echo ($ddial == 'CHECKED')?'':'CHECKED'?>>
						<label for="ddialyes"><?php echo _("Yes")?></label>
						<input type="radio" name="ddial" id="ddialno" value='CHECKED' <?php echo ($ddial == 'CHECKED')?'CHECKED':'' ?>>
						<label for="ddialno"><?php echo _("No")?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="ddialw-help" class="help-block fpbx-help-block"><?php echo _('By default (yes) any call to this extension will go to this Follow-Me instead, including directory calls by name from IVRs. If no, calls will go only to the extension.<BR>However, destinations that specify FollowMe will come here.<BR>This setting is often used in conjunction with VmX Locater, where you want a call to ring the extension, and then only if the caller chooses to find you do you want it to come here.')?></span>
		</div>
	</div>
</div>
<!--END Enable Followme-->
<div class="element-container <?php echo FreePBX::Modules()->checkStatus('calendar')?'':'hidden'?>">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="calendar_enable"><?php echo _("Enable Calendar Matching") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="calendar_enable"></i>
          </div>
          <div class="col-md-9 radioset">
            <input type="radio" name="calendar_enable" id="calendar_enableyes" value="1" <?php echo ($calendar_enable == "1")?"CHECKED":"" ?>>
            <label for="calendar_enableyes"><?php echo _("Yes");?></label>
            <input type="radio" name="calendar_enable" id="calendar_enableno" value = "0" <?php echo ($calendar_enable == "0")?"CHECKED":"" ?>>
            <label for="calendar_enableno"><?php echo _("No");?></label>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="calendar_enable-help" class="help-block fpbx-help-block"><?php echo _("Link this Follow Me to a Calendar or Calendar group to automatically Enable/Disable based on a schedule")?></span>
    </div>
  </div>
</div>
<!--Calendar-->
<div class="element-container calendar <?php echo FreePBX::Modules()->checkStatus('calendar') && $calendar_enable ?'':'hidden'?>">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar_id"><?php echo _("Calendar") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar_id"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="calendar_id" name="calendar_id">
							<option value=""><?php echo _("--Not Calendar Controlled--")?></option>
							<?php foreach($calendars as $id => $calendar) { ?>
								<option value="<?php echo $id?>" <?php echo ($calendar_id == $id) ? "selected" : ""?>><?php echo $calendar['name']?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar_id-help" class="help-block fpbx-help-block"><?php echo _("If set the followme will only be active when the calendar has an event.")?></span>
		</div>
	</div>
</div>
<!--End Calendar-->
<!--Calendar-->
<div class="element-container calendar <?php echo FreePBX::Modules()->checkStatus('calendar') && $calendar_enable ?'':'hidden'?>">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar_group_id"><?php echo _("Calendar Group") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar_group_id"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="calendar_group_id" name="calendar_group_id">
							<option value=""><?php echo _("--Not Calendar Group Controlled--")?></option>
							<?php foreach($groups as $id => $group) { ?>
								<option value="<?php echo $id?>" <?php echo ($calendar_group_id == $id) ? "selected" : ""?>><?php echo $group['name']?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar_group_id-help" class="help-block fpbx-help-block"><?php echo _("If set the followme will only be active when the calendar group has an event.")?></span>
		</div>
	</div>
</div>
<!--End Calendar-->
<!--Calendar Match on Event-->
<div class="element-container calendar <?php echo FreePBX::Modules()->checkStatus('calendar') && $calendar_enable ?'':'hidden'?>">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar_match"><?php echo _("Calendar Match Inverse") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar_match"></i>
					</div>
					<div class="col-md-9 radioset">
            <input type="radio" name="calendar_match" id="calendar_matchyes" value="yes" <?php echo ($calendar_match == "yes"?"CHECKED":"") ?>>
            <label for="calendar_matchyes"><?php echo _("Yes");?></label>
            <input type="radio" name="calendar_match" id="calendar_matchno" value="no"<?php echo ($calendar_match == "yes"?"":"CHECKED") ?>>
            <label for="calendar_matchno"><?php echo _("No");?></label>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar_match-help" class="help-block fpbx-help-block"><?php echo _("When set to yes follow me will match (be enabled) whenever there is an event. When set to no followme will match (be enabled) whenever no event is present")?></span>
		</div>
	</div>
</div>
<!--END Calendar Match on Event-->
<!--Initial Ring Time-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="pre_ring"><?php echo _("Initial Ring Time") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="pre_ring"></i>
					</div>
					<div class="col-md-9">
						<input type="number" min="0" max="60" class="form-control" id="pre_ring" name="pre_ring" value="<?php echo (isset($pre_ring) ? $pre_ring : 0) ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="pre_ring-help" class="help-block fpbx-help-block"><?php echo _("This is the number of seconds to ring the primary extension prior to proceeding to the follow-me list. The extension can also be included in the follow-me list. A 0 setting will bypass this.")?></span>
		</div>
	</div>
</div>
<!--END Initial Ring Time-->
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
						<select class="form-control" id="strategy" name="strategy">
							<?php echo $rsrows ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="strategy-help" class="help-block fpbx-help-block"><?php echo $rshelp ?></span>
		</div>
	</div>
</div>
<!--END Ring Strategy-->
<!--Follow-Me Ring Time (max 60 sec)-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="grptime"><?php echo _("Follow-Me")." ". _("Ring Time (max 60 sec)") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="grptime"></i>
					</div>
					<div class="col-md-9">
						<input type="number" min="0" max="60" class="form-control" id="grptime" name="grptime" value="<?php  echo $grptime?$grptime:20 ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="grptime-help" class="help-block fpbx-help-block"><?php echo _("Time in seconds that the phones will ring. For all hunt style ring strategies, this is the time for each iteration of phone(s) that are rung")." "._("This is in addition to the Initial Ring Time")?></span>
		</div>
	</div>
</div>
<!--END Follow-Me Ring Time (max 60 sec)-->
<!--Follow-Me List-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="grplist"><?php echo _("Follow-Me List") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="grplist"></i>
					</div>
					<div class="col-md-9">
						<div class="input-group">
							<textarea id="grplist" class="form-control autosize" rows="<?php echo $glrows?>" name="grplist"><?php echo implode(PHP_EOL,$grplist);?></textarea>
							<span class="input-group-addon">
								<select id="qsagents1" class="form-control" data-for="grplist" style="width:170px;">
									<option SELECTED value=""><?php echo("Quick Select")?></option>
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
			<span id="grplist-help" class="help-block fpbx-help-block"><?php echo _("List extensions to ring, one per line, or use the Extension Quick Pick below.<br><br>You can include an extension on a remote system, or an external number by suffixing a number with a pound (#).  ex:  2448089# would dial 2448089 on the appropriate trunk (see Outbound Routing).<br><br>Note: Any local extension added will skip that local extension's FindMe/FollowMe, if you wish the system to use another extension's FindMe/FollowMe append a # onto that extension, eg 105#")?></span>
		</div>
	</div>
</div>
<!--END Follow-Me List-->
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
						<label class="control-label" for="dring"><?php echo _("Alert Info") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="dring"></i>
					</div>
					<div class="col-md-9">
						<?php echo FreePBX::View()->alertInfoDrawSelect("dring",(($dring)?$dring:''));?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="dring-help" class="help-block fpbx-help-block"><?php echo _("ALERT_INFO can be used for distinctive ring with SIP devices.")?></span>
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
						<input type="radio" name="needsconf" id="needsconfno" value='' <?php echo ($needsconf == "CHECKED"?"":"CHECKED") ?>>
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
<?php
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
?>
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
						<?php echo drawselects($goto,0);?>
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
</form>
