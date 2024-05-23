<?php
//Via action call
//$dataurl = "?display=visualplan&action=getJSON&jdata=grid&quietmode=1";
//Via BMO AJAX call
$dataurl = "ajax.php?module=visualplan&command=getJSON&jdata=grid";
?>

<div class="bs-bars pull-left">
	<div id="toolbar-all">
		<div class="dropdown">
			<a href="/freepbx/visualplan/?did=new_route" target="_blank" class="btn btn-default"><i class="fa fa-plus"></i> <?php echo _("Create new route")?></a>
		</div>
	</div>
</div>

<table id="mygrid" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
	<thead>
		<tr>
			<th data-field="name"><?php echo _("Inbound Routes")?></th>
			<th data-field="link" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
		</tr>
	</thead>
	<tbody>
		<?php foreach ($routes as $key => $value): ?>
			<?php if ($value['extension']): ?>
				<tr>
					<?php $id = $value['extension']. ' / '. ($value['cidnum'] ? $value['cidnum'] : '') ?>
					<td>
						<?php echo $id ?>
					</td>
					<td><?php echo urlencode($id) ?></td>
				</tr>
			<?php endif; ?>
		<?php endforeach; ?>
	</tbody>
</table>
