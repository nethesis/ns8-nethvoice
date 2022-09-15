$("#link").click(function(e) {
	e.preventDefault();
	e.stopPropagation();
	$(this).prop("disabled",true);
	window.location = '?display=calendar&action=edit&type=calendar&id='+calendarid;
});
$("#generate-ical-link").click(function(e) {
	if($(this).data("generating")) {
		return;
	}
	var text = $(this).text();
	var $this = this;
	$(this).data("generating",true);
	$(this).text(_('Generating...'));
	$.get( "ajax.php?module=calendar&command=generateical&id="+calendarid)
	.done(function(data) {
		if(data.status) {
			$("#ical-link").removeClass("hidden");
			$("#ical-link").attr('href',data.href);
		}
	})
	.fail(function(err){

	})
	.always(function(){
		$($this).text(text);
		$($this).data("generating",false);
	})

});
$("#eventForm").submit(function(e) {
	e.preventDefault();
	var frm = $(this);
	var frmurl = frm.attr('action');
	var frmdata = frm.serializeArray();

	if (!validateCalSubmit(frmdata)) {
		return;
	}
	$("#modalSubmit").prop("disabled",true);
	$("#modalDelete").prop("disabled",true);

	$.post(frmurl, frmdata)
	.done(function(data){
		if(data.status) {
			$('#eventModal').modal('hide');
			fpbxToast(data.message);
			$("#calendar").fullCalendar( 'refetchEvents' );
		}
	})
	.fail(function(jqXHR, status, error) {
		if (typeof jqXHR.responseJSON !== undefined) {
			fpbxToast('Error: ' + jqXHR.responseJSON.error.message);
		} else {
			fpbxToast('Unknown Error');
		}
	})
	.always(function() {
		$("#modalSubmit").prop("disabled",false);
		$("#modalDelete").prop("disabled",false);
	})
});
$("#modalDelete").on('click',function(e){
	if(readonly) {
		return;
	}
	$.post( "ajax.php?module=calendar&command=delevent", {calendarid: calendarid, eventid: $("#eventid").val()}, function( data ) {
		$("#calendar").fullCalendar( 'refetchEvents' );
	});
});

function validateCalSubmit(data) {
	if($("#title").val().trim().length === 0) {
		return warnInvalid($("#title"),_('Event must have a title'));
	}
	return true;
}

function resetModalForm(){
	$(".time").show();
	$('input[type=checkbox]').prop("checked",false);
	$('select')[0].selectedIndex = 0;
	$('input[type=text]').val('');
	$("#timezone").val('');
	$("#timezone").multiselect('select', '');
	updateReoccurring();
	$("#repeat0").prop("checked",true);
	$("#modalSubmit,#modalDelete").addClass('hidden');
	updateAllDay();
}

function typeformatter(v,r) {
	return drivers[v];
}

function actionformatter(v,r) {
	return '<div class="actions"><a href="?display=calendar&amp;action=view&amp;type=calendar&amp;id='+r.id+'"><i class="fa fa-eye" aria-hidden="true"></i></a><a href="?display=calendar&amp;action=edit&amp;type=calendar&amp;id='+r.id+'"><i class="fa fa-pencil-square-o" aria-hidden="true"></i></a><a class="delAction" href="?display=calendar&amp;action=delete&amp;type=calendar&amp;id='+r.id+'"><i class="fa fa-trash" aria-hidden="true"></i></a></div>';
}
var test = '';
var buttons = {};
if($('#calendar').length && !readonly) {
	buttons = {
			addEvent: {
					text: _('Add Event'),
					click: function() {
						resetModalForm();
						$('#description').val('');
						$("#eventtype").val('');
						$('.dest').addClass('hidden');
						$("#startdate")[0]._flatpickr.setDate(moment(Date.now()).format("YYYY-MM-DD"));
						$("#starttime")[0]._flatpickr.setDate(moment(Date.now()).format("kk:mm:ss"));
						$("#enddate")[0]._flatpickr.setDate(moment(Date.now()).format("YYYY-MM-DD"));
						$("#endtime")[0]._flatpickr.setDate(moment(Date.now()).add(1, 'h').format("kk:mm:ss"));
						$('#eventid').val('new');
						$('#eventModal').modal('show');
						$('#modalDelete').data('id', null);
						updateReoccurring();
						updateAllDay();
						$("#modalSubmit").removeClass('hidden');
					}
			}
	};
}

