<?php
	if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
?>
<div id="toolbar-qrnav">
	<a href="config.php?display=epm_templates" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Tempalte Custom") ?></a>
</div>
<table 
	data-url="ajax.php?module=endpointman&amp;module_sec=epm_templates&amp;module_tab=manager&amp;command=list_current_template"
	data-cache="false"
    data-toolbar="#toolbar-qrnav"
    data-toggle="table"
    data-search="true" 
    class="table table-hover"
	id="table-all-side">
	<thead>
		<tr>
			<th data-sortable="true" data-field="name"><?php echo _("Template Name")?></th>
			<th data-sortable="true" data-field="model_class"><?php echo _("Model Classification")?></th>
			<th data-sortable="true" data-field="model_clone"><?php echo _("Model Clone")?></th>
		</tr>
	</thead>
	<tbody>
	</tbody>
</table>
<br />