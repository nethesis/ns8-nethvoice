<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div id="toolbar-all">
				<button type="button" class="btn btn-primary btn-lg" data-toggle="modal" data-target="#AddDlgModal"><i class='fa fa-plus'></i> <?php echo _('Add Custom OUI')?></button>
				<a class='btn btn-default' href="javascript:epm_advanced_tab_oui_manager_refresh_table();" ><i class='fa fa-refresh fa-spin'></i> <?php echo _('Refresh Table')?></a>
			</div>
			<table id="mygrid"
				data-url="ajax.php?module=endpointman&amp;module_sec=epm_advanced&amp;module_tab=oui_manager&amp;command=oui"
				data-cache="false"
				data-cookie="true"
				data-cookie-id-table="oui_manager-all"
				data-toolbar="#toolbar-all"
				data-maintain-selected="true"
				data-show-columns="true"
				data-show-toggle="true"
				data-toggle="table"
				data-pagination="true"
				data-search="true"
				data-sort-name="oui"
				class="table table-striped">
				<thead>
					<tr>
						<th data-field="oui" data-sortable="true" data-formatter="<code>%s</code>"><?php echo _("OUI")?></th>
						<th data-field="brand" data-sortable="true"><?php echo _("Brand")?></th>
						<th data-field="custom" data-formatter="epm_advanced_tab_oui_manager_grid_customFormatter"><?php echo _("Type")?></th>
						<th data-field="id" data-formatter="epm_advanced_tab_oui_manager_grid_actionFormatter"><?php echo _("Actions")?></th>
					</tr>
				</thead>
			</table>
		</div>
	</div>
</div>