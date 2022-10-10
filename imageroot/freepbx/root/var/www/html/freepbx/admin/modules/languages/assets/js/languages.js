function checkLanguage(theForm) {
	var msgInvalidDescription = _('Invalid description specified');
	var tmp_name = $('input[name=description]')[0].value.trim();

	// set up the Destination stuff
	setDestinations(theForm, '_post_dest');

	// form validation
	defaultEmptyOK = false;
	if (isEmpty(theForm.description.value))
		return warnInvalid(theForm.description, msgInvalidDescription);

	if (!validateDestinations(theForm, 1, true))
		return false;

	if($.inArray(tmp_name, description) != -1)

		return warnInvalid($('input[name=description]'),  sprintf(_("%s already used, please use a different description."),tmp_name));
	return true;
}
