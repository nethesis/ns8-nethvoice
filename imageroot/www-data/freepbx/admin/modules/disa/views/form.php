<?php
$usagehtml = '';
if(isset($_REQUEST['itemid'])){
  $itemid = $_REQUEST['itemid'];
  $thisItem = disa_get($itemid);
  $subhead = '<h2>'._("DISA").': '.$thisItem["displayname"].'('.$itemid.')</h2>';
  $delURL = '?display=disa&action=delete&itemid='.$itemid;
  $usage_list = framework_display_destination_usage(disa_getdest($itemid));
  if(!empty($usage_list)){
    $usagehtml = '<div class="info info-default">';
    $usagehtml .= '<h3>'.$usage_list['text'].'</h3>';
    $usagehtml .= $usage_list['tooltip'];
    $usagehtml .= '</div>';
  }
}else{
  $thisItem = array(
    'needconf' => '',
    'hangup' => '',
  );
  $subhead = '<h2>'._("Add DISA").'</h2>';
  $delURL = '';
}
$fcc = new featurecode('core', 'disconnect');
$hangup_code = $fcc->getCodeActive();
unset($fcc);
if ($hangup_code == "") {
  $hangup_code = '*';
}
if (isset($thisItem['recording'])) {
  $recording = $thisItem['recording'];
} else {
  $recording = "dontcare";
}
$options = array(_("Force") => "force", _("Yes") => "yes", _("Don't Care") => "dontcare", _("No") => "no", _("Never") => "never");
$rechtml = "";
foreach ($options as $disp => $name) {
  if ($recording == $name) {
    $checked = "checked";
  } else {
    $checked = "";
  }
  $rechtml .= "<input type='radio' id='record_${name}' name='recording' value='$name' $checked><label for='record_${name}'>$disp</label>";
}

echo $subhead;
echo $usagehtml;
?>
<form autocomplete="off" name="edit" id="edit" class="fpbx-submit" action="?display=disa" method="post" onsubmit="return edit_onsubmit(this);" data-fpbx-delete="<?php echo $delURL?>">
<input type="hidden" name="display" value="disa">
<input type="hidden" name="action" value="<?php echo (isset($itemid) ? 'edit' : 'add') ?>">
<input type="hidden" name="itemid" value="<?php echo (isset($itemid) ? $itemid : '') ?>">
<!--DISA Name-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="displayname"><?php echo _("DISA Name") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="displayname"></i>
          </div>
          <div class="col-md-9">
            <input type="text" class="form-control" id="displayname" name="displayname" value="<?php echo htmlspecialchars(isset($thisItem['displayname']) ? $thisItem['displayname'] : ''); ?>">
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="displayname-help" class="help-block fpbx-help-block"><?php echo _("Give this DISA a brief name to help you identify it.")?></span>
    </div>
  </div>
</div>
<!--END DISA Name-->
<!--PIN-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="pin"><?php echo _("PIN") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="pin"></i>
          </div>
          <div class="col-md-9">
            <input type="text" class="form-control" id="pin" name="pin" value="<?php echo htmlspecialchars(isset($thisItem['pin']) ? $thisItem['pin'] : ''); ?>">
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="pin-help" class="help-block fpbx-help-block"><?php echo _("The user will be prompted for this number.")." "._("If you wish to have multiple PIN's, separate them with commas");?></span>
    </div>
  </div>
</div>
<!--END PIN-->
<!--Response Timeout-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="resptimeout"><?php echo _("Response Timeout") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="resptimeout"></i>
          </div>
          <div class="col-md-9">
            <div class="input-group">
              <input type="number" class="form-control" id="resptimeout" name="resptimeout" value="<?php echo htmlspecialchars(isset($thisItem['resptimeout']) ? $thisItem['resptimeout'] : '10'); ?>">
              <span class="input-group-addon" id="disatimeout-addon"><?php echo _("Seconds")?></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="resptimeout-help" class="help-block fpbx-help-block"><?php echo _("The maximum amount of time it will wait before hanging up if the user has dialed an incomplete or invalid number. Default of 10 seconds")?></span>
    </div>
  </div>
</div>
<!--END Response Timeout-->
<!--Digit Timeout-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="digittimeout"><?php echo _("Digit Timeout") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="digittimeout"></i>
          </div>
          <div class="col-md-9">
            <div class="input-group">
              <input type="number" class="form-control" id="digittimeout" name="digittimeout" value="<?php echo htmlspecialchars(isset($thisItem['digittimeout']) ? $thisItem['digittimeout'] : '5'); ?>">
              <span class="input-group-addon" id="disadigittimeout-addon"><?php echo _("Seconds")?></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="digittimeout-help" class="help-block fpbx-help-block"><?php echo _("The maximum amount of time permitted between digits when the user is typing in an extension. Default of 5 seconds")?></span>
    </div>
  </div>
</div>
<!--END Digit Timeout-->
<!--Call Recording-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="id"><?php echo _("Call Recording") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="id"></i>
          </div>
          <div class="col-md-9 radioset">
            <?php echo $rechtml?>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="id-help" class="help-block fpbx-help-block"><?php echo _("Record calls that use this DISA")?></span>
    </div>
  </div>
</div>
<!--END Call Recording-->
<!--Require Confirmation-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="needconf"><?php echo _("Require Confirmation") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="needconf"></i>
          </div>
          <div class="col-md-9 radioset">
            <input type="radio" name="needconf" id="needconfyes" value="CHECKED" <?php echo ($thisItem['needconf'] == "CHECKED"?"CHECKED":"") ?>>
            <label for="needconfyes"><?php echo _("Yes");?></label>
            <input type="radio" name="needconf" id="needconfno" <?php echo ($thisItem['needconf'] == "CHECKED"?"":"CHECKED") ?>>
            <label for="needconfno"><?php echo _("No");?></label>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="needconf-help" class="help-block fpbx-help-block"><?php echo _("equire Confirmation before prompting for password. Used when your PSTN connection appears to answer the call immediately")?></span>
    </div>
  </div>
