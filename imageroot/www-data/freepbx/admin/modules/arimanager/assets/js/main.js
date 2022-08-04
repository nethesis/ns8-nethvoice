var type = $('select[name="password_type"]').val();
$('#ariform').submit(function( event ) {
	if($('input[name="name"]').val().length === 0) {
		alert(_("User Name Can Not Be Blank!"));
		event.preventDefault();
		$('input[name="name"]').focus();
		return false;
	}
	if($('input[name="password"]').val().length === 0) {
		alert(_("User Password Can Not Be Blank!"));
		event.preventDefault();
		$('input[name="password"]').focus();
		return false;
	}
	if($('input[name="password"]').val() == '******' && ($('select[name="password_type"]').val() != type)) {
		alert(_("You Cant Change Password Type Without Changing the Password"));
		event.preventDefault();
		$('input[name="password"]').focus();
		return false;
	}
	if(jQuery.inArray( $('input[name="name"]').val(), users) >= 0 || $('input[name="name"]').val() == freepbxuser) {
		alert(_("User Name already exists!"));
		event.preventDefault();
		$('input[name="name"]').focus();
		return false;
	}
});

$("#ariusergrid-side").on("click-row.bs.table", function(row, $element) {
	window.location = "?display=arimanager&view=form&user="+$element.id;
});
