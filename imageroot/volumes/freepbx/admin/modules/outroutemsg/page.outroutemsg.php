<?php /* $Id: page.outroutemsg.php  $ */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

define (DEFAULT_MSG, -1);
define (CONGESTION_TONE, -2);

$dispnum = 'outroutemsg'; //used for switch on config.php
$tabindex = 0;

$action  = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';
$type  = isset($_REQUEST['type']) ? $_REQUEST['type'] : 'tool';
$tresults = recordings_list();

// do if we are submitting a form
if($action){
	$default_msg_id      = isset($_REQUEST['default_msg_id'])      ? trim($_REQUEST['default_msg_id'])      : DEFAULT_MSG;
	$intracompany_msg_id = isset($_REQUEST['intracompany_msg_id']) ? trim($_REQUEST['intracompany_msg_id']) : DEFAULT_MSG;
	$emergency_msg_id    = isset($_REQUEST['emergency_msg_id'])    ? trim($_REQUEST['emergency_msg_id'])    : DEFAULT_MSG;
	$no_answer_msg_id    = isset($_REQUEST['no_answer_msg_id'])    ? trim($_REQUEST['no_answer_msg_id'])    : DEFAULT_MSG;
	$invalidnmbr_msg_id  = isset($_REQUEST['invalidnmbr_msg_id'])  ? trim($_REQUEST['invalidnmbr_msg_id'])  : DEFAULT_MSG;

	if ($action == 'submit') {
		outroutemsg_add($default_msg_id, $intracompany_msg_id, $emergency_msg_id, $no_answer_msg_id, $invalidnmbr_msg_id);
		needreload();
	}
}


// get the outroutemsg settings if not a submit
//
if ($action != 'submit') {
	$outroutemsg_settings = outroutemsg_get();
	$default_msg_id      = $outroutemsg_settings['default_msg_id'];
	$intracompany_msg_id = $outroutemsg_settings['intracompany_msg_id'];
	$emergency_msg_id    = $outroutemsg_settings['emergency_msg_id'];
	$no_answer_msg_id    = $outroutemsg_settings['no_answer_msg_id'];
	$invalidnmbr_msg_id  = $outroutemsg_settings['invalidnmbr_msg_id'];
}