</div>
<!--END Require Confirmation-->
<!--Caller ID-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="cid"><?php echo _("Caller ID") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="cid"></i>
          </div>
          <div class="col-md-9">
            <input type="text" class="form-control" id="cid" name="cid" value="<?php echo htmlspecialchars(isset($thisItem['cid']) ? $thisItem['cid'] : ''); ?>">
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="cid-help" class="help-block fpbx-help-block"><?php echo _("(Optional) When using this DISA, the users CallerID will be set to this. Format is \"User Name\" <5551234>")?></span>
    </div>
  </div>
</div>
<!--END Caller ID-->
<!--Context-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="context"><?php echo _("Context") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="context"></i>
          </div>
          <div class="col-md-9">
            <input type="text" class="form-control" id="context" name="context" value="<?php echo htmlspecialchars(isset($thisItem['context']) ? $thisItem['context'] : 'from-internal'); ?>">
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="context-help" class="help-block fpbx-help-block"><?php echo _("(Experts Only) Sets the context that calls will originate from. Leave this as from-internal unless you know what you're doing.")?></span>
    </div>
  </div>
</div>
<!--END Context-->
<!--Allow Hangup-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="hangup"><?php echo _("Allow Hangup") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="hangup"></i>
          </div>
          <div class="col-md-9 radioset">
            <input type="radio" name="hangup" id="hangupyes" value="CHECKED" <?php echo ($thisItem['hangup'] == "CHECKED"?"CHECKED":"") ?>>
            <label for="hangupyes"><?php echo _("Yes");?></label>
            <input type="radio" name="hangup" id="hangupno" <?php echo ($thisItem['hangup'] == "CHECKED"?"":"CHECKED") ?>>
            <label for="hangupno"><?php echo _("No");?></label>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="hangup-help" class="help-block fpbx-help-block"><?php echo sprintf(_("Allow the current call to be disconnected and dial tone presented for a new call by pressing the Hangup feature code: %s while in a call"),$hangup_code)?></span>
    </div>
  </div>
</div>
<!--END Allow Hangup-->
<!--Caller ID Override-->
<div class="element-container">
  <div class="row">
    <div class="col-md-12">
      <div class="row">
        <div class="form-group">
          <div class="col-md-3">
            <label class="control-label" for="keepcid"><?php echo _("Caller ID Override") ?></label>
            <i class="fa fa-question-circle fpbx-help-icon" data-for="keepcid"></i>
          </div>
          <div class="col-md-9 radioset">
            <input type="radio" name="keepcid" id="keepcidyes" value="1" <?php echo (isset($thisItem['keepcid']) && $thisItem['keepcid'] == "1"?"CHECKED":"") ?>>
            <label for="keepcidyes"><?php echo _("Yes");?></label>
            <input type="radio" name="keepcid" id="keepcidno" value="0" <?php echo (isset($thisItem['keepcid']) && $thisItem['keepcid'] == "1"?"":"CHECKED") ?>>
            <label for="keepcidno"><?php echo _("No");?></label>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-12">
      <span id="keepcid-help" class="help-block fpbx-help-block"><?php echo _("Determine if we keep the Caller ID being presented or if we override it. Default is No")."</br>"._("If you choose Yes the disa will pass the caller id set above.")?></span>
    </div>
  </div>
</div>
<!--END Caller ID Override-->
</form>
<script language="javascript">
<!--
var DisaNames = <?php print json_encode(\FreePBX::Disa()->getalldisa($itemid)); ?>;
var theForm = document.edit;
theForm.displayname.focus();

function edit_onsubmit(theForm) {
	var msgInvalidDISAName = "<?php echo _('Please enter a valid DISA Name'); ?>";
	var msgInvalidDISAPIN = "<?php echo _('Please enter a valid DISA PIN'); ?>";
	var msgInvalidCID = "<?php echo _('Please enter a valid Caller ID or leave it blank'); ?>";
	var msgInvalidContext = "<?php echo _('Context cannot be blank'); ?>";
	var msgduplicate = "<?php echo _('DISA Name Duplicate'); ?>";
	defaultEmptyOK = false;

	if (DisaNames.indexOf(theForm.displayname.value) >= 0) {
		 if(typeof theForm.disa_id === 'undefined'){
			 return warnInvalid(theForm.displayname, msgduplicate);
		 }else {
			 if (DisaNames.indexOf(theForm.displayname.value) >= 0) {
				return warnInvalid(theForm.displayname, _("Already exists DISA Name:"+theForm.displayname.value));
			 }
		 }
	}
	<?php if (function_exists('module_get_field_size')) { ?>
		var sizeDisplayName = "<?php echo module_get_field_size('disa', 'displayname', 50); ?>";
		if (!isCorrectLength(theForm.displayname.value, sizeDisplayName))
			return warnInvalid(theForm.displayname, "<?php echo _('The DISA Name provided is too long.'); ?>")
	<?php } ?>

	if (!isAlphanumeric(theForm.displayname.value))
		return warnInvalid(theForm.displayname, msgInvalidDISAName);

	defaultEmptyOK = true;
	if (!isPINList(theForm.pin.value))
		return warnInvalid(theForm.pin, msgInvalidDISAPIN);

	defaultEmptyOK = true;
	if (!isCallerID(theForm.cid.value))
		return warnInvalid(theForm.cid, msgInvalidCID);

	defaultEmptyOK = false;
	if (isEmpty(theForm.context.value))
		return warnInvalid(theForm.context, msgInvalidContext);

	return true;
}

//-->
</script>
