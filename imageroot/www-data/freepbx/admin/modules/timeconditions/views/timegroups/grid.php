<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
$dataurl = "ajax.php?module=timeconditions&command=getJSON&jdata=tggrid";

?>
<div id="toolbar-all">
  <a href="config.php?display=timeconditions" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Time Conditions") ?></a>
  <a href="config.php?display=timegroups&amp;view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Time Group") ?></a>
  <span class="btn btn-info disabled">
  	<b><?php echo _("Server time:")?></b> <span id="idTime" data-time="<?php echo time()?>" data-zone="<?php echo date("e")?>"><?php echo _("Not received")?></span>
  </span>
</div>
 <table id="tgtable"
        data-url="<?php echo $dataurl?>"
        data-cache="false"
        data-toolbar="#toolbar-all"
        data-maintain-selected="true"

        data-toggle="table"
        data-pagination="true"
        data-search="true"
        class="table table-striped">
    <thead>
            <tr>
            <th data-field="text" data-sortable="true"><?php echo _("Time Group")?></th>
            <th data-field="value" data-formatter="actionFormatter"><?php echo _("Actions")?></th>
        </tr>
    </thead>
</table>
