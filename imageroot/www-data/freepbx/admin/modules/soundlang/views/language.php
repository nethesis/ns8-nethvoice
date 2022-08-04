<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display no-border">
					<div id="toolbar-all">
					</div>
					<table data-toolbar="#toolbar-all" data-toggle="table" data-pagination="true" data-show-columns="true" data-show-toggle="true" data-search="true" data-cookie="true" data-cookie-id-table="soundlangscookie"  class="table table-striped">
						<thead>
							<tr>
								<th data-sortable="true"><?php echo _("Module")?></th>
								<th data-sortable="true"><?php echo _("Format")?></th>
								<th data-sortable="true"><?php echo _("Available")?></th>
								<th data-sortable="true"><?php echo _("Installed")?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ($packages as $package) { ?>
							<tr>
								<td><?php echo $package['module'] ?></td>
								<td><?php echo $package['format'] ?></td>
								<td><?php echo $package['version'] ?></td>
								<td><?php echo $package['installed'] ?></td>
							</tr>
							<?php } ?>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
