$(document).ready(function() { //start ready function

$('#hbutton').click(function() {
  if($('#help').is(':visible'))
    $('#help').hide('normal');
  else
    $('#help').show('normal');
    }
);

function hideSuccess()
{
  $('#success').fadeOut('slow');
}

$('#saveOptions').click(function () {
  startWaiting();
  $.get("action.php", {
      action: 'saveOptions',
      internal_call: $('#internal_call').is(':checked'),
      groupcalls: $('#groupcalls').is(':checked'),
      externalcalls: $('#externalcalls').is(':checked'),
      internal_call_nocheckin: $('#internal_call_nocheckin').is(':checked'),
      prefix: $('#prefix').val(),
      ext_pattern: $('#ext_pattern').val(),
      reception: $('#reception').val(),
      enableclean: $('#enableclean').is(':checked'),
      clean: $('#clean').is(':checked'),
      reception_lang: $('#reception-lang-select').val()

  }, function (data) {
    $('#success').fadeIn('slow');
    setTimeout(hideSuccess,5000);
    stopWaiting();
  });
  return false;
});

}); //end ready function
