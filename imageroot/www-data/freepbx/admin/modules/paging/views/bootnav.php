<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
?>
<div id="toolbar-pagenav">
<a href="config.php?display=paging" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Page Groups") ?></a>
<a href="config.php?display=paging&view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Page Group") ?></a>
</div>
<table data-toolbar="#toolbar-pagenav" data-escape="true" data-url="ajax.php?module=paging&amp;command=getJSON&amp;jdata=grid" data-cache="false" data-toggle="table" data-search="true" class="table" id="table-all-side">
    <thead>
        <tr>
            <th data-sortable="true" data-field="page_group"><?php echo _('Page Group')?></th>
            <th data-sortable="true" data-field="description"><?php echo _('Description')?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
	$("#table-all-side").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=paging&view=form&extdisplay='+row['page_group'];
	})
</script>
