<?php
/** Run inside the deployed FreePBX container with --apply and a fixture path. */
if (PHP_SAPI !== 'cli' || ($argv[1] ?? '') !== '--apply' || empty($argv[2])) {
    fwrite(STDERR, "Usage: php configure_sample_company.php --apply sample-company.json\n");
    exit(2);
}
$fixture = json_decode(file_get_contents($argv[2]), true, 512, JSON_THROW_ON_ERROR);
if (!isset($fixture['company'], $fixture['profiles']['internal'], $fixture['profiles']['external'])) {
    throw new RuntimeException('Invalid sample company fixture');
}
$bootstrap_settings['freepbx_error_handler'] = false;
define('FREEPBX_IS_AUTH', true);
require '/etc/freepbx.conf';
require_once '/var/www/html/freepbx/admin/modules/satellite/lib/AgentConfigurationBuilder.php';
// Preserve FreePBX's legacy global $db, which needreload() still uses.
$profileDatabase = FreePBX::Database();
$repository = new AgentProfileRepository($profileDatabase);
$profileDatabase->beginTransaction();
try {
    foreach ($fixture['profiles'] as $key => $sample) {
        $stored = $repository->getByKey($key);
        if (!$stored || !$stored['trunk_id']) {
            throw new RuntimeException('Configure a built-in trunk before applying this fixture');
        }
        $input = array(
            'company' => $fixture['company'],
            'language' => $sample['language'],
            'greeting' => $sample['greeting'],
            'prompt' => $sample['prompt'],
            'permissions' => array_replace($stored['permissions'], $sample['company_permissions']),
            'tools' => array_replace($stored['tools'], array('company.get_information' => 'enabled')),
        );
        if (array_intersect_key($stored, $input) != $input) {
            $repository->save($key, $input);
        }
    }
    $profileDatabase->commit();
} catch (Throwable $error) {
    $profileDatabase->rollBack();
    throw $error;
}
// Configuration identity includes company/policy data. Apply native dialplan
// regeneration as well as runtime synchronization before testing a new call.
needreload();
(new AgentConfigurationBuilder(FreePBX::create()))->synchronize();
echo json_encode(array('sample_company_saved' => true, 'profiles' => array('internal', 'external'),
    'native_reload_required' => true), JSON_PRETTY_PRINT) . "\n";
