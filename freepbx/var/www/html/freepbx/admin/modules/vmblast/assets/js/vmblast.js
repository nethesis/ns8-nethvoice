//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
function checkGRP(theForm) {
	var msgInvalidGrpNum = ('Invalid Group Number specified');
	var msgInvalidGrpNumStartWithZero = ('Group numbers with more than one digit cannot begin with 0');
	var msgInvalidExtList = ('Please enter an extension list.');
	var msgInvalidDescription = ('Please enter a valid Group Description');
	var msgInvalidPassword = ('Please enter a valid numeric password, only numbers are allowed');

	// form validation
	defaultEmptyOK = false;
	if (!isInteger(theForm.account.value)) {
		return warnInvalid(theForm.account, msgInvalidGrpNum);
	} else if (theForm.account.value.indexOf('0') === 0 && theForm.account.value.length > 1) {
		return warnInvalid(theForm.account, msgInvalidGrpNumStartWithZero);
	}

	defaultEmptyOK = true;
	if (!isInteger(theForm.password.value))
		return warnInvalid(theForm.password, msgInvalidPassword);

	defaultEmptyOK = false;

	if (!isAlphanumeric(theForm.description.value))
		return warnInvalid(theForm.description, msgInvalidDescription);

	var selected = 0;
	for (var i=0; i < theForm.xtnlist.options.length; i++) {
		if (theForm.xtnlist.options[i].selected) selected += 1;
	}
	if (selected < 1) {
    theForm.xtnlist.focus();
		alert(msgInvalidExtList);
		return false;
	}

	return true;
}
$('#xtnlist').multiselect();
