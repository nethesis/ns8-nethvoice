<?php
$dataurl = "ajax.php?module=disa&command=getJSON&jdata=grid";
?>
<div id="toolbar-rnav">
  <a href='?display=disa&view=form' class="btn btn-default"><i class="fa fa-plus"></i> <?php echo _("Add DISA")?></a>
  <a href='?display=disa' class="btn btn-default"><i class="fa fa-list"></i> <?php echo _("DISA List")?></a>
</div>
<table id="disagridrnav"
      data-url="<?php echo $dataurl?>"
      data-cache="false"
      data-toolbar="#toolbar-rnav"
      data-toggle="table"
      data-search="true"
      class="table">
  <thead>
    <tr>
      <th data-field="displayname" class="col-md-2"><?php echo _("DISA")?></th>
    </tr>
  </thead>
</table>

<script type="text/javascript">
	$("#disagridrnav").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=disa&view=form&itemid='+row['disa_id'];
	})
</script>
