<?php
extract($request, EXTR_SKIP);
$member = array();
//Name is a text box on add or text on edit.
if(isset($extdisplay) && $extdisplay != ''){
	$accountInput = '<input type="hidden" name="account" value="'.$extdisplay.'">';
	$accountInput .= '<h3>'.$extdisplay.'</h3>';
	$thisQ = queues_get($extdisplay);
	//create variables
	extract($thisQ);
}else{
	$accountInput = '<input type="text" name="account" id="account" class="form-control" value="" required>';
}
//Added for RVOL mode
if ($rvol_mode == "") {
        $rvol_mode = "dontcare";
}

$options = array(_("Force") => "force", _("Yes") => "yes", _("Don't Care") => "dontcare", _("No") => "no", _("Never") => "never");
foreach ($options as $disp => $rname) {
        if ($rvol_mode == $rname) {
                $checked = "checked";
        } else {
                $checked = "";
        }
        $rvolmode_opts .= "<input type='radio' id='rvolmode_${rname}' name='rvol_mode' value='$rname' $checked><label for='rvolmode_${rname}'>$disp</label>";
}

//Rvol mode ENDS here
$cronVars = array(
	'cron_schedule' => isset($cron_schedule)?$cron_schedule:'never',
	'cron_minute' => isset($cron_minute)?$cron_minute:'',
	'cron_hour' => isset($cron_hour)?$cron_hour:'',
	'cron_dow' => isset($cron_dow)?$cron_dow:'',
	'cron_month' => isset($cron_month)?$cron_month:'',
	'cron_dom' => isset($cron_dom)?$cron_dom:'',
	'cron_random' => isset($cron_random)?$cron_random:false,
	);
$engineinfo = engine_getinfo();
$astver =  $engineinfo['version'];
$ast_ge_11 = version_compare($astver, '11', 'ge');
$ast_ge_120 = version_compare($astver, '12', 'ge');
$ast_ge_130 = version_compare($astver, '13', 'ge');
$mem_array = array();
foreach ($member as $mem) {
	if (preg_match("/^(Local|Agent|SIP|DAHDI|ZAP|IAX2|PJSIP)\/([\d]+).*,([\d]+)$/",$mem,$matches)) {
		switch ($matches[1]) {
			case 'Agent':
				$exten_prefix = 'A';
			break;
			case 'PJSIP':
				$exten_prefix = 'P';
			break;
			case 'SIP':
				$exten_prefix = 'S';
			break;
			case 'IAX2':
				$exten_prefix = 'X';
			break;
			case 'ZAP':
				$exten_prefix = 'Z';
			break;
			case 'DAHDI':
				$exten_prefix = 'D';
			break;
			case 'Local':
				$exten_prefix = '';
			break;
		}
		$mem_array[] = $exten_prefix.$matches[2].','.$matches[3];
	}
}
if ($amp_conf['GENERATE_LEGACY_QUEUE_CODES']){
	$glqchtml = '
	<!--Queue Password-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="password">'._("Queue Password").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="password"></i>
						</div>
						<div class="col-md-9">
							<input type="password" name="password" id="password" class="form-control" value="'.(isset($password) ? $password : '').'">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="password-help" class="help-block fpbx-help-block">'._("You can require agents to enter a password before they can log in to this queue.<br><br>This setting is optional.").'</span>
			</div>
		</div>
	</div>
	<!--END Queue Password-->
	';
}
//Queue No Answer
$qnoahtml = '';
	$qnoahtml = '
	<!--Queue No Answer-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="qnoanswerw">'._("Queue No Answer").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="qnoanswerw"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" name="qnoanswer" id="qnoansweryes" value="1" '. (isset($qnoanswer) && $qnoanswer == '1' ? 'checked' : '') .' >
							<label for="qnoansweryes">'. _("Yes") .'</label>
							<input type="radio" name="qnoanswer" id="qnoanswerno" value="0" '. (isset($qnoanswer) && $qnoanswer == '1' ? '' : 'checked') .' >
							<label for="qnoanswerno">'. _("No").'</label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="qnoanswerw-help" class="help-block fpbx-help-block">'._("If checked, the queue will not answer the call. Under most circumstance you should always have the queue answering calls. If not, then it's possible that recordings and MoH will not be heard by the waiting callers since early media capabilities vary and are inconsistent. Some cases where it may be desired to not answer a call is when using Strict Join Empty queue policies where the caller will not be admitted to the queue unless there is a queue member immediately available to take the call.").'</span>
			</div>
		</div>
	</div>
	<!--END Queue No Answer-->
	';

//Fields that are dependent on recordings
//Call Confirm Announce
//Call Join Announce
//Agent Announce
if(function_exists('recordings_list')){
	$ccahtml = '
	<!--Call Confirm Announce-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="callconfirm_id">'._("Call Confirm Announce").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="callconfirm_id"></i>
						</div>
						<div class="col-md-9">
							<select class="form-control" id="callconfirm_id" name="callconfirm_id">
							';
	$tresults = recordings_list();
    $default = (isset($callconfirm_id) ? $callconfirm_id : '');
    $ccahtml .= '<option value="None">'._("Default");
    if (isset($tresults[0])) {
		foreach ($tresults as $tresult) {
		    $ccahtml .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
		}
	}
	$ccahtml .= '
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="callconfirm_id-help" class="help-block fpbx-help-block">'. _("Announcement played to the Queue Memeber announcing the Queue call and requesting confirmation prior to answering. If set to default, the standard call confirmation default message will be played unless the member is reached through a Follow-Me and there is an alternate message provided in the Follow-Me. This message will override any other message specified..<br><br>To add additional recordings please use the \"System Recordings\" MENU.").'</span>
			</div>
		</div>
	</div>
	<!--END Call Confirm Announce-->
	';
	$jahtml = '
	<!--Join Announcement-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="joinannounce_id">'._("Join Announcement").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="joinannounce_id"></i>
						</div>
						<div class="col-md-9">
							<select name="joinannounce_id" id="joinannounce_id" class="form-control">';
	$tresults = recordings_list();
	$default = (isset($joinannounce_id) ? $joinannounce_id : '');
	$jahtml .= '<option value="None">'._("None");
	if (isset($tresults[0])) {
		foreach ($tresults as $tresult) {
			$jahtml .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
		}
	}
	$jahtml .= '			</select>
							<span class="radioset input-group">
								<input type="radio" id="skip_joinannounce-no" name="skip_joinannounce" value="" '.($skip_joinannounce ==''?'checked':'').'><label for="skip_joinannounce-no">'. _('Always').'</label>
								<input type="radio" id="skip_joinannounce-free" name="skip_joinannounce" value="free" '.($skip_joinannounce =='free'?'checked':'').'><label for="skip_joinannounce-free">'. _('When No Free Agents').'</label>
								<input type="radio" id="skip_joinannounce-ready" name="skip_joinannounce" value="ready" '. ($skip_joinannounce =='ready'?'checked':'').'><label for="skip_joinannounce-ready">'. _('When No Ready Agents').'</label>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="joinannounce_id-help" class="help-block fpbx-help-block">'._("Announcement played to callers prior to joining the queue. This can be skipped if there are agents ready to answer a call (meaning they still may be wrapping up from a previous call) or when they are free to answer the call right now. To add additional recordings please use the \"System Recordings\" MENU.").'</span>
			</div>
		</div>
	</div>
	<!--END Join Announcement-->
	';
	$tresults = recordings_list(false);
	$aaopts = '';
	$default = (isset($agentannounce_id) ? $agentannounce_id : '');
	$aaopts .= '<option value="">'._("None").'</option>';
	if (isset($tresults[0])) {
		foreach ($tresults as $tresult) {
			$aaopts .= '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
		}
	}
	$aahtml ='
	<!--Agent Announcement-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="agentannounce_id">'._("Agent Announcement").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="agentannounce_id"></i>
						</div>
						<div class="col-md-9">
							<select name="agentannounce_id" id="agentannounce_id" class="form-control" >
							'.$aaopts.'
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="agentannounce_id-help" class="help-block fpbx-help-block">'. _("Announcement played to the Agent prior to bridging in the caller <br><br> Example: \"the Following call is from the Sales Queue\" or \"This call is from the Technical Support Queue\".<br><br>To add additional recordings please use the \"System Recordings\" MENU. Compound recordings composed of 2 or more sound files are not displayed as options since this feature can not accept such recordings.").'</span>
			</div>
		</div>
	</div>
	<!--END Agent Announcement-->
	';

}else{
	$ccahtml = '<input type="hidden" name="callconfirm_id" value="'.$default.'">';
};

