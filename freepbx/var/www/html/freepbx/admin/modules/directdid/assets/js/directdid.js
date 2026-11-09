function actionformatter(v){
  var html = '<a href="?display=directdid&view=form&id='+v+'"><i class="fa fa-edit"></i></a>';
      html += '<a href="?display=directdid&action=delete&id='+v+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}

