<?php
	if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
	
	if ($_REQUEST['subpage'] != "editor") {
		echo "Pagina no valida!";
		return;
	}
	
	$product_list = "SELECT * FROM endpointman_product_list WHERE id > 0";
	$product_list =& sql($product_list,'getAll', DB_FETCHMODE_ASSOC);
	
	$mac_list = "SELECT * FROM endpointman_mac_list";
	$mac_list =& sql($mac_list, 'getAll', DB_FETCHMODE_ASSOC);
	
	if((!$product_list) && (!$mac_list)) {
		echo '<div class="alert alert-warning" role="alert">';
		echo '<strong>'._("Warning!").'</strong>'.(" Welcome to Endpoint Manager. You have no products (Modules) installed, click").' <a href="config.php?display=epm_config"><b>'._("here").'</b></a> '._(" to install some");
		echo '</div>';
		return;
	}
	elseif(!$product_list) {
		echo '<div class="alert alert-warning" role="alert">';
		echo '<strong>'._("Warning!").'</strong>'.(" Thanks for upgrading to version 2.0! Please head on over to ").' <a href="config.php?display=epm_config"><b>'._("Brand Configurations/Setup").'</b></a> '._(" to setup and install phone configurations");
		echo '</div>';
		return;
	}
	unset ($product_list);
	unset ($mac_list);
	
	
	if ((! isset($_REQUEST['idsel'])) || (! isset($_REQUEST['custom'])))
	{
		echo '<div class="alert alert-warning" role="alert">';
		echo '<strong>'._("Warning!").'</strong>'.(" No select ID o Custom!");
		echo '</div>';
		return;
	}
	$dtemplate = FreePBX::Endpointman()->epm_templates->edit_template_display($_REQUEST['idsel'],$_REQUEST['custom']);
	
	echo load_view(__DIR__.'/epm_templates/editor.views.template.php', array('request' => $_REQUEST, 'dtemplate' => $dtemplate ));
	echo load_view(__DIR__.'/epm_templates/editor.views.dialog.cfg.global.php', array('request' => $_REQUEST));
	echo load_view(__DIR__.'/epm_templates/editor.views.dialog.edit.cfg.php', array('request' => $_REQUEST, 'dtemplate' => $dtemplate ));
	
	unset ($dtemplate);
?>