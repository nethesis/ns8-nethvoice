$(document).ready(function() {
	$('form').unbind( "submit");
	$('form[name=setcid]').submit(function() {
		var tmp_description = $('input[name=description]')[0].value.trim();
		if (!isAlphanumeric(tmp_description)){
			return warnInvalid($('input[name=description]'), _("Please enter a valid Description."));
		}else{
			if($.inArray(tmp_description, setcid_descriptions) != -1){
				return warnInvalid($('input[name=description]'), tmp_description  + _(" already used, please use a different Description."));
			}
		}
		if($('select[name=goto0]')[0].value == ''){
			return warnInvalid($('select[name=goto0]'), _("Please select an item."));
		}
		return true;
	});
	$('form').submit(function(e) {
		if (!e.isDefaultPrevented()){
			$(".destdropdown2").filter(".hidden").remove();
		}
	});
});
