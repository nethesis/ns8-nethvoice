<?php
	if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
	
	$sql = 'SELECT * from endpointman_brand_list WHERE id > 0 ORDER BY name ASC';
	$brands = sql($sql, 'getAll', DB_FETCHMODE_ASSOC);
	unset ($sql);
	
	echo load_view(__DIR__.'/epm_advanced/oui_manager.views.grid.php', array('request' => $_REQUEST));
	echo load_view(__DIR__.'/epm_advanced/oui_manager.views.new.modal.php', array('request' => $_REQUEST, 'brands' => $brands));
	
	unset ($brands);
	return;
?>