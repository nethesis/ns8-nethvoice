<?php
$extdisplay = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:'';
$usagehtml = '';
if ($extdisplay != '') {
	// load
	$row = queueprio_get($extdisplay);
  $usage_list = framework_display_destination_usage(queueprio_getdest($extdisplay));
  if (!empty($usage_list)) {
    $usagehtml = '<div class="well well-info>"';
    $usagehtml .= '<h3>'.$usage_list['text'].'</h3>';
    $usagehtml .= $usage_list['tooltip'];
    $usagehtml .= '</div>';
  }
	$description = $row['description'];
	$queue_priority   = $row['queue_priority'];
	$dest        = $row['dest'];
  $delURL = '?display=queueprio&action=delete&queueprio_id='.$extdisplay;
	$subhead = "<h2>"._("Edit: ")."$description ($queue_priority)"."</h2>";
} else {

  $description = '';
  $queue_priority   = '0';
  $dest        = '';
  $delURL = '';
	$subhead = "<h2>"._("Add Queue Priority")."</h2>";
}



echo $subhead;
echo $usagehtml;
?>
<form name="editQueuePriority" id="editQueuePriority" class="fpbx-submit" action="" method="post" onsubmit="return checkQueuePriority(editQueuePriority);" data-fpbx-delete="<?php echo $delURL?>">
	<input type="hidden" name="extdisplay" value="<?php echo $extdisplay; ?>">
	<input type="hidden" name="queueprio_id" value="<?php echo $extdisplay; ?>">
	<input type="hidden" name="action" value="<?php echo ($extdisplay ? 'edit' : 'add'); ?>">
  <!--Description-->
  <div class="element-container">
    <div class="row">
      <div class="col-md-12">
        <div class="row">
          <div class="form-group">
            <div class="col-md-3">
              <label class="control-label" for="description"><?php echo _("Description") ?></label>
              <i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
            </div>
            <div class="col-md-9">
              <input type="text" class="form-control" id="description" name="description" value="<?php echo isset($description )?$description :''?>">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="description-help" class="help-block fpbx-help-block"><?php echo _("The descriptive name of this Queue Priority instance.")?></span>
      </div>
    </div>
  </div>
  <!--END Description-->
  <!--Priority-->
  <div class="element-container">
    <div class="row">
      <div class="col-md-12">
        <div class="row">
          <div class="form-group">
            <div class="col-md-3">
              <label class="control-label" for="queue_priority"><?php echo _("Priority") ?></label>
              <i class="fa fa-question-circle fpbx-help-icon" data-for="queue_priority"></i>
            </div>
            <div class="col-md-9">
              <input type="number" min="0" max="20" class="form-control" id="queue_priority" name="queue_priority" value="<?php echo isset($queue_priority)?$queue_priority:'0'?>">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="queue_priority-help" class="help-block fpbx-help-block"><?php echo _("The Queue Priority to set 0 - 20")?></span>
      </div>
    </div>
  </div>
  <!--END Priority-->
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
              <?php echo drawselects($dest,0)?>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Destination")?></span>
      </div>
    </div>
  </div>
  <!--END Destination-->
</form>
<script queueprio="javascript">
<!--

function checkQueuePriority(theForm) {
	var msgInvalidDescription = "<?php echo _('Invalid description specified'); ?>";

	// set up the Destination stuff
	setDestinations(theForm, '_post_dest');

	// form validation
	defaultEmptyOK = false;
	if (isEmpty(theForm.description.value))
		return warnInvalid(theForm.description, msgInvalidDescription);

	if (!validateDestinations(theForm, 1, true))
		return false;

	return true;
}
//-->
</script>
