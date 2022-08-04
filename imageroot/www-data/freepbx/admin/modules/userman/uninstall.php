<?php
out('Remove all User Management tables');
$tables = array('userman_users', 'userman_users_settings', 'userman_groups', 'userman_groups_settings');
foreach ($tables as $table) {
	$sql = "DROP TABLE IF EXISTS {$table}";
	$result = $db->query($sql);
	if (DB::IsError($result)) {
		die_freepbx($result->getDebugInfo());
	}
	unset($result);
}
