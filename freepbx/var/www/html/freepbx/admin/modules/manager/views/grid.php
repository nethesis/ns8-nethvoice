<?php
$dataurl = "ajax.php?module=manager&command=getJSON&jdata=grid";
?>
<div id="toolbar-all">
  <a href="?type=tool&display=manager&view=form" class="btn btn-default"><i class="fa fa-plus"></i> <?php echo _("Add Manager")?></a>
</div>
 <table id="managersgrid" data-url="<?php echo $dataurl?>" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
    <thead>
            <tr>
            <th data-field="name"><?php echo _("Name")?></th>
            <th data-field="deny"><?php echo _("Deny")?></th>
            <th data-field="permit"><?php echo _("Permit")?></th>
            <th data-field="name" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
function linkFormatter(value){
  var html = '<a href="?type=tool&display=manager&managerdisplay='+value+'&view=form"><i class="fa fa-pencil"></i></a>';
  html += '&nbsp;<a href="?display=manager&action=delete&managerdisplay='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
  return html;
}
</script>
