var theForm = document.prompt;

function prompt_onsubmit() {
	var msgInvalidPassword = _('Please enter a valid numeric password, only numbers are allowed');
	var msgInvalidgoto0 = _('Please set the Normal Flow destination');
	var msgInvalidgoto1 = _('Please set the Override Flow destination');
	var msgInvalidstate = _('Please set the Current Mode');
	defaultEmptyOK = true;
	if(theForm.goto0.value === '')
		return warnInvalid(theForm.goto0,msgInvalidgoto0);
	if(theForm.goto1.value === '')
		return warnInvalid(theForm.goto1,msgInvalidgoto1);
	if(theForm.state.value === '')
		return warnInvalid(theForm.state,msgInvalidstate);
	if (!isInteger(theForm.password.value))
		return warnInvalid(theForm.password, msgInvalidPassword);
	return true;
}

$("#daynightgrid").on("post-body.bs.table", function () {
	$(".deleteitem").off("click");
	$(".deleteitem").click(function(e) {
		if(!confirm(_("Are you sure you want to delete this flow?"))) {
			e.preventDefault();
			e.stopPropagation();
		}
	});
});
