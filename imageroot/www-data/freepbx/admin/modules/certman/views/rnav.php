<div id="toolbar-certman">
	<a href='?display=certman' class="btn btn-default"><i class="fa fa-th-list"></i>&nbsp;&nbsp;<?php echo _('Certificate List')?></a>
</div>
<table data-url="ajax.php?module=certman&command=getJSON&jdata=grid" data-cache="false" data-toggle="table" data-toolbar="#toolbar-certman" data-search="true" class="table" id="table-all-side">
    <thead>
        <tr>
            <th data-sortable="true" data-field="cid" data-formatter='certmanformatter'><?php echo _('Certificate')?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
	function certmanformatter(v,r){
		return '<a href="?display=certman&action=view&id='+v+'">'+r['basename']+" ("+r['description']+')</a>';
	}
</script>
