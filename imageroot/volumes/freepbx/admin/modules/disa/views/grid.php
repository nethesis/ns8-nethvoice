<?php
$dataurl = "ajax.php?module=disa&command=getJSON&jdata=grid";
?>
<div id="toolbar-all">
  <a href='?display=disa&view=form' class="btn btn-default"><i class="fa fa-plus"></i> <?php echo _("Add DISA")?></a>
</div>
<table id="disagrid" data-url="<?php echo $dataurl?>" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
  <thead>
    <tr>
      <th data-field="displayname"><?php echo _("DISA")?></th>
      <th data-field="disa_id" data-formatter="linkFormatter" class="col-md-2"><?php echo _("Actions")?></th>
    </tr>
  </thead>
</table>
<script type="text/javascript">
function linkFormatter(value, row, index){
  var html = '<a href="?display=disa&view=form&itemid='+value+'"><i class="fa fa-pencil"></i></a>';
  html += '&nbsp;<a href="?display=disa&action=delete&itemid='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}
</script>
