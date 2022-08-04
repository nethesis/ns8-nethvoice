<?php
//Default to disabled:
$cron_schedule = isset($cron_schedule)?$cron_schedule:'never';
?>
<script type="text/javascript" src="modules/queues/assets/js/jquery-cron.js"></script>
<link type="text/css" href="modules/queues/assets/css/jquery-cron.css" rel="stylesheet" />
<input type="hidden" name="cron_schedule" id="cron_schedule" value="<?php echo $cron_schedule?>">
<input type="hidden" name="cron_minute" id="cron_minute" value="<?php echo $cron_minute?>" <?php echo ($cron_schedule == 'never'? 'disabled':'') ?>>
<input type="hidden" name="cron_hour" id="cron_hour" value="<?php echo $cron_hour?>" <?php echo ($cron_schedule == 'never'? 'disabled':'') ?>>
<input type="hidden" name="cron_dow" id="cron_dow" value="<?php echo $cron_dow ?>" <?php echo ($cron_schedule == 'never'? 'disabled':'') ?>>
<input type="hidden" name="cron_month" id="cron_month" value="<?php echo $cron_month ?>" <?php echo ($cron_schedule == 'never'? 'disabled':'') ?>>
<input type="hidden" name="cron_dom" id="cron_dom" value="<?php echo $cron_dom?>" <?php echo ($cron_schedule == 'never'? 'disabled':'') ?>>
<!--Disable CRON-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="enabledw"><?php echo _("Stats Reset") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="enabledw"></i>
					</div>
					<div class="col-md-9 radioset">
						<span class="radioset">
						<input type="radio" name="disablecron" id="disablecronyes" value="" <?php echo ($cron_schedule == "never"?"":"CHECKED") ?>>
						<label for="disablecronyes"><?php echo _("Yes");?></label>
						<input type="radio" name="disablecron" id="disablecronno" value="never" <?php echo ($cron_schedule == "never"?"CHECKED":"") ?>>
						<label for="disablecronno"><?php echo _("No");?></label>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="enabledw-help" class="help-block fpbx-help-block"><?php echo _("Enable this task")?></span>
		</div>
	</div>
</div>
<!--END Disable CRON-->

<!--RANDOM-->
<div class="element-container <?php echo ($cron_schedule == 'never' ? 'hidden':'')?>" id="randominput">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="cron_randomw"><?php echo _("Random") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="cron_randomw"></i>
					</div>
					<div class="col-md-9 radioset form-inline">
						<input type="radio" name="cron_random" id="cron_randomyes" value="true" <?php echo ($cron_random == "true"?"CHECKED":"") ?>>
						<label for="cron_randomyes"><?php echo _("Yes");?></label>
						<input type="radio" name="cron_random" id="cron_randomno" value="false" <?php echo ($cron_random == "true"?"":"CHECKED") ?>>
						<label for="cron_randomno"><?php echo _("No");?></label>
						<select class="form-control <?php echo (($cron_random == "true")? '':'hidden') ?>" id="cron_schedule_select" <?php echo (($cron_random == "true")? '':'disabled') ?>>
							<option value = "hourly" <?php echo ($cron_schedule == 'hourly'?'SELECTED':'')?>><?php echo _("Hourly")?></option>
							<option value = "daily" <?php echo ($cron_schedule == 'daily'?'SELECTED':'')?>><?php echo _("Daily")?></option>
							<option value = "weekly" <?php echo ($cron_schedule == 'weekly'?'SELECTED':'')?>><?php echo _("Weekly")?></option>
							<option value = "monthly" <?php echo ($cron_schedule == 'monthly'?'SELECTED':'')?>><?php echo _("Monthly")?></option>
							<option value = "annually" <?php echo ($cron_schedule == 'annually'?'SELECTED':'')?>><?php echo _("Annually")?></option>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="cron_randomw-help" class="help-block fpbx-help-block"><?php echo _("Set this task to happen at random")?></span>
		</div>
	</div>
</div>
<!--END RANDOM-->
<!--RUN-->
<div class="element-container <?php echo ($cron_schedule == 'never' ? 'hidden':'')?>" id="runinput">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="runw"><?php echo _("RUN") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="runw"></i>
					</div>
					<div class="col-md-9">
						<div id="cron" class="form-inline"></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="runw-help" class="help-block fpbx-help-block"><?php echo _("When to schedule this job. Note enabling 'Random' overrides these settings")?></span>
		</div>
	</div>
