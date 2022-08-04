<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
extract($request,EXTR_SKIP);
$subhead = _("Add Time Condition");
if ($itemid){
	$fcc = new featurecode('timeconditions', 'toggle-mode-'.$itemid);
	$code = $fcc->getCodeActive();
	unset($fcc);
	$thisItem = timeconditions_get($itemid);
	$displayname = $thisItem['displayname']?$thisItem['displayname']:'';
	$fcc_password = $thisItem['fcc_password']?$thisItem['fcc_password']:'';
	$time = $thisItem['time']?$thisItem['time']:'';
	$invert_hint = $thisItem['invert_hint']?$thisItem['invert_hint']:'0';
	$delURL = '?display=timeconditions&action=delete&itemid='.$itemid;
	$thisItem['timezone'] = isset($thisItem['timezone'])?$thisItem['timezone']:'default';
	$subhead = sprintf(_("Edit Time Condition: %s (%s)"),$displayname,$code);
} else {
	$thisItem['mode'] = 'time-group';
}
if ($itemid && $thisItem['tcstate'] !== false) {
	$tcstate = $thisItem['tcstate'] == '' ? 'auto' : $thisItem['tcstate'];
	switch ($tcstate) {
		case 'auto':
			$state_msg = _('No Override');
		break;
		case 'true':
			$state_msg = _('Temporary Override matching state');
		break;
		case 'true_sticky':
			$state_msg = _('Permanent Override matching state');
		break;
		case 'false':
			$state_msg = _('Temporary Override unmatching state');
		break;
		case 'false_sticky':
			$state_msg = _('Permanent Override unmatching state');
		break;
		default:
			$state_msg = _('Unknown State');
		break;
	}
}else{
	$state_msg = _('Unknown State');
}

$groups = FreePBX::Calendar()->listGroups();
$calendars = FreePBX::Calendar()->listCalendars();

?>
<h2><?php echo $subhead?></h2>
<form autocomplete="off" name="edit" id="edit" action="config.php?display=timeconditions" method="post" onsubmit="return edit_onsubmit(this);" class="fpbx-submit" data-fpbx-delete="<?php echo $delURL?>">
<input type="hidden" name="display" value="timeconditions">
<input type="hidden" name="action" value="<?php echo ($itemid ? 'edit' : 'add') ?>">
<?php if($itemid) { ?>
	<input type="hidden" name="itemid" value="<?php echo $itemid?>">
<?php } ?>
<!--Time Condition name-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="displayname"><?php echo _("Time Condition name") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="displayname"></i>
					</div>
					<div class="col-md-9">
						<input type="text" class="form-control" id="displayname" name="displayname" value="<?php echo $displayname?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="displayname-help" class="help-block fpbx-help-block"><?php echo _("Give this Time Condition a brief name to help you identify it.")?></span>
		</div>
	</div>
</div>
<!--END Time Condition name-->
<!--Override Code Pin-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="fcc_password"><?php echo _("Override Code Pin") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="fcc_password"></i>
					</div>
					<div class="col-md-9">
						<input type="number" min="0" class="form-control" id="fcc_password" name="fcc_password" value="<?php echo $fcc_password?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="fcc_password-help" class="help-block fpbx-help-block"><?php echo _("If set dialing the feature code will require a pin to change the override state")?></span>
		</div>
	</div>
</div>
<!--END Override Code Pin-->
<!--Invert BLF Hint-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="invert_hint"><?php echo _("Invert BLF Hint") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="invert_hint"></i>
					</div>
					<div class="col-md-9">
						<span class="radioset">
						<input type="radio" name="invert_hint" id="invert_hintyes" value="1" <?php echo ($invert_hint == "1"?"CHECKED":"") ?>>
						<label for="invert_hintyes"><?php echo _("Yes");?></label>
						<input type="radio" name="invert_hint" id="invert_hintno" value="0" <?php echo ($invert_hint == "1"?"":"CHECKED") ?>>
						<label for="invert_hintno"><?php echo _("No");?></label>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="invert_hint-help" class="help-block fpbx-help-block"><?php echo _("If set the hint will be INUSE if the time condition is matched, and NOT_INUSE if it fails")?></span>
		</div>
	</div>
</div>
<!--END Invert BLF Hint-->
<!--Change Override-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="tcstate_new"><?php echo _("Change Override") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="tcstate_new"></i>
					</div>
					<div class="col-md-9">
							<select class="form-control" id="tcstate_new" name="tcstate_new">
								<option value="unchanged" SELECTED><?php echo _("Unchanged");?></option>
								<option value="auto" ><?php echo _("Reset Override");?></option>
								<option value="true" ><?php echo _("Temporary matched");?></option>
								<option value="true_sticky" ><?php echo _("Permanently matched");?></option>
								<option value="false" ><?php echo _("Temporary unmatched");?></option>
								<option value="false_sticky" ><?php echo _("Permanently unmatched");?></option>
							</select>
							<br/>
							<b><?php echo _("Current")?>: </b><?php echo $state_msg; ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="tcstate_new-help" class="help-block fpbx-help-block"><?php echo _("This Time Condition can be set to Temporarily go to the 'matched' or 'unmatched' destination in which case the override will automatically reset once the current time span has elapsed. If set to Permanent it will stay overridden until manually reset. All overrides can be removed with the Reset Override option. Temporary Overrides can also be toggled with the %s feature code, which will also remove a Permanent Override if set but can not set a Permanent Override which must be done here or with other applications such as an XML based phone options.") ?></span>
		</div>
	</div>
