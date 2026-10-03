<?php
/** Read-only policy export for sample_company_test.py. Excludes bindings/secrets. */
if (PHP_SAPI !== 'cli') {
    exit(2);
}
$bootstrap_settings['freepbx_error_handler'] = false;
define('FREEPBX_IS_AUTH', true);
require '/etc/freepbx.conf';
require_once '/var/www/html/freepbx/admin/modules/satellite/lib/AgentProfileRepository.php';
$export = array();
foreach ((new AgentProfileRepository(FreePBX::Database()))->listAll() as $profile) {
    $export[$profile['profile_key']] = array_intersect_key($profile,
        array_flip(array('company', 'permissions', 'tools')));
}
echo json_encode($export, JSON_THROW_ON_ERROR) . "\n";
