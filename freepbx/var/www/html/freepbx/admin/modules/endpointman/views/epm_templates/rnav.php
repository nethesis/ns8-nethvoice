<?php
	if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
?>
<div id="toolbar-all-side">
	<a href="config.php?display=epm_templates" class="btn"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Tempalte Custom") ?></a>
</div>
<table id="templates-side"
	data-url="ajax.php?module=endpointman&amp;module_sec=epm_templates&amp;module_tab=manager&amp;command=list_current_template"
	data-cache="false"
	data-cookie="true"
	data-cookie-id-table="template_custom_table"
	data-toolbar="toolbar-all-side"
	data-toggle="table"
	class="table">
	<thead>
		<tr>
			<th data-sortable="true" data-field="name" data-formatter="epm_templates_rnav_format"><?php echo _("Template Name")?></th>
			<th data-sortable="true" data-field="model_class" data-formatter="epm_templates_rnav_format"><?php echo _("Model Classification")?></th>
			<th data-sortable="true"data-field="model_clone" data-formatter="epm_templates_rnav_format"><?php echo _("Model Clone")?></th>
		</tr>
	</thead>
	<tbody>
	</tbody>
</table>