</div>
<!--END Change Override-->
<!--Timezone-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="timezone"><?php echo _("Time Zone:")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="timezone"></i>
					</div>
					<div class="col-md-9">
						<select id="timezone" class="chosenselect form-control" name="timezone" id="timezone">
							<option value="default" <?php echo (isset($thisItem['timezone']) && $thisItem['timezone'] == $tz ? 'selected' : ''); ?>><?php echo _("Use System Timezone")?>
							<?php foreach(DateTimeZone::listIdentifiers(DateTimeZone::ALL) as $tz) {?>
								<option value="<?php echo $tz?>" <?php echo (isset($thisItem['timezone']) && $thisItem['timezone'] == $tz ? 'selected' : ''); ?>><?php echo $tz?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="timezone-help" class="help-block fpbx-help-block"><?php echo _("Specify the time zone by name if the destinations are in a different time zone than the server. Type two characters to start an auto-complete pick-list. <br/><strong>Important</strong>: Your selection here <strong>MUST</strong> appear in the pick-list or in the /usr/share/zoneinfo/ directory.") ?></span>
		</div>
	</div>
</div>
<!--END Timezone-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="mode"><?php echo _("Mode") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="mode"></i>
					</div>
					<div class="col-md-9">
						<span class="radioset">
						<input type="radio" name="mode" id="mode_legacy" value="time-group" <?php echo ($thisItem['mode'] == "time-group"?"CHECKED":"") ?>>
						<label for="mode_legacy"><?php echo _("Time Group Mode");?></label>
						<input type="radio" name="mode" id="mode_calendar" value="calendar-group" <?php echo ($thisItem['mode'] == "calendar-group"?"CHECKED":"") ?>>
						<label for="mode_calendar"><?php echo _("Calendar Mode");?></label>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="mode-help" class="help-block fpbx-help-block"><?php echo _("Select the Mode for checking time conditions")?></span>
		</div>
	</div>
</div>
<div class="element-container calendar-container <?php echo ($thisItem['mode'] == "time-group") ? 'hidden' : ''?>">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar-id"><?php echo _("Calendar") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar-id"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="calendar-id" name="calendar-id">
							<option value=""><?php echo _("--Select a Calendar--")?></option>
							<?php foreach($calendars as $id=> $group) { ?>
								<option value="<?php echo $id?>" <?php echo ($thisItem['calendar_id'] == $id) ? "selected" : ""?>><?php echo $group['name']?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar-id-help" class="help-block fpbx-help-block"><?php echo _("Calendar to check for time condition")?></span>
		</div>
	</div>
</div>
<div class="element-container calendar-container <?php echo ($thisItem['mode'] == "time-group") ? 'hidden' : ''?>">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar-group"><?php echo _("Calendar Group") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar-group"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="calendar-group" name="calendar-group">
							<option value=""><?php echo _("--Select a Group--")?></option>
							<?php foreach($groups as $id=> $group) { ?>
								<option value="<?php echo $id?>" <?php echo ($thisItem['calendar_group_id'] == $id) ? "selected" : ""?>><?php echo $group['name']?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar-group-help" class="help-block fpbx-help-block"><?php echo _("Calendar Group to check for timeconditions")?></span>
		</div>
	</div>
</div>
<!--Time Group-->
<div class="element-container time-group-container <?php echo ($thisItem['mode'] == "time-group") ? '' : 'hidden'?>">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="tgw"><?php echo _("Time Group") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="tgw"></i>
					</div>
					<div class="col-md-9">
						<?php echo timeconditions_timegroups_drawgroupselect('time', (isset($thisItem['time']) ? $thisItem['time'] : ''), true, ''); ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="tgw-help" class="help-block fpbx-help-block"><?php echo _("Select a Time Group created under Time Groups. Matching times will be sent to matching destination. If no group is selected, call will always go to no-match destination.")?></span>
		</div>
	</div>
</div>
<!--END Time Group-->
<?php
// implementation of module hook
$module_hook = moduleHook::create();
echo $module_hook->hookHtml;
?>
<!--Destination matches-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="goto0"><?php echo _("Destination matches") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
					</div>
					<div class="col-md-9">
						<?php
						if (isset($thisItem)) {
							echo drawselects($thisItem['truegoto'],0);
						} else {
							echo drawselects(null, 0);
						}
						?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Destination if time matches")?></span>
		</div>
	</div>
</div>
<!--END Destination matches-->
<!--Destination non-matches-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="goto1"><?php echo _("Destination non-matches") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="goto1"></i>
					</div>
					<div class="col-md-9">
						<?php
						if (isset($thisItem)) {
							echo drawselects($thisItem['falsegoto'],1);
						} else {
							echo drawselects(null, 1);
						}
						?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="goto1-help" class="help-block fpbx-help-block"><?php echo _("Destination if time does not matche")?></span>
		</div>
	</div>
</div>
<!--END Destination non-matches-->
</form>
<script>
var TimeConditionNames = <?php print json_encode(\FreePBX::Timeconditions()->getAllTimeconditonNames($itemid)); ?>;
</script>
