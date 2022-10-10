function checkForm(theForm) {
  var msgInvalidDescription = _('Invalid description specified');
  var msgInvalidText = _('Invalid text specified');
  var msgInvalidName = _('Invalid name specified');
  
  // form validation
  defaultEmptyOK = false;
  if (isEmpty(theForm.description.value))
    return warnInvalid(theForm.description, msgInvalidDescription);

  if (isEmpty(theForm.text.value))
    return warnInvalid(theForm.text, msgInvalidText);

  if (isEmpty(theForm.name.value))
    return warnInvalid(theForm.name, msgInvalidName);

  return true;
}

function actionformatter(v){
  var html = '<a href="?display=googletts&view=form&id='+v+'"><i class="fa fa-edit"></i></a>';
      html += '<a href="?display=googletts&action=delete&id='+v+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}

