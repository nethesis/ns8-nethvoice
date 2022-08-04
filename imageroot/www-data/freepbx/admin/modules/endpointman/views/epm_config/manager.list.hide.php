<?php
	if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
?>

<div class="alert alert-info" role="alert">
	<h3><?php echo _("Hidden Packages") ?></h3>
    <div class="input-group">
        <span class="input-group-addon"><?php echo _("Hidden Brands:") ?></span>
        <select 
			data-url="ajax.php?module=endpointman&amp;module_sec=epm_config&amp;module_tab=manager&amp;command=list_brand_model_hide"
            data-cache="false"
            data-id = ""
			data-label = ""
            data-selected-text-format="count > 4"
            data-size="10"
            data-style="" 
            data-live-search-placeholder="<?php echo _("Search") ?>"" 
            data-live-search="true" 
            data-done-button="true"
            class="selectpicker show-tick form-control"
            id="epm_config_manager_select_hidens" 
            name="epm_config_manager_select_hidens"
            multiple>
        </select>
        <span class="input-group-addon"><span class="help"><i class="fa fa-question-circle"></i><span style="display: none;"><?php echo _("This list contains all the Brands <br /> that have been hidden.  Clicking on any of them will unhide them.") ?></span></span></span>
    </div>
</div>
