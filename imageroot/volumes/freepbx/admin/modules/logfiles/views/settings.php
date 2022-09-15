<?php
global $amp_conf;
$datehelp = _('Customize the display of debug message time stamps. '
									. 'See strftime(3) Linux manual for format specifiers. '
									. 'Note that there is also a fractional second parameter '
									. 'which may be used in this field.  Use %1q for tenths, '
									. '%2q for hundredths, etc.')
									. _('Leave blank for default: ISO 8601 date format '
									. 'yyyy-mm-dd HH:MM:SS (%F %T)');
$rotatehelp = _('Sequential: Rename archived logs in order, such that the newest has the highest sequence number').'<br/>';
$rotatehelp .= _('Rotate: Rotate all the old files, such that the oldest has the highest sequence number (expected behavior for Unix administrators).').'<br/>';
$rotatehelp .= _('Timestamp: Rename the logfiles using a timestamp instead of a sequence number when "logger rotate" is executed.').'<br/>';
function log_dropdown($name,$value,$i){
		$ret = '<select class="form-control" name="logfiles['.$name.']['.$i.']">';
		$ret .= '<option value="on" '.(($value == 'on')?"SELECTED":"").'>'._("On").'</option>';
		$ret .= '<option value="" '.(($value != 'on')?"SELECTED":"").'>'._("Off").'</option>';
		$ret .=	'</select>';
	return $ret;
}

function verbose_log_dropdown($name,$value,$i){
		$value = ($value == 'on')?3:$value;
		$value = ($value === 0)?'off':$value;
		$value = (is_numeric($value) && $value >= 10)?10:$value;
		$ret = '<select class="form-control" name="logfiles['.$name.']['.$i.']">';
		$ret .= '<option value="off" '.(($value == 'off')?"SELECTED":"").'>'._("Off").'</option>';
		$ret .= '<option value="3" '.(($value == '3')?"SELECTED":"").'>'._("On").'</option>';
		for($i = 4; $i <= 10; $i++) {
			$ret .= '<option value="'.$i.'" '.(($value == $i)?"SELECTED":"").'>'.$i.'</option>';
		}
		$ret .= '<option value="*" '.(($value == '*')?"SELECTED":"").'>*</option>';
		$ret .=	'</select>';
	return $ret;
}

