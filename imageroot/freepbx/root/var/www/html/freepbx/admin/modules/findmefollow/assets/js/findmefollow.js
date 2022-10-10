//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
//
$("input[name=needsconf]").click(function() {
	if($("input[name=needsconf]:checked").val() == "CHECKED") {
		$(".fmfm_remotealert_id").prop("disabled",false);
	} else {
		$(".fmfm_remotealert_id").prop("disabled",true);
	}
})

//Agent Quick Select
$("[id^='qsagents']").on('change',function(){
	var taelm = $(this).data('for');
	var cval = $('#'+taelm).val();
	if(cval.length === 0){
		$('#'+taelm).val($(this).val());
		$(this).children('option[value="'+$(this).val()+'"]').remove();
	}else{
		$('#'+taelm).val(cval+"\n"+$(this).val());
		$(this).children('option[value="'+$(this).val()+'"]').remove();
	}
	var ta = document.querySelector('textarea.autosize');
	autosize.update(ta);
});
//FixedCID
$("#changecid").change(function(){
	if($(this).val() == 'fixed'){
		$("#fixedcid").attr('disabled',false);
	}else{
		$("#fixedcid").attr('disabled',true);
	}
});

$(document).ready(function(){
	$("#changecid").change(function(){
				state = (this.value == "fixed" || this.value == "extern") ? "" : "disabled";
		if (state == "disabled") {
			$("#fixedcid").attr("disabled",state);
		} else {
			$("#fixedcid").removeAttr("disabled");
		}
	});
});

$(document).ready(function(){
	$("#changecid").change(function(){
        state = (this.value == "fixed" || this.value == "extern") ? "" : "disabled";
    if (state == "disabled") {
      $("#fixedcid").attr("disabled",state);
    } else {
      $("#fixedcid").removeAttr("disabled");
    }
	});
});
$(document).ready(function(){
	$(document).on('change', "[id^='fmtoggle']",function(){
		var fmstate = "";
		var exten = $(this).data('for');
		if($(this).val() == "CHECKED"){
			fmstate = "disable";
		}else{
			fmstate = "enable";
		}
		$.get("ajax.php?module=findmefollow&command=toggleFM&extdisplay="+exten+"&state="+fmstate, function(data, status){
			if(data.toggle == 'received'){
				if(data.return){
					fpbxToast('Followme '+fmstate+'d',exten,'success');
				}else{
					fpbxToast(_('We received and sent your request but something failed'),exten,'warning');
				}
			}else{
				fpbxToast(_('Request not received'),_('Error'),'error');
			}
		});
	});
	$("input[name=calendar_enable]").change(function(){
		if($(this).val() == "1") {
			$(".calendar").removeClass("hidden");
		} else {
			$(".calendar").addClass("hidden");
		}
	});
	$("#calendar_id, #calendar_group_id").change(function() {
		if($("#calendar_id").val() !== "" && $("#calendar_group_id").val() !== "") {
			$(this).val("");
			warnInvalid($(this),_("You cant set both a group and a calendar"));
		}
	});
});

//Below are functions moved here from page.findmefollow.php

function insertExten() {
	exten = document.getElementById('insexten').value;

	grpList=document.getElementById('grplist');
	if (grpList.value[ grpList.value.length - 1 ] == "\n") {
		grpList.value = grpList.value + exten;
	} else {
		grpList.value = grpList.value + '\n' + exten;
	}

	// reset element
	document.getElementById('insexten').value = '';
}

function checkGRP(theForm) {
	var msgInvalidExtList = _('Please enter an extension list.');
	var msgInvalidTime = _('Invalid time specified');
	var msgInvalidGrpTimeRange = _('Time must be between 1 and 60 seconds');
	var msgInvalidRingStrategy = _('Only ringall, ringallv2, hunt and the respective -prim versions are supported when confirmation is checked');
	var msgInvalidCID =  _('Invalid CID Number. Must be in a format of digits only with an option of E164 format using a leading "+"');

	// set up the Destination stuff
	setDestinations(theForm, 1);

	// form validation
	defaultEmptyOK = false;
	if (isEmpty(theForm.grplist.value))
		return warnInvalid(theForm.grplist, msgInvalidExtList);

	if (!theForm.fixedcid.disabled) {
		fixedcid = $.trim(theForm.fixedcid.value);
		if (!fixedcid.match('^[+]{0,1}[0-9]+$')) {
			return warnInvalid(theForm.fixedcid, msgInvalidCID);
		}
	}

	if (!isInteger(theForm.grptime.value)) {
		return warnInvalid(theForm.grptime, msgInvalidTime);
	} else {
		var grptimeVal = theForm.grptime.value;
		if (grptimeVal < 1 || grptimeVal > 60)
			return warnInvalid(theForm.grptime, msgInvalidGrpTimeRange);
	}

	if (theForm.needsconf.checked && (theForm.strategy.value.substring(0,7) != "ringall" && theForm.strategy.value.substring(0,4) != "hunt")) {
		return warnInvalid(theForm.needsconf, msgInvalidRingStrategy);
	}

	defaultEmptyOK = true;

	if (!validateDestinations(theForm, 1, true))
		return false;

	return true;
}
