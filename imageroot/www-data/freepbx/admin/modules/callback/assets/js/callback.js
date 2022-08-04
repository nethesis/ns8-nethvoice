var theForm = document.edit;
if(typeof theForm !== 'undefined'){
	theForm.description.focus();
}

$(document).ready(function() {
	$('form').unbind( "submit");
	$('form[name=edit]').submit(function(e) {
		setDestinations(edit,1);
                defaultEmptyOk = false;
                var sizeDisplayName = 50;
                if (!isCorrectLength(theForm.description.value, sizeDisplayName))
                    return warnInvalid(theForm.description, _('The callback description provided is too long.'));
                if (!isAlphanumeric(theForm.description.value)){
			return warnInvalid(theForm.description, _("Please enter a valid Description"));
		}else{
			if($.inArray(theForm.description.value, callback_names) != -1){
	                         return warnInvalid(theForm.description, theForm.description.value  + _(" already used, please use a different description."));
			}
		}
			
		if (!validateDestinations(edit,1,true))
		        return false;
		return true;
          });
	$('form').submit(function(e) {
		if (!e.isDefaultPrevented()){
			$(".destdropdown2").filter(".hidden").remove();
		}
	});

});
function linkFormatter(value){
	var html = '<a href="?display=callback&view=form&itemid='+value+'"><i class="fa fa-pencil"></i></a>';
	html += '&nbsp;<a href="?display=callback&action=delete&itemid='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';    
	return html;
}