//Used for the agent quick select boxes.
//$results = core_users_list();
$results = \FreePBX::Core()->listUsers();
$results = is_array($results)?$results:array();
$qsagentlist = '';
foreach($results as $result){
	$qsagentlist .= "<option value='".$result[0]."'>".$result[0]." (".$result[1].")</option>\n";
}
//Ring Strategy
$strategyhelphtml = '<b>' ._("ringall").'</b>: ' . _("ring all available agents until one answers (default)").'<br>';
$strategyhelphtml .= '<b>' . _("leastrecent").'</b>: ' . _("ring agent which was least recently called by this queue").'<br>';
$strategyhelphtml .= '<b>' . _("fewestcalls").'</b>: ' . _("ring the agent with fewest completed calls from this queue").'<br>';
$strategyhelphtml .= '<b>' . _("random").'</b>: ' . _("ring random agent").'<br>';
$strategyhelphtml .= '<b>' . _("rrmemory").'</b>: ' . _("round robin with memory, remember where we left off last ring pass").'<br>';
$strategyhelphtml .= '<b>' . _("rrordered").'</b>: ' . _("same as rrmemory, except the queue member order from config file is preserved").'<br>';
$strategyhelphtml .= '<b>' . _("linear").'</b>: ' . _("rings agents in the order specified, for dynamic agents in the order they logged in").'<br>';
$strategyhelphtml .= '<b>' . _("wrandom").'</b>: ' . _("random using the member's penalty as a weighting factor, see asterisk documentation for specifics").'<br>';
$strategyhelphtml .= '<b>' . _("Some ring strategies (linear, round robin) require Asterisk to be restarted for changes to take effect.").'</b><br>';
$default = (isset($strategy) ? $strategy : 'ringall');
$items = array('ringall','leastrecent','fewestcalls','random','rrmemory','rrordered', 'linear', 'wrandom');
$strategyopts = '';
foreach ($items as $item) {
	$strategyopts .= '<option value="'.$item.'" '.($default == $item ? 'SELECTED' : '').'>'._($item);
}
//MOH
if(function_exists('music_list')) {
	$mohhtml='
	<!--Music on Hold Class-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="music">'._("Music on Hold Class").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="music"></i>
						</div>
						<div class="col-md-9">

							<select name="music" id="music" class="form-control">';
	$tresults = music_list();
	array_unshift($tresults,'inherit');
	$default = (isset($music) ? $music : 'inherit');
	if (isset($tresults) && is_array($tresults)) {
		foreach ($tresults as $tresult) {
			$searchvalue="$tresult";
			$ttext = $tresult;
			if($tresult == 'inherit') $ttext = _("inherit");
			if($tresult == 'none') $ttext = _("none");
			if($tresult == 'default') $ttext = _("default");
			$mohhtml .= '<option value="'.$tresult.'" '.($searchvalue == $default ? 'SELECTED' : '').'>'.$ttext;
		}
	}
	$mohhtml .='			</select>
							<span class="radioset input-group">
								<input type="radio" id="rtone-no" name="rtone" value="0" '. ($rtone=='0'?'checked':'').'><label for="rtone-no">'._('MoH Only').'</label>
								<input type="radio" id="rtone-agent" name="rtone" value="2" '.($rtone=='2'?'checked':'').'><label for="rtone-agent">'. _('Agent Ringing').'</label>
								<input type="radio" id="rtone-yes" name="rtone" value="1" '. ($rtone=='1'?'checked':'').'><label for="rtone-yes">'. _('Ring Only').'</label>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="music-help" class="help-block fpbx-help-block">'._("Music (MoH) played to the caller while they wait in line for an available agent. Choose \"inherit\" if you want the MoH class to be what is currently selected, such as by the inbound route. MoH Only will play music until the agent answers. Agent Ringing will play MoH until an agent's phone is presented with the call and is ringing. If they don't answer, MoH will return.  Ring Only makes callers hear a ringing tone instead of MoH ignoring any MoH Class selected as well as any configured periodic announcements. This music is defined in the \"Music on Hold\" Menu.").'</span>
			</div>
		</div>
	</div>
	<!--END Music on Hold Class-->
	';
}
//Recordings
if (!isset($thisQ['recording'])) {
	$recording = "dontcare";
} else {
	$recording = $thisQ['recording'];
	// Update to recordings 12.1. Remove later.
	if ($recording == "always") {
		$recording = "yes";
	}
}
//Max Wait
$default = (isset($maxwait) ? $maxwait : 0);
$maxwopts = '';
for ($i=0; $i < 30; $i++) {
	if ($i == 0)
		$maxwopts .= '<option value="">'._("Unlimited").'</option>';
	else
		$maxwopts .= '<option value="'.$i.'"'.($i == $maxwait ? ' SELECTED' : '').'>'.$i.' '._("seconds").'</option>';
}
for ($i=30; $i < 60; $i+=5) {
	$maxwopts .= '<option value="'.$i.'"'.($i == $maxwait ? ' SELECTED' : '').'>'.$i.' '._("seconds").'</option>';
}
for ($i=60; $i < 300; $i+=20) {
	$maxwopts .= '<option value="'.$i.'"'.($i == $maxwait ? ' SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
for ($i=300; $i < 1200; $i+=60) {
	$maxwopts .= '<option value="'.$i.'"'.($i == $maxwait ? ' SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
for ($i=1200; $i <= 7200; $i+=300) {
	$maxwopts .= '<option value="'.$i.'"'.($i == $maxwait ? ' SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
//Time Out
$default = (isset($timeout) ? $timeout : 15);
$toopts = '<option value="0" '.(0 == $default ? 'SELECTED' : '').'>'._("Unlimited").'</option>';
for ($i=1; $i <= 120; $i++) {
	$toopts .= '<option value="'.$i.'" '.($i == $default ? ' SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
//Retry Time
$default = (isset($retry) ? $retry : 5);
$retryopts = '<option value="none" '.(($default == "none") ? 'SELECTED' : '').'>'._("No Retry").'</option>';
for ($i=0; $i <= 60; $i++) {
	$retryopts .= '<option value="'.$i.'" '.(("$i" == "$default") ? 'SELECTED' : '').'>'.$i.' '._("seconds").'</option>';
}
//Wrapup Time
$default = (isset($wrapuptime) ? $wrapuptime : 0);
$wutopts = '';
for ($i=0; $i < 60; $i++) {
	$wutopts .= '<option value="'.$i.'" '.($i == $default ? 'SELECTED' : '').'>'.$i.' '._("seconds").'</option>';
}
for ($i=60; $i <= 3600; $i+=30) {
	$wutopts .= '<option value="'.$i.'" '.($i == $default ? ' SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
//Member Delay
$mdopts = '';
$default = (isset($memberdelay) ? $memberdelay : 0);
for ($i=0; $i <= 60; $i++) {
	$mdopts .= '<option value="'.$i.'" '.($i == $default ? 'SELECTED' : '').'>'.$i.' '._("seconds").'</option>';
}
//Join Empty
$jehelphtml = _("Determines if new callers will be admitted to the Queue, if not, the failover destination will be immediately pursued. The options include:");
$jehelphtml .= '<ul>';
$jehelphtml .= '<li><b>'._("Yes").'</b> '._("Always allows the caller to join the Queue.").'</li>';
$jehelphtml .= '<li><b>'._("Strict").'</b> '._("Same as Yes but more strict.  Simply speaking, if no agent could answer the phone then don't admit them. If agents are inuse or ringing someone else, caller will still be admitted.").'</li>';
$jehelphtml .= '<li><b>'._("Ultra Strict").'</b> '._("Same as Strict plus a queue member must be able to answer the phone 'now' to let them in. Simply speaking, any 'available' agents that could answer but are currently on the phone or ringing on behalf of another caller will be considered unavailable.").'</li>';
$jehelphtml .= '<li><b>'._("No").'</b> '._("Callers will not be admitted if all agents are paused, show an invalid state for their device, or have penalty values less than QUEUE_MAX_PENALTY (not currently set in FreePBX dialplan).").'</li>';
$jehelphtml .= '<li><b>'._("Loose").'</b> '._("Same as No except Callers will be admitted if there are paused agents who could become available.").'</li>';
$jehelphtml .= '</ul>';
//Leave Empty
$lwehelphtml = _("Determines if callers should be exited prematurely from the queue in situations where it appears no one is currently available to take the call. The options include:");
$lwehelphtml .= '<ul>';
$lwehelphtml .= '<li><b>'._("Yes").'</b> '._("Callers will exit if all agents are paused, show an invalid state for their device or have penalty values less than QUEUE_MAX_PENALTY (not currently set in FreePBX dialplan).").'</li>';
$lwehelphtml .= '<li><b>'._("Strict").'</b> '._("Same as Yes but more strict.  Simply speaking, if no agent could answer the phone then have them leave the queue. If agents are inuse or ringing someone else, caller will still be held.").'</li>';
$lwehelphtml .= '<li><b>'._("Ultra Strict").'</b> '._("Same as Strict plus a queue member must be able to answer the phone 'now' to let them remain. Simply speaking, any 'available' agents that could answer but are currently on the phone or ringing on behalf of another caller will be considered unavailable.").'</li>';
$lwehelphtml .= '<li><b>'._("Loose").'</b> '._("Same as Yes except Callers will remain in the Queue if there are paused agents who could become available.").'</li>';
$lwehelphtml .= '<li><b>'._("No").'</b> '._("Never have a caller leave the Queue until the Max Wait Time has expired.").'</li>';
$lwehelphtml .= '</ul>';
//Penalty Member Limits
$default = (isset($penaltymemberslimit) ? $penaltymemberslimit : 0);
$pmlopts = '<option value="0" '.(!$default ? 'SELECTED' : '').'>'._("Honor Penalties").'</option>';
for ($i=1; $i <= 20; $i++) {
	$pmlopts .= '<option value="'.$i.'" '.($i == $default ? 'SELECTED' : '').'>'.$i.'</option>';
}
//Queue Announce Frequency
$default = (isset($thisQ['announce-frequency']) ? $thisQ['announce-frequency'] : 0);
$qafreqopts = '';
for ($i=0; $i <= 1200; $i+=15) {
	$qafreqopts .= '<option value="'.$i.'" '.($i == $default ? 'SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
//Queue Minimum Announce Frequency
$default = (isset($thisQ['min-announce-frequency']) ? $thisQ['min-announce-frequency'] : 15);
$qminfreqopts = '';
for ($i=0; $i <= 1200; $i+=15) {
	$qminfreqopts .= '<option value="'.$i.'" '.($i == $default ? 'SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
//VQPlus
if(function_exists('vqplus_callback_get') && function_exists('ivr_get_details')) {
	if (isset($callback) && $callback != 'none') {
		$breakouttype = 'callback';
	} else {
		$breakouttype = 'announcemenu';
	}
	$breakouthtml ='
	<!--Break Out Type-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="breakouttype">'._("Break Out Type") .'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="breakouttype"></i>
						</div>
						<div class="col-md-9">
							<select name="breakouttype" id="breakouttype" class="form-control"  onChange="breakoutDisable()">
								<option value="announcemenu" '. ($breakouttype == 'announcemenu' ? 'SELECTED' : '') .'>'._("IVR Break Out Menu").'</option>
								<option value="callback" '. ($breakouttype == 'callback' ? 'SELECTED' : '') .'>'. _("Queue Callback").'</option>
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="breakouttype-help" class="help-block fpbx-help-block">'. _("Whether this queue uses an IVR Break Out Menu or a Queue Callback.  Queue Callbacks can also be achieved through an IVR, but requires extra configuration.").'</span>
			</div>
		</div>
	</div>
	<!--END Break Out Type-->
	';

}else if(function_exists('ivr_get_details')) {
	$breakouttype = 'announcemenu';
	$breakouthtml = "<input type=\"hidden\" name=\"breakouttype\" value=\"announcemenu\">";
}else if(function_exists('vqplus_callback_get')) {
	$breakouttype = 'callback';
	$breakouthtml = "<input type=\"hidden\" name=\"breakouttype\" value=\"callback\">";
}
//IVR Breakout
if(function_exists('ivr_get_details')) {
	$default = (isset($announcemenu) ? $announcemenu : "none");
	$unique_aas = ivr_get_details();
	$compound_recordings = false;
	$is_error = false;
	$ivrboopts = '';
	if (isset($unique_aas) && is_array($unique_aas)) {
		foreach ($unique_aas as $unique_aa) {
			$menu_id = $unique_aa['id'];
			$menu_name = $unique_aa['name'] ? $unique_aa['name'] : 'IVR ' . $unique_aa['id'];
			$unique_aa['announcement'] = recordings_get_file($unique_aa['announcement']);
			if (strpos($unique_aa['announcement'],"&") === false) {
				$ivrboopts .= '<option value="'.$menu_id.'" '.($default == $menu_id ? 'SELECTED' : '').'>'.($menu_name ? $menu_name : _("Menu ID ").$menu_id)."</option>\n";
			}else {
				$compound_recordings = true;
				if ($menu_id == $default) {
					$ivrboopts .= '<option style="color:red" value="'.$menu_id.'" '.($default == $menu_id ? 'SELECTED' : '').'>'.($menu_name ? $menu_name : _("Menu ID ").$menu_id)." (**)</option>\n";
					$is_error = true;
				}
			}
		}
	}
	$ivrbreakouterror = '';
	if ($is_error) {
		$ivrbreakouterror .='
		<div class="alert alert-danger">
			'._("<b>ERROR</b>: You have selected an IVR that uses Announcements created from compound sound files. The Queue is not able to play these announcements. This IVRs recording will be truncated to use only the first sound file. You can correct the problem by selecting a different announcement for this IVR that is not from a compound sound file. The IVR itself can play such files, but the Queue subsystem can not").'<br />'._("Earlier versions of this module allowed such queues to be chosen, once changing this setting, it will no longer appear as an option").'
		</div>
		';
	}
	$ivrbreakouthtml = '
	<!--IVR Break Out Menu-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="announcemenu">'. _("IVR Break Out Menu").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="announcemenu"></i>
						</div>
						<div class="col-md-9">
							<select name="announcemenu" id="announcemenu" class="form-control" '.($breakouttype == 'announcemenu' ? '' : 'disabled').'>
								<option value="none" '.($default == "none" ? 'SELECTED' : '').'>'._("None").'</option>
								'.$ivrboopts.'
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="announcemenu-help" class="help-block fpbx-help-block">'. _("You can optionally present an existing IVR as a 'break out' menu.<br><br>This IVR must only contain single-digit 'dialed options'. The Recording set for the IVR will be played at intervals specified in 'Repeat Frequency', below.").'</span>
			</div>
		</div>
		'.$ivrbreakouterror.'
	</div>
	<!--END IVR Break Out Menu-->
	';
}else{
	$ivrbreakouthtml .= '<input type="hidden" name="announcemenu" value="none">';
}
//VQPLUS Callback
if(function_exists('vqplus_callback_get')) {
	$cbs = vqplus_callback_get();
	$cbs = is_array($cbs)?$cbs:array();
	$vqcbopts = '';
	foreach ($cbs as $cb) {
		$vqcbopts .= '<option value="'.$cb['id'].'" '.($callback == $cb['id'] ? 'SELECTED' : '').'>'.$cb['name']."</option>";
	}
	$vqcbhtml ='
	<!--Queue Callback-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="callback">'. _("Queue Callback").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="callback"></i>
						</div>
						<div class="col-md-9">
							<select name="callback" id="callback" class=form-control '. ($breakouttype == 'callback' ? '' : 'disabled').'>
							<option value="none" '.($callback == "" ? 'SELECTED' : '').'>'. _("None").'</option>
							'.$vqcbopts.'
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="callback-help" class="help-block fpbx-help-block">'. _("Callback to use when caller presses 1.").'</span>
			</div>
		</div>
	</div>
	<!--END Queue Callback-->
	';
}else{
	$vqcbhtml = '<input type="hidden" name="callback" value="none">';
}
//Repeat Frequency
if(function_exists('vqplus_callback_get') || function_exists('ivr_get_details')) {
	$default = (isset($thisQ['periodic-announce-frequency']) ? $thisQ['periodic-announce-frequency'] : 0);
	$pafreqopts = '';
	for ($i=0; $i <= 1200; $i+=15) {
		$pafreqopts .= '<option value="'.$i.'" '.($i == $default ? 'SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
	}
	$repeatfreqhtml ='
	<!--Repeat Frequency-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="pannouncefreq">'._("Repeat Frequency").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="pannouncefreq"></i>
						</div>
						<div class="col-md-9">
							<select name="pannouncefreq" id="pannouncefreq" class="form-control">
								'.$pafreqopts.'
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="pannouncefreq-help" class="help-block fpbx-help-block">'. _("How often to announce a voice menu to the caller (0 to Disable Announcements).").'</span>
			</div>
		</div>
	</div>
	<!--END Repeat Frequency-->
	';
}
if(!$ast_ge_120){
	$amp_conf['QUEUES_EVENTS_WHEN_CALLED_DEFAULT'] = $amp_conf['QUEUES_EVENTS_WHEN_CALLED_DEFAULT']?'yes':'no';
	$default = (isset($eventwhencalled) ? $eventwhencalled : $amp_conf['QUEUES_EVENTS_WHEN_CALLED_DEFAULT']);
	$agenteventshtml = '
	<!--Event When Called-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="eventwhencalledw">'. _("Event When Called").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="eventwhencalledw"></i>
						</div>
						<div class="col-md-9 radioset input-group">
							&nbsp;&nbsp;&nbsp;
							<input type="radio" name="eventwhencalled" id="eventwhencalledyes" value="yes" '. ($default == "yes" ? 'checked' : '') .' >
							<label for="eventwhencalledyes">'. _("Yes") .'</label>
							<input type="radio" name="eventwhencalled" id="eventwhencalledno" value="no" '. ($default == "no" ? 'checked' : '') .' >
							<label for="eventwhencalledno">'. _("No").'</label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="eventwhencalledw-help" class="help-block fpbx-help-block">'. _("When this option is set to YES, the following manager events will be generated: AgentCalled, AgentDump, AgentConnect and AgentComplete.").'</span>
			</div>
		</div>
	</div>
	<!--END Event When Called-->
	';
	$amp_conf['QUEUES_EVENTS_MEMEBER_STATUS_DEFAULT'] = $amp_conf['QUEUES_EVENTS_MEMEBER_STATUS_DEFAULT']?'yes':'no';
	$default = (isset($eventmemberstatus) ? $eventmemberstatus : $amp_conf['QUEUES_EVENTS_MEMEBER_STATUS_DEFAULT']);
	$membereventhtml = '
	<!--Event When Called-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="eventmemberstatusw">'. _("Member Status Event").'</label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="eventmemberstatusw"></i>
						</div>
						<div class="col-md-9 radioset input-group">
							&nbsp;&nbsp;&nbsp;
							<input type="radio" name="eventmemberstatus" id="eventmemberstatusyes" value="yes" '. ($default == "yes" ? 'checked' : '') .' >
							<label for="eventmemberstatusyes">'. _("Yes") .'</label>
							<input type="radio" name="eventmemberstatus" id="eventmemberstatusno" value="no" '. ($default == "no" ? 'checked' : '') .' >
							<label for="eventmemberstatusno">'. _("No").'</label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="eventmemberstatusw-help" class="help-block fpbx-help-block">'. _("When set to YES, the following manager event will be generated: QueueMemberStatus").'</span>
			</div>
		</div>
	</div>
	<!--END Event When Called-->
	';

}//End If Asterisk GE 12
$default = (isset($servicelevel) ? $servicelevel : 60);
$slopts = '';
for ($i=15; $i <= 300; $i+=15) {
	$slopts .= '<option value="'.$i.'" '.($i == $default ? ' SELECTED' : '').'>'.queues_timeString($i,true).'</option>';
}
//hooks
$hookdata = \FreePBX::Queues()->hookTabs();
?>
<form class="fpbx-submit" autocomplete="off" name="editQ" action="config.php?display=queues" method="post" onsubmit="return checkQ(editQ);" data-fpbx-delete="config.php?display=queues&amp;account=<?php echo urlencode($extdisplay) ?>&amp;action=delete">
<input type="hidden" name="display" value="queues">
<input type="hidden" name="extdisplay" value="<?php echo $extdisplay ?>">
<input type="hidden" name="action" value="<?php echo (($extdisplay != '') ? 'edit' : 'add') ?>">
<div class="nav-container">
	<div class="scroller scroller-left"><i class="glyphicon glyphicon-chevron-left"></i></div>
	<div class="scroller scroller-right"><i class="glyphicon glyphicon-chevron-right"></i></div>
	<div class="wrapper">
		<ul class="nav nav-tabs list" role="tablist">
			<li role="presentation" data-name="qgeneral" class="active">
				<a href="#qgeneral" aria-controls="qgeneral" role="tab" data-toggle="tab">
					<?php echo _("General Settings")?>
				</a>
			</li>
			<li role="presentation" data-name="qagentlist">
				<a href="#qagentlist" aria-controls="qagentlist" role="tab" data-toggle="tab">
					<?php echo _("Queue Agents")?>
				</a>
			</li>
			<li role="presentation" data-name="qagent" class="change-tab">
				<a href="#qagent" aria-controls="qagent" role="tab" data-toggle="tab">
					<?php echo _("Timing & Agent Options")?>
				</a>
			</li>
			<li role="presentation" data-name="qcallercap" class="change-tab">
				<a href="#qcallercap" aria-controls="qcallercap" role="tab" data-toggle="tab">
					<?php echo _("Capacity Options")?>
				</a>
			</li>
			<li role="presentation" data-name="qcallerannounce" class="change-tab">
				<a href="#qcallerannounce" aria-controls="qcallerannounce" role="tab" data-toggle="tab">
					<?php echo _("Caller Announcements")?>
				</a>
			</li>
			<li role="presentation" data-name="qadvanced" class="change-tab">
				<a href="#qadvanced" aria-controls="qadvanced" role="tab" data-toggle="tab">
					<?php echo _("Advanced Options")?>
				</a>
			</li>
			<li role="presentation" data-name="qresetstats" class="change-tab">
				<a href="#qresetstats" aria-controls="qresetstats" role="tab" data-toggle="tab">
					<?php echo _("Reset Queue Stats")?>
				</a>
			</li>
			<?php echo $hookdata['hookTabs']?>
			<li role="presentation" data-name="qother" class="change-tab <?php echo empty($hookdata['oldHooks'])?'hidden':''?>">
				<a href="#qother" aria-controls="qother" role="tab" data-toggle="tab">
					<?php echo _("Other Options")?>
				</a>
			</li>
		</ul>
	</div>
</div>
<div class="tab-content display">
	<div role="tabpanel" id="qgeneral" class="tab-pane active">
		<!--Queue Number-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="account"><?php echo _("Queue Number") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="account"></i>
							</div>
							<div class="col-md-9">
								<?php echo $accountInput?>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="account-help" class="help-block fpbx-help-block"><?php echo _("Use this number to dial into the queue, or transfer callers to this number to put them into the queue")?></span>
				</div>
			</div>
		</div>
		<!--END Queue Number-->
		<!--Queue Name-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="name"><?php echo _("Queue Name") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
							</div>
							<div class="col-md-9">
								<input type="text" name="name" id="name" class="form-control" value="<?php echo (isset($name) ? $name : ''); ?>" >
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="name-help" class="help-block fpbx-help-block"><?php echo _("Give this queue a brief name to help you identify it.")?></span>
				</div>
			</div>
		</div>
		<!--END Queue Name-->
		<?php echo $glqchtml ?>
		<?php echo $qnoahtml ?>
		<!--Call Confirm-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="callconfirmw"><?php echo _("Call Confirm") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="callconfirmw"></i>
							</div>
							<div class="col-md-9 radioset">
								<input type="radio" name="callconfirm" id="callconfirmyes" value="1" <?php echo (isset($callconfirm) && $callconfirm == '1' ?"CHECKED":"") ?>>
								<label for="callconfirmyes"><?php echo _("Yes");?></label>
								<input type="radio" name="callconfirm" id="callconfirmno" value="" <?php echo (isset($callconfirm) && $callconfirm == '1' ?"":"CHECKED") ?>>
								<label for="callconfirmno"><?php echo _("No");?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="callconfirmw-help" class="help-block fpbx-help-block"><?php echo _("If checked, any queue member that is actually an outside telephone number, or any extensions Follow-Me or call forwarding that are pursued and leave the PBX will be forced into Call Confirmation mode where the member must acknowledge the call before it is answered and delivered.")?></span>
				</div>
			</div>
		</div>
		<!--END Call Confirm-->
		<?php echo $ccahtml //if function_exists('recordings_list') ?>
		<!--CID Name Prefix-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="prefix"><?php echo _("CID Name Prefix") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="prefix"></i>
							</div>
							<div class="col-md-9">
								<input class="form-control" type="text" name="prefix" id="prefix" value="<?php echo (isset($prefix) ? $prefix : ''); ?>" >
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="prefix-help" class="help-block fpbx-help-block"><?php echo _("You can optionally prefix the CallerID name of callers to the queue. ie: If you prefix with \"Sales:\", a call from John Doe would display as \"Sales:John Doe\" on the extensions that ring.")?></span>
				</div>
			</div>
		</div>
		<!--END CID Name Prefix-->
		<!--Wait Time Prefix-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="queuewaitw"><?php echo _("Wait Time Prefix") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="queuewaitw"></i>
							</div>
							<div class="col-md-9 radioset">
								<?php $default = (isset($queuewait) ? $queuewait : "0");?>
								<input type="radio" name="queuewait" id="queuewaitYES" value="1" <?php echo ($default == "1" ? 'checked' : '') ?>>
								<label for="queuewaitYES"><?php echo _("Yes")?></label>
								<input type="radio" name="queuewait" id="queuewaitNO" value="0" <?php echo ($default == "0" ? 'checked' : '') ?>>
								<label for="queuewaitNO"><?php echo _("No")?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="queuewaitw-help" class="help-block fpbx-help-block"><?php echo _("When set to Yes, the CID Name will be prefixed with the total wait time in the queue so the answering agent is aware how long they have waited. It will be rounded to the nearest minute, in the form of Mnn: where nn is the number of minutes.").'<br />'._("If the call is subsequently transferred, the wait time will reflect the time since it first entered the queue or reset if the call is transferred to another queue with this feature set.")?></span>
				</div>
			</div>
		</div>
		<!--END Wait Time Prefix-->
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
								<?php echo FreePBX::View()->alertInfoDrawSelect("alertinfo",(isset($alertinfo)?$alertinfo:''));?>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="alertinfo-help" class="help-block fpbx-help-block"><?php echo _("Add an Alert-Info Header like Snom and other Phones need for Ring or Ringtone informations")?></span>
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
		<!-- Rvol mode-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="rvolumemode"><?php echo _("Ringer Volume Override Mode") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="rvol_mode"></i>
							</div>
							  <div class="col-md-9 radioset">
                                  <?php echo $rvolmode_opts ?>
                               </div>

						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="rvol_mode-help" class="help-block fpbx-help-block"><?php echo sprintf(_("While queue calls are distributed, any member has FM/FM(Find Me/Follow Me) enabled, Ringer Volume value will set based on the 'Ringer Volume Override Mode(RVOM)'."))?></span>
				</div>
			</div>
		</div>
		<!--End Rvol mode-->
		<!--Restrict Dynamic Agents-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="dynmemberonlyw"><?php echo _("Restrict Dynamic Agents") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="dynmemberonlyw"></i>
							</div>
							<div class="col-md-9 radioset">
								<input type="radio" id="dynmemberonly_yes" name="dynmemberonly" value="yes" <?php echo ($dynmemberonly=='yes'?'checked':'');?>>
								<label for="dynmemberonly_yes"><?php echo _('Yes')?></label>
								<input type="radio" name="dynmemberonly" id="dynmemberonly_no" value="no" <?php echo ($dynmemberonly!='yes'?'checked':'');?>>
								<label for="dynmemberonly_no"><?php echo _('No'); ?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="dynmemberonlyw-help" class="help-block fpbx-help-block"><?php echo _("Restrict dynamic queue member logins to only those listed in the Dynamic Members list above. When set to Yes, members not listed will be DENIED ACCESS to the queue.")?></span>
				</div>
			</div>
		</div>
		<!--END Restrict Dynamic Agents-->
		<!--Agent Restrictions-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="use_queue_context"><?php echo _("Agent Restrictions") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="use_queue_context"></i>
							</div>
							<div class="col-md-9 radioset">
								<?php
								$default = (isset($use_queue_context) ? $use_queue_context : '0');
								?>
								<input type="radio" name="use_queue_context" id="use_queue_context0" value="0" <?php echo ($default == "0"?"CHECKED":"") ?>>
								<label for="use_queue_context0"><?php echo _("Call as Dialed");?></label>
								<input type="radio" name="use_queue_context" id="use_queue_context1" value="1" <?php echo ($default == "1"?"CHECKED":"") ?>>
								<label for="use_queue_context1"><?php echo _("No Follow-Me or Call Forward");?></label>
								<input type="radio" name="use_queue_context" id="use_queue_context2" value="2" <?php echo ($default == "2"?"CHECKED":"") ?>>
								<label for="use_queue_context2"><?php echo _("Extensions Only");?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="use_queue_context-help" class="help-block fpbx-help-block"><?php echo _("When set to 'Call as Dialed' the queue will call an extension just as if the queue were another user. Any Follow-Me or Call Forward states active on the extension will result in the queue call following these call paths. This behavior has been the standard queue behavior on past FreePBX versions. <br />When set to 'No Follow-Me or Call Forward', all agents that are extensions on the system will be limited to ringing their extensions only. Follow-Me and Call Forward settings will be ignored. Any other agent will be called as dialed. This behavior is similar to how extensions are dialed in ringgroups. <br />When set to 'Extensions Only' the queue will dial Extensions as described for 'No Follow-Me or Call Forward'. Any other number entered for an agent that is NOT a valid extension will be ignored. No error checking is provided when entering a static agent or when logging on as a dynamic agent, the call will simply be blocked when the queue tries to call it. For dynamic agents, see the 'Agent Regex Filter' to provide some validation.")?></span>
				</div>
			</div>
		</div>
		<!--END Agent Restrictions-->
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
								<select name="strategy" id="strategy" class="form-control" >
									<?php echo $strategyopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="strategy-help" class="help-block fpbx-help-block"><?php echo $strategyhelphtml?></span>
				</div>
			</div>
		</div>
		<!--END Ring Strategy-->
		<!--Autofill-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="autofillw"><?php echo _("Autofill") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="autofillw"></i>
							</div>
							<div class="col-md-9 radioset">
								<input type="radio" name="autofill" id="autofillyes" value="1" <?php echo (isset($autofill) && $autofill == 'yes' ?"CHECKED":"") ?>>
								<label for="autofillyes"><?php echo _("Yes");?></label>
								<input type="radio" name="autofill" id="autofillno" value="" <?php echo (isset($autofill) && $autofill == 'yes' ?"":"CHECKED") ?>>
								<label for="autofillno"><?php echo _("No");?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="autofillw-help" class="help-block fpbx-help-block"><?php echo _("If this is Enabled, and multiple agents are available, Asterisk will send one call to each waiting agent (depending on the ring strategy). Otherwise, it will hold all calls while it tries to find an agent for the top call in the queue making other calls wait.")?></span>
				</div>
			</div>
		</div>
		<!--END Autofill-->
		<!--Skip Busy Agents-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="cwignore"><?php echo _("Skip Busy Agents") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="cwignore"></i>
							</div>
							<div class="col-md-9 radioset">
									<?php
									$default = (isset($cwignore) ? $cwignore : 'no');
									$items = array(
										'0' => _("No"),
										'1'=>_("Yes"),
										'2'=>_("Yes + (ringinuse=no)"),
										'3'=>_("Queue calls only (ringinuse=no)"),
										);
									foreach ($items as $item=>$val) {
										echo '<input type="radio" name="cwignore" id="cwignore'.$item.'" value="'.$item.'" '. ($default == $item?"CHECKED":"") .'>';
										echo '<label for="cwignore'.$item.'">'.$val.'</label>';
									}
									?>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="cwignore-help" class="help-block fpbx-help-block"><?php echo _("When set to 'Yes' agents who are on an occupied phone will be skipped as if the line were returning busy. This means that Call Waiting or multi-line phones will not be presented with the call and in the various hunt style ring strategies, the next agent will be attempted. <br />When set to 'Yes + (ringinuse=no)' the queue configuration flag 'ringinuse=no' is set for this queue in addition to the phone's device status being monitored. This results in the queue tracking remote agents (agents who are a remote PSTN phone, called through Follow-Me, and other means) as well as PBX connected agents, so the queue will not attempt to send another call if they are already on a call from any queue. <br />When set to 'Queue calls only (ringinuse=no)' the queue configuration flag 'ringinuse=no' is set for this queue also but the device status of locally connected agents is not monitored. The behavior is to limit an agent belonging to one or more queues to a single queue call. If they are occupied from other calls, such as outbound calls they initiated, the queue will consider them available and ring them since the device state is not monitored with this option. <br /><br />WARNING: When using the settings that set the 'ringinuse=no' flag, there is a NEGATIVE side effect. An agent who transfers a queue call will remain unavailable by any queue until that call is terminated as the call still appears as 'inuse' to the queue UNLESS 'Agent Restrictions' is set to 'Extensions Only'.")?></span>
				</div>
			</div>
		</div>
		<!--END Skip Busy Agents-->
		<!--Queue Weight-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="weight"><?php echo _("Queue Weight") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="weight"></i>
							</div>
							<div class="col-md-9">
								<?php $default = (isset($weight) ? $weight : 0);?>
								<input type="number" min="0" max="10" class="form-control" id="weight" name="weight" value="<?php echo $default ?>">
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="weight-help" class="help-block fpbx-help-block"><?php echo _("Gives queues a 'weight' option, to ensure calls waiting in a higher priority queue will deliver its calls first if there are agents common to both queues.")?></span>
				</div>
			</div>
		</div>
		<!--END Queue Weight-->
		<?php echo $mohhtml //if function_exists('music_list')?>
		<?php echo $jahtml //if function_exists('recordings_list')?>
		<!--Call Recording-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="recording"><?php echo _("Call Recording") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="recording"></i>
							</div>
							<div class="col-md-9 radioset input-group">
								&nbsp;&nbsp;&nbsp;<!--Align Span to other elements. Not sure why it shifts-->
								<input type="radio" id="record_force" name="recording" value="force" <?php echo ($recording =='force'?'checked':'');?>><label for="record_force"><?php echo _('Force'); ?></label>
								<input type="radio" id="record_yes" name="recording" value="yes" <?php echo ($recording =='yes'?'checked':'');?>><label for="record_yes"><?php echo _('Yes'); ?></label>
								<input type="radio" id="record_dontcare" name="recording" value="dontcare" <?php echo ($recording =='dontcare'?'checked':'');?>><label for="record_dontcare"><?php echo _("Don't Care")?></label>
								<input type="radio" id="record_no" name="recording" value="no" <?php echo ($recording =='no'?'checked':'');?>><label for="record_no"><?php echo _('No'); ?></label>
								<input type="radio" id="record_never" name="recording" value="never" <?php echo ($recording =='never'?'checked':'');?>><label for="record_never"><?php echo _('Never'); ?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="recording-help" class="help-block fpbx-help-block"><?php echo _("Incoming calls to agents can be recorded. If 'never' is selected, then in-call on demand recording is blocked.")?></span>
				</div>
			</div>
		</div>
		<!--END Call Recording-->
		<!--Mark calls answered elsewhere-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="answered_elsewherew"><?php echo _("Mark calls answered elsewhere") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="answered_elsewherew"></i>
							</div>
							<div class="col-md-9 radioset">
								<span class="radioset">
								<input type="radio" name="answered_elsewhere" id="answered_elsewhereyes" value="1" <?php echo (isset($answered_elsewhere) && $answered_elsewhere == 1 ?"CHECKED":"") ?>>
								<label for="answered_elsewhereyes"><?php echo _("Yes");?></label>
								<input type="radio" name="answered_elsewhere" id="answered_elsewhereno" value="0" <?php echo (isset($answered_elsewhere) && $answered_elsewhere == 1 ?"":"CHECKED") ?>>
								<label for="answered_elsewhereno"><?php echo _("No");?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="answered_elsewherew-help" class="help-block fpbx-help-block"><?php echo _("Enabling this option, all calls are marked as 'answered elsewhere' when cancelled. The effect is that missed queue calls are *not* shown on the phone (if the phone supports it)")?></span>
				</div>
			</div>
		</div>
		<!--END Mark calls answered elsewhere-->
		<!--Fail Over Destination-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="goto0"><?php echo _("Fail Over Destination") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
							</div>
							<div class="col-md-9">
								<?php echo drawselects($goto,0,false,true,'',true); ?>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Where calls should fail to")?></span>
				</div>
			</div>
		</div>
		<!--END Fail Over Destination-->
	</div>
	<!--End of General Tab -->
	<div role="tabpanel" id="qagentlist" class="tab-pane">
		<!--Static Agents-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="members"><?php echo _("Static Agents") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="members"></i>
							</div>
							<div class="col-md-9">
								<div class="input-group">
									<textarea id="members" class="form-control" cols="15" rows="<?php  $rows = count($mem_array)+1; echo (($rows < 5) ? 5 : (($rows > 20) ? 20 : $rows) ); ?>" name="members" ><?php echo implode("\n",$mem_array) ?></textarea>
									<span class="input-group-addon">
										<label for="qsagents1"><strong><?php echo("Agent Quick Select")?></strong></label>
										<select id="qsagents1" class="form-control" data-for="members">
											<option SELECTED>
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
					<span id="members-help" class="help-block fpbx-help-block"><?php echo _("Static agents are extensions that are assumed to always be on the queue.  Static agents do not need to 'log in' to the queue, and cannot 'log out' of the queue.<br><br>List extensions to ring, one per line.<br><br>You can include an extension on a remote system, or an external number (Outbound Routing must contain a valid route for external numbers). You can put a \",\" after the agent followed by a penalty value, see Asterisk documentation concerning penalties.<br /><br /> An advanced mode has been added which allows you to prefix an agent number with S, P, X, Z, D or A. This will force the agent number to be dialed as an Asterisk device of type SIP, PJSIP, IAX2, ZAP, DAHDi or Agent respectively. This mode is for advanced users and can cause known issues in FreePBX as you are by-passing the normal dialplan. If your 'Agent Restrictions' are not set to 'Extension Only' you will have problems with subsequent transfers to voicemail and other issues may also exist.")?></span>
				</div>
			</div>
		</div>
		<!--END Static Agents-->
		<!--Dynamic Agents-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="dynmembers"><?php echo _("Dynamic Agents") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="dynmembers"></i>
							</div>
							<div class="col-md-9">
								<div class="input-group">
									<textarea id="dynmembers" class="form-control" cols="15" rows="<?php  $rows = count(explode("\n",$dynmembers)) + 1; echo (($rows < 5) ? 5 : (($rows > 20) ? 20 : $rows) ); ?>" name="dynmembers" ><?php echo $dynmembers ?></textarea>
									<span class="input-group-addon">
										<label for="qsagents2"><strong><?php echo("Agent Quick Select")?></strong></label>
										<select id="qsagents2" class="form-control" data-for="dynmembers">
											<option SELECTED>
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
					<span id="dynmembers-help" class="help-block fpbx-help-block"><?php echo _("Dynamic Members are extensions or callback numbers that can log in and out of the queue. When a member logs in to a queue, their penalty in the queue will be as specified here. Extensions included here will NOT automatically be logged in to the queue.")?></span>
				</div>
			</div>
		</div>
		<!--END Dynamic Agents-->
	</div>
	<!--End of Agent List-->
	<div role="tabpanel" id="qagent" class="tab-pane">
		<!--Max Wait Time-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="maxwait"><?php echo _("Max Wait Time") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="maxwait"></i>
							</div>
							<div class="col-md-9">
								<select name="maxwait" id="maxwait" class="form-control" >
									<?php echo $maxwopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="maxwait-help" class="help-block fpbx-help-block"><?php echo _("The maximum number of seconds a caller can wait in a queue before being pulled out.  (0 for unlimited).")?></span>
				</div>
			</div>
		</div>
		<!--END Max Wait Time-->
		<!--Max Wait Time Mode-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="timeoutpriorityw"><?php echo _("Max Wait Time Mode") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="timeoutpriorityw"></i>
							</div>
							<div class="col-md-9 radioset input-group">
								&nbsp;&nbsp;&nbsp;
								<?php $default = (isset($timeoutpriority) ? $timeoutpriority : "app")?>
								<input type="radio" name="timeoutpriority" id="timeoutpriorityapp" value="app" <?php echo ($default == "app" ? 'CHECKED' : '') ?> >
								<label for="timeoutpriorityapp"><?php echo _("Strict") ?></label>
								<input type="radio" name="timeoutpriority" id="timeoutpriorityconf" value="conf" <?php echo ($default == "conf" ? 'CHECKED' : '') ?> >
								<label for="timeoutpriorityconf"><?php echo _("Loose") ?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="timeoutpriorityw-help" class="help-block fpbx-help-block"><?php echo _("Asterisk timeoutpriority. In 'Strict' mode, when the 'Max Wait Time' of a caller is hit, they will be pulled out of the queue immediately. In 'Loose' mode, if a queue member is currently ringing with this call, then we will wait until the queue stops ringing this queue member or otherwise the call is rejected by the queue member before taking the caller out of the queue. This means that the 'Max Wait Time' could be as long as 'Max Wait Time' + 'Agent Timeout' combined.")?></span>
				</div>
			</div>
		</div>
		<!--END Max Wait Time Mode-->
		<!--Agent Timeout-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="timeout"><?php echo _("Agent Timeout") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="timeout"></i>
							</div>
							<div class="col-md-9">
								<select name="timeout" id="timeout" class="form-control" >
									<?php echo $toopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="timeout-help" class="help-block fpbx-help-block"><?php echo _("The number of seconds an agent's phone can ring before we consider it a timeout. Unlimited or other timeout values may still be limited by system ringtime or individual extension defaults.")?></span>
				</div>
			</div>
		</div>
		<!--END Agent Timeout-->
		<!--Agent Timeout Restart-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="timeoutrestartw"><?php echo _("Agent Timeout Restart") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="timeoutrestartw"></i>
							</div>
							<div class="col-md-9 radioset input-group">
								&nbsp;&nbsp;&nbsp;
								<?php $default = (isset($timeoutrestart) ? $timeoutrestart : "no");?>
								<input type="radio" name="timeoutrestart" id="timeoutrestartyes" value="yes" <?php echo ($default == "yes" ? 'checked' : '')?> >
								<label for="timeoutrestartyes"><?php echo _("Yes") ?></label>
								<input type="radio" name="timeoutrestart" id="timeoutrestartno" value="no" <?php echo ($default == "no" ? 'checked' : '') ?> >
								<label for="timeoutrestartno"><?php echo _("No") ?></label>

							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="timeoutrestartw-help" class="help-block fpbx-help-block"><?php echo _("If timeoutrestart is set to yes, then the time out for an agent to answer is reset if a BUSY or CONGESTION is received. This can be useful if agents are able to cancel a call with reject or similar.")?></span>
				</div>
			</div>
		</div>
		<!--END Agent Timeout Restart-->
		<!--Retry-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="retry"><?php echo _("Retry") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="retry"></i>
							</div>
							<div class="col-md-9">
								<select name="retry" id="retry" class="form-control" >>
									<?php echo $retryopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="retry-help" class="help-block fpbx-help-block"><?php echo _("The number of seconds we wait before trying all the phones again. Choosing \"No Retry\" will exit the Queue and go to the fail-over destination as soon as the first attempted agent times-out, additional agents will not be attempted.")?></span>
				</div>
			</div>
		</div>
		<!--END Retry-->
		<!--Wrap-Up-Time-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="wrapuptime"><?php echo _("Wrap-Up-Time") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="wrapuptime"></i>
							</div>
							<div class="col-md-9">
								<select name="wrapuptime" id="wrapuptime" class="form-control" >
									<?php echo $wutopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="wrapuptime-help" class="help-block fpbx-help-block"><?php echo _("After a successful call, how many seconds to wait before sending a potentially free agent another call (default is 0, or no delay) If using Asterisk 1.6+, you can also set the 'Honor Wrapup Time Across Queues' setting (Asterisk: shared_lastcall) on the Advanced Settings page so that this is honored across queues for members logged on to multiple queues.")?></span>
				</div>
			</div>
		</div>
		<!--END Wrap-Up-Time-->
		<!--Member Delay-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="memberdelay"><?php echo _("Member Delay") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="memberdelay"></i>
							</div>
							<div class="col-md-9">
								<select name="memberdelay" id="memberdelay" class="form-control" >
									<?php echo $mdopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="memberdelay-help" class="help-block fpbx-help-block"><?php echo _("If you wish to have a delay before the member is connected to the caller (or before the member hears any announcement messages), set this to the number of seconds to delay.")?></span>
				</div>
			</div>
		</div>
		<!--END Member Delay-->
		<?php echo $aahtml //if function_exists('recordings_list')?>
		<!--Report Hold Time-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="reportholdtimew"><?php echo _("Report Hold Time") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="reportholdtimew"></i>
							</div>
							<div class="col-md-9 radioset input-group">
								&nbsp;&nbsp;&nbsp;
								<?php $default = (isset($reportholdtime) ? $reportholdtime : "no");?>
								<input type="radio" name="reportholdtime" id="reportholdtimeyes" value="yes" <?php echo ($default == "yes" ? 'checked' : '') ?> >
								<label for="reportholdtimeyes"><?php echo _("Yes") ?></label>
								<input type="radio" name="reportholdtime" id="reportholdtimeno" value="no" <?php echo ($default == "no" ? 'checked' : '') ?> >
								<label for="reportholdtimeno"><?php echo _("No") ?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="reportholdtimew-help" class="help-block fpbx-help-block"><?php echo _("If you wish to report the caller's hold time to the member before they are connected to the caller, set this to yes.")?></span>
				</div>
			</div>
		</div>
		<!--END Report Hold Time-->
		<!--Auto Pause-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="autopause"><?php echo _("Auto Pause") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="autopause"></i>
							</div>
							<div class="col-md-9 radioset">
									<?php
										$default = (isset($autopause) ? $autopause : 'no');
										$items = array('yes'=>_("Yes in this queue only"),'all'=>_('Yes in all queues'),'no'=>_("No"));
										foreach ($items as $item=>$val) {
											echo '<input type="radio" name="autopause" id="autopause'.$item.'" value="'.$item.'" '.($default == $item?"CHECKED":"") .'>';
											echo '<label for="autopause'.$item.'">'.$val.'</label>';
										}
									?>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="autopause-help" class="help-block fpbx-help-block"><?php echo _("Auto Pause an agent in this queue (or all queues they are a member of) if they don't answer a call. Specific behavior can be modified by the Auto Pause Delay as well as Auto Pause Busy/Unavailable settings if supported on this version of Asterisk.")?></span>
				</div>
			</div>
		</div>
		<!--END Auto Pause-->
		<!--Auto Pause on Busy-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="autopausebusyw"><?php echo _("Auto Pause on Busy") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="autopausebusyw"></i>
							</div>
							<div class="col-md-9 radioset input-group">
								&nbsp;&nbsp;&nbsp;
								<?php $default = (isset($autopausebusy) ? $autopausebusy : "no");?>
								<input type="radio" name="autopausebusy" id="autopausebusyyes" value="yes" <?php echo ($default == "yes" ? 'checked' : '') ?> >
								<label for="autopausebusyyes"><?php echo _("Yes") ?></label>
								<input type="radio" name="autopausebusy" id="autopausebusyno" value="no" <?php echo ($default == "no" ? 'checked' : '') ?> >
								<label for="autopausebusyno"><?php echo _("No") ?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="autopausebusyw-help" class="help-block fpbx-help-block"><?php echo _("When set to Yes agents devices that report busy upon a call attempt will be considered as a missed call and auto paused immediately or after the auto pause delay if configured")?></span>
				</div>
			</div>
		</div>
		<!--END Auto Pause on Busy-->
		<!--Auto Pause on Unavailable-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="autopauseunavailw"><?php echo _("Auto Pause on Unavailable") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="autopauseunavailw"></i>
							</div>
							<div class="col-md-9 radioset input-group">
								&nbsp;&nbsp;&nbsp;
								<?php $default = (isset($autopauseunavail) ? $autopauseunavail : "no");?>
								<input type="radio" name="autopauseunavail" id="autopauseunavailyes" value="yes" <?php echo ($default == "yes" ? 'checked' : '') ?> >
								<label for="autopauseunavailyes"><?php echo _("Yes") ?></label>
								<input type="radio" name="autopauseunavail" id="autopauseunavailno" value="no" <?php echo ($default == "no" ? 'checked' : '') ?> >
								<label for="autopauseunavailno"><?php echo _("No") ?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="autopauseunavailw-help" class="help-block fpbx-help-block"><?php echo _("When set to Yes agents devices that report congestion upon a call attempt will be considered as a missed call and auto paused immediately or after the auto pause delay if configured")?></span>
				</div>
			</div>
		</div>
		<!--END Auto Pause on Unavailable-->
		<!--Auto Pause Delay-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="autopausedelay"><?php echo _("Auto Pause Delay") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="autopausedelay"></i>
							</div>
							<div class="col-md-9">
								<input type="number" class="form-control" id="autopausedelay" name="autopausedelay" min="0" max="3600" value="<?php echo (isset($autopausedelay)?$autopausedelay:'0') ?>" >
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="autopausedelay-help" class="help-block fpbx-help-block"><?php echo _("This setting will delay the auto pause of an agent by auto pause delay seconds from when it last took a call. For example, if this were set to 120 seconds, and a new call is presented to the agent 90 seconds after they last took a call, they will not be auto paused if they don't answer the call. If presented with a call 120 seconds or later after answering the last call, they will then be auto paused. If they have taken no calls, this will have no affect.")?></span>
				</div>
			</div>
		</div>
		<!--END Auto Pause Delay-->
	</div>
	<!--End Timing and Agent-->
	<div role="tabpanel" id="qcallercap" class="tab-pane">
		<!--Max Callers-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="maxlen"><?php echo _("Max Callers") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="maxlen"></i>
							</div>
							<div class="col-md-9">
								<?php $default = (isset($maxlen) ? $maxlen : 0);?>
								<input type="number" min="0" max="5000" class="form-control" id="maxlen" name="maxlen" value="<?php echo $default ?>" >
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="maxlen-help" class="help-block fpbx-help-block"><?php echo _("Maximum number of people waiting in the queue (0 for unlimited)")?></span>
				</div>
			</div>
		</div>
		<!--END Max Callers-->
		<!--Join Empty-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="joinempty"><?php echo _("Join Empty") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="joinempty"></i>
							</div>
							<div class="col-md-9 radioset">
								<?php $default = (isset($joinempty) ? $joinempty : 'yes');?>
								<input type="radio" name="joinempty" id="joinemptyyes" value="yes" <?php echo ($default == "yes"?"CHECKED":"") ?>>
								<label for="joinemptyyes"><?php echo _("Yes");?></label>
								<input type="radio" name="joinempty" id="joinemptystrict" value="strict" <?php echo ($default == "strict"?"CHECKED":"") ?>>
								<label for="joinemptystrict"><?php echo _("Strict");?></label>
								<input type="radio" name="joinempty" id="joinemptyultra" value="penalty,paused,invalid,unavailable,inuse,ringing" <?php echo ($default == "penalty,paused,invalid,unavailable,inuse,ringing"?"CHECKED":"") ?>>
								<label for="joinemptyultra"><?php echo _("Ultra Strict");?></label>
								<input type="radio" name="joinempty" id="joinemptyno" value="no" <?php echo ($default == "no"?"CHECKED":"") ?>>
								<label for="joinemptyno"><?php echo _("No");?></label>
								<input type="radio" name="joinempty" id="joinemptyloose" value="loose" <?php echo ($default == "loose"?"CHECKED":"") ?>>
								<label for="joinemptyloose"><?php echo _("Loose");?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="joinempty-help" class="help-block fpbx-help-block"><?php echo $jehelphtml ?></span>
				</div>
			</div>
		</div>
		<!--END Join Empty-->
		<!--Leave Empty-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="leavewhenempty"><?php echo _("Leave Empty") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="leavewhenempty"></i>
							</div>
							<div class="col-md-9 radioset">
								<?php $default = (isset($leavewhenempty) ? $leavewhenempty : 'no');?>
								<input type="radio" name="leavewhenempty" id="leavewhenemptyyes" value="yes" <?php echo ($default == "yes"?"CHECKED":"") ?>>
								<label for="leavewhenemptyyes"><?php echo _("Yes");?></label>
								<input type="radio" name="leavewhenempty" id="leavewhenemptystrict" value="strict" <?php echo ($default == "strict"?"CHECKED":"") ?>>
								<label for="leavewhenemptystrict"><?php echo _("Strict");?></label>
								<input type="radio" name="leavewhenempty" id="leavewhenemptyultra" value="penalty,paused,invalid,unavailable,inuse,ringing" <?php echo ($default == "penalty,paused,invalid,unavailable,inuse,ringing"?"CHECKED":"") ?>>
								<label for="leavewhenemptyultra"><?php echo _("Ultra Strict");?></label>
								<input type="radio" name="leavewhenempty" id="leavewhenemptyno" value="no" <?php echo ($default == "no"?"CHECKED":"") ?>>
								<label for="leavewhenemptyno"><?php echo _("No");?></label>
								<input type="radio" name="leavewhenempty" id="leavewhenemptyloose" value="loose" <?php echo ($default == "loose"?"CHECKED":"") ?>>
								<label for="leavewhenemptyloose"><?php echo _("Loose");?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="leavewhenempty-help" class="help-block fpbx-help-block"><?php echo $lwehelphtml ?></span>
				</div>
			</div>
		</div>
		<!--END Leave Empty-->
		<!--Penalty Members Limit-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="penaltymemberslimit"><?php echo _("Penalty Members Limit") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="penaltymemberslimit"></i>
							</div>
							<div class="col-md-9">
								<select class="form-control" id="penaltymemberslimit" name="penaltymemberslimit">
									<?php echo $pmlopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="penaltymemberslimit-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: penaltymemberslimit. A limit can be set to disregard penalty settings, allowing all members to be tried, when the queue has too few members.  No penalty will be weighed in if there are only X or fewer queue members.")?></span>
				</div>
			</div>
		</div>
		<!--END Penalty Members Limit-->
	</div>
	<!--END Capacity options-->
	<div role="tabpanel" id="qcallerannounce" class="tab-pane">
		<div class="section-title" data-for="qannouncepos">
			<h3><i class="fa fa-minus"></i> <?php echo _("Caller Position")?></h3>
		</div>
		<div class="section" data-id="qannouncepos">
   			<!--Frequency-->
   			<div class="element-container">
   				<div class="row">
   					<div class="col-md-12">
   						<div class="row">
   							<div class="form-group">
   								<div class="col-md-3">
   									<label class="control-label" for="announcefreq"><?php echo _("Frequency") ?></label>
   									<i class="fa fa-question-circle fpbx-help-icon" data-for="announcefreq"></i>
   								</div>
   								<div class="col-md-9">
   									<select class="form-control" id="announcefreq" name="announcefreq" >
   										<?php echo $qafreqopts ?>
   									</select>
   								</div>
   							</div>
   						</div>
   					</div>
   				</div>
   				<div class="row">
   					<div class="col-md-12">
   						<span id="announcefreq-help" class="help-block fpbx-help-block"><?php echo _("How often to announce queue position and estimated holdtime (0 to Disable Announcements).")."<br/>"._("This value is ignored if the caller's position changes")?></span>
   					</div>
   				</div>
   			</div>
   			<!--END Frequency-->
				<!--Minimum Announcement Interval-->
				<div class="element-container">
					<div class="row">
						<div class="col-md-12">
							<div class="row">
								<div class="form-group">
									<div class="col-md-3">
										<label class="control-label" for="min-announce"><?php echo _("Minimum Announcement Interval") ?></label>
										<i class="fa fa-question-circle fpbx-help-icon" data-for="min-announce"></i>
									</div>
									<div class="col-md-9">
										<select id="min-announce" name="min-announce" class="form-control"><?php echo $qminfreqopts?></select>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<span id="min-announce-help" class="help-block fpbx-help-block"><?php echo _("The absolute minimum time between the start of each queue position and/or estimated holdtime announcement")?></span>
						</div>
					</div>
				</div>
				<!--END Minimum Announcement Interval-->
   			<!--Announce Position-->
   			<div class="element-container">
   				<div class="row">
   					<div class="col-md-12">
   						<div class="row">
   							<div class="form-group">
   								<div class="col-md-3">
   									<label class="control-label" for="announcepositionw"><?php echo _("Announce Position") ?></label>
   									<i class="fa fa-question-circle fpbx-help-icon" data-for="announcepositionw"></i>
   								</div>
   								<div class="col-md-9 radioset input-group">
   								&nbsp;&nbsp;&nbsp;
								<?php $default = (isset($thisQ['announce-position']) ? $thisQ['announce-position'] : "no");?>
								<input type="radio" name="announceposition" id="announcepositionyes" value="yes" <?php echo ($default == "yes" ? 'checked' : '') ?> >
								<label for="announcepositionyes"><?php echo _("Yes") ?></label>
								<input type="radio" name="announceposition" id="announcepositionno" value="no" <?php echo ($default == "no" ? 'checked' : '') ?> >
								<label for="announcepositionno"><?php echo _("No") ?></label>
   								</div>
   							</div>
   						</div>
   					</div>
   				</div>
   				<div class="row">
   					<div class="col-md-12">
   						<span id="announcepositionw-help" class="help-block fpbx-help-block"><?php echo _("Announce position of caller in the queue?")?></span>
   					</div>
   				</div>
   			</div>
   			<!--END Announce Position-->
   			<!--Announce Hold Time-->
   			<div class="element-container">
   				<div class="row">
   					<div class="col-md-12">
   						<div class="row">
   							<div class="form-group">
   								<div class="col-md-3">
   									<label class="control-label" for="announceholdtimew"><?php echo _("Announce Hold Time") ?></label>
   									<i class="fa fa-question-circle fpbx-help-icon" data-for="announceholdtimew"></i>
   								</div>
   								<div class="col-md-9 radioset input-group">
   								&nbsp;&nbsp;&nbsp;
								<?php $default = (isset($thisQ['announce-holdtime']) ? $thisQ['announce-holdtime'] : "no");?>
								<input type="radio" name="announceholdtime" id="announceholdtimeyes" value="yes" <?php echo ($default == "yes" ? 'checked' : '') ?> >
								<label for="announceholdtimeyes"><?php echo _("Yes") ?></label>
								<input type="radio" name="announceholdtime" id="announceholdtimeno" value="no" <?php echo ($default == "no" ? 'checked' : '') ?> >
								<label for="announceholdtimeno"><?php echo _("No") ?></label>
   								<input type="radio" name="announceholdtime" id="announceholdtimeonce" value="once" <?php echo ($default == "once" ? 'checked' : '') ?> >
								<label for="announceholdtimeonce"><?php echo _("Once") ?></label>
   								</div>
   							</div>
   						</div>
   					</div>
   				</div>
   				<div class="row">
   					<div class="col-md-12">
   						<span id="announceholdtimew-help" class="help-block fpbx-help-block"><?php echo _("Should we include estimated hold time in position announcements?  Either yes, no, or only once; hold time will not be announced if <1 minute")?></span>
   					</div>
   				</div>
   			</div>
   			<!--END Announce Hold Time-->
		</div>
		<!--End Caller Position section-->
		<div class="section-title" data-for="qannounceper">
			<h3><i class="fa fa-minus"></i> <?php echo _("Periodic Announcements")?></h3>
		</div>
		<div class="section" data-id="qannounceper">
			<?php echo $breakouthtml //if function_exists('vqplus_callback_get') && function_exists('ivr_get_details')?>
			<?php echo $ivrbreakouthtml //if function_exists('ivr_get_details')?>
			<?php echo $vqcbhtml //if function_exists('vqplus_callback_get') ?>
			<?php echo $repeatfreqhtml //if function_exists('vqplus_callback_get') || function_exists('ivr_get_details')?>
		</div>
	</div>
	<div role="tabpanel" id="qadvanced" class="tab-pane">
		<?php echo isset($agenteventshtml)?$agenteventshtml:''; //if asterisk is below 12 ?>
		<?php echo isset($membereventhtml)?$membereventhtml:''; //if asterisk is below 12 ?>
		<!--Service Level-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="servicelevel"><?php echo _("Service Level") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="servicelevel"></i>
							</div>
							<div class="col-md-9">
								<select name="servicelevel" id="servicelevel" class="form-control" >
									<?php echo $slopts ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="servicelevel-help" class="help-block fpbx-help-block"><?php echo _("Used for service level statistics (calls answered within service level time frame)")?></span>
				</div>
			</div>
		</div>
		<!--END Service Level-->
		<!--Agent Regex Filter-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="qregex"><?php echo _("Agent Regex Filter") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="qregex"></i>
							</div>
							<div class="col-md-9">
								<input type="text" class="form-control" id="qregex" name="qregex" value="<?php echo (isset($qregex) ? $qregex : ''); ?>">
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="qregex-help" class="help-block fpbx-help-block"><?php echo _("Provides an optional regex expression that will be applied against the agent callback number. If the callback number does not pass the regex filter then it will be treated as invalid. This can be used to restrict agents to extensions within a range, not allow callbacks to include keys like *, or any other use that may be appropriate. An example input might be:<br />^([2-4][0-9]{3})$<br />This would restrict agents to extensions 2000-4999. Or <br />^([0-9]+)$ would allow any number of any length, but restrict the * key.<br />WARNING: make sure you understand what you are doing or otherwise leave this blank!")?></span>
				</div>
			</div>
		</div>
		<!--END Agent Regex Filter-->

	</div>
	<!--HOOKS-->
	<?php echo $hookdata['hookContent'] ?>
	<div role="tabpanel" id="qother" class="tab-pane">
		<?php
		echo $hookdata['oldHooks']
		?>
	</div>
	<!--END HOOKS-->
	<div role="tabpanel" id="qresetstats" class="tab-pane">
		<?php echo load_view(__DIR__ . '/cron.php', $cronVars); ?>
	</div>
</div>
</form>
