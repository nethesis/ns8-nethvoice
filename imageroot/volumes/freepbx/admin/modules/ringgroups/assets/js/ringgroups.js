//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
//Agent Quick Select
$("[id^='qsagents']").on('change',function(){
	if($(this).val().length) {
		var taelm = $(this).data('for');
		var cval = $('#'+taelm).val();
		if(cval.length === 0){
			$('#'+taelm).val($(this).val());
			$(this).children('option[value="'+$(this).val()+'"]').remove();
		}else{
			$('#'+taelm).val(cval+"\n"+$(this).val());
			$(this).children('option[value="'+$(this).val()+'"]').remove();
		}
	}
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
	var msgInvalidGrpNum = _('Invalid Group Number specified');
	var msgInvalidExtList = _('Please enter an extension list.');
	var msgInvalidTime = _('Invalid time specified');
	var msgInvalidGrpTimeRange = _('Time must be between 1 and 300 seconds');
	var msgInvalidDescription = _('Please enter a valid Group Description');
	var msgInvalidRingStrategy = _('Only ringall, ringallv2, hunt and the respective -prim versions are supported when confirmation is checked');
	var msgInvalidCID = _("Invalid CID");

	// set up the Destination stuff
	setDestinations(theForm, 1);

	// form validation
	defaultEmptyOK = false;
	if (!isInteger(theForm.account.value)) {
		return warnInvalid(theForm.account, msgInvalidGrpNum);
	}

	defaultEmptyOK = false;

	if (!isAlphanumeric(theForm.description.value))
		return warnInvalid(theForm.description, msgInvalidDescription);

	if (isEmpty(theForm.grplist.value))
		return warnInvalid(theForm.grplist, msgInvalidExtList);

	if(theForm.grplist.length > 255){
		return warnInvalid(theForm.grplist, _("The group list can only contain a maximum of 255 characters."));
	}

	if (!theForm.fixedcid.disabled) {
		fixedcid = $.trim(theForm.fixedcid.value);
		if(!fixedcid.match('^[+]{0,1}[0-9]+$')) {
			return warnInvalid(theForm.fixedcid, msgInvalidCID);
		}
	}

	defaultEmptyOK = false;
	if (!isInteger(theForm.grptime.value)) {
		return warnInvalid(theForm.grptime, msgInvalidTime);
	} else {
		var grptimeVal = theForm.grptime.value;
		if (grptimeVal < 1 || grptimeVal > 300)
			return warnInvalid(theForm.grptime, msgInvalidGrpTimeRange);
	}

	if (theForm.needsconf.checked && (theForm.strategy.value.substring(0,7) != "ringall" && theForm.strategy.value.substring(0,4) != "hunt")) {
		return warnInvalid(theForm.needsconf, msgInvalidRingStrategy);
	}

	if (!validateDestinations(theForm, 1, true))
		return false;

	return true;
}
