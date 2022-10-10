//This format's the action column
function linkFormatter(value,row) {
  var html = '<a href="?display=rapidcode&view=form&id=' + row.id + '"><i class="fa fa-edit"></i></a>&nbsp;';
  html += '<a class="delAction" href="?display=rapidcode&action=delete&id=' + row.id + '"><i class="fa fa-trash"></i></a>';
  return html;
}

$("document").ready(function(){

    $("#fileupload").change(function() {
        $("#filenamelabel").show();
        var text = $("#fileupload").val().replace('C:\\fakepath\\','');
        $("#filename").text(text);
    });
});

