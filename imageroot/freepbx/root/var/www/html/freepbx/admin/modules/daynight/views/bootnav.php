<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//?>
<div id="toolbar-daynightrnav">
  <a class="btn btn-primary" href="?display=daynight&amp;view=form"><i class="fa fa-plus"></i> <?php echo _("Add Callflow")?></a>
  <a class="btn btn-primary" href="?display=daynight"><i class="fa fa-list"></i> <?php echo _("List Callflows")?></a>

</div>
<table data-url="ajax.php?module=daynight&amp;command=getJSON&amp;jdata=grid"
  data-cache="false"
  data-toggle="table"
  data-search="true"
  data-toolbar="#toolbar-daynightrnav"
  class="table"
  id="table-all-side">
    <thead>
      <tr>
        <th data-sortable="true" data-field="dest"><?php echo _('Call Flow')?></th>
      </tr>
    </thead>
</table>
<script type="text/javascript">
  $("#table-all-side").on('click-row.bs.table',function(e,row,elem){
    var v = row['ext'];
    window.location = '?display=daynight&view=form&itemid='+v+'&extdisplay='+v;
  })
</script>