?>
<div class="container-fluid">
	<h1><?php echo _('Log File Settings')?></h1>
	<div class = "display full-border">
		<div class="row">
			<div class="col-md-11">
				<div class="fpbx-container">
					<div class="display full-border">
						<ul class="nav nav-tabs" role="tablist">
							<li data-name="logfiles_general" class="change-tab active"><a href="#logfiles_general" aria-controls="logfiles_general" role="tab" data-toggle="tab"><?php echo _("General Settings")?></a></li>
							<li data-name="logfiles_logfiles" class="change-tab"><a href="#logfiles_logfiles" aria-controls="logfiles_logfiles" role="tab" data-toggle="tab"><?php echo _("Log Files")?></a></li>
						</ul>
						<form class="fpbx-submit" action="" method="post" id="logfiles-settings">
						<div class="tab-content display">
								<div id="logfiles_general" class="tab-pane active">
									<input type="hidden" name="action" value="save">
									<!--Date Format-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="dateformat"><?php echo _("Date Format") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="dateformat"></i>
														</div>
														<div class="col-md-9">
															<input type="text" class="form-control" id="dateformat" name="dateformat" value="<?php echo isset($dateformat)?$dateformat:''?>">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="dateformat-help" class="help-block fpbx-help-block"> <?php echo $datehelp?></span>
											</div>
										</div>
									</div>
									<!--END Date Format-->
									<!--Log rotation-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="rotatestrategy"><?php echo _("Log Rotation") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="rotatestrategy"></i>
														</div>
														<div class="col-md-9 radioset">
									            <input type="radio" name="rotatestrategy" id="rotatestrategysequential" value="sequential" <?php echo ($rotatestrategy == "sequential"?"CHECKED":"") ?>>
									            <label for="rotatestrategysequential"><?php echo _("Sequential");?></label>
									            <input type="radio" name="rotatestrategy" id="rotatestrategyrotate" value="rotate" <?php echo ($rotatestrategy == "rotate"?"CHECKED":"") ?>>
									            <label for="rotatestrategyrotate"><?php echo _("Rotate");?></label>
									            <input type="radio" name="rotatestrategy" id="rotatestrategytimestamp" value="timestamp" <?php echo ($rotatestrategy == "timestamp"?"CHECKED":"") ?>>
									            <label for="rotatestrategytimestamp"><?php echo _("Timestamp");?></label>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="rotatestrategy-help" class="help-block fpbx-help-block"> <?php echo $rotatehelp ?></span>
											</div>
										</div>
									</div>
									<!--END Log rotation-->
									<!--Append Hostname-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="appendhostname"><?php echo _("Append Hostname") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="appendhostname"></i>
														</div>
														<div class="col-md-9 radioset">
									            <input type="radio" name="appendhostname" id="appendhostnameyes" value="yes" <?php echo ($appendhostname == "yes"?"CHECKED":"") ?>>
									            <label for="appendhostnameyes"><?php echo _("Yes");?></label>
									            <input type="radio" name="appendhostname" id="appendhostnameno" value="no" <?php echo ($appendhostname == "yes"?"":"CHECKED") ?>>
									            <label for="appendhostnameno"><?php echo _("No");?></label>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="appendhostname-help" class="help-block fpbx-help-block"><?php echo _("Appends the hostname to the name of the log files")?></span>
											</div>
										</div>
									</div>
									<!--END Append Hostname-->
									<!--Log Queues-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="queue_log"><?php echo _("Log Queues") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="queue_log"></i>
														</div>
														<div class="col-md-9 radioset">
									            <input type="radio" name="queue_log" id="queue_logyes" value="yes" <?php echo ($queue_log == "yes"?"CHECKED":"") ?>>
									            <label for="queue_logyes"><?php echo _("Yes");?></label>
									            <input type="radio" name="queue_log" id="queue_logno" value="no" <?php echo ($queue_log == "yes"?"":"CHECKED") ?>>
									            <label for="queue_logno"><?php echo _("No");?></label>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="queue_log-help" class="help-block fpbx-help-block"><?php echo _("Log queue events to a file")?></span>
											</div>
										</div>
									</div>
									<!--END Log Queues-->
								</div>
								<div id="logfiles_logfiles" class="tab-pane">
									<div class="well well-info">
										<h2><?php echo _("Logfile Help")?> </h2>
									<table>
									<tr><th><?php echo _("Field")?></th><th><?php echo _("Information")?></th></tr>
									<tr><td><?php echo _('File Name') ?></td><td><?php echo _('Name of file, relative to Asterisk logpath. Use absolute path for a different location') ?></td></tr>
									<tr><td><?php echo _('Debug')?></td><td><?php echo _('Messages used for debuging. '
									            . 'Do not report these as error\'s unless you have a '
									            . 'specific issue that you are attempting to debug. '
									            . 'Also note that Debug messages are also very verbose '
									            . 'and can and do fill up logfiles (and disk storage) quickly.')?></td></tr>
									<tr><td><?php echo _('DTMF')?></td><td><?php echo _('Keypresses as understood by asterisk. Usefull for debuging IVR and VM issues.')?></td></tr>
									<tr><td><?php echo _('Error')?></td><td><?php echo _('Critical errors and issues')?></td></tr>
									<tr><td><?php echo _('Fax')?></td><td><?php echo _('Transmition and receiving of faxes')?></td></tr>
									<tr><td><?php echo _('Notice')?></td><td><?php echo _('Messages of specific actions, such as a phone registration or call completion')?></td></tr>
									<tr><td><?php echo _('Verbose')?></td><td><?php echo ('Step-by-step messages of every step of a call flow. '
									              . 'Always enable and review if calls dont flow as expected')?></td></tr>
									<tr><td><?php echo _('Warning')?></td><td><?php echo _('Possible issues with dialplan syntaxt or call flow, but not critical.')?></td></tr>
									</table>
								</div>
									<table id="logfile_entries" class="table table-striped">
										<thead>
											<tr>
												<th> <?php echo _("File Name")?></th>
												<th> <?php echo _("Debug")?></th>
												<th> <?php echo _("DTMF")?></th>
												<th> <?php echo _("Error")?></th>
												<th> <?php echo _("Fax")?></th>
												<th> <?php echo _("Notice")?></th>
												<th> <?php echo _("Verbose")?></th>
												<th> <?php echo _("Warning")?></th>
												<th> <?php echo _("Security")?></th>
												<th> <?php echo _("Delete")?></th>
											</tr>
										</thead>
										<tbody>
											<?php
											$i = 0;
												foreach ($logfiles as $log) {;
													echo '<tr>';
													echo '<td>';
													echo '<input type="text" class="form-control" name="logfiles[name][]" value="'.$log['name'].'">';
													echo '</td>';
													echo '<td>';
													echo log_dropdown("debug",$log['debug'],$i);
													echo '</td>';
													echo '<td>';
													echo log_dropdown("dtmf",$log['dtmf'],$i);
													echo '</td>';
													echo '<td>';
													echo log_dropdown("error",$log['error'],$i);
													echo '</td>';
													echo '<td>';
													echo log_dropdown("fax",$log['fax'],$i);
													echo '</td>';
													echo '<td>';
													echo log_dropdown("notice",$log['notice'],$i);
													echo '</td>';
													echo '<td>';
													echo verbose_log_dropdown("verbose",$log['verbose'],$i);
													echo '</td>';
													echo '<td>';
													echo log_dropdown("warning",$log['warning'],$i);
													echo '</td>';
													echo '<td>';
													echo log_dropdown("security",$log['security'],$i);
													echo '</td>';
													echo '<td>';
													echo '<a href="#" class="delAction delete_entry"><i class="fa fa-trash"></i></a>';
													echo '</td>';
													echo '</tr>';
												$i++;
												}
											?>
										</tbody>
									</table>
									<a href="#" class="btn btn-default" id="add_entry"><i class="fa fa-plus"></i> <?php echo _("Add Log")?></a>
								</div>
						</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
<script type="text/javascript" src="modules/logfiles/assets/js/views/settings.js"></script>