$(document).ready(function() {
	$(".calform").on('submit',function(e){
		if($('[name="action"]').val() !== "edit" && calnames.indexOf($("#name").val().trim()) > -1){
			warnInvalid($("#name"),_("Calendar names should be unique."));
			return false;
		}
	});

	$("#allday").click(function() {
		if($(this).is(":checked")) {
			$(".time").addClass("hidden");
		} else {
			$(".time").removeClass("hidden");
		}
	});
	var daysOfWeek = moment.weekdays(),
			daysOfWeekShort = moment.weekdaysShort();
	$("#starttime").flatpickr({
		enableTime: true,
		noCalendar: true
	});
	$("#endtime").flatpickr({
		enableTime: true,
		noCalendar: true
	});
	$('#startdate').flatpickr();
	$("#enddate").flatpickr();
	$("#afterdate").flatpickr();

	//Add bootstrap classes to full calendar
	$('.fc-button').addClass('btn btn-default');

	if($('#calendar').length) {
		$('#calendar').fullCalendar({
			dayNames: daysOfWeek,
			dayNamesShort: daysOfWeekShort,
			displayEventEnd: true,
			nextDayThreshold: '00:00:01',
			customButtons: buttons,
			buttonIcons: {
				prev: 'left-single-arrow',
				next: 'right-single-arrow',
				prevYear: 'left-double-arrow',
				nextYear: 'right-double-arrow'
			},
			header: {
				left:	 'prev,addEvent,next',
				center: 'title',
				right:	'month,basicWeek,agendaDay'
			},
			height: 650,
			timezone: caltimezone,
			eventSources: [{
				url: 'ajax.php',
				type: 'GET',
				data: {
					module:'calendar',
					command: 'events',
					calendarid: calendarid
				},
				error: function(){
					fpbxToast(_('There was an error fetching the events'),'','warning');
				},
			}],
			eventClick: function( event, jsEvent, view ) {
				var src = (typeof event.parent !== "undefined") ? event.parent : event,
						tz = (typeof src.timezone !== "undefined" && src.timezone !== null) ? src.timezone : caltimezone,
						ms = moment.unix(src.ustarttime).tz(tz),
						me = moment.unix(src.uendtime).tz(tz),
						allday = src.allDay;
				resetModalForm();
				if(allday) {
					me = me.subtract(1, "days"); //force day to display correctly
				}
				$('#title').val(src.title);
				$('#description').val(src.description);
				if(src.categories.length) {
					$('#categories').val(src.categories.join(','));
				}
				$('#eventid').val(src.linkedid);
				$("#eventtype option[value='"+src.eventtype+"']").prop('selected', true);
				$("#startdate")[0]._flatpickr.setDate(ms.format("YYYY-MM-DD"));
				$("#enddate")[0]._flatpickr.setDate(me.format("YYYY-MM-DD"));
				if(!allday) {
					$("#starttime")[0]._flatpickr.setDate(ms.format("kk:mm:ss"));
					$("#endtime")[0]._flatpickr.setDate(me.format("kk:mm:ss"));
				}
				if(typeof src.timezone !== "undefined") {
					$("#timezone").val(src.timezone);
					$("#timezone").multiselect('select', src.timezone);
				}
				$('#modalDelete').data('id', src.uid);
				$('#eventModal').modal('show');
				if(src.recurring) {
					$("#reoccurring").prop("checked",true);
					if(src.rrules.interval !== "") {
						$("#repeat-count").val(src.rrules.interval);
					}
					if(src.rrules.count !== "") {
						$("#repeat1").prop("checked",true);
						$("#occurrences").val(src.rrules.count);
					}
					if(src.rrules.until !== "") {
						$("#repeat2").prop("checked",true);
						$('#afterdate').val(moment.unix(src.rrules.until).format("YYYY-MM-DD"));
					}
					switch(src.rrules.frequency) {
						case "DAILY":
							$("#repeats").val(0);
						break;
						case "WEEKLY":
							if(src.rrules.interval === "") {
								switch(src.rrules.byday) {
									case "MO,TU,WE,TH,FR":
										$("#repeats").val(1);
									break;
									case "MO,WE,FR":
										$("#repeats").val(2);
									break;
									case "TU,TH":
										$("#repeats").val(3);
									break;
									default:
										$("#repeats").val(4);
									break;
								}
							} else {
								$("#repeats").val(4);
							}
						break;
					}
					var days = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6};
					$.each(src.rrules.days, function(i,v) {
						$("#weekday"+days[v]).prop("checked",true);
					});
				}
				if (readonly) {
					$("#eventForm input").prop("disabled",true);
					$("#eventForm select").prop("disabled",true);
					$("#timezone").multiselect('disable');
				} else {
					$("#eventForm input").prop("disabled",false);
					$("#eventForm select").prop("disabled",false);
					$("#timezone").multiselect('enable');
					$("#modalSubmit,#modalDelete").removeClass('hidden');
				}
				updateReoccurring();
				updateAllDay();
			},
			dayClick: function( event, jsEvent, view ) {
				if(readonly) {
					return;
				}
				resetModalForm();
				$("#startdate")[0]._flatpickr.setDate(event.format("YYYY-MM-DD"));
				$("#starttime")[0]._flatpickr.setDate(moment(Date.now()).format("kk:mm:ss"));
				$("#enddate")[0]._flatpickr.setDate(event.format("YYYY-MM-DD"));
				$("#endtime")[0]._flatpickr.setDate(moment(Date.now()).add(1, 'h').format("kk:mm:ss"));
				$('#eventid').val('new');
				$('#modalSubmit').removeClass('hidden');
				$('#eventModal').modal('show');
				updateAllDay();
			},
			viewRender: function(view, element) {
				$(".fc-left .fc-button-group").append('<span id="loading-bar">&nbsp;Loading...</span>');
			},
			eventAfterAllRender: function(view) {
				$("#loading-bar").remove();
			}
		});
	}

	$("#updatecal").on('click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		$("#updatecal").text(_("Updating...")).attr("disabled", true).addClass("disabled");
		$("body").css("cursor", "progress");
		$.ajax({
			url : "ajax.php?module=calendar",
			data : {
				command: "updatesource",
				calendarid: calendarid
			},
			success: function(data) {
				$("#timezone-display").text(data.timezone);
				$("#calendar").fullCalendar( 'refetchEvents' );
			},
			complete: function(data) {
				$("#updatecal").text(_("Update from Source")).attr("disabled", false).removeClass("disabled");
				$("body").css("cursor", "default");
			},
		});
	});
});

