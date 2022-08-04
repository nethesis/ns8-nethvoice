$(document).ready(function() {
	$('form[name=page_opts_form]').submit(function(){
		var theForm = document.page_opts_form;
		if(typeof theForm.schedulerenableyes !== 'undefined' && theForm.schedulerenableyes.checked){
			if(!moment(theForm.startdatepicker.value, "MM/DD/YYYY", true).isValid()){
				return warnInvalid(theForm.startdatepicker, _("Please enter a valid start Date."));
	                }else{
			        var start_date = moment(theForm.startdatepicker.value, "MM/DD/YYYY");
			}
			if(!moment(theForm.enddatepicker.value, "MM/DD/YYYY", true).isValid()){
			        return warnInvalid(theForm.enddatepicker, _("Please enter a valid end Date."));
			}else{
			        var end_date = moment(theForm.enddatepicker.value, "MM/DD/YYYY");
			}
			if(!start_date.isBefore(end_date)){
				return warnInvalid(theForm.enddatepicker, _("The end date must biger greater the start date."));
	                }
			var allevents = document.getElementsByName("eventids[]");
			for(i = 0;i < allevents.length; i++){
				var event_time_name = "starttimepicker_" + allevents[i].value;
				var tmp_time_valid =false;
				var time_obj = document.getElementById(event_time_name);
				if(time_obj.value != ''){
					var tmp_time_value = '2017-07-01 ' + time_obj.value.trim().toUpperCase().replace("AM", " AM").replace("PM", " PM");
					moment.updateLocale('en',{});
					tmp_time_valid = moment(tmp_time_value,"YYYY-MM-DD LT", true).isValid();
			    	}
				if(tmp_time_valid){
				        var set_event_date = false;
				        var evnet_name  = "eventdayselect_" + allevents[i].value + "[]";
				        var event_days = document.getElementsByName(evnet_name);
				        for(j = 0;j < event_days.length; j++){
					        if(event_days[j].checked){
							set_event_date = true;
						        break;
						}
			   		}
					if(set_event_date == false){
					        return warnInvalid(document.getElementById("event_" + allevents[i].value + "_sunday"), _(" Please set the event days."));
					}
			        }else{
					return warnInvalid(time_obj, _(" Please set the event time."));
				}
			}
		}
		return true;
	});
});

//make devlist heights the same
function dev_list_height() {
	var height = 0;
	$('.device_list').height('auto').each(function(){
		height = $(this).height() > height ? $(this).height() : height;
	}).height(height);
}

function dev_list_item_width() {
	var width = 0;
	$('.device_list > span').each(function(){
		width = $(this).width() > width ? $(this).width() : width;
	});

	$('.device_list > span').width(width);
}
function dev_list_sort() {
	$('.device_list').each(function(){
		var dev_list = $(this);
		var list = dev_list.find('span').sort(function(a, b){
			return $(a).data('ext') > $(b).data('ext') ? 1 : -1;
		})
		$.each(list, function(id, item){
			console.log(item);
			dev_list.append(item);
		})
	});
}

/**
 * limit the amount of devices a page can contain, based on the advanced settings
 * key PAGINGMAXPARTICIPANTS
 * @param string id - id of target
 *
 * @returns bool
 */
function dev_limit(id) {
	if (id == 'notselected_dev') {
		return true;
	}

	//if key isnt set, just return true
	if (typeof fpbx.conf.PAGINGMAXPARTICIPANTS == 'undefined') {
		return true;
	}
	return $('#selected_dev > span').length < fpbx.conf.PAGINGMAXPARTICIPANTS;
}

$(document).ready(function(){
	$("#bnavgrid").bootstrapTable({
		method: 'get',
		url: 'ajax.php?module=paging&command=getJSON&jdata=grid',
		cache: false,
		striped: false,
		showColumns: false,
		columns: [
			{
				title: _("Page Groups"),
				field: 'page_group',
				formatter: bnLinkFormatter,
			}
			]
	});
});

function linkFormatter(value){
	html = '<a href="?display=paging&view=form&extdisplay='+encodeURIComponent(value)+'"><i class="fa fa-edit"></i></a>&nbsp;';
	html += '<a href="?display=paging&action=delete&extdisplay='+encodeURIComponent(value)+'" class="delAction"><i class="fa fa-trash"></i></a>&nbsp;';
	return html;
}
function bnLinkFormatter(value){
	html = '<a href="?display=paging&view=form&extdisplay='+value+'"><i class="fa fa-edit"></i>&nbsp;'+value+'</a>';
	return html;
}
function defaultCheck(val){
	return val;
}

$('#pagegrid').bootstrapTable({
	onCheck: function(row){
		$.get('ajax.php?module=paging&command=setDefault&ext='+row.page_group,function(data,status){console.log(data)});
	},
});

$('#pagelist').multiselect({
		enableFiltering: true,
		includeSelectAllOption: true,
		enableCaseInsensitiveFiltering: true
});
