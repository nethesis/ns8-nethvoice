//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2016 Sangoma Technologies.
//

function checkAnnouncement(theForm) {
  var msgInvalidDescription = _('Invalid description specified');

  // set up the Destination stuff
  setDestinations(theForm, '_post_dest');

  // form validation
  defaultEmptyOK = false;
  if (isEmpty(theForm.description.value))
    return warnInvalid(theForm.description, msgInvalidDescription);
	if (announcementnames.indexOf($("#description").val()) >= 0) {
				return warnInvalid($("#description"),_("Announcement Description Already Exist"));
	}
  if (!validateDestinations(theForm, 1, true))
    return false;

  return true;
}

$("#announcegrid-side").on('click-row.bs.table',function(e,row,elem){
	window.location = '?display=announcement&view=form&extdisplay='+row['announcement_id'];
});

function actionformatter(v,r){
  var html = '<a href="?display=announcement&view=form&extdisplay='+v+'"><i class="fa fa-edit"></i></a>';
      html += '<a href="?display=announcement&action=delete&extdisplay='+v+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}
function aDestFormatter(value){
	if(value === null || value.length == 0){
		return _("No Destination");
	}else{
		if(typeof destinations[value] !== "undefined") {
			if(typeof destinations[value].edit_url !== "undefined" && destinations[value].edit_url !== false) {
				return '<a href="' + destinations[value].edit_url + '">' + destinations[value].name + ": " + destinations[value].description + '</a>';
			} else {
				return destinations[value].name + ": " + destinations[value].description;
			}
		} else {
			return value;
		}
	}
}