?>
<div class="container-fluid">
	<h1><?php echo _('Route Congestion Messages')?></h1>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-9">
				<div class="fpbx-container">
					<form name="outroutemsg" id="outroutemsg" class='fpbx-submit' action="config.php" method="post">
					<input type="hidden" name="display" value="outroutemsg"/>
					<input type="hidden" name="action" value="submit"/>
						<ul class="nav nav-tabs" role="tablist">
							<li role="presentation" data-name="noroute" class="active">
								<a href="#noroute" aria-controls="noroute" role="tab" data-toggle="tab">
									<?php echo _("No Routes Available")?>
								</a>
							</li>
							<li role="presentation" data-name="notrunk" class="change-tab">
								<a href="#notrunk" aria-controls="notrunk" role="tab" data-toggle="tab">
									<?php echo _("Trunk Failures")?>
								</a>
							</li>
						</ul>
						<div class="tab-content display">
							<div role="tabpanel" id="noroute" class="tab-pane active">
								<!--Standard Routes-->
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="default_msg_id"><?php echo _("Standard Routes") ?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="default_msg_id"></i>
													</div>
													<div class="col-md-9">
														<select class="form-control" id="default_msg_id" name="default_msg_id">
															<?php
																echo '<option value="'.DEFAULT_MSG.'"'.(DEFAULT_MSG == $default_msg_id ? ' SELECTED' : '').'>'._("Default Message")."</option>\n";
																echo '<option value="'.CONGESTION_TONE.'"'.(CONGESTION_TONE == $default_msg_id ? ' SELECTED' : '').'>'._("Congestion Tones")."</option>\n";
																if (isset($tresults[0])) {
																	foreach ($tresults as $tresult) {
																		echo '<option value="'.$tresult['id'].'"'.($tresult['id'] == $default_msg_id ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
																	}
																}
															?>
														</select>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="default_msg_id-help" class="help-block fpbx-help-block"><?php echo _("Message or tone to be played if no trunks are available.")?></span>
										</div>
									</div>
								</div>
								<!--END Standard Routes-->
								<!--Intra-Company Routes-->
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="intracompany_msg_id"><?php echo _("Intra-Company Routes") ?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="intracompany_msg_id"></i>
													</div>
													<div class="col-md-9">
														<select class="form-control" id="intracompany_msg_id" name="intracompany_msg_id">
															<?php
																echo '<option value="'.DEFAULT_MSG.'"'.(DEFAULT_MSG == $intracompany_msg_id ? ' SELECTED' : '').'>'._("Default Message")."</option>\n";
																echo '<option value="'.CONGESTION_TONE.'"'.(CONGESTION_TONE == $intracompany_msg_id ? ' SELECTED' : '').'>'._("Congestion Tones")."</option>\n";
																if (isset($tresults[0])) {
																	foreach ($tresults as $tresult) {
																		echo '<option value="'.$tresult['id'].'"'.($tresult['id'] == $intracompany_msg_id ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
																	}
																}
															?>
														</select>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="intracompany_msg_id-help" class="help-block fpbx-help-block"><?php echo _("Message or tone to be played if no trunks are available. Used on routes marked as intra-company only.")?></span>
										</div>
									</div>
								</div>
								<!--END Intra-Company Routes-->
								<!--Emergency Routes-->
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="emergency_msg_id"><?php echo _("Emergency Routes") ?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="emergency_msg_id"></i>
													</div>
													<div class="col-md-9">
														<select class="form-control" id="emergency_msg_id" name="emergency_msg_id">
															<?php
																echo '<option value="'.DEFAULT_MSG.'"'.(DEFAULT_MSG == $emergency_msg_id ? ' SELECTED' : '').'>'._("Default Message")."</option>\n";
																echo '<option value="'.CONGESTION_TONE.'"'.(CONGESTION_TONE == $emergency_msg_id ? ' SELECTED' : '').'>'._("Congestion Tones")."</option>\n";
																if (isset($tresults[0])) {
																	foreach ($tresults as $tresult) {
																		echo '<option value="'.$tresult['id'].'"'.($tresult['id'] == $emergency_msg_id ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
																	}
																}
															?>
														</select>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="emergency_msg_id-help" class="help-block fpbx-help-block"><?php echo _("Message or tone to be played if no trunks are available. Used on all emergency routes. Consider a message instructing callers to find an alternative means of calling emergency services such as a cell phone or alarm system panel.")?></span>
										</div>
									</div>
								</div>
								<!--END Emergency Routes-->
							</div>
							<div role="tabpanel" id="notrunk" class="tab-pane">
								<!--No Answer-->
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="no_answer_msg_id"><?php echo _("No Answer") ?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="no_answer_msg_id"></i>
													</div>
													<div class="col-md-9">
														<select class="form-control" id="no_answer_msg_id" name="no_answer_msg_id">
															<?php
																echo '<option value="'.DEFAULT_MSG.'"'.(DEFAULT_MSG == $no_answer_msg_id ? ' SELECTED' : '').'>'._("Default Message")."</option>\n";
																echo '<option value="'.CONGESTION_TONE.'"'.(CONGESTION_TONE == $no_answer_msg_id ? ' SELECTED' : '').'>'._("Congestion Tones")."</option>\n";
																if (isset($tresults[0])) {
																	foreach ($tresults as $tresult) {
																		echo '<option value="'.$tresult['id'].'"'.($tresult['id'] == $no_answer_msg_id ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
																	}
																}
															?>
														</select>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="no_answer_msg_id-help" class="help-block fpbx-help-block"><?php echo _("Message or tone to be played if there was no answer. Default message is:<br>\"The number is not answering.\"<br> Hangupcause is 18 or 19")?></span>
										</div>
									</div>
								</div>
								<!--END No Answer-->
								<!--Number or Address Incomplete-->
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="invalidnmbr_msg_id"><?php echo _("Number or Address Incomplete") ?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="invalidnmbr_msg_id"></i>
													</div>
													<div class="col-md-9">
														<select class="form-control" id="invalidnmbr_msg_id" name="invalidnmbr_msg_id">
															<?php
																echo '<option value="'.DEFAULT_MSG.'"'.(DEFAULT_MSG == $invalidnmbr_msg_id ? ' SELECTED' : '').'>'._("Default Message")."</option>\n";
																echo '<option value="'.CONGESTION_TONE.'"'.(CONGESTION_TONE == $invalidnmbr_msg_id ? ' SELECTED' : '').'>'._("Congestion Tones")."</option>\n";
																if (isset($tresults[0])) {
																	foreach ($tresults as $tresult) {
																		echo '<option value="'.$tresult['id'].'"'.($tresult['id'] == $invalidnmbr_msg_id ? ' SELECTED' : '').'>'.$tresult['displayname']."</option>\n";
																	}
																}
															?>
														</select>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="invalidnmbr_msg_id-help" class="help-block fpbx-help-block"><?php echo _("Message or tone to be played if trunk reports Number or Address Incomplete. Usually this means that the number you have dialed is to short. Default message is:<br>\"The number you have dialed is not in service. Please check the number and try again.\"<br>Hangupcause is 28")?></span>
										</div>
									</div>
								</div>
								<!--END Number or Address Incomplete-->
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
