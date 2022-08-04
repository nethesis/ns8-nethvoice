<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
$iaxsettings = iaxsettings_get();
extract($iaxsettings, EXTR_SKIP);
$errordisplay = '';
if(!empty($errors)){
	$errordisplay .= '<div class = "alert alert-danger">';
	$errordisplay .= implode('<br/>', $errors);
	$errordisplay .= '</div>';
}
//Custom Fields
$idx = 1;
$var_iax_custom_key = "iax_custom_key_$idx";
$var_iax_custom_val = "iax_custom_val_$idx";
$iaxcinputs = '';
while (isset($$var_iax_custom_key)) {
	if ($$var_iax_custom_key != '') {
		$iaxcinputs .= <<< END
<input type="text" id="iax_custom_key_$idx" name="iax_custom_key_$idx" class="form-control iax-custom" value="{$$var_iax_custom_key}"> =
<input type="text" id="iax_custom_val_$idx" name="iax_custom_val_$idx" class="form-control" value="{$$var_iax_custom_val}">
END;
	}
	$idx++;
	$var_iax_custom_key = "iax_custom_key_$idx";
	$var_iax_custom_val = "iax_custom_val_$idx";
}
$seq = 1;
$rows = array();
$c = (max(array_values($codecs)) + 1);
$c++;
$rows[0] =  '<ul class="sortable" id="acodeclist">';
foreach ($codecs as $codec => $codec_state) {
	$codec_trans = _($codec);
	$codec_checked = $codec_state ? 'checked' : '';
	$count = !empty($codec_state)?$codec_state:$c++;
	$rows[$count] = '<li><a href="#">'
	. '<b>'.$codec_trans.'&nbsp;</b>'
	. '<input type="checkbox" name="codec['.$codec.']" id="'.$codec.'" value="1" '
	. ($codec_state?"checked":"")
	. '>'
	. '</a></li>';
}
$rows[$c++] = '</ul>';
ksort($rows);
$acodeclist =  implode(PHP_EOL, $rows);
unset($rows);
$seq = 1;
$vcodeclist =  '<ul class="sortable video-codecs">';
foreach ($video_codecs as $codec => $codec_state) {
	$codec_trans = _($codec);
	$codec_checked = $codec_state ? 'checked' : '';
	$vcodeclist .= '<li><a href="#">'
	. '<b>'.$codec_trans.'&nbsp;</b>'
	. '<input type="checkbox" name="vcodec['.$codec.']" id="'.$codec.'" value="1" '
	. ($codec_state?"checked":"")
	. '>'
	. '</a></li>';
}
$vcodeclist .=  '</ul>';
?>
<div class="container-fluid">
  <h1><?php echo _('IAX Settings')?></h1>
  <div class="fpbx-container">
		<?php echo $errordisplay;?>
    <div class="display no-border">
		<form autocomplete="off" class="fpbx-submit" name="editIax" id="editIax" action="" method="post" role="form">
		  <input type="hidden" name="action" value="edit">
			<ul class="nav nav-tabs" role="tablist">
				<li role="presentation" data-name="general" class="active">
					<a href="#general" aria-controls="general" role="tab" data-toggle="tab">
						<?php echo _("General Settings")?>
					</a>
				</li>
				<li role="presentation" data-name="advanced" class="change-tab">
					<a href="#advanced" aria-controls="advanced" role="tab" data-toggle="tab">
						<?php echo _("Advanced Settings")?>
					</a>
				</li>
				<li role="presentation" data-name="codec" class="change-tab">
					<a href="#codec" aria-controls="codec" role="tab" data-toggle="tab">
						<?php echo _("Codec Settings")?>
					</a>
				</li>
			</ul>
			<div class="tab-content display">
				<div role="tabpanel" id="general" class="tab-pane active">
					<!--Registration Times-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="regw"><?php echo _("Registration Times") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="regw"></i>
										</div>
										<div class="col-md-9 form-horizontal">
											<label for="minregexpire"><?php echo("minregexpire: ")?></label>
											<input type="number" class="form-control" id="minregexpire" name="minregexpire" value="<?php echo $minregexpire ?>">
											<label for="maxregexpire"><?php echo("maxregexpire: ")?></label>
											<input type="number" class="form-control" id="maxregexpire" name="maxregexpire" value="<?php echo $maxregexpire ?>">
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="regw-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: minregexpire, maxregexpire. Minimum and maximum length of time that IAX peers can request as a registration expiration interval (in seconds).")?></span>
							</div>
						</div>
					</div>
					<!--END Registration Times-->
					<!--Jitter Buffer Enable-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="jitterbuffer"><?php echo _("Jitter Buffer Enable") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="jitterbuffer"></i>
										</div>
										<div class="col-md-9 radioset">
											<input id="jitterbuffer-yes" type="radio" name="jitterbuffer" value="yes" <?php echo $jitterbuffer=="yes"?"checked=\"yes\"":""?>/>
											<label for="jitterbuffer-yes"><?php echo _("Yes") ?></label>
											<input id="jitterbuffer-no" type="radio" name="jitterbuffer" value="no" <?php echo $jitterbuffer=="no"?"checked=\"no\"":""?>/>
											<label for="jitterbuffer-no"><?php echo _("No") ?></label>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="jitterbuffer-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: jitterbuffer. You can adjust several parameters relating to the jitter buffer. The jitter buffer's function is to compensate for varying network delay. The jitter buffer works for INCOMING audio - the outbound audio will be dejittered by the jitter buffer at the other end.")?></span>
							</div>
						</div>
					</div>
					<!--END Jitter Buffer Enable-->
					<div id="jitterbuffer" class="<?php echo $jitterbuffer=="no"?"hidden":""?>">
						<!--Force Jitter Buffer-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="forcejitterbuffer"><?php echo _("Force Jitter Buffer") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="forcejitterbuffer"></i>
											</div>
											<div class="col-md-9 radioset">
												<input id="forcejitterbuffer-yes" type="radio" name="forcejitterbuffer" value="yes" <?php echo $forcejitterbuffer=="yes"?"checked=\"yes\"":""?>/>
												<label for="forcejitterbuffer-yes"><?php echo _("Yes") ?></label>
												<input id="forcejitterbuffer-no" type="radio" name="forcejitterbuffer" value="no" <?php echo $forcejitterbuffer=="no"?"checked=\"no\"":""?>/>
												<label for="forcejitterbuffer-no"><?php echo _("No") ?></label>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="forcejitterbuffer-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: forcejitterbuffer. Forces the use of a jitterbuffer on the receive side of an IAX channel. Normally the jitter buffer will not be used if receiving a jittery channel but sending it off to another channel such as a SIP channel to an endpoint, since there is typically a jitter buffer at the far end. This will force the use of the jitter buffer before sending the stream on. This is not typically desired as it adds additional latency into the stream.")?></span>
								</div>
							</div>
						</div>
						<!--END Force Jitter Buffer-->
						<!--Jitter Buffer Size-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="jbsw"><?php echo _("Jitter Buffer Size") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="jbsw"></i>
											</div>
											<div class="col-md-9 form-horizontal">
												<label for="maxjitterbuffer"><?php echo("maxjitterbuffer: ")?></label>
												<input type="number" class="form-control" id="maxjitterbuffer" name="maxjitterbuffer" value="<?php echo $maxjitterbuffer ?>">
												<label for="resyncthreshold"><?php echo("resyncthreshold: ")?></label>
												<input type="number" class="form-control" id="resyncthreshold" name="resyncthreshold" value="<?php echo $resyncthreshold ?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="jbsw-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: maxjitterbuffer. Max length of the jitterbuffer in milliseconds.<br /> Asterisk: resyncthreshold. When the jitterbuffer notices a significant change in delay that continues over a few frames, it will resync, assuming that the change in delay was caused by a timestamping mix-up. The threshold for noticing a change in delay is measured as twice the measured jitter plus this resync threshold. Resyncing can be disabled by setting this parameter to -1.")?></span>
								</div>
							</div>
						</div>
						<!--END Jitter Buffer Size-->
						<!--Max Interpolations-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="maxjitterinterps"><?php echo _("Max Interpolations") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="maxjitterinterps"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="maxjitterinterps" name="maxjitterinterps" value="<?php echo $maxjitterinterps ?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="maxjitterinterps-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: maxjitterinterps. The maximum number of interpolation frames the jitterbuffer should return in a row. Since some clients do not send CNG/DTX frames to indicate silence, the jitterbuffer will assume silence has begun after returning this many interpolations. This prevents interpolating throughout a long silence.")?></span>
								</div>
							</div>
						</div>
						<!--END Max Interpolations-->
					</div>
				</div>
				<div role="tabpanel" id="advanced" class="tab-pane">
					<!--Bind Address-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="bindaddr"><?php echo _("Bind Address") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="bindaddr"></i>
										</div>
										<div class="col-md-9">
											<input type="text" class="form-control validate-ip" id="bindaddr" name="bindaddr" value="<?php echo $bindaddr ?>">
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="bindaddr-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: bindaddr. The IP address to bind to and listen for calls on the Bind Port. If set to 0.0.0.0 Asterisk will listen on all addresses. To bind to multiple IP addresses or ports, use the Other 'IAX Settings' fields where you can put settings such as:<br /> bindaddr=192.168.10.100:4555.<br />  It is recommended to leave this blank.")?></span>
							</div>
						</div>
					</div>
					<!--END Bind Address-->
					<!--Bind Port-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="bindport"><?php echo _("Bind Port") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="bindport"></i>
										</div>
										<div class="col-md-9">
											<input type="text" class="form-control validate-ip-port" id="bindport" name="bindport" value="<?php echo $bindport ?>">
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="bindport-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: bindport. Local incoming UDP Port that Asterisk will bind to and listen for IAX messages. The IAX standard is 4569 and in most cases this is what you want. It is recommended to leave this blank.")?></span>
							</div>
						</div>
					</div>
					<!--END Bind Port-->
					<!--Delay Auth Rejects-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="delayreject"><?php echo _("Delay Auth Rejects") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="delayreject"></i>
										</div>
										<div class="col-md-9 radioset">
											<input id="delayreject-yes" type="radio" name="delayreject" value="yes" <?php echo $delayreject=="yes"?"checked=\"yes\"":""?>/>
											<label for="delayreject-yes"><?php echo _("Yes") ?></label>
											<input id="delayreject-no" type="radio" name="delayreject" value="no" <?php echo $delayreject=="no"?"checked=\"no\"":""?>/>
											<label for="delayreject-no"><?php echo _("No") ?></label>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="delayreject-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: delayreject. For increased security against brute force password attacks enable this which will delay the sending of authentication reject for REGREQ or AUTHREP if there is a password.")?></span>
							</div>
						</div>
					</div>
					<!--END Delay Auth Rejects-->
					<!--Other IAX Settings-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="iaxcustomw"><?php echo _("Other IAX Settings") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="iaxcustomw"></i>
										</div>
										<div class="col-md-9 form-horizontal" id="iax-custom-buttons">
											<input type="text" id="iax_custom_key_0" name="iax_custom_key_0" class="iax-custom" value="<?php echo $iax_custom_key_0 ?>"> =
											<input type="text" id="iax_custom_val_0" name="iax_custom_val_0" value="<?php echo $iax_custom_val_0 ?>">
											<?php echo $iaxcinputs ?>
											<input type="button" id="iax-custom-add" class="btn btn-default" value="<?php echo _("Add Field")?>" />
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="iaxcustomw-help" class="help-block fpbx-help-block"><?php echo _("You may set any other IAX settings not present here that are allowed to be configured in the General section of iax.conf. There will be no error checking against these settings so check them carefully. They should be entered as:<br /> [setting] = [value]<br /> in the boxes below. Click the Add Field box to add additional fields. Blank boxes will be deleted when submitted.")?></span>
							</div>
						</div>
					</div>
					<!--END Other IAX Settings-->
				</div>
				<div role="tabpanel" id="codec" class="tab-pane">
					<h3><?php echo _("Audio Codecs")?></h3>
					<br/>
					<?php echo $acodeclist?>
					<!--Codec Priority-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="codecpriority"><?php echo _("Codec Priority") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="codecpriority"></i>
										</div>
										<div class="col-md-9 radioset">
											<input id="codecpriority-host" type="radio" name="codecpriority" value="host" <?php echo $codecpriority=="host"?"checked=\"host\"":""?>/>
											<label for="codecpriority-host">host</label>
											<input id="codecpriority-caller" type="radio" name="codecpriority" value="caller" <?php echo $codecpriority=="caller"?"checked=\"caller\"":""?>/>
											<label for="codecpriority-caller">caller</label>
											<input id="codecpriority-disabled" type="radio" name="codecpriority" value="disabled" <?php echo $codecpriority=="disabled"?"checked=\"disabled\"":""?>/>
											<label for="codecpriority-disabled">disabled</label>
											<input id="codecpriority-regonly" type="radio" name="codecpriority" value="regonly" <?php echo $codecpriority=="regonly"?"checked=\"regonly\"":""?>/>
											<label for="codecpriority-regonly">regonly</label>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="codecpriority-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: codecpriority. Controls the codec negotiation of an inbound IAX call. This option is inherited to all user entities.  It can also be defined in each user entity separately which will override the setting here. The valid values are:<br />host - Consider the host's preferred order ahead of the caller's.<br />caller - Consider the callers preferred order ahead of the host's.<br /> disabled - Disable the consideration of codec preference altogether. (this is the original behavior before preferences were added)<br />reqonly  - Same as disabled, only do not consider capabilities if the requested format is not available the call will only be accepted if the requested format is available.")?></span>
							</div>
						</div>
					</div>
					<!--END Codec Priority-->
					<!--Bandwidth-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="bandwidth"><?php echo _("Bandwidth") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="bandwidth"></i>
										</div>
										<div class="col-md-9 radioset">
											<input id="bandwidth-low" type="radio" name="bandwidth" value="low" <?php echo $bandwidth=="low"?"checked=\"low\"":""?>/>
											<label for="bandwidth-low"><?php echo _("low") ?></label>
											<input id="bandwidth-medium" type="radio" name="bandwidth" value="medium" <?php echo $bandwidth=="medium"?"checked=\"medium\"":""?>/>
											<label for="bandwidth-medium"><?php echo _("medium") ?></label>
											<input id="bandwidth-high" type="radio" name="bandwidth" value="high" <?php echo $bandwidth=="high"?"checked=\"high\"":""?>/>
											<label for="bandwidth-high"><?php echo _("high") ?></label>
											<input id="bandwidth-unset" type="radio" name="bandwidth" value="unset" <?php echo $bandwidth=="unset"?"checked=\"unset\"":""?>/>
											<label for="bandwidth-unset"><?php echo _("unset") ?></label>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="bandwidth-help" class="help-block fpbx-help-block"><?php echo _("Asterisk: bandwidth. Specify bandwidth of low, medium, or high to control which codecs are used in general.")?></span>
							</div>
						</div>
					</div>
					<!--END Bandwidth-->
					<!--Video Support-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="videosupport"><?php echo _("Enable Video Support") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="videosupport"></i>
										</div>
										<div class="col-md-9 radioset">
											<input id="videosupport-yes" type="radio" name="videosupport" value="yes" <?php echo $videosupport=="yes"?"checked=\"yes\"":""?>/>
											<label for="videosupport-yes"><?php echo _("Yes") ?></label>
											<input id="videosupport-no" type="radio" name="videosupport" value="no" <?php echo $videosupport=="no"?"checked=\"no\"":""?>/>
											<label for="videosupport-no"><?php echo _("No") ?></label>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="videosupport-help" class="help-block fpbx-help-block"><?php echo _("Check to enable and then choose allowed codecs.")._(" If you clear each codec and then add them one at a time, submitting with each addition, they will be added in order which will effect the codec priority.")?></span>
							</div>
						</div>
					</div>
					<!--END Video Support-->
					<div class="video-codecs">
						<?php echo $vcodeclist?>
					</div>
				</div>
			</div>
		</form>
		</div>
	</div>
</div>
