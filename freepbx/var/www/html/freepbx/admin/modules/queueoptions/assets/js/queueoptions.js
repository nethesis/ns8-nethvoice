function actionformatter(v){
  var html = '<a href="?display=queueoptions&view=form&id='+v+'"><i class="fa fa-edit"></i></a>';
      html += '<a href="?display=queueoptions&action=delete&id='+v+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}

$('input[type=radio]').change(function () {updateDestination();});

function updateDestination(){
    $(':radio').each(function(index,value){
        if ($(this).attr('id').indexOf('_ENABLEDyes') !== -1){
            var postid = $(this).attr('id').substring(0,$(this).attr('id').indexOf('_ENABLEDyes'));
            if ($(this).is(':checked')) {
                $('#'+postid).prop('disabled', false);
                $("[id$="+postid+"].destdropdown").prop('disabled', false);
                $("[id$="+postid+"].destdropdown2").prop('disabled', false);
                console.log(postid + ' is enabled');
            } else {
                $('#'+postid).prop('disabled', true);
                $("[id$="+postid+"].destdropdown").prop('disabled', true);
                $("[id$="+postid+"].destdropdown2").prop('disabled', true);
                console.log(postid + ' is disabled');
            }
        }
    });
}

$( document ).ready(function() {
    updateDestination();
});
