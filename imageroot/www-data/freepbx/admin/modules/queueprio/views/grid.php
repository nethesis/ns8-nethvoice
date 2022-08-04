<?php
$dataurl = "ajax.php?module=queueprio&command=getJSON&jdata=grid";
?>
<div id="toolbar-all">
  <a href="?display=queueprio&view=form" class="btn btn-default"><i class="fa fa-plus"></i> <?php echo _("Add Priority")?></a>
</div>
<table id="queuepriogrid" data-url="<?php echo $dataurl?>" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
  <thead>
    <tr>
      <th data-field="description"><?php echo _("Priority")?></th>
      <th data-field="queueprio_id" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
    </tr>
  </thead>
</table>
<script type="text/javascript">
function linkFormatter(value, row, index){
  var html = '<a href="?display=queueprio&view=form&extdisplay='+value+'"><i class="fa fa-pencil"></i></a>';
  html += '&nbsp;<a href="?display=queueprio&action=delete&queueprio_id='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}
</script>