</div>
<!--END RUN-->
<script type="text/javascript">
$(document).ready(function() {
	var crontime = [];
		crontime['minute'] = '59',
		crontime['hour'] = '23',
		crontime['dom'] ='*',
		crontime['month'] = '*',
		crontime['dow'] = '0'
	if (($("#cron_minute").val().length > 0)){
		crontime['minute'] = $("#cron_minute").val();
	}
	if (($("#cron_hour").val().length > 0)){
		crontime['hour'] = $("#cron_hour").val();
	}
	if (($("#cron_dow").val().length > 0)){
		crontime['dow'] = $("#cron_dow").val();
	}
	if (($("#cron_month").val().length > 0)){
		crontime['month'] = $("#cron_month").val();
	}
	if (($("#cron_dom").val().length > 0)){
		crontime['dom'] = $("#cron_dom").val();
	}

	$('#cron').cron({
		selectClass:'form-control',
		//Minute, Hour, Day of Month, Month, Day of Week
		initial : crontime['minute'] + " " + crontime['hour'] + " " + crontime['dom'] + " " + crontime['month'] + " " + crontime['dow'],
		onChange : function(){
			switch($("[name='cron-period']").val()){
				case "year":
					$('#cron_schedule').val("annually");
					$('#cron_minute').val($("[name='cron-time-min']").val());
					$('#cron_hour').val($("[name='cron-time-hour']").val());
					$('#cron_dow').val('*');
					$('#cron_month').val($("[name='cron-month']").val());
					$('#cron_dom').val($("[name='cron-dom']").val());
				break;
				case "hour":
					$('#cron_schedule').val("hourly");
					$('#cron_minute').val($("[name='cron-time-min']").val());
					$('#cron_hour').val('*');
					$('#cron_dow').val('*');
					$('#cron_month').val('*');
					$('#cron_dom').val('*');
				break;
				case "month":
					$('#cron_schedule').val("monthly");
					$('#cron_minute').val($("[name='cron-time-min']").val());
					$('#cron_hour').val($("[name='cron-time-hour']").val());
					$('#cron_dow').val('*');
					$('#cron_month').val('*');
					$('#cron_dom').val($("[name='cron-dom']").val());
				break;
				case "day":
					$('#cron_schedule').val("daily");
					$('#cron_minute').val($("[name='cron-time-min']").val());
					$('#cron_hour').val($("[name='cron-time-hour']").val());
					$('#cron_dow').val('*');
					$('#cron_month').val('*');
					$('#cron_dom').val('*');
				break;
				case "week":
					$('#cron_schedule').val("weekly");
					$('#cron_minute').val($("[name='cron-time-min']").val());
					$('#cron_hour').val($("[name='cron-time-hour']").val());
					$('#cron_dow').val($("[name='cron-dow']").val());
					$('#cron_month').val('*');
					$('#cron_dom').val('*');
				break;
				default:
					$('#cron_schedule').val("never");
				break;
			}

		},
	});
	$(".form-control option[value='minute']").each(function() {
    $(this).remove();
	});
	if($('input[name="disablecron"]:checked').val() == 'never'){
		$('#cron').prop('disabled',true);
		$('#cron_schedule').val("never");
	}
});
//Disable Check box...
$('input[name="disablecron"]').on('change',function(){
	if($(this).val() == 'never'){
		$('#cron').prop('disabled',true);
		$('#cron_minute').attr('disabled', true);
		$('#cron_hour').attr('disabled', true);
		$('#cron_dow').attr('disabled', true);
		$('#cron_month').attr('disabled', true);
		$('#cron_dom').attr('disabled', true);
		$('#runinput').addClass('hidden');
		$('#randominput').addClass('hidden');
		$('#cron_random').attr('disabled', true);
		$('#cron_schedule').val('never');
	}else{
		if($('input[name="cron_random"]:checked').val() == 'false'){
			$('#cron').prop('disabled',false);
			$('#cron_minute').attr('disabled', false);
			$('#cron_hour').attr('disabled', false);
			$('#cron_dow').attr('disabled', false);
			$('#cron_month').attr('disabled', false);
			$('#cron_dom').attr('disabled', false);
			$('#runinput').removeClass('hidden');
			$('#cron_schedule').val($('#cron_schedule_select').val());
		}else{
			$('#cron_schedule').val('custom');
		}
		$('#randominput').removeClass('hidden');
		$('#cron_random').attr('disabled', false);
	}
});
//Random
$('input[name="cron_random"]').on('change',function(){
	if($(this).val() == "true"){
		$('#cron_schedule_select').attr('disabled', false);
		$('#cron_schedule_select').removeClass('hidden');
		$('#cron_minute').attr('disabled', true);
		$('#cron_hour').attr('disabled', true);
		$('#cron_dow').attr('disabled', true);
		$('#cron_month').attr('disabled', true);
		$('#cron_dom').attr('disabled', true);
		$('#runinput').addClass('hidden');
	}else{
		$('#cron_schedule_select').attr('disabled', true);
		$('#cron_schedule_select').addClass('hidden');
		$('#cron_minute').attr('disabled', false);
		$('#cron_hour').attr('disabled', false);
		$('#cron_dow').attr('disabled', false);
		$('#cron_month').attr('disabled', false);
		$('#cron_dom').attr('disabled', false);
		$('#runinput').removeClass('hidden');
	}
});
//Schedule Select
$("#cron_schedule_select").change(function(){
	$('#cron_schedule').val($(this).val());
});

</script>
