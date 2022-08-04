<?php
if (isset($amp_conf["AMPEXTENSIONS"]) && ($amp_conf["AMPEXTENSIONS"] == "deviceanduser")) {
	$editURL = '?display=users&extdisplay='.ltrim($request['extdisplay'],'GRP-') ;
	$EXTorUSER = _("User");
}else{
	$editURL = '?display=extensions&extdisplay='.ltrim($request['extdisplay'],'GRP-') ;
	$EXTorUSER = _("Extension");
}

?>
<div id="toolbar-fmfm">
<a href="config.php?display=findmefollow" class="btn btn-default <?php echo ($request['view'] == ''? 'hidden':'')?>"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Followme Groups") ?></a>
<a href="<?php echo $editURL?>" class="btn btn-default"><i class="fa fa-external-link"></i>&nbsp; <?php echo $EXTorUSER . " " . ltrim($request['extdisplay'],'GRP-') ?></a>
</div>
<table data-url="ajax.php?module=findmefollow&amp;command=getJSON&amp;jdata=grid" data-cache="false" data-toggle="table" data-search="true" class="table" data-toolbar="#toolbar-fmfm" id="table-all-side">
    <thead>
        <tr>
            <th data-sortable="true" data-field="ext"><?php echo _('Extension')?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
	$("#table-all-side").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=findmefollow&view=form&extdisplay=GRP-'+row['ext'];
	})
</script>
