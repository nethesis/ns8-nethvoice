<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
$dataurl = "ajax.php?module=timeconditions&command=getJSON&jdata=tcgrid";
?>
<div id="toolbar-all">
  <a href="config.php?display=timegroups" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Time Groups") ?></a>
  <a href="config.php?display=timeconditions&amp;view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Time Condition") ?></a>
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
            <th data-field="displayname" data-sortable="true"><?php echo _("Time Condition")?></th>
						<th data-field="state" data-sortable="true" data-formatter="tcstateFormatter"><?php echo _("Override State")?></th>
            <th data-field="group" data-formatter="tcLinkedFormatter" data-sortable="true"><?php echo _("Linked Item")?></th>
            <th data-field="timeconditions_id" data-formatter="tcactionFormatter"><?php echo _("Actions")?></th>
        </tr>
    </thead>
</table>
