<div id="toolbar-rnav">
<a href="?display=vmblast" class="btn btn-default"><i class="fa fa-list"></i>&nbsp;<?php echo _("List VM Blast Groups")?></a>
<a href="?display=vmblast&view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp;<?php echo _("Add VM Blast Group")?></a>
</div>
<table data-url="ajax.php?module=vmblast&command=getJSON&jdata=grid" data-cache="false" data-toggle="table" data-search="true" class="table" id="table-all-side" data-toolbar="#toolbar-rnav">
    <thead>
        <tr>
            <th data-sortable="true" data-field="description" data-formatter="vmbformatter"><?php echo _('VMBlast Group')?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
	$("#table-all-side").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=vmblast&view=form&extdisplay='+row['extension'];
	})
  function vmbformatter(v,r){
    return v+' ('+r['extension']+')';
  }
</script>
