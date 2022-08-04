if($("#idTime").length) {
	var time = $("#idTime").data("time");
	var timezone = $("#idTime").data("zone");
	var updateTime = function() {
		$("#idTime").text(moment.unix(time).tz(timezone).format('HH:mm:ss z'));
		time = time + 1;
	};

	setInterval(updateTime,1000);
}

$("#duplicate").click(function(e){
	e.preventDefault();
	e.stopPropagation();
	$('input[name="action"]').val("duplicate");
	$("#extdisplay").val("");
	$("#edit").submit();
});

function edit_onsubmit(theForm) {
	defaultEmptyOK = false;
	if (!isAlphanumeric(theForm.displayname.value)) {
		return warnInvalid(theForm.displayname, _("Please enter a valid Time Conditions Name"));
	}
	if (TimeConditionNames.indexOf(theForm.displayname.value) >= 0) {
		// check the condition for EDIT from
		if(typeof theForm.itemid === 'undefined'){
			//Its a new one
			return warnInvalid(theForm.displayname, _("Duplicate Time Conditions Name"));
		}
		else{// its a edit form so check displayname exist in TimeConditionNames
		        if (TimeConditionNames.indexOf(theForm.displayname.value) >= 0) {
				return warnInvalid(theForm.displayname, _("Already exists Time Conditions Name:"+theForm.displayname.value));
			}
		}
	}

	if (theForm.fcc_password.value !== '' && !isNumber(theForm.fcc_password.value)) {
		return warnInvalid(theForm.fcc_password, _("Please enter a valid Override Code Pin"));
	}

	if ($("#mode_legacy").is(":checked") && isEmpty($("#time").val())) {
		return warnInvalid(theForm.time, _("Please select a time group to associate with this timecondition."));
	}

	if ($("#mode_calendar").is(":checked") && (isEmpty($("#calendar-group").val()) && isEmpty($("#calendar-id").val()))) {
		return warnInvalid($('select[name="calendar-id"]'), _("Please select a calendar or calendar group to associate with this timecondition."));
	}

	if (!validateDestinations(edit,2,true)) {
		return false;
	}

	return true;
}

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
function tcLinkedFormatter(value,row){
	var html = '';
	if(row.mode == "calendar-group") {
		if(row.calendar_id !== "") {
			html = '<a href="?display=calendar&action=view&type=calendar&id='+row.calendar_id+'">'+_("Calendar")+'</a>';
		} else if(row.calendar_group_id !== "") {
			html = '<a href="?display=calendargroups&action=edit&id='+row.calendar_group_id+'">'+_("Calendar Group")+'</a>';
		} else {
			html = _('Not Set');
		}
	} else if(row.group !== "") {
		html = '<a href="?display=timegroups&view=form&extdisplay='+row.group+'">'+_("Time Group")+'</a>';
	} else {
		html = _('Not Set');
	}
	return html;
}
function tcactionFormatter(value,row){
	var html = '';
	html += '<a href="?display=timeconditions&view=form&itemid='+value+'"><i class="fa fa-edit"></i></a>&nbsp;';
	//html += '<a href="?display=timegroups&view=form&extdisplay='+row.time+'"><i class="fa fa-clock-o"></i></a>&nbsp;';
	html += '<a href="?display=timeconditions&action=delete&itemid='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
	return html;
}
function tcstateFormatter(value,row){
	var str = '';
	switch(value) {
		case "true_sticky":
			str = _("Permanently matched");
		break;
		case "false_sticky":
			str = _("Permanently unmatched");
		break;
		case "false":
			str = _("Temporary unmatched");
		break;
		case "true":
			str = _("Temporary matched");
		break;
		default:
			str = _("No Override");
		break;
	}
	return str;
}
$("#tcrnav").on('click-row.bs.table',function(e,row,elem){
  window.location = '?display=timeconditions&view=form&itemid='+row.timeconditions_id;
});

var previous;
$("#time").on('focus', function () {
	// Store the current value on focus and on change
	if(this.value != "popover") {
		previous = this.value;
	}
}).change(function() {
	var $this = this;
	if($(this).val() == "popover") {
		var urlStr = "config.php?display=timegroups&view=form&fw_popover=1", id = 1;
		popover_select_id = this.id;
		popover_box_class = "timegroups";
		popover_box_mod = "timegroups";
		popover_box = $("<div id=\"popover-box-id\" data-id=\"" + id + "\"></div>")
			.html("<iframe data-popover-class=\"" + popover_box_class + "\" id=\"popover-frame\" frameBorder=\"0\" src=\"" + urlStr + "\" width=\"100%\" height=\"95%\"></iframe>")
			.dialog({
				title: "Add",
				resizable: false,
				modal: true,
				width: window.innerWidth - (window.innerWidth * '.10'),
				height: window.innerHeight - (window.innerHeight * '.10'),
				create: function() {
					$("body").scrollTop(0).css({ overflow: "hidden" });
				},
				close: function(e) {
					$($this).val(previous);
					$("#popover-frame").contents().find("body").remove();
					$("#popover-box-id").html("");
					$("body").css({ overflow: "inherit" });
					updateGroups();
					$(e.target).dialog("destroy").remove();
				},
				buttons: [
						{
						text: fpbx.msg.framework.save,
						click: function() {
							pform = $("#popover-frame").contents().find("form").first();
							pform.submit();
						}
					}, {
						text: fpbx.msg.framework.cancel,
						click: function() {
							$(this).dialog("close");
						}
					}
				]
			});
	}
});

function updateGroups(selectLast) {
	$.post( "ajax.php", { module: "timeconditions", command: "getGroups" })
  .success(function( data ) {
		var options = '<option value="">--'+_('Select a Group')+'--</option>';
		$.each(data.groups, function(i,v) {
			options = options + '<option value="'+v.value+'">'+v.text+'</option>';
		});
		options = options + '<option value="popover">'+_('Add New Time Group...')+'</option>';
		$("#time").html(options);
		if(typeof selectLast === "undefined" || !selectLast) {
			$("#time").val(data.last);
		}
  });
}

$("input[name=mode]").change(function() {
	if($(this).val() == "time-group") {
		$(".calendar-container").addClass("hidden");
		$(".time-group-container").removeClass("hidden");
	} else {
		$(".calendar-container").removeClass("hidden");
		$(".time-group-container").addClass("hidden");
	}
});

$("#calendar-id, #calendar-group").change(function() {
	if($("#calendar-id").val() !== "" && $("#calendar-group").val() !== "") {
		$(this).val("");
		warnInvalid($(this),_("You cant set both a group and a calendar"));
	}
});
/* Removing self time codition entry from the destination list */
$(document).on('change', 'select[name="goto0"], select[name="goto1"]', function() {
        if ($("select[id^='goto0']").val() == "Time_Conditions") {
                $("#Time_Conditions0").find('option').each(function() {
                        if ($(this).text() == $("#displayname").val()) {
                                $(this).remove();
                        }
                });
        }

        if ($("select[id^='goto1']").val() == "Time_Conditions") {
                $("#Time_Conditions1").find('option').each(function() {
                        if ($(this).text() == $("#displayname").val()) {
                                $(this).remove();
                        }
                });
        }
});
