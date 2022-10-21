$("[id^='qsagents']").on('change',function(){
	var taelm = $(this).data('for');
	var cval = $('#'+taelm).val();
	if(cval.length === 0){
		$('#'+taelm).val($(this).val()+",0");
		$(this).children('option[value="'+$(this).val()+'"]').remove();
	}else{
		$('#'+taelm).val(cval+"\n"+$(this).val()+",0");
		$(this).children('option[value="'+$(this).val()+'"]').remove();
	}
});

function insertExten(type) {
	exten = document.getElementById(type+'insexten').value;

	grpList=document.getElementById(type+'members');
	if (grpList.value[ grpList.value.length - 1 ] == "\n") {
		grpList.value = grpList.value + exten + ',0';
	} else {
		grpList.value = grpList.value + '\n' + exten + ',0';
	}

	// reset element
	document.getElementById(type+'insexten').value = '';
}

function checkQ(theForm) {
	var bad = false;
	var msgWarnRegex = _("Using a Regex filter is fairly advanced, please confirm you know what you are doing or leave this blank");

	var whichitem = 0;
	while (whichitem < theForm.goto0.length) {
		if (theForm.goto0[whichitem].checked) {
			theForm.goto0.value=theForm.goto0[whichitem].value;
		}
		whichitem++;
	}

	if (!isInteger(theForm.account.value)) {
		alert(_("Queue Number must not be blank"));
		bad=true;
	}

	defaultEmptyOK = false;
/*
	<?php if (function_exists('module_get_field_size')) { ?>
		var sizeDisplayName = "<?php echo module_get_field_size('queues_config', 'descr', 35); ?>";
		if (!isCorrectLength(theForm.name.value, sizeDisplayName))
			return warnInvalid(theForm.name, "<?php echo _('The Queue Name provided is too long.'); ?>")
	<?php } ?>
*/
	if (!isAlphanumeric(theForm.name.value)) {
		alert(_("Queue name must not be blank and must contain only alpha-numeric characters"));
		bad=true;
	}
	if (!isEmpty(theForm.qregex.value)) {
		if (!confirm(msgWarnRegex)) {
			bad=true;
		}
	}

	return !bad;
}

function breakoutDisable() {
	breakouttype = document.getElementById('breakouttype');

	for (var i = 0; i < breakouttype.length; i++) {
		/* Disable everything */
		document.getElementById(breakouttype.options[i].value).disabled = true;
	}

	/* Re-enable the active one */
	document.getElementById(breakouttype.value).disabled = false;
}

function linkFormatterGroup(value, row, index){
    var html = '<a href="?display=queues&view=form&extdisplay='+row[0]+'"><i class="fa fa-edit"></i></a>';
    html += '&nbsp;<a href="?display=queues&action=delete&account='+row[0]+'" class="delAction"><i class="fa fa-trash"></i></a>';
    return html;
}
