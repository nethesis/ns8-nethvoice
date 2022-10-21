<?php
$url = "config.php?display=calendar&action=edit&type=calendar&id=".$data['id'];
$readonly = $data['type'] !== 'local' ? 'true' : 'false';
?>

<h1>
	<?php echo sprintf(_("Viewing Calendar '%s'"),$data['name'])?>
</h1>
<h5>
	<?php echo sprintf(_("Viewing from timezone '%s'"),'<span id="timezone-display">'.$data['timezone'].'</span>')?>
</h5>
<h6>
	<?php if($data['type'] === 'local') {
		echo _('Utilizing the calendar timezone (You can change this in Edit Settings)');
	} else {
		echo _('Utilizing your timezone (You can change this in Advanced Settings or User Manager)');
	}?>
</h6>
<h6>
	<?php echo _('Private address in iCal format')?> (<a id="generate-ical-link" class="clickable"><?php echo _('(Re)Generate Link')?></a>)
	<br>
	<a href="<?php echo !empty($icallink) ? $icallink : ''?>" id="ical-link" class="<?php echo !empty($icallink) ? '' : 'hidden'?>"><?php echo _('Private iCal Link') ?></a>
</h6>
<script>
var readonly = <?php echo $readonly; ?>;
var calendarid = "<?php echo $data['id']; ?>";
var caltimezone = "<?php echo $data['timezone']; ?>";
</script>
<div id="calendar" class="calendar-readonly-<?php echo $readonly; ?>"></div>
<div class="row">
	<div class="col-sm-12">
		<div class="fpbx-container">
			<div class = "display no-border">
				<div id="eventModal" class="modal fade">
					<div class="modal-dialog">
						<div class="modal-content">
							<div class="modal-header">
								<button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">×</span> <span class="sr-only">close</span></button>
								<h4 id="modalTitle" class="modal-title"><?php echo _("Event")?></h4>
							</div>
							<div id="modalBody" class="modal-body">
								<form name="eventForm" id="eventForm" action="ajax.php?command=eventform&amp;module=calendar" method="POST">
									<input type="hidden" name="calendarid" id="calendarid" value="<?php echo $data['id']?>">
									<input type="hidden" name="eventid" id="eventid" value="">
									<input type="hidden" name="rstartdate" id="rstartdate" value="">
									<input type="hidden" name="renddate" id="renddate" value="">
									<!--Event Description-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="title"><?php echo _("Event Title") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="title"></i>
														</div>
														<div class="col-md-9">
															<input type="text" class="form-control" id="title" name="title" value="">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="title-help" class="help-block fpbx-help-block"><?php echo _("Friendly name for the event")?></span>
											</div>
										</div>
									</div>
									<!--END Event Description-->
									<!--Event Description-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="description"><?php echo _("Event Description") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
														</div>
														<div class="col-md-9">
															<input type="text" class="form-control" id="description" name="description" value="">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="description-help" class="help-block fpbx-help-block"><?php echo _("Description for the event")?></span>
											</div>
										</div>
									</div>
									<!--END Event Description-->
									<!--Event Categories-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="categories"><?php echo _("Event Categories") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="categories"></i>
														</div>
														<div class="col-md-9">
															<input type="text" class="form-control" id="categories" name="categories" value="">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="categories-help" class="help-block fpbx-help-block"><?php echo _("Categories this event belongs to, separated by comma")?></span>
											</div>
										</div>
									</div>
									<!--END Event Categories-->
									<!--Start Date and Time-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="startdate"><?php echo _("Start Date") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="startdate"></i>
														</div>
														<div class="col-md-9">
															<div class="input-group">
																<input type="text" class="form-control" id="startdate" name="startdate" value="">
																<span class="input-group-addon"><i class="fa fa-calendar"></i></span>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="startdate-help" class="help-block fpbx-help-block"><?php echo _("The time to start the event")?></span>
											</div>
										</div>
									</div>
									<!--END Start Date and Time-->
									<!--End Event Date and Time-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="enddate"><?php echo _("End Date") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="enddate"></i>
														</div>
														<div class="col-md-9">
															<div class="input-group">
																<input type="text" class="form-control" id="enddate" name="enddate" value="">
																<span class="input-group-addon"><i class="fa fa-calendar"></i></span>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="enddate-help" class="help-block fpbx-help-block"><?php echo _("Time this event ends")?></span>
											</div>
										</div>
									</div>
									<!--END End Event-->
									<!--End Event Date and Time-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="allday"><?php echo _("All Day") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="allday"></i>
														</div>
														<div class="col-md-9 radioset">
															<input type="checkbox" class="form-control" id="allday" name="allday" value="yes">
															<label for="allday"><?php echo _("All Day")?></label>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="allday-help" class="help-block fpbx-help-block"><?php echo _("All Day Event")?></span>
											</div>
										</div>
									</div>
									<!--END End Event-->
									<!--Start Time-->
									<div class="element-container time">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="starttime"><?php echo _("Start Time") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="starttime"></i>
														</div>
														<div class="col-md-9">
															<input type="text" class="form-control" id="starttime" name="starttime" value="<?php echo isset($starttime)?$starttime:''?>">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="starttime-help" class="help-block fpbx-help-block"><?php echo _("Time event starts")?></span>
											</div>
										</div>
									</div>
									<!--END Start Time-->
									<!--End Time-->
									<div class="element-container time">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="endtime"><?php echo _("End Time") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="endtime"></i>
														</div>
														<div class="col-md-9">
															<input type="text" class="form-control" id="endtime" name="endtime" value="<?php echo isset($endtime)?$endtime:''?>">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="endtime-help" class="help-block fpbx-help-block"><?php echo _("Time the event ends")?></span>
											</div>
										</div>
									</div>
									<!--END End Time-->
									<!--Timezone-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="timezone"><?php echo _("Timezone") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="timezone"></i>
														</div>
														<div class="col-md-9">
															<?php echo FreePBX::View()->timezoneDrawSelect('timezone',null,_('Use Calendar Timezone')); ?>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="timezone-help" class="help-block fpbx-help-block"><?php echo _("Timezone for this event")?></span>
											</div>
										</div>
									</div>
									<!--END Timezone-->
									<!--End Event Date and Time-->
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="reoccurring"><?php echo _("Reoccurring") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="reoccurring"></i>
														</div>
														<div class="col-md-9 radioset">
															<input type="checkbox" class="form-control" id="reoccurring" name="reoccurring" value="yes">
															<label for="reoccurring"><?php echo _("Reoccurring")?></label>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="reoccurring-help" class="help-block fpbx-help-block"><?php echo _("Reoccurring Event")?></span>
											</div>
										</div>
									</div>
									<!--END End Event-->
									<div id="repeats-container" class="element-container reoccurring">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="repeats"><?php echo _("Repeats") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="repeats"></i>
														</div>
														<div class="col-md-9">
															<select class="form-control" id="repeats" name="repeats">
																<option value="0" title="Daily">Daily</option>
																<option value="1" title="Every weekday (Monday to Friday)">Every weekday (Monday to Friday)</option>
																<option value="2" title="Every Monday, Wednesday, and Friday">Every Monday, Wednesday, and Friday</option>
																<option value="3" title="Every Tuesday and Thursday">Every Tuesday and Thursday</option>
																<option value="4" title="Weekly">Weekly</option>
																<option value="5" title="Monthly">Monthly</option>
																<option value="6" title="Yearly">Yearly</option>
															</select>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="repeats-help" class="help-block fpbx-help-block"><?php echo _("Repeats")?></span>
											</div>
										</div>
									</div>
									<div id="repeats-every-container" class="element-container reoccurring">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="repeat-count"><?php echo _("Repeat Every") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="repeat-count"></i>
														</div>
														<div class="col-md-9">
															<div class="input-group">
																<select class="form-control" name="repeat-count" id="repeat-count">
																	<option value="1" selected="selected">1</option>
																	<option value="2">2</option>
																	<option value="3">3</option>
																	<option value="4">4</option>
																	<option value="5">5</option>
																	<option value="6">6</option>
																	<option value="7">7</option>
																	<option value="8">8</option>
																	<option value="9">9</option>
																	<option value="10">10</option>
																	<option value="11">11</option>
																	<option value="12">12</option>
																	<option value="13">13</option>
																	<option value="14">14</option>
																	<option value="15">15</option>
																	<option value="16">16</option>
																	<option value="17">17</option>
																	<option value="18">18</option>
																	<option value="19">19</option>
																	<option value="20">20</option>
																	<option value="21">21</option>
																	<option value="22">22</option>
																	<option value="23">23</option>
																	<option value="24">24</option>
																	<option value="25">25</option>
																	<option value="26">26</option>
																	<option value="27">27</option>
																	<option value="28">28</option>
																	<option value="29">29</option>
																	<option value="30">30</option>
																</select>
																<span class="input-group-addon" id="countType">Days</span>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="repeat-count-help" class="help-block fpbx-help-block"><?php echo _("Repeats")?></span>
											</div>
										</div>
									</div>
									<div id="repeat-on-container" class="element-container reoccurring">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="repeats"><?php echo _("Repeat On") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="repeats"></i>
														</div>
														<div class="col-md-9 radioset">
															<?php foreach($locale['weekdaysShort'] as $id => $day) { ?>
																<input id="weekday<?php echo $id?>" name="weekday[]" type="checkbox" title="<?php echo $locale['weekdays'][$id]?>" value="<?php echo $id?>">
																<label for="weekday<?php echo $id?>" title="Sunday"><?php echo $day?></label>
															<?php } ?>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="repeats-help" class="help-block fpbx-help-block"><?php echo _("Repeats")?></span>
											</div>
										</div>
									</div>
									<div id="repeat-by-container" class="element-container reoccurring">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="repeat-by"><?php echo _("Repeat by") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="repeat-by"></i>
														</div>
														<div class="col-md-9 radioset">
															<input id="repeat-by0" name="repeat-by" type="radio" value="0">
															<label for="repeat-by0"><?php echo _("Day of the month")?></label>
															<input id="repeat-by1" name="repeat-by" type="radio" value="1">
															<label for="repeat-by1"><?php echo _("Day of the week")?></label>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="repeat-by-help" class="help-block fpbx-help-block"><?php echo _("Repeats")?></span>
											</div>
										</div>
									</div>
									<div class="element-container reoccurring">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="ends"><?php echo _("Ends") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="ends"></i>
														</div>
														<div class="col-md-9 radioset">
															<input id="repeat0" name="ends" type="radio" value="never">
															<label for="repeat0"><?php echo _("Never")?></label>
															<input id="repeat1" name="ends" type="radio" value="after">
															<label for="repeat1"><?php echo _("After")?></label>
															<input id="repeat2" name="ends" type="radio" value="on">
															<label for="repeat2"><?php echo _('On')?></label>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="ends-help" class="help-block fpbx-help-block"><?php echo _("Ends")?></span>
											</div>
										</div>
									</div>
									<div id="occurrences-container" class="element-container reoccurring">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="occurrences"><?php echo _("Occurrences") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="occurrences"></i>
														</div>
														<div class="col-md-9">
															<div class="input-group">
																<input id="occurrences" name="occurrences" type="text" class="form-control">
																<span class="input-group-addon"><?php echo _("occurrences")?></span>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="occurrences-help" class="help-block fpbx-help-block"><?php echo _("occurrences")?></span>
											</div>
										</div>
									</div>
									<div id="after-container" class="element-container reoccurring">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="afterdate"><?php echo _("After") ?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="afterdate"></i>
														</div>
														<div class="col-md-9">
															<div class="input-group">
																<input type="text" class="form-control" id="afterdate" name="afterdate" value="">
																<span class="input-group-addon"><i class="fa fa-calendar"></i></span>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="afterdate-help" class="help-block fpbx-help-block"><?php echo _("Repeats")?></span>
											</div>
										</div>
									</div>
								</form>
							</div>
							<div class="modal-footer">
								<button type="button" class="btn btn-danger pull-left hidden" data-id='deletebutton' data-dismiss="modal" id="modalDelete"><?php echo _("Delete Event")?></button>
								<button type="button" class="btn btn-default" data-dismiss="modal"><?php echo _("Close")?></button>
								<button type="submit" class="btn btn-default" form='eventForm' id="modalSubmit"><?php echo _("Submit")?></button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