$("#repeat0").click(function() {
	$("#occurrences-container").addClass("hidden");
	$("#after-container").addClass("hidden");
});

$("#repeat1").click(function() {
	$("#occurrences-container").removeClass("hidden");
	$("#after-container").addClass("hidden");
});

$("#repeat2").click(function() {
	$("#after-container").removeClass("hidden");
	$("#occurrences-container").addClass("hidden");
});

$("#reoccurring").click(function() {
	updateReoccurring();
});

$("#repeats").change(function() {
	updateReoccurring();
});

function updateReoccurring() {
	if($("#reoccurring").is(":checked")) {
		$(".reoccurring").removeClass("hidden");
		updateReoccurringOptions();
	} else {
		$(".reoccurring").addClass("hidden");
	}
}

function updateReoccurringOptions() {
	switch($("#repeats").val()) {
		case "4":
			$("#repeat-on-container").removeClass("hidden");
			$("#repeats-every-container").removeClass("hidden");
			$("#repeat-by-container").addClass("hidden");
			$("#countType").text(_("Weeks"));
		break;
		case "0":
			$("#countType").text(_("Days"));
			$("#repeat-on-container").addClass("hidden");
			$("#repeats-every-container").removeClass("hidden");
			$("#repeat-by-container").addClass("hidden");
		break;
		case "1":
		case "2":
		case "3":
			$("#repeat-on-container").addClass("hidden");
			$("#repeats-every-container").addClass("hidden");
			$("#repeat-by-container").addClass("hidden");
		break;
		case "5":
			$("#countType").text(_("Months"));
			$("#repeat-on-container").addClass("hidden");
			$("#repeats-every-container").removeClass("hidden");
			$("#repeat-by-container").removeClass("hidden");
		break;
		case "6":
			$("#countType").text(_("Years"));
			$("#repeat-on-container").addClass("hidden");
			$("#repeats-every-container").addClass("hidden");
			$("#repeat-by-container").addClass("hidden");
		break;
	}
	if($("#repeat1").is(":checked")) {
		$("#occurrences-container").removeClass("hidden");
	} else {
		$("#occurrences-container").addClass("hidden");
	}
	if($("#repeat2").is(":checked")) {
		$("#after-container").removeClass("hidden");
	} else {
		$("#after-container").addClass("hidden");
	}
}

function updateAllDay() {
	if($("#starttime").val() == $("#endtime").val()) {
		$("#allday").prop("checked",true);
		$(".time").addClass("hidden");
	} else {
		$("#allday").prop("checked",false);
		$(".time").removeClass("hidden");
	}
}

function checkduplicate(name,id){
	$.ajax({url: "ajax.php?command=duplicate&module=calendar&value="+name+"&id="+id,
	success: function(result){
		if(result.value == 1){
			alert("Duplicate calendar name ");

		}
	}
	});

}
$("#icalform").submit(function(event) {
	if($("#url").val() == "") {
		return warnInvalid($("#url"),_("Please define a valid url"));
	}
	var result = $.ajax({
		url: "ajax.php?module=calendar&command=checkical",
		type: 'POST',
		async: false,
		data: {url: $("#url").val()}
		});
	obj = JSON.parse(result.responseText);
	if(obj.status) {
		return true;
	} else {
		warnInvalid($("#url"), obj.message);
		event.preventDefault();
		return false;
	}
	return false;

});
