function actionformatter(v){
  var html = '<a href="?display=pin&view=form&extension='+v+'"><i class="fa fa-edit"></i></a>';
      html += '<a href="?display=pin&action=delete&extension='+v+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}